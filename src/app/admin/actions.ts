'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getAuthClient,
} from '@/app/api/auth/_shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  clearSessionCookies,
  requireAdminAction,
  setSessionCookies,
} from './_lib/auth';

const updateQuestionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(3).max(220),
  difficulty: z.enum(['junior', 'mid', 'senior']),
  freePreview: z.boolean(),
});

const deleteEntitySchema = z.object({
  id: z.string().uuid(),
});

const createTopicSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid('Please select a topic category.'),
  icon: z.string().trim().max(64).optional(),
});

const updateTopicSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid('Please select a topic category.'),
  icon: z.string().trim().max(64).optional(),
});

const createTopicCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  icon: z.string().trim().max(64).optional(),
});

const updateTopicCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().max(120).optional(),
  icon: z.string().trim().max(64).optional(),
});

const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['user', 'admin']),
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
});

const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
      .regex(/[0-9]/, 'Password must include at least one number.'),
    confirmPassword: z.string().min(1),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

function toBoolean(value: FormDataEntryValue | null): boolean {
  if (typeof value !== 'string') return false;
  return value === 'on' || value === 'true' || value === '1';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function normalizeSlug(raw: string | undefined, fallbackName: string): string {
  if (!raw) return slugify(fallbackName);
  const trimmed = raw.trim();
  if (!trimmed) return slugify(fallbackName);
  return slugify(trimmed);
}

function normalizeOptionalText(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function redirectTopicFeedback(status: 'success' | 'error', message: string): never {
  redirect(`/admin/topics?status=${status}&message=${encodeURIComponent(message)}`);
}

async function validateTopicCategory(supabase: ReturnType<typeof createSupabaseServerClient>, categoryId: string) {
  const { data, error } = await supabase
    .from('topic_categories')
    .select('id')
    .eq('id', categoryId)
    .maybeSingle();

  if (error?.code === '42P01') {
    return { ok: false as const, message: 'topic_categories table is missing. Please create it first.' };
  }
  if (error) {
    return { ok: false as const, message: error.message || 'Failed to validate topic category.' };
  }
  if (!data) {
    return { ok: false as const, message: 'Selected topic category does not exist.' };
  }

  return { ok: true as const };
}

export async function adminLogoutAction() {
  await clearSessionCookies();
  redirect('/admin/login');
}

export async function updateQuestionAction(formData: FormData) {
  await requireAdminAction();
  const parsed = updateQuestionSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
    difficulty: formData.get('difficulty'),
    freePreview: toBoolean(formData.get('freePreview')),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid question payload.');
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('questions')
    .update({
      title: parsed.data.title,
      difficulty: parsed.data.difficulty,
      free_preview: parsed.data.freePreview,
    })
    .eq('id', parsed.data.id);

  if (error) {
    throw new Error(error.message || 'Failed to update question.');
  }

  revalidatePath('/admin/questions');
  revalidatePath('/interview-questions');
}

export async function deleteQuestionAction(formData: FormData) {
  await requireAdminAction();
  const parsed = deleteEntitySchema.safeParse({
    id: formData.get('id'),
  });
  if (!parsed.success) {
    throw new Error('Invalid question id.');
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('questions').delete().eq('id', parsed.data.id);
  if (error) {
    throw new Error(error.message || 'Failed to delete question.');
  }

  revalidatePath('/admin/questions');
  revalidatePath('/interview-questions');
}

export async function createTopicAction(formData: FormData) {
  await requireAdminAction();
  const parsed = createTopicSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    categoryId: formData.get('categoryId'),
    icon: formData.get('icon'),
  });
  if (!parsed.success) {
    redirectTopicFeedback('error', parsed.error.issues[0]?.message ?? 'Invalid topic payload.');
  }

  const supabase = createSupabaseServerClient();
  const categoryValidation = await validateTopicCategory(supabase, parsed.data.categoryId);
  if (!categoryValidation.ok) {
    redirectTopicFeedback('error', categoryValidation.message);
  }

  const slug = normalizeSlug(parsed.data.slug, parsed.data.name);
  const icon = normalizeOptionalText(parsed.data.icon);
  const insertCandidates: Record<string, unknown>[] = [
    { name: parsed.data.name, slug, category_id: parsed.data.categoryId, icon },
    { name: parsed.data.name, slug, category_id: parsed.data.categoryId },
    { name: parsed.data.name, category_id: parsed.data.categoryId, icon },
    { name: parsed.data.name, category_id: parsed.data.categoryId },
    { title: parsed.data.name, slug, category_id: parsed.data.categoryId, icon },
    { title: parsed.data.name, slug, category_id: parsed.data.categoryId },
    { title: parsed.data.name, category_id: parsed.data.categoryId, icon },
    { title: parsed.data.name, category_id: parsed.data.categoryId },
  ];

  let lastError: { code?: string; message?: string } | null = null;
  let created = false;

  for (const payload of insertCandidates) {
    const { error } = await supabase.from('topics').insert(payload);
    if (!error) {
      created = true;
      break;
    }

    lastError = { code: error.code, message: error.message };
    if (error.code !== '42703') break;
  }

  if (!created) {
    if (lastError?.code === '42703') {
      redirectTopicFeedback(
        'error',
        'topics.category_id/slug column is missing. Add these columns to link topics with topic_categories.',
      );
    }
    redirectTopicFeedback('error', lastError?.message || 'Failed to create topic.');
  }

  revalidatePath('/admin/topics');
  revalidatePath('/interview-questions');
  redirectTopicFeedback('success', `Topic "${parsed.data.name}" created successfully.`);
}

export async function updateTopicAction(formData: FormData) {
  await requireAdminAction();
  const parsed = updateTopicSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    slug: formData.get('slug'),
    categoryId: formData.get('categoryId'),
    icon: formData.get('icon'),
  });
  if (!parsed.success) {
    redirectTopicFeedback('error', parsed.error.issues[0]?.message ?? 'Invalid topic payload.');
  }

  const supabase = createSupabaseServerClient();
  const categoryValidation = await validateTopicCategory(supabase, parsed.data.categoryId);
  if (!categoryValidation.ok) {
    redirectTopicFeedback('error', categoryValidation.message);
  }

  const slug = normalizeSlug(parsed.data.slug, parsed.data.name);
  const icon = normalizeOptionalText(parsed.data.icon);
  const updateCandidates: Record<string, unknown>[] = [
    { name: parsed.data.name, slug, category_id: parsed.data.categoryId, icon },
    { name: parsed.data.name, slug, category_id: parsed.data.categoryId },
    { name: parsed.data.name, category_id: parsed.data.categoryId, icon },
    { name: parsed.data.name, category_id: parsed.data.categoryId },
    { title: parsed.data.name, slug, category_id: parsed.data.categoryId, icon },
    { title: parsed.data.name, slug, category_id: parsed.data.categoryId },
    { title: parsed.data.name, category_id: parsed.data.categoryId, icon },
    { title: parsed.data.name, category_id: parsed.data.categoryId },
  ];

  let lastError: { code?: string; message?: string } | null = null;
  let updated = false;
  for (const payload of updateCandidates) {
    const { error } = await supabase
      .from('topics')
      .update(payload)
      .eq('id', parsed.data.id);

    if (!error) {
      updated = true;
      break;
    }

    lastError = { code: error.code, message: error.message };
    if (error.code !== '42703') break;
  }

  if (!updated) {
    if (lastError?.code === '42703') {
      redirectTopicFeedback(
        'error',
        'topics.category_id/slug column is missing. Add these columns to link topics with topic_categories.',
      );
    }
    redirectTopicFeedback('error', lastError?.message || 'Failed to update topic.');
  }

  revalidatePath('/admin/topics');
  revalidatePath('/interview-questions');
  redirectTopicFeedback('success', `Topic "${parsed.data.name}" updated successfully.`);
}

export async function deleteTopicAction(formData: FormData) {
  await requireAdminAction();
  const parsed = deleteEntitySchema.safeParse({
    id: formData.get('id'),
  });
  if (!parsed.success) {
    throw new Error('Invalid topic id.');
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('topics').delete().eq('id', parsed.data.id);
  if (error) {
    if (error.code === '23503') {
      redirectTopicFeedback('error', 'This topic is in use by one or more questions and cannot be deleted.');
    }
    redirectTopicFeedback('error', error.message || 'Failed to delete topic.');
  }

  revalidatePath('/admin/topics');
  revalidatePath('/interview-questions');
  redirectTopicFeedback('success', 'Topic deleted successfully.');
}

export async function createTopicCategoryAction(formData: FormData) {
  await requireAdminAction();
  const parsed = createTopicCategorySchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    icon: formData.get('icon'),
  });
  if (!parsed.success) {
    redirectTopicFeedback('error', parsed.error.issues[0]?.message ?? 'Invalid topic category payload.');
  }

  const supabase = createSupabaseServerClient();
  const slug = normalizeSlug(parsed.data.slug, parsed.data.name);
  const icon = normalizeOptionalText(parsed.data.icon);
  const insertCandidates: Record<string, unknown>[] = [
    { name: parsed.data.name, slug, icon },
    { name: parsed.data.name, slug },
    { title: parsed.data.name, slug, icon },
    { title: parsed.data.name, slug },
    { name: parsed.data.name, icon },
    { name: parsed.data.name },
    { title: parsed.data.name, icon },
    { title: parsed.data.name },
  ];

  let lastError: { code?: string; message?: string } | null = null;
  let created = false;

  for (const payload of insertCandidates) {
    const { error } = await supabase.from('topic_categories').insert(payload);
    if (!error) {
      created = true;
      break;
    }

    lastError = { code: error.code, message: error.message };
    if (error.code !== '42703') break;
  }

  if (!created) {
    if (lastError?.code === '42P01') {
      redirectTopicFeedback('error', 'topic_categories table is missing. Please create it first.');
    }
    redirectTopicFeedback('error', lastError?.message || 'Failed to create topic category.');
  }

  revalidatePath('/admin/topics');
  revalidatePath('/admin/questions/new');
  revalidatePath('/interview-questions');
  redirectTopicFeedback('success', `Topic category "${parsed.data.name}" created successfully.`);
}

export async function updateTopicCategoryAction(formData: FormData) {
  await requireAdminAction();
  const parsed = updateTopicCategorySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    slug: formData.get('slug'),
    icon: formData.get('icon'),
  });
  if (!parsed.success) {
    redirectTopicFeedback('error', parsed.error.issues[0]?.message ?? 'Invalid topic category payload.');
  }

  const supabase = createSupabaseServerClient();
  const slug = normalizeSlug(parsed.data.slug, parsed.data.name);
  const icon = normalizeOptionalText(parsed.data.icon);
  const updateCandidates: Record<string, unknown>[] = [
    { name: parsed.data.name, slug, icon },
    { name: parsed.data.name, slug },
    { title: parsed.data.name, slug, icon },
    { title: parsed.data.name, slug },
    { name: parsed.data.name, icon },
    { name: parsed.data.name },
    { title: parsed.data.name, icon },
    { title: parsed.data.name },
  ];

  let lastError: { code?: string; message?: string } | null = null;
  let updated = false;

  for (const payload of updateCandidates) {
    const { error } = await supabase
      .from('topic_categories')
      .update(payload)
      .eq('id', parsed.data.id);
    if (!error) {
      updated = true;
      break;
    }

    lastError = { code: error.code, message: error.message };
    if (error.code !== '42703') break;
  }

  if (!updated) {
    if (lastError?.code === '42P01') {
      redirectTopicFeedback('error', 'topic_categories table is missing. Please create it first.');
    }
    redirectTopicFeedback('error', lastError?.message || 'Failed to update topic category.');
  }

  revalidatePath('/admin/topics');
  revalidatePath('/admin/questions/new');
  revalidatePath('/interview-questions');
  redirectTopicFeedback('success', `Topic category "${parsed.data.name}" updated successfully.`);
}

export async function deleteTopicCategoryAction(formData: FormData) {
  await requireAdminAction();
  const parsed = deleteEntitySchema.safeParse({
    id: formData.get('id'),
  });
  if (!parsed.success) {
    redirectTopicFeedback('error', 'Invalid topic category id.');
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from('topic_categories').delete().eq('id', parsed.data.id);
  if (error) {
    if (error.code === '23503') {
      redirectTopicFeedback(
        'error',
        'This category has linked topics. Reassign or delete those topics before deleting the category.',
      );
    }
    redirectTopicFeedback('error', error.message || 'Failed to delete topic category.');
  }

  revalidatePath('/admin/topics');
  revalidatePath('/admin/questions/new');
  revalidatePath('/interview-questions');
  redirectTopicFeedback('success', 'Topic category deleted successfully.');
}

export async function updateUserRoleAction(formData: FormData) {
  await requireAdminAction();
  const parsed = updateUserRoleSchema.safeParse({
    userId: formData.get('userId'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    throw new Error('Invalid role update request.');
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role: parsed.data.role })
    .eq('id', parsed.data.userId);

  if (error) {
    throw new Error(error.message || 'Failed to update role.');
  }

  revalidatePath('/admin/users');
}

export async function updateAdminProfileAction(formData: FormData) {
  const admin = await requireAdminAction();
  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get('fullName'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid full name.');
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName })
    .eq('id', admin.user.id);

  if (error) {
    throw new Error(error.message || 'Failed to update profile.');
  }

  revalidatePath('/admin');
  revalidatePath('/admin/settings');
}

export async function changeAdminPasswordAction(formData: FormData) {
  await requireAdminAction();
  const parsed = changePasswordSchema.safeParse({
    newPassword: formData.get('newPassword'),
    confirmPassword: formData.get('confirmPassword'),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid password.');
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? null;
  if (!accessToken || !refreshToken) {
    throw new Error('Missing auth session. Please login again.');
  }

  const authClient = getAuthClient();
  const setSessionResult = await authClient.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (setSessionResult.error || !setSessionResult.data.session) {
    throw new Error(setSessionResult.error?.message ?? 'Failed to validate session.');
  }

  const updateResult = await authClient.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (updateResult.error) {
    throw new Error(updateResult.error.message ?? 'Failed to change password.');
  }

  const refreshed = await authClient.auth.refreshSession({
    refresh_token: setSessionResult.data.session.refresh_token,
  });
  if (refreshed.data.session) {
    await setSessionCookies(refreshed.data.session);
  }

  revalidatePath('/admin/settings');
}

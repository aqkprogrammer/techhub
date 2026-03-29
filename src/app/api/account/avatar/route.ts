import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPublicProfile, jsonError, setAuthCookies } from '../../auth/_shared';
import { requireAuthenticatedUser } from '../_auth';

export const runtime = 'nodejs';

const DEFAULT_UPLOAD_DIR = 'uploads/avatars';
const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_AVATAR_FILE_SIZE_MB ?? '5') * 1024 * 1024;
const ALLOWED_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function getUploadDirectoryConfig() {
  const configured = (process.env.AVATAR_UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR).trim();
  const normalized = configured.replace(/^\/+/, '').replace(/\\/g, '/');
  if (normalized.includes('..')) {
    throw new Error('Invalid AVATAR_UPLOAD_DIR: path traversal is not allowed.');
  }
  return normalized || DEFAULT_UPLOAD_DIR;
}

function resolveUploadDirectoryAbsolute() {
  const relativeUploadPath = getUploadDirectoryConfig();
  const cwd = process.cwd();
  const publicRootFromCwd = path.join(cwd, 'public');
  const publicRootFromMonorepo = path.join(cwd, 'apps', 'web', 'public');
  const publicRoot = existsSync(publicRootFromCwd) ? publicRootFromCwd : publicRootFromMonorepo;
  const absoluteUploadPath = path.join(publicRoot, relativeUploadPath);
  return {
    publicRoot,
    relativeUploadPath,
    absoluteUploadPath,
  };
}

async function deleteExistingLocalAvatar(publicRoot: string, avatarUrl: string | null) {
  if (!avatarUrl) return;
  const normalized = avatarUrl.trim();
  if (!normalized.startsWith('/uploads/')) return;

  const relativeFilePath = normalized.replace(/^\/+/, '');
  const absoluteFilePath = path.join(publicRoot, relativeFilePath);
  try {
    await fs.unlink(absoluteFilePath);
  } catch {
    // Ignore missing/locked files.
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid multipart form data.');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError('Avatar file is required.');
  }

  if (!(file.type in ALLOWED_MIME_TO_EXTENSION)) {
    return jsonError('Only JPG, PNG, WEBP, and GIF images are supported.');
  }

  if (!Number.isFinite(MAX_FILE_SIZE_BYTES) || MAX_FILE_SIZE_BYTES <= 0) {
    return jsonError('Invalid MAX_AVATAR_FILE_SIZE_MB configuration.', 500);
  }

  if (file.size === 0) {
    return jsonError('Avatar file is empty.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonError(`Avatar file is too large. Max size is ${process.env.MAX_AVATAR_FILE_SIZE_MB ?? '5'}MB.`);
  }

  const extension = ALLOWED_MIME_TO_EXTENSION[file.type];
  let publicRoot: string;
  let relativeUploadPath: string;
  let absoluteUploadPath: string;
  try {
    const resolved = resolveUploadDirectoryAbsolute();
    publicRoot = resolved.publicRoot;
    relativeUploadPath = resolved.relativeUploadPath;
    absoluteUploadPath = resolved.absoluteUploadPath;
  } catch {
    return jsonError('Invalid avatar upload directory configuration.', 500);
  }
  await fs.mkdir(absoluteUploadPath, { recursive: true });

  const fileName = `${auth.user.id}-${Date.now()}-${randomUUID()}.${extension}`;
  const absoluteFile = path.join(absoluteUploadPath, fileName);
  const publicUrl = `/${relativeUploadPath}/${fileName}`.replace(/\/+/g, '/');

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absoluteFile, buffer);

  const admin = createSupabaseServerClient();

  const currentProfile = await getPublicProfile(auth.user.id);
  const { error } = await admin.from('profiles').upsert(
    {
      id: auth.user.id,
      email: auth.user.email ?? null,
      avatar_url: publicUrl,
    },
    { onConflict: 'id' },
  );

  if (error) {
    try {
      await fs.unlink(absoluteFile);
    } catch {
      // Ignore cleanup errors.
    }
    return jsonError('Failed to save avatar.', 500);
  }

  await deleteExistingLocalAvatar(publicRoot, currentProfile?.avatarUrl ?? null);

  const profile = await getPublicProfile(auth.user.id);
  const response = NextResponse.json({
    avatarUrl: publicUrl,
    profile,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if (!auth.ok) {
    return auth.response;
  }

  let publicRoot: string;
  try {
    publicRoot = resolveUploadDirectoryAbsolute().publicRoot;
  } catch {
    return jsonError('Invalid avatar upload directory configuration.', 500);
  }
  const admin = createSupabaseServerClient();
  const currentProfile = await getPublicProfile(auth.user.id);

  const { error } = await admin.from('profiles').upsert(
    {
      id: auth.user.id,
      email: auth.user.email ?? null,
      avatar_url: null,
    },
    { onConflict: 'id' },
  );

  if (error) {
    return jsonError('Failed to remove avatar.', 500);
  }

  await deleteExistingLocalAvatar(publicRoot, currentProfile?.avatarUrl ?? null);

  const profile = await getPublicProfile(auth.user.id);
  const response = NextResponse.json({
    avatarUrl: null,
    profile,
  });

  if (auth.session) {
    setAuthCookies(response, auth.session);
  }

  return response;
}

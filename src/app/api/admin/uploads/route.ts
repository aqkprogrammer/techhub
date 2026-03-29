import { randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import { jsonError, requireAdmin } from '../../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DEFAULT_UPLOAD_DIR = 'uploads/answers';
const MAX_FILE_SIZE_BYTES = Number(process.env.MAX_ANSWER_IMAGE_SIZE_MB ?? '5') * 1024 * 1024;
const ALLOWED_MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function getUploadDirectoryConfig() {
  const configured = (process.env.ANSWER_IMAGE_UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR).trim();
  const normalized = configured.replace(/^\/+/, '').replace(/\\/g, '/');
  if (normalized.includes('..')) {
    throw new Error('Invalid ANSWER_IMAGE_UPLOAD_DIR: path traversal is not allowed.');
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

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const { response } = await requireAdmin(supabase, { request });
  if (response) return response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Invalid multipart form data.');
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonError('Image file is required.');
  }

  if (!(file.type in ALLOWED_MIME_TO_EXTENSION)) {
    return jsonError('Only JPG, PNG, WEBP, and GIF images are supported.');
  }

  if (!Number.isFinite(MAX_FILE_SIZE_BYTES) || MAX_FILE_SIZE_BYTES <= 0) {
    return jsonError('Invalid MAX_ANSWER_IMAGE_SIZE_MB configuration.', 500);
  }

  if (file.size === 0) {
    return jsonError('Image file is empty.');
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonError(`Image file is too large. Max size is ${process.env.MAX_ANSWER_IMAGE_SIZE_MB ?? '5'}MB.`);
  }

  const extension = ALLOWED_MIME_TO_EXTENSION[file.type];
  let relativeUploadPath: string;
  let absoluteUploadPath: string;
  try {
    const resolved = resolveUploadDirectoryAbsolute();
    relativeUploadPath = resolved.relativeUploadPath;
    absoluteUploadPath = resolved.absoluteUploadPath;
  } catch {
    return jsonError('Invalid answer image upload directory configuration.', 500);
  }

  await fs.mkdir(absoluteUploadPath, { recursive: true });

  const fileName = `answer-${Date.now()}-${randomUUID()}.${extension}`;
  const absoluteFile = path.join(absoluteUploadPath, fileName);
  const publicUrl = `/${relativeUploadPath}/${fileName}`.replace(/\/+/g, '/');

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absoluteFile, buffer);

  return NextResponse.json({ url: publicUrl }, { status: 201 });
}

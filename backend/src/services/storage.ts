import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Avatar storage on Supabase Storage, over its REST API.
 *
 * The service-role key is used, which bypasses storage RLS — acceptable because
 * this module is only ever reached from routes that have already established
 * who the caller is, and every object path is derived from their own user id
 * rather than from anything they send.
 */

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Allowed image types, mapped to the extension the object is stored under.
 *
 * A whitelist, not a blocklist: the browser-declared MIME type is attacker
 * controlled, so the extension comes from this table rather than from the
 * uploaded filename, which stops `avatar.svg` or `avatar.html` being served
 * back as active content from the storage domain.
 */
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function isStorageConfigured(): boolean {
  return env.storage.configured;
}

function assertConfigured(): void {
  if (!env.storage.configured) {
    throw HttpError.badRequest(
      'Avatar uploads are not configured on this server. Set SUPABASE_URL and ' +
        'SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${env.storage.serviceRoleKey}`,
    apikey: env.storage.serviceRoleKey as string,
    ...extra,
  };
}

/**
 * Creates the avatar bucket if it is missing.
 *
 * Called once at boot rather than per upload. A 400 saying the bucket already
 * exists is the success case on a second run, so it is swallowed.
 */
export async function ensureAvatarBucket(): Promise<void> {
  if (!env.storage.configured) return;

  try {
    const response = await fetch(`${env.storage.url}/storage/v1/bucket`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        id: env.storage.bucket,
        name: env.storage.bucket,
        public: true,
        file_size_limit: MAX_BYTES,
        allowed_mime_types: Object.keys(ALLOWED_TYPES),
      }),
    });

    if (response.ok) {
      console.log(`  [storage] created public bucket "${env.storage.bucket}"`);
      return;
    }

    const detail = await response.text();
    if (detail.includes('already exists') || detail.includes('Duplicate')) return;

    console.warn(`  [storage] could not ensure bucket (${response.status}): ${detail}`);
  } catch (error) {
    console.warn(
      '  [storage] could not reach Supabase Storage:',
      error instanceof Error ? error.message : error,
    );
  }
}

export interface UploadedAvatar {
  url: string;
  path: string;
}

export async function uploadAvatar(
  userId: string,
  file: { buffer: Buffer; mimetype: string; size: number },
): Promise<UploadedAvatar> {
  assertConfigured();

  const extension = ALLOWED_TYPES[file.mimetype];
  if (!extension) {
    throw HttpError.badRequest(
      `That file type is not supported. Use ${Object.values(ALLOWED_TYPES).join(', ')}.`,
    );
  }
  if (file.size > MAX_BYTES) {
    throw HttpError.badRequest('Profile pictures must be 2 MB or smaller.');
  }

  // A random segment per upload rather than a fixed `${userId}.png`: the public
  // URL changes every time, so a replaced picture is never served from a CDN or
  // browser cache still holding the old one.
  const path = `${userId}/${randomBytes(8).toString('hex')}.${extension}`;

  const response = await fetch(
    `${env.storage.url}/storage/v1/object/${env.storage.bucket}/${path}`,
    {
      method: 'POST',
      headers: headers({ 'Content-Type': file.mimetype, 'cache-control': '3600' }),
      body: new Uint8Array(file.buffer),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    console.error(`[storage] upload failed (${response.status}): ${detail}`);
    throw HttpError.badRequest('Could not store that image. Try again.');
  }

  return {
    url: `${env.storage.url}/storage/v1/object/public/${env.storage.bucket}/${path}`,
    path,
  };
}

/**
 * Best-effort removal of a replaced avatar. A failure here leaves an orphaned
 * object, which costs a few kilobytes — not a reason to fail the request that
 * successfully uploaded its replacement.
 */
export async function deleteAvatar(path: string): Promise<void> {
  if (!env.storage.configured) return;

  try {
    const response = await fetch(
      `${env.storage.url}/storage/v1/object/${env.storage.bucket}/${path}`,
      { method: 'DELETE', headers: headers() },
    );
    if (!response.ok) {
      console.warn(`[storage] could not delete ${path} (${response.status}).`);
    }
  } catch (error) {
    console.warn('[storage] delete failed:', error instanceof Error ? error.message : error);
  }
}

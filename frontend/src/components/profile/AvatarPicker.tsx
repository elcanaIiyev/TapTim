import { useRef, useState } from 'react';
import { profileApi } from '../../lib/api';
import { ApiError } from '../../lib/api';
import type { User } from '../../lib/types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

/** Initials, so an empty avatar still reads as a person rather than a gap. */
function initials(user: { firstName: string; lastName: string | null }): string {
  return [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase() || '?';
}

export function AvatarPicker({
  user,
  enabled,
  onChange,
}: {
  user: Pick<User, 'firstName' | 'lastName' | 'avatarUrl'>;
  /** False when the server has no storage configured; upload is then hidden. */
  enabled: boolean;
  onChange: (updated: User) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Shown immediately from the local file, before the upload finishes. */
  const [preview, setPreview] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    // Checked here as well as on the server so the person is told before a
    // 2 MB upload is spent finding out.
    if (file.size > 2 * 1024 * 1024) {
      setError('That image is over 2 MB. Try a smaller one.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);

    try {
      onChange(await profileApi.uploadAvatar(file));
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof ApiError ? caught.message : 'That upload did not go through.');
    } finally {
      setBusy(false);
      // Revoked once the real URL has taken over, or the preview is discarded.
      URL.revokeObjectURL(localUrl);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      setPreview(null);
      onChange(await profileApi.removeAvatar());
    } catch {
      setError('Could not remove that picture.');
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? user.avatarUrl;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative">
        <div
          className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-iris-500/60 bg-ink-100 dark:bg-ink-800"
          style={{ boxShadow: '0 0 22px -4px rgb(124 58 237 / 0.5)' }}
        >
          {shown ? (
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="readout text-2xl font-bold text-iris-600 dark:text-iris-300">
              {initials(user)}
            </span>
          )}
        </div>

        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-ink-950/60">
            <Spinner className="text-white" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="type-label text-ink-700 dark:text-ink-300">Profile picture</p>

        {enabled ? (
          <>
            <p className="mt-1.5 text-xs text-ink-600 dark:text-ink-400">
              PNG, JPG, WebP or GIF. Up to 2 MB.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
              >
                {shown ? 'Replace' : 'Upload'}
              </Button>
              {shown && (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
                  Remove
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={(event) => {
                void handleFile(event.target.files?.[0]);
                // Reset so choosing the same file twice still fires a change.
                event.target.value = '';
              }}
            />
          </>
        ) : (
          <p className="mt-1.5 max-w-xs text-xs text-ink-600 dark:text-ink-400">
            Picture uploads are not configured on this server.
          </p>
        )}

        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-signal-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

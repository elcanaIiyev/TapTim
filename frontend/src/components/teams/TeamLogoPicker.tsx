import { useEffect, useRef, useState } from 'react';
import { ApiError, teamsApi } from '../../lib/api';
import type { TeamDetail } from '../../lib/types';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { TeamLogo } from './TeamLogo';

/**
 * Upload, replace, or clear a team's logo. Shown to the owner only.
 *
 * The chosen file is previewed from a local object URL the moment it is picked,
 * so the change is visible immediately rather than after a round trip to
 * storage. That URL is revoked when it is replaced or the component unmounts —
 * without that, every attempt leaks a blob for the life of the page.
 */
export function TeamLogoPicker({
  team,
  onChange,
}: {
  team: TeamDetail;
  onChange: (updated: TeamDetail) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    // Checked here as well as on the server, so nobody spends a 2 MB upload
    // finding out.
    if (file.size > 2 * 1024 * 1024) {
      setError('That image is over 2 MB. Try a smaller one.');
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return localUrl;
    });
    setBusy(true);

    try {
      onChange(await teamsApi.uploadLogo(team.id, file));
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof ApiError ? caught.message : 'That upload did not go through.');
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    setBusy(true);
    setError(null);
    try {
      onChange(await teamsApi.removeLogo(team.id));
      setPreview(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not remove the logo.');
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? team.logoUrl;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative">
        <TeamLogo
          name={team.name}
          src={shown}
          className="h-16 w-16"
          textClassName="text-lg"
        />
        {busy && (
          <span className="absolute inset-0 grid place-items-center rounded-[var(--radius-soft-sm)] bg-black/50">
            <Spinner className="text-white" />
          </span>
        )}
      </div>

      <div className="min-w-0">
        <p className="type-label text-ink-700 dark:text-ink-300">Team logo</p>
        <p className="mt-1 text-xs text-ink-600 dark:text-ink-400">
          PNG, JPEG, or WebP, up to 2 MB. Without one, the team shows its initials.
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              // Cleared so picking the same file twice still fires a change.
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {team.logoUrl ? 'Replace' : 'Upload logo'}
          </Button>
          {team.logoUrl && (
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void clear()}>
              Remove
            </Button>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-2 text-xs font-medium text-signal-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

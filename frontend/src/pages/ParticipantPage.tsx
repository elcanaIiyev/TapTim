import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Container } from '../components/ui/Container';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, endorsementsApi, profileApi } from '../lib/api';
import { cn } from '../lib/cn';
import { skillLabel } from '../lib/types';
import type { DirectoryUser, ProfileEndorsements } from '../lib/types';

/**
 * Somebody else's profile.
 *
 * This existed as a link before it existed as a page — the compatibility page
 * was already sending people to `/participants/:id`, which 404'd. It is also
 * the only sensible home for endorsements: you endorse a person by looking at
 * them, not from inside a list.
 */

function SkillRow({
  skill,
  level,
  endorsement,
  canEndorse,
  busy,
  onToggle,
}: {
  skill: string;
  level: number | undefined;
  endorsement: { count: number; byViewer: boolean } | undefined;
  canEndorse: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const count = endorsement?.count ?? 0;
  const mine = endorsement?.byViewer ?? false;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink-900 dark:text-white">{skill}</p>
        <p className="mt-0.5 text-xs text-ink-600 dark:text-ink-400">
          {/* An unrated skill says so rather than showing the default as if it
              were a claim — that distinction is the whole point of confidence. */}
          {level === undefined ? (
            <span className="italic">Not rated yet</span>
          ) : (
            <>
              {skillLabel(level)} · <span className="tabular-nums">{level}</span>
            </>
          )}
          {count > 0 && (
            <>
              {' · '}
              <span className="font-semibold text-success-text">
                {count} endorsement{count === 1 ? '' : 's'}
              </span>
            </>
          )}
        </p>
      </div>

      {canEndorse && (
        <button
          type="button"
          disabled={busy}
          onClick={onToggle}
          aria-pressed={mine}
          className={cn(
            'shrink-0 cursor-pointer rounded-full border px-3 py-1.5 font-mono text-xs font-semibold transition-colors',
            mine
              ? 'border-fern-700 bg-fern-600 text-white'
              : 'border-ink-300 text-ink-700 hover:border-fern-600 hover:text-fern-700 dark:border-ink-600 dark:text-ink-300',
            busy && 'cursor-not-allowed opacity-60',
          )}
        >
          {mine ? 'Endorsed' : 'Endorse'}
        </button>
      )}
    </li>
  );
}

export function ParticipantPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();

  const [person, setPerson] = useState<DirectoryUser | null>(null);
  const [endorsements, setEndorsements] = useState<ProfileEndorsements | null>(null);
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const [profile, marks] = await Promise.all([
        profileApi.get(id),
        endorsementsApi.forProfile(id),
      ]);
      setPerson(profile);
      setEndorsements(marks);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 404) setNotFound(true);
      else setError(caught instanceof ApiError ? caught.message : 'Could not load that profile.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(skill: string, currentlyMine: boolean) {
    setBusySkill(skill);
    setError(null);
    try {
      const updated = currentlyMine
        ? await endorsementsApi.withdraw(id, skill)
        : await endorsementsApi.endorse(id, skill);

      setEndorsements((current) =>
        current
          ? {
              ...current,
              skills: current.skills.map((entry) =>
                entry.skill === updated.skill ? updated : entry,
              ),
            }
          : current,
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'That did not go through.');
    } finally {
      setBusySkill(null);
    }
  }

  if (notFound) {
    return (
      <Container className="py-20">
        <p className="text-sm text-ink-600 dark:text-ink-300">No participant with that id.</p>
      </Container>
    );
  }

  if (!person) {
    return (
      <Container className="py-20">
        <div className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
          <Spinner className="text-iris-600 dark:text-iris-400" />
          Loading…
        </div>
      </Container>
    );
  }

  const byName = new Map((endorsements?.skills ?? []).map((entry) => [entry.skill, entry]));
  const isSelf = user?.id === person.id;

  return (
    <Container className="py-14 sm:py-20">
      <div className="flex flex-wrap items-start gap-5 border-b border-ink-200 pb-8 dark:border-ink-700">
        {person.avatarUrl ? (
          <img src={person.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-iris-600 text-2xl font-bold text-white"
          >
            {person.firstName?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}

        <div className="min-w-0">
          <h1 className="type-title text-ink-900 dark:text-white">{person.fullName}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {person.roles.map((role) => (
              <Badge key={role} tone="brand">
                {role}
              </Badge>
            ))}
            {person.verified && <Badge tone="success">Verified</Badge>}
          </div>
          {person.bio && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-600 dark:text-ink-300">
              {person.bio}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-6 text-sm font-medium text-signal-bad">
          {error}
        </p>
      )}

      <Card className="mt-8">
        <h2 className="type-label text-accent-text">Skills</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          {isSelf
            ? 'Endorsements come from people you have been on a team with.'
            : endorsements?.canEndorse
              ? 'You have been on a team together, so you can vouch for what you have actually seen. Endorsements do not change the number — they change how much it is trusted.'
              : 'Only people who have been on a team with them can endorse these.'}
        </p>

        {person.skills.length === 0 ? (
          <p className="mt-4 text-sm text-ink-600 dark:text-ink-400">No skills listed yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-ink-200 dark:divide-ink-700">
            {person.skills.map((skill) => (
              <SkillRow
                key={skill}
                skill={skill}
                level={person.skillLevels?.[skill]}
                endorsement={byName.get(skill)}
                canEndorse={Boolean(endorsements?.canEndorse)}
                busy={busySkill === skill}
                onToggle={() => void toggle(skill, byName.get(skill)?.byViewer ?? false)}
              />
            ))}
          </ul>
        )}
      </Card>
    </Container>
  );
}

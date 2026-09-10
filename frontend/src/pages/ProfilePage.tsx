import { useCallback, useEffect, useMemo, useState } from 'react';
import { AVAILABILITY_LABELS, TRAIT_COPY } from '../lib/people';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AvatarPicker } from '../components/profile/AvatarPicker';
import { ExperienceEditor } from '../components/profile/ExperienceEditor';
import { RolePicker } from '../components/profile/RolePicker';
import { SkillPicker } from '../components/profile/SkillPicker';
import { TourOverlay, type TourStep } from '../components/onboarding/TourOverlay';
import { Button } from '../components/ui/Button';
import { ChipGroup } from '../components/ui/Chip';
import { Container } from '../components/ui/Container';
import { Input, Select } from '../components/ui/Input';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { ApiError, authApi, profileApi } from '../lib/api';
import { cn } from '../lib/cn';
import type { Experience, ProfileOptions, ProfilePayload } from '../lib/types';

/**
 * The profile builder.
 *
 * Also the destination of the onboarding tour — `/onboarding` renders this same
 * page with the tour running, because walking someone through a *copy* of the
 * profile screen and then dropping them on the real one teaches them the wrong
 * layout. `data-tour` attributes mark what the spotlight highlights.
 */

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Let’s build your profile',
    body: 'This is what the matching runs on. Four short sections — about two minutes. You can change any of it later.',
    action: 'Show me',
  },
  {
    target: 'avatar',
    title: 'Put a face to the name',
    body: 'Upload a picture. Profiles with one get opened far more often than the ones without.',
  },
  {
    target: 'basics',
    title: 'The basics',
    body: 'Your age, where you are, and your pronouns. Age and location help us match you with people in compatible time zones.',
  },
  {
    target: 'skills',
    title: 'What you build with',
    body: 'Tap the skills you have — five is plenty for now, and you can add more any time. Each one you pick gets a slider so you can say how good you actually are. Then tap the languages you speak.',
  },
  {
    target: 'interests',
    title: 'What you want to build',
    body: 'Pick the problem areas that interest you and why you’re here. Two people with identical skills and different goals still make a bad team — this is the field that catches that.',
  },
  {
    target: 'availability',
    title: 'When you’re free',
    body: 'Overlapping hours matter more than most people expect. This is 20% of your compatibility score.',
  },
  {
    target: 'style',
    title: 'How you work',
    body: 'Ten sliders, thirty seconds. There are no wrong answers — we match complementary styles, not identical ones, so nobody wins by picking the extremes.',
  },
  {
    target: 'save',
    title: 'Save when you’re ready',
    body: 'Nothing is stored until you press this. Your completeness meter climbs as you fill things in.',
    action: 'Got it',
  },
];

function Section({
  tour,
  title,
  hint,
  children,
}: {
  tour?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      data-tour={tour}
      className="hud hud-ticks relative scroll-mt-24 overflow-hidden p-6 sm:p-7"
    >
      <div className="grid-floor pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="relative">
        <h2 className="type-label text-accent-text">{title}</h2>
        {hint && <p className="mt-2 text-sm text-ink-600 dark:text-ink-300">{hint}</p>}
        <div className="mt-5 space-y-6">{children}</div>
      </div>
    </section>
  );
}

export function ProfilePage({ tour = false }: { tour?: boolean }) {
  const { user, initialising, applyUser, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [options, setOptions] = useState<ProfileOptions | null>(null);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [draft, setDraft] = useState<ProfilePayload>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tourOpen, setTourOpen] = useState(tour);

  useEffect(() => {
    profileApi.options().then(setOptions).catch(() => setError('Could not load the options list.'));
    profileApi.experiences().then(setExperiences).catch(() => {
      // The rest of the page is still usable without the timeline.
    });
  }, []);

  /** The live value: what is in the draft, falling back to what is saved. */
  const value = useCallback(
    <K extends keyof ProfilePayload>(key: K): NonNullable<ProfilePayload[K]> | undefined => {
      if (draft[key] !== undefined) return draft[key] as NonNullable<ProfilePayload[K]>;
      return user ? (user[key as keyof typeof user] as never) : undefined;
    },
    [draft, user],
  );

  const set = <K extends keyof ProfilePayload>(key: K, next: ProfilePayload[K]) => {
    setDraft((current) => ({ ...current, [key]: next }));
    setSaved(false);
  };

  const dirty = Object.keys(draft).length > 0;

  // A half-filled form is real work; leaving without saving should cost a
  // confirmation rather than happening silently.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const personality = (value('personality') ?? {}) as Record<string, number | undefined>;

  const connectedProviders = useMemo(
    () => new Set((user?.connections ?? []).map((entry) => entry.provider)),
    [user?.connections],
  );

  async function save(alsoFinishTour = false) {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const payload = { ...draft };
      if (alsoFinishTour) payload.onboardingCompleted = true;

      const updated = await profileApi.update(payload);
      applyUser(updated);
      setDraft({});
      setSaved(true);
      await refresh();

      if (alsoFinishTour) navigate('/', { replace: true });
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(Object.fromEntries(caught.issues.map((i) => [i.field, i.message])));
        setError(caught.issues.length ? 'Check the highlighted fields.' : caught.message);
      } else {
        setError('Could not save. Try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function connect(provider: string) {
    try {
      window.location.href = await authApi.connectOAuth(provider);
    } catch {
      setError(`Could not start the ${provider} connection.`);
    }
  }

  if (initialising) {
    return (
      <Container className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="text-iris-600 dark:text-iris-400" />
      </Container>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const completeness = user.profileCompleteness ?? 0;

  return (
    <Container className="py-12">
      {/* -- header ------------------------------------------------------- */}
      <div className="hud hud-ticks relative overflow-hidden p-6 sm:p-8">
        <div className="grid-floor pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div data-tour="avatar">
            <AvatarPicker
              user={user}
              enabled={options?.avatarUploadEnabled ?? false}
              onChange={applyUser}
            />
          </div>

          <div className="min-w-[14rem] flex-1">
            <p className="type-label text-accent-text">Profile strength</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="meter-track">
                <div className="meter-fill" style={{ width: `${completeness}%` }} />
              </div>
              <span className="readout text-lg font-bold text-ink-900 dark:text-white">
                {completeness}%
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-ink-600 dark:text-ink-400">
              {completeness >= 85
                ? 'Strong profile — you’ll rank well in other people’s matches.'
                : 'The more you fill in, the better your matches get. Skills, availability and working style count most.'}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        {/* -- basics ----------------------------------------------------- */}
        <Section tour="basics" title="The basics" hint="Only your age is shown to others, never your birth date.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="First name"
              value={(value('firstName') as string) ?? ''}
              onChange={(e) => set('firstName', e.target.value)}
              error={fieldErrors.firstName}
            />
            <Input
              label="Last name"
              value={(value('lastName') as string) ?? ''}
              onChange={(e) => set('lastName', e.target.value || null)}
              error={fieldErrors.lastName}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Date of birth"
              type="date"
              value={(value('dateOfBirth') as string) ?? ''}
              onChange={(e) => set('dateOfBirth', e.target.value || null)}
              error={fieldErrors.dateOfBirth}
              hint={user.age !== null ? `Age ${user.age}` : 'Shown to others as an age'}
            />
            <Select
              label="Pronouns"
              value={(value('pronouns') as string) ?? ''}
              onChange={(e) => set('pronouns', e.target.value || null)}
              error={fieldErrors.pronouns}
            >
              <option value="">Prefer not to say</option>
              {(options?.pronouns ?? []).map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
            <Input
              label="Hackathons attended"
              type="number"
              min={0}
              max={500}
              value={String(value('hackathonsAttended') ?? 0)}
              onChange={(e) => set('hackathonsAttended', Number(e.target.value) || 0)}
              error={fieldErrors.hackathonsAttended}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="City"
              placeholder="Baku"
              value={(value('locationCity') as string) ?? ''}
              onChange={(e) => set('locationCity', e.target.value || null)}
            />
            <Input
              label="Country"
              placeholder="Azerbaijan"
              value={(value('locationCountry') as string) ?? ''}
              onChange={(e) => set('locationCountry', e.target.value || null)}
            />
          </div>

          <Input
            label="Short bio"
            placeholder="One line on what you like building."
            value={(value('bio') as string) ?? ''}
            onChange={(e) => set('bio', e.target.value || null)}
            error={fieldErrors.bio}
          />
        </Section>

        {/* -- skills ----------------------------------------------------- */}
        <Section tour="skills" title="What you build with">
          {options?.skills && (
            <SkillPicker
              catalogue={options.skills}
              selected={(value('skills') as string[]) ?? []}
              levels={(value('skillLevels') as Record<string, number>) ?? {}}
              // Skills and their levels move together, so they are set in one
              // update — two separate `set` calls would batch into a draft
              // where the levels referenced a skill list that no longer matched.
              onChange={(skills, levels) => {
                setDraft((current) => ({ ...current, skills, skillLevels: levels }));
                setSaved(false);
              }}
              suggestedMax={tour ? 5 : undefined}
            />
          )}
          {fieldErrors.skills && (
            <p role="alert" className="text-xs font-medium text-signal-bad">
              {fieldErrors.skills}
            </p>
          )}

          <RolePicker
            selected={(value('roles') as string[]) ?? []}
            onChange={(next) => set('roles', next)}
            error={fieldErrors.roles}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Experience level"
              value={(value('experienceLevel') as string) ?? ''}
              onChange={(e) => set('experienceLevel', e.target.value)}
            >
              {(options?.experienceLevels ?? []).map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </Select>
          </div>

          <ChipGroup
            legend="Languages you speak"
            options={options?.languages ?? []}
            selected={(value('languages') as string[]) ?? []}
            onChange={(next) => set('languages', next)}
          />
        </Section>

        {/* -- interests -------------------------------------------------- */}
        <Section
          tour="interests"
          title="What you want to build"
          hint="Two people with the same skills and different goals still make a bad team."
        >
          <ChipGroup
            legend="Problem areas"
            hint="Pick up to 6."
            max={6}
            options={options?.interestDomains ?? []}
            selected={(value('interestDomains') as string[]) ?? []}
            onChange={(next) => set('interestDomains', next)}
          />
          <ChipGroup
            legend="Why you're here"
            hint="Pick up to 3."
            max={3}
            options={options?.goals ?? []}
            selected={(value('goals') as string[]) ?? []}
            onChange={(next) => set('goals', next)}
          />
        </Section>

        {/* -- availability ----------------------------------------------- */}
        <Section tour="availability" title="When you're free">
          <ChipGroup
            legend="Time slots"
            options={options?.availabilitySlots ?? []}
            labels={AVAILABILITY_LABELS}
            selected={(value('availability') as string[]) ?? []}
            onChange={(next) => set('availability', next)}
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Hours per week"
              type="number"
              min={0}
              max={80}
              value={value('hoursPerWeek') === null ? '' : String(value('hoursPerWeek') ?? '')}
              onChange={(e) => set('hoursPerWeek', e.target.value === '' ? null : Number(e.target.value))}
              error={fieldErrors.hoursPerWeek}
            />
            <Input
              label="UTC offset"
              type="number"
              min={-12}
              max={14}
              value={value('timezoneOffset') === null ? '' : String(value('timezoneOffset') ?? '')}
              onChange={(e) =>
                set('timezoneOffset', e.target.value === '' ? null : Number(e.target.value))
              }
              hint="Baku is +4"
              error={fieldErrors.timezoneOffset}
            />
            <Input
              label="Preferred team size"
              type="number"
              min={2}
              max={12}
              value={value('preferredTeamSize') === null ? '' : String(value('preferredTeamSize') ?? '')}
              onChange={(e) =>
                set('preferredTeamSize', e.target.value === '' ? null : Number(e.target.value))
              }
              error={fieldErrors.preferredTeamSize}
            />
          </div>

        </Section>

        {/* -- working style ---------------------------------------------- */}
        <Section
          tour="style"
          title="How you work"
          hint="No wrong answers — we match complementary styles, not identical ones."
        >
          <div className="space-y-5">
            {(options?.personalityTraits ?? []).map((trait) => {
              const copy = TRAIT_COPY[trait] ?? { label: trait, low: 'Low', high: 'High' };
              const current = personality[trait] ?? 3;
              return (
                <div key={trait}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="type-label text-ink-700 dark:text-ink-300">{copy.label}</span>
                    <span className="readout text-xs text-accent-text">{current} / 5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={current}
                    aria-label={`${copy.label}: 1 is ${copy.low}, 5 is ${copy.high}`}
                    onChange={(e) =>
                      set('personality', { ...personality, [trait]: Number(e.target.value) })
                    }
                    className="mt-2 w-full cursor-pointer accent-iris-600"
                  />
                  <div className="mt-1 flex justify-between text-[0.7rem] text-ink-500 dark:text-ink-400">
                    <span>{copy.low}</span>
                    <span>{copy.high}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* -- experience -------------------------------------------------- */}
        <Section tour="experience" title="Proof of work">
          <ExperienceEditor
            entries={experiences}
            kinds={options?.experienceKinds ?? []}
            onChange={setExperiences}
          />
        </Section>

        {/* -- connections -------------------------------------------------- */}
        <Section tour="connections" title="Connected accounts" hint="Optional, but they add trust.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="GitHub"
              placeholder="https://github.com/you"
              value={(value('githubUrl') as string) ?? ''}
              onChange={(e) => set('githubUrl', e.target.value || null)}
              error={fieldErrors.githubUrl}
            />
            <Input
              label="Portfolio"
              placeholder="https://yoursite.dev"
              value={(value('portfolioUrl') as string) ?? ''}
              onChange={(e) => set('portfolioUrl', e.target.value || null)}
              error={fieldErrors.portfolioUrl}
            />
          </div>

          <Input
            label="Discord username"
            placeholder="yourname"
            value={(value('discordHandle') as string) ?? ''}
            onChange={(e) => set('discordHandle', e.target.value || null)}
            error={fieldErrors.discordHandle}
            hint="Most hackathons run on Discord — this is how teammates actually reach you."
          />

          <div className="flex flex-wrap gap-2.5">
            {['google', 'linkedin'].map((provider) => {
              const connected = connectedProviders.has(provider as 'google' | 'linkedin');
              return (
                <Button
                  key={provider}
                  size="sm"
                  variant={connected ? 'secondary' : 'outline'}
                  disabled={connected}
                  onClick={() => void connect(provider)}
                  className="capitalize"
                >
                  {connected ? `${provider} connected` : `Connect ${provider}`}
                </Button>
              );
            })}
          </div>
        </Section>
      </div>

      {/* -- save bar ------------------------------------------------------ */}
      <div
        data-tour="save"
        className={cn(
          'sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-4',
          'rounded-[var(--radius-soft-lg)] border border-iris-300 bg-white/95 px-5 py-4 backdrop-blur',
          'shadow-[var(--shadow-soft-lg)] dark:border-iris-500/40 dark:bg-ink-900/95',
        )}
      >
        <div className="min-w-0">
          {error ? (
            <p role="alert" className="text-sm font-medium text-signal-bad">
              {error}
            </p>
          ) : saved ? (
            <p role="status" className="text-sm font-medium text-success-text">
              Saved.
            </p>
          ) : (
            <p className="text-sm text-ink-600 dark:text-ink-300">
              {dirty ? 'You have unsaved changes.' : 'Everything is up to date.'}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {tour && (
            <Button variant="outline" onClick={() => void save(true)} disabled={saving}>
              Save &amp; finish setup
            </Button>
          )}
          <Button onClick={() => void save(false)} disabled={saving || !dirty} className={dirty ? 'pulse-cta' : ''}>
            {saving && <Spinner />}
            {saving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </div>

      <TourOverlay
        steps={TOUR_STEPS}
        open={tourOpen}
        onSkip={() => setTourOpen(false)}
        onFinish={() => setTourOpen(false)}
      />
    </Container>
  );
}

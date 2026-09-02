-- Registration rewrite: split names, OAuth identities, email confirmation,
-- and the profile fields the onboarding tour fills in.

-- ---------------------------------------------------------------------------
-- Names
-- ---------------------------------------------------------------------------
-- Signup now asks for first and last name separately. `full_name` stays as the
-- display column every existing query already selects; the service writes it
-- from the two halves so there is one thing to render and no join to do.

alter table users add column if not exists first_name text;
alter table users add column if not exists last_name  text;

update users
   set first_name = coalesce(nullif(split_part(full_name, ' ', 1), ''), full_name),
       last_name  = nullif(trim(substring(full_name from position(' ' in full_name) + 1)), '')
 where first_name is null;

-- ---------------------------------------------------------------------------
-- Passwords become optional
-- ---------------------------------------------------------------------------
-- An account created through Google or LinkedIn has no password and never
-- will. Login already refuses to match against a null hash, so the column
-- simply stops being required.

alter table users alter column password_hash drop not null;

-- ---------------------------------------------------------------------------
-- Profile: the matching inputs the onboarding tour collects
-- ---------------------------------------------------------------------------
-- Date of birth rather than an age integer: an age is wrong within a year of
-- being entered and nobody ever comes back to correct it. The API derives and
-- returns `age` so the UI still shows a single number.

alter table users add column if not exists date_of_birth       date;
alter table users add column if not exists pronouns            text;
alter table users add column if not exists location_city       text;
alter table users add column if not exists location_country    text;
alter table users add column if not exists languages           text[] not null default '{}';
alter table users add column if not exists interest_domains    text[] not null default '{}';
alter table users add column if not exists goals               text[] not null default '{}';
alter table users add column if not exists hackathons_attended integer not null default 0;
alter table users add column if not exists preferred_team_size integer;
alter table users add column if not exists discord_handle      text;

-- Lifecycle flags that drive which screen a signed-in account lands on.
alter table users add column if not exists email_verified       boolean not null default false;
alter table users add column if not exists onboarding_completed boolean not null default false;

-- Storage object path, kept alongside the public URL in `avatar_url` so an old
-- upload can be deleted when it is replaced.
alter table users add column if not exists avatar_path text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_hackathons_attended_check') then
    alter table users add constraint users_hackathons_attended_check
      check (hackathons_attended >= 0 and hackathons_attended <= 500);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'users_preferred_team_size_check') then
    alter table users add constraint users_preferred_team_size_check
      check (preferred_team_size is null or (preferred_team_size >= 2 and preferred_team_size <= 12));
  end if;

  -- Nobody under 13 and nobody older than the oldest living person: this is a
  -- typo guard, not an age policy.
  if not exists (select 1 from pg_constraint where conname = 'users_date_of_birth_check') then
    alter table users add constraint users_date_of_birth_check
      check (
        date_of_birth is null
        or (date_of_birth <= current_date - interval '13 years'
            and date_of_birth >= current_date - interval '120 years')
      );
  end if;
end
$$;

create index if not exists users_languages_idx on users using gin (languages);
create index if not exists users_interest_domains_idx on users using gin (interest_domains);
create index if not exists users_email_verified_idx on users (email_verified) where not email_verified;

-- Seeded demo accounts predate email confirmation; treat them as confirmed and
-- onboarded so the fixture data stays immediately usable.
update users set email_verified = true, onboarding_completed = true
 where email like '%@taptim.dev' and password_hash is not null;

-- ---------------------------------------------------------------------------
-- Email confirmation
-- ---------------------------------------------------------------------------
-- Only a hash of the token is stored. The row is a lookup key, not a
-- credential: a leaked database dump must not hand anyone a working
-- confirmation link.

create table if not exists email_verification_tokens (
  token_hash  text        primary key,
  user_id     uuid        not null references users (id) on delete cascade,
  email       text        not null,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists email_verification_tokens_user_idx
  on email_verification_tokens (user_id);

-- ---------------------------------------------------------------------------
-- OAuth identities
-- ---------------------------------------------------------------------------
-- One row per provider account. Separate from `users` so one person can hold
-- both a Google and a LinkedIn identity against a single TapTim account, and
-- so connecting a provider later is an insert rather than a schema change.

create table if not exists oauth_identities (
  provider            text        not null,
  provider_account_id text        not null,
  user_id             uuid        not null references users (id) on delete cascade,
  email               text,
  profile_url         text,
  created_at          timestamptz not null default now(),

  primary key (provider, provider_account_id),
  constraint oauth_identities_provider_check check (provider in ('google', 'linkedin'))
);

create index if not exists oauth_identities_user_idx on oauth_identities (user_id);

-- A person connects each provider at most once.
create unique index if not exists oauth_identities_one_per_provider
  on oauth_identities (user_id, provider);

-- ---------------------------------------------------------------------------
-- Experience
-- ---------------------------------------------------------------------------
-- Jobs, internships, projects, past hackathons, and study. One table rather
-- than four: they carry the same fields and the profile renders them as a
-- single timeline.

create table if not exists experiences (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references users (id) on delete cascade,
  kind         text        not null,
  title        text        not null,
  organisation text,
  start_date   date,
  end_date     date,
  is_current   boolean     not null default false,
  description  text,
  url          text,
  skills       text[]      not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint experiences_kind_check
    check (kind in ('work', 'internship', 'project', 'hackathon', 'education', 'volunteering')),
  -- An ongoing role has no end date, and a finished one cannot end before it began.
  constraint experiences_dates_check
    check (
      (is_current and end_date is null)
      or (not is_current and (start_date is null or end_date is null or end_date >= start_date))
    )
);

create index if not exists experiences_user_idx on experiences (user_id, start_date desc);

drop trigger if exists experiences_set_updated_at on experiences;
create trigger experiences_set_updated_at before update on experiences
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Lock the new tables against Supabase's public API roles, as in 001.
-- ---------------------------------------------------------------------------

alter table email_verification_tokens enable row level security;
alter table oauth_identities          enable row level security;
alter table experiences               enable row level security;

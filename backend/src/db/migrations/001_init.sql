-- TapTim Sprint 2 — initial schema.
--
-- The API connects as the database owner over a direct Postgres connection and
-- enforces every rule in the service layer. Row Level Security is switched on
-- with no policies at the end of this file so that Supabase's PostgREST roles
-- (anon / authenticated) cannot read these tables with a leaked API key; the
-- owner role the API uses bypasses RLS, so the backend is unaffected.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------

create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  email             text        not null unique,
  password_hash     text        not null,
  full_name         text        not null,
  primary_role      text        not null,
  skills            text[]      not null default '{}',
  bio               text,
  avatar_url        text,
  verified          boolean     not null default false,

  -- Matching inputs. Every field has a usable default so a Sprint 1 account
  -- still scores without being edited first.
  experience_level  text        not null default 'intermediate',
  availability      text[]      not null default '{}',
  hours_per_week    integer,
  timezone_offset   integer,
  personality       jsonb       not null default '{}'::jsonb,
  looking_for_team  boolean     not null default true,

  github_url        text,
  linkedin_url      text,
  portfolio_url     text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint users_experience_level_check
    check (experience_level in ('beginner', 'intermediate', 'advanced', 'expert')),
  constraint users_hours_per_week_check
    check (hours_per_week is null or (hours_per_week >= 0 and hours_per_week <= 80)),
  constraint users_timezone_offset_check
    check (timezone_offset is null or (timezone_offset >= -12 and timezone_offset <= 14))
);

create index if not exists users_skills_idx on users using gin (skills);
create index if not exists users_primary_role_idx on users (primary_role);
create index if not exists users_looking_for_team_idx on users (looking_for_team);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
-- The id stays `text` rather than `uuid`: the Sprint 1 catalogue is already
-- addressed as `evt-001` by the frontend, and keeping those ids stable means
-- the existing UI keeps working against the database-backed endpoints.

create table if not exists events (
  id                    text        primary key,
  name                  text        not null,
  description           text        not null,
  category              text        not null,
  tags                  text[]      not null default '{}',
  start_date            timestamptz not null,
  end_date              timestamptz not null,
  location              text        not null,
  mode                  text        not null,
  team_size_min         integer     not null,
  team_size_max         integer     not null,
  prize_pool            text,
  registration_deadline timestamptz not null,
  participants          integer     not null default 0,
  featured              boolean     not null default false,
  created_by            uuid        references users (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint events_mode_check check (mode in ('onsite', 'online', 'hybrid')),
  constraint events_team_size_check check (team_size_min >= 1 and team_size_max >= team_size_min),
  constraint events_dates_check check (end_date >= start_date),
  constraint events_participants_check check (participants >= 0)
);

create index if not exists events_category_idx on events (category);
create index if not exists events_start_date_idx on events (start_date);
create index if not exists events_featured_idx on events (featured);

drop trigger if exists events_set_updated_at on events;
create trigger events_set_updated_at before update on events
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------

create table if not exists teams (
  id              uuid        primary key default gen_random_uuid(),
  event_id        text        not null references events (id) on delete cascade,
  owner_id        uuid        not null references users (id) on delete cascade,
  name            text        not null,
  description     text,
  looking_for     text[]      not null default '{}',
  required_skills text[]      not null default '{}',
  max_size        integer     not null,
  status          text        not null default 'recruiting',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint teams_status_check check (status in ('recruiting', 'full', 'locked', 'disbanded')),
  constraint teams_max_size_check check (max_size >= 1 and max_size <= 12)
);

-- One team name per event, case-insensitively, so "Team Alpha" and "team alpha"
-- cannot both exist and confuse participants picking from a list.
create unique index if not exists teams_event_name_key on teams (event_id, lower(name));
create index if not exists teams_event_status_idx on teams (event_id, status);
create index if not exists teams_owner_idx on teams (owner_id);

drop trigger if exists teams_set_updated_at on teams;
create trigger teams_set_updated_at before update on teams
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------

create table if not exists team_members (
  team_id   uuid        not null references teams (id) on delete cascade,
  user_id   uuid        not null references users (id) on delete cascade,
  role      text        not null,
  is_owner  boolean     not null default false,
  joined_at timestamptz not null default now(),

  primary key (team_id, user_id)
);

create index if not exists team_members_user_idx on team_members (user_id);

-- A participant belongs to at most one team per event. Enforced here rather
-- than in the service layer because two concurrent accept-requests would both
-- pass an application-level check.
create table if not exists team_event_membership (
  user_id  uuid not null references users (id) on delete cascade,
  event_id text not null references events (id) on delete cascade,
  team_id  uuid not null references teams (id) on delete cascade,
  primary key (user_id, event_id)
);

create index if not exists team_event_membership_team_idx on team_event_membership (team_id);

-- ---------------------------------------------------------------------------
-- team_requests — invitations (team → user) and applications (user → team)
-- ---------------------------------------------------------------------------

create table if not exists team_requests (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references teams (id) on delete cascade,
  user_id    uuid        not null references users (id) on delete cascade,
  kind       text        not null,
  status     text        not null default 'pending',
  message    text,
  created_by uuid        not null references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_requests_kind_check check (kind in ('invite', 'application')),
  constraint team_requests_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled'))
);

-- Only one open request of each kind per (team, user); resolved rows stay as
-- history and do not block a later re-application.
create unique index if not exists team_requests_open_key
  on team_requests (team_id, user_id, kind)
  where status = 'pending';

create index if not exists team_requests_user_idx on team_requests (user_id, status);
create index if not exists team_requests_team_idx on team_requests (team_id, status);

drop trigger if exists team_requests_set_updated_at on team_requests;
create trigger team_requests_set_updated_at before update on team_requests
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- certificates
-- ---------------------------------------------------------------------------

create table if not exists certificates (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references users (id) on delete cascade,
  title          text        not null,
  issuer         text        not null,
  issued_on      date,
  credential_id  text,
  credential_url text,
  skills         text[]      not null default '{}',
  status         text        not null default 'pending',
  confidence     numeric(4, 3),
  verdict_reason text,
  verified_by    text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint certificates_status_check
    check (status in ('pending', 'verified', 'rejected')),
  constraint certificates_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists certificates_user_idx on certificates (user_id, status);

drop trigger if exists certificates_set_updated_at on certificates;
create trigger certificates_set_updated_at before update on certificates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Lock the tables against Supabase's public API roles.
-- ---------------------------------------------------------------------------
-- No policies are defined, so anon/authenticated see nothing over PostgREST.
-- The owner role used by this backend bypasses RLS and is unaffected.

alter table users                 enable row level security;
alter table events                enable row level security;
alter table teams                 enable row level security;
alter table team_members          enable row level security;
alter table team_event_membership enable row level security;
alter table team_requests         enable row level security;
alter table certificates          enable row level security;

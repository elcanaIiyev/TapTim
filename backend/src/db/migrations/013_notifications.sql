-- Notifications.
--
-- Stored rather than derived. Most of what people need to know about *could* be
-- computed from current state — a pending invitation is a row in
-- `team_requests`, an unread message is a message with no read mark — but the
-- most important cases leave nothing behind to compute from. "Kenan accepted
-- your application" is a transition, not a state: once it is accepted the
-- request row says `accepted` and there is no way to tell whether the person it
-- concerns has ever seen that. A derived feed silently drops exactly the events
-- someone most wants to be told about.
--
-- Deliberately denormalised. `title`, `body` and `link` are written at emit
-- time rather than reconstructed on read, so a notification keeps saying what it
-- said even after the team is renamed, the request is withdrawn, or the account
-- that caused it is deleted. Reconstructing them would mean every read joins
-- four tables to render one line, and rows about deleted things would render as
-- holes.

create table if not exists notifications (
  id         uuid        primary key default gen_random_uuid(),
  /** Who is being told. */
  user_id    uuid        not null references users (id) on delete cascade,
  kind       text        not null,
  title      text        not null,
  body       text,
  /** In-app path to open, e.g. /teams/<id>. Null for the purely informational. */
  link       text,
  /**
   * Who caused it, kept only for the avatar. Nulled rather than cascaded on
   * delete: the notification is still true and still worth reading after the
   * person who triggered it has gone.
   */
  actor_id   uuid        references users (id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_kind_check check (kind in (
    'team-invitation',
    'team-application',
    'request-accepted',
    'request-declined',
    'team-member-joined',
    'removed-from-team',
    'connection-request',
    'connection-accepted'
  ))
);

-- The feed: this person's newest first.
create index if not exists notifications_feed_idx
  on notifications (user_id, created_at desc);

-- The badge is read on every page load, so the unread rows get a partial index
-- rather than making that count scan the whole history.
create index if not exists notifications_unread_idx
  on notifications (user_id) where read_at is null;

alter table notifications enable row level security;

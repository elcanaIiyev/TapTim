-- Team channels.
--
-- A separate table rather than a `team_id` bolted onto `messages`. That table
-- is keyed on a canonical pair with `check (pair_a < pair_b)` and a pair index
-- carrying every read; adding a team channel to it would mean making both pair
-- columns nullable, dropping the constraint that makes a DM singular, and
-- teaching every existing query to say "and team_id is null". The DM invariant
-- is worth more than the one table.
--
-- Read state is per member, not per message. A direct message has exactly one
-- recipient, so `messages.read_at` on the row itself is right. A team message
-- has as many recipients as the roster, and a row per (message, member) grows
-- multiplicatively for a number nobody needs at that resolution — the only
-- question anyone asks is "how many have I not seen". One high-water mark per
-- member answers it in a single comparison.

create table if not exists team_messages (
  id         uuid        primary key default gen_random_uuid(),
  team_id    uuid        not null references teams (id) on delete cascade,
  sender_id  uuid        not null references users (id) on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now(),

  constraint team_messages_body_check check (length(btrim(body)) between 1 and 2000)
);

-- The one query this table serves: "the newest messages in this channel".
create index if not exists team_messages_channel_idx
  on team_messages (team_id, created_at desc);

-- Counting somebody's unread means scanning this team's messages newer than
-- their mark and excluding their own, so sender is part of the same lookup.
create index if not exists team_messages_unread_idx
  on team_messages (team_id, created_at, sender_id);

/**
 * How far each member has read in each channel.
 *
 * A row appears the first time somebody opens a channel. Its absence means
 * "never opened", which is deliberately distinct from a mark of the epoch:
 * a member who joins an old team should not arrive to two hundred unread.
 * `joined_at` on team_members is the floor the service uses instead.
 */
create table if not exists team_message_reads (
  team_id      uuid        not null references teams (id) on delete cascade,
  user_id      uuid        not null references users (id) on delete cascade,
  last_read_at timestamptz not null default now(),

  primary key (team_id, user_id)
);

alter table team_messages      enable row level security;
alter table team_message_reads enable row level security;

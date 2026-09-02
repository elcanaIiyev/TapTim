-- Connections and direct messages.
--
-- Both are relationships between two people with no inherent direction, and
-- both would otherwise allow two rows for the same pair — (A,B) and (B,A) —
-- which every read would then have to remember to check twice.
--
-- So the pair is stored canonically: `user_a` is always the smaller uuid. A
-- check constraint enforces it, a unique index makes the pair singular, and
-- `requested_by` carries the direction that actually matters. Callers order
-- the two ids before querying and never have to write an OR.

create table if not exists connections (
  id           uuid        primary key default gen_random_uuid(),
  user_a       uuid        not null references users (id) on delete cascade,
  user_b       uuid        not null references users (id) on delete cascade,
  /** Who asked. The other side is the one who accepts or declines. */
  requested_by uuid        not null references users (id) on delete cascade,
  status       text        not null default 'pending',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint connections_ordered check (user_a < user_b),
  constraint connections_status_check check (status in ('pending', 'accepted', 'declined'))
);

create unique index if not exists connections_pair_key on connections (user_a, user_b);
create index if not exists connections_user_a_idx on connections (user_a, status);
create index if not exists connections_user_b_idx on connections (user_b, status);

drop trigger if exists connections_set_updated_at on connections;
create trigger connections_set_updated_at before update on connections
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------
-- Keyed on the same canonical pair rather than on a connection id, so a
-- conversation survives the connection being removed and re-made. Sending is
-- gated on an accepted connection in the service layer; the history is not.

create table if not exists messages (
  id         uuid        primary key default gen_random_uuid(),
  pair_a     uuid        not null references users (id) on delete cascade,
  pair_b     uuid        not null references users (id) on delete cascade,
  sender_id  uuid        not null references users (id) on delete cascade,
  body       text        not null,
  read_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint messages_ordered check (pair_a < pair_b),
  constraint messages_body_check check (length(btrim(body)) between 1 and 2000)
);

-- The one query this table serves: "the newest messages in this conversation".
create index if not exists messages_pair_idx on messages (pair_a, pair_b, created_at desc);

-- Unread counts are read on every page load for the nav badge, so the rows
-- that answer that question get their own partial index.
create index if not exists messages_unread_idx
  on messages (pair_a, pair_b, sender_id) where read_at is null;

alter table connections enable row level security;
alter table messages    enable row level security;

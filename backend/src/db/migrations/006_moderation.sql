-- Account suspension.
--
-- One nullable timestamp rather than a boolean plus a date: null means "not
-- banned", a timestamp means "banned until then", and `'infinity'` means
-- permanently. A boolean alongside a date invites the state where they
-- disagree, and every read then has to decide which one it trusts.
--
-- Expiry needs no scheduled job. A temporary ban simply stops being true when
-- `now()` passes it, so nothing has to run to lift it.

alter table users add column if not exists banned_until  timestamptz;
alter table users add column if not exists banned_reason text;
alter table users add column if not exists banned_at     timestamptz;
alter table users add column if not exists banned_by     uuid references users (id) on delete set null;

-- Partial: only currently-banned rows are worth indexing, and the list of them
-- is tiny next to the table.
create index if not exists users_banned_until_idx
  on users (banned_until) where banned_until is not null;

comment on column users.banned_until is
  'NULL = active. A timestamp = suspended until then. ''infinity'' = permanent.';

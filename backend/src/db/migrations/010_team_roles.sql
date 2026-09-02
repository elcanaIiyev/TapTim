-- One role per person becomes several.
--
-- `primary_role` modelled a job title, and that was the wrong shape for what
-- this field is actually for. Nobody arrives at a hackathon as exactly one
-- thing: the same person is the backend developer *and* the one who presents on
-- Sunday, and a team that has nobody willing to pitch loses for a reason that
-- has nothing to do with code. Forcing a single choice hid the second half of
-- what someone brings.
--
-- So it becomes a set, and the catalogue grows past engineering titles to
-- include the positions a team actually needs filled on the day — presenter,
-- business analyst, researcher, and so on
-- (`backend/src/modules/users/user.model.ts`).
--
-- The column is replaced rather than kept alongside a new one. Two columns
-- describing the same thing is how they drift: some code would read
-- `primary_role`, some would read `roles[1]`, and a profile edited through one
-- path would disagree with itself through the other.

alter table users
  add column if not exists roles text[] not null default '{}';

-- Everyone keeps the role they already had, as the first entry.
update users
set roles = array[primary_role]
where primary_role is not null
  and primary_role <> ''
  and cardinality(roles) = 0;

-- A profile has to claim at least one role: it is what team search filters on,
-- and "no role" would make someone invisible to every search rather than
-- broadly available.
alter table users
  add constraint users_roles_not_empty check (cardinality(roles) > 0);

-- Selecting every role would otherwise be strictly better than choosing
-- honestly, which turns the field into noise. Five is more than anyone
-- genuinely fills in a weekend.
alter table users
  add constraint users_roles_max check (cardinality(roles) <= 5);

drop index if exists users_primary_role_idx;
alter table users drop column if exists primary_role;

-- `&&` (overlap) is what the directory filters on — "anyone who can present" —
-- and that needs GIN, the same as skills.
create index if not exists users_roles_idx on users using gin (roles);

comment on column users.roles is
  'Roles this person can play on a team, 1..5 of them. Not job titles — positions for the event.';

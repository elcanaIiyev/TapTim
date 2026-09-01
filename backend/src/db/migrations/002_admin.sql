-- Account-level admin flag.
--
-- Distinct from `users.primary_role`, which is the *product* role a participant
-- plays on a team (Frontend Developer, Designer, …). This column is about
-- privilege inside TapTim itself, and only the admin console reads it.
--
-- There is deliberately no way to set this over the public API — not even by an
-- admin editing their own profile. The first admin is granted with
-- `npm run admin:grant`, and after that admins promote each other from the
-- console.

alter table users
  add column if not exists is_admin boolean not null default false;

-- Admins are a handful of rows out of the whole table, so a partial index keeps
-- "list the admins" cheap without carrying an entry for every ordinary account.
create index if not exists users_is_admin_idx on users (is_admin) where is_admin;

-- Site roles, replacing the `is_admin` boolean from 002.
--
-- A boolean could only ever say "staff or not". A column with an ordered set of
-- values can carry the middle tier — a moderator who can act on abuse without
-- also being able to hand out privilege — which is the distinction a flag
-- cannot express.
--
-- Still separate from `users.primary_role`, which is the *profession* someone
-- practises on a team (Frontend Developer, Designer, …). The two never mix:
-- this column is about authority on the site, that one is about what you build.

alter table users
  add column if not exists account_role text not null default 'user';

-- Carry 002's flag across before the constraint lands, so existing admins keep
-- their access rather than being silently reset to 'user'.
update users set account_role = 'admin' where is_admin;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_account_role_check'
  ) then
    alter table users
      add constraint users_account_role_check
      check (account_role in ('user', 'moderator', 'admin'));
  end if;
end
$$;

drop index if exists users_is_admin_idx;
alter table users drop column if exists is_admin;

-- Staff are a handful of rows; a partial index keeps "list the staff" cheap
-- without carrying an entry for every ordinary account.
create index if not exists users_account_role_idx
  on users (account_role) where account_role <> 'user';

-- Skill proficiency.
--
-- `skills text[]` stays the canonical set. Everything that matters for matching
-- reads it as a set — the GIN index, the `&&` overlap filter, and the
-- compatibility engine's intersection — and none of that works on an array of
-- objects. So the level lives alongside it as a map rather than replacing it.
--
-- The two are kept consistent in one place: `userStore.update` prunes
-- `skill_levels` to whatever `skills` contains on every write, so a level for a
-- skill someone has removed cannot linger.

alter table users
  add column if not exists skill_levels jsonb not null default '{}'::jsonb;

comment on column users.skill_levels is
  'Map of skill name -> proficiency 1..5. Keys are always a subset of skills[].';

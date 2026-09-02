-- Skill proficiency moves from a 1–5 step to a 0–100 scale.
--
-- Five steps turned out to be too coarse in the place it mattered most. An
-- event's focus-area coverage is computed from proficiency, and with only five
-- values the gap between "I can build with Node" and "I have shipped Node for
-- three years" was a single step — so somebody deep in one backend skill and
-- somebody who had followed a tutorial landed within 20 points of each other.
-- A continuous scale separates them.
--
-- The labels are kept. They stop being the *value* and become bands over it:
-- 0–19 Learning, 20–39 Familiar, 40–59 Comfortable, 60–79 Strong, 80–100
-- Expert (`backend/src/modules/users/skill-catalogue.ts`). Someone still reads
-- a word rather than a bare number, which is what made the labels worth having.
--
-- Existing values are mapped to the midpoint of the band they meant, so nobody
-- who filled in a profile under the old scale is silently re-rated:
-- 1 -> 10, 2 -> 30, 3 -> 50, 4 -> 70, 5 -> 90.

update users
set skill_levels = (
  select coalesce(
    jsonb_object_agg(
      key,
      -- Only the old 1–5 range is rescaled. Anything already on the new scale
      -- is carried across untouched, so re-running this after a partial
      -- failure cannot double-convert a value.
      case when value ~ '^[1-5]$' then (value::int - 1) * 20 + 10 else value::int end
    ),
    '{}'::jsonb
  )
  from jsonb_each_text(skill_levels)
  -- A non-numeric value could only come from outside the API. Dropping it is
  -- right: it has no meaning on either scale, and `::int` would abort the
  -- migration for every user.
  where value ~ '^\d+$'
)
where skill_levels <> '{}'::jsonb;

-- A CHECK constraint cannot contain a subquery, and validating a map means
-- walking its entries — hence the helper. IMMUTABLE because the answer depends
-- on nothing but the argument, which is what lets a constraint call it.
create or replace function skill_levels_in_range(levels jsonb) returns boolean
language sql immutable parallel safe as $$
  select coalesce(
    bool_and(value ~ '^\d+$' and value::int between 0 and 100),
    true  -- an empty map is valid
  )
  from jsonb_each_text(levels);
$$;

alter table users
  drop constraint if exists users_skill_levels_range;

alter table users
  add constraint users_skill_levels_range check (skill_levels_in_range(skill_levels));

comment on column users.skill_levels is
  'Map of skill name -> proficiency 0..100. Keys are always a subset of skills[].';

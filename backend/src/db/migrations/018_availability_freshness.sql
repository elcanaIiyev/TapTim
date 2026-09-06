-- When availability was last confirmed.
--
-- Availability is the heaviest single component the matching engine has — a
-- hackathon weights it 28 of 100 — and it is the one people fill in once during
-- onboarding and never look at again. Availability that is three months stale
-- is worse than availability that is absent, because the engine trusts it: an
-- empty slot list scores low and says so, while a wrong one scores high and
-- lies.
--
-- `updated_at` cannot answer this. It moves whenever any field changes, so
-- somebody who edited their bio this morning looks like they confirmed their
-- Saturday availability this morning too.
--
-- Backfilled to `updated_at` rather than to null: it is the last moment we know
-- the row was touched at all, so it is the most generous defensible reading,
-- and it stops every existing account being told its availability is stale on
-- the day this ships.

alter table users
  add column if not exists availability_confirmed_at timestamptz;

update users
   set availability_confirmed_at = updated_at
 where availability_confirmed_at is null;

-- Per-event stat profiles.
--
-- What a team needs is not the same at every event: engine and art skill decide
-- a game jam, security depth decides a CTF, and a 48-hour build lives on
-- overlapping hours in a way a month-long one does not. Each event therefore
-- carries which skill areas it draws on, which roles it needs covered, and how
-- to re-weight the five compatibility components.
--
-- Nullable, because the answer is usually "whatever this category normally
-- means". A null column falls back to the archetype for `events.category`
-- (`backend/src/modules/events/event-stats.ts`), so the common case stores
-- nothing and only a deliberately unusual event carries an override.

alter table events add column if not exists stat_profile jsonb;

comment on column events.stat_profile is
  'Optional override of the category archetype: { summary, weights, focusAreas, keyRoles }. NULL = use the archetype.';

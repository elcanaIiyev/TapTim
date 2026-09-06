-- Endorsements carry the event they came from.
--
-- An endorsement was permanent and context-free: someone strong at React two
-- years ago counted exactly as much as someone endorsed last weekend, and the
-- coverage engine had no way to tell the difference. It already required that
-- the two people had shared a team, so the evidence existed — it simply was
-- not kept in a form anything could read.
--
-- The event fixes both halves at once. It dates the endorsement against
-- something real (an event has an end date; a row's `created_at` only says when
-- somebody got round to clicking), and it makes the claim auditable without a
-- moderator: both people were on the same team at a named event.
--
-- Denormalised rather than joined through `team_id` on every read. `team_id` is
-- `on delete set null`, so a disbanded team takes its own context with it —
-- and losing the event would silently downgrade every endorsement that team
-- produced.

alter table skill_endorsements
  add column if not exists event_id text references events (id) on delete set null;

-- Backfill from the team the endorsement was already recorded against. Rows
-- whose team is gone stay null and are weighted as unverified, which is
-- honest: nothing left can confirm where they came from.
update skill_endorsements e
   set event_id = t.event_id
  from teams t
 where t.id = e.team_id
   and e.event_id is null;

-- The weighting read joins events for their end date; this keeps the lookup
-- from that side cheap.
create index if not exists skill_endorsements_event_idx
  on skill_endorsements (event_id);

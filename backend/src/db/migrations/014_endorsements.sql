-- Endorsements on individual skills.
--
-- Self-reported 0–100 proficiency now drives the whole coverage calculation,
-- and nothing stopped anyone claiming 95 at everything — which quietly poisons
-- the recruit brief for their own team, since a gap the engine believes is
-- covered is a gap nobody goes looking to fill.
--
-- An endorsement is one person saying "yes, I have seen them do this". It does
-- not change the number: overwriting somebody's self-assessment with a crowd
-- average would make the slider meaningless and the result harder to explain.
-- It changes how much the number is *trusted* — see `coverageFor`.
--
-- Who may endorse is a service-layer rule (you must have shared a team), not a
-- constraint, because it depends on history this table cannot see. What is
-- enforced here is what the data must never be regardless of that rule: you
-- cannot endorse yourself, and you cannot endorse the same skill twice.

create table if not exists skill_endorsements (
  /** The person being endorsed. */
  user_id     uuid        not null references users (id) on delete cascade,
  endorser_id uuid        not null references users (id) on delete cascade,
  /** Canonical catalogue name, matching an entry in `users.skills`. */
  skill       text        not null,
  /** The team they worked together on, kept so the claim is auditable. */
  team_id     uuid        references teams (id) on delete set null,
  created_at  timestamptz not null default now(),

  primary key (user_id, endorser_id, skill),
  constraint skill_endorsements_not_self check (user_id <> endorser_id)
);

-- "How endorsed is each of this person's skills" — the read behind every
-- profile and every coverage calculation.
create index if not exists skill_endorsements_user_idx
  on skill_endorsements (user_id, skill);

-- "What have I already endorsed for them", to render the buttons correctly.
create index if not exists skill_endorsements_endorser_idx
  on skill_endorsements (endorser_id, user_id);

alter table skill_endorsements enable row level security;

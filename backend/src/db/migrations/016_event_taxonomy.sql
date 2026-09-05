-- One category becomes two axes: format and domains.
--
-- `category` mixed two different questions into one list. "Hackathons" is a
-- *format* — how the event runs — while "Design", "AI" and "Cybersecurity" are
-- *domains*, what it is about. They are orthogonal, and forcing one value meant
-- a design hackathon had nowhere to sit: filing it under Hackathons hid it from
-- every designer browsing Design, and filing it under Design lied about what
-- kind of event it was.
--
-- The split also makes the scoring archetypes more honest, because they were
-- already conflating the same two things. Look at what the old profiles
-- actually encoded:
--
--   * `weights` tracked the format. A 48-hour hackathon weighted availability
--     28 because overlapping hours decide it; a CTF weighted credibility 18
--     because proven depth does.
--   * `focusAreas` tracked the domain. Design meant Design/Frontend/Product
--     regardless of whether it was a jam or a week-long sprint.
--
-- So format now drives the weights, domains drive the focus areas, and an event
-- gets a profile composed from both rather than picked from a list of nine
-- pre-blended ones.
--
-- Backfilled from the old value so nothing is lost. The seeded catalogue is
-- re-stated properly by `db:seed`; anything organiser-created keeps a sensible
-- reading of whatever it had.

alter table events add column if not exists format  text;
alter table events add column if not exists domains text[] not null default '{}';

update events set
  format = case category
    when 'Hackathons'    then 'Hackathon'
    when 'Gaming'        then 'Jam'
    when 'Cybersecurity' then 'Capture the Flag'
    when 'Programming'   then 'Competitive contest'
    when 'Design'        then 'Sprint'
    when 'Startup'       then 'Startup weekend'
    else 'Hackathon'
  end,
  domains = case category
    when 'Hackathons'    then array['Web', 'Product & business']
    when 'AI'            then array['AI & ML']
    when 'Programming'   then array['Web']
    when 'Design'        then array['Design']
    when 'Gaming'        then array['Game development', 'Design']
    when 'Web3'          then array['Web3']
    when 'Cybersecurity' then array['Security']
    when 'Startup'       then array['Product & business']
    when 'Data Science'  then array['Data']
    else array['Web']
  end
where format is null;

alter table events alter column format set not null;

-- Every event is exactly one format and at least one domain. The upper bound
-- exists for the same reason the role cap does: an event tagged with every
-- domain matches every search and therefore says nothing.
alter table events
  add constraint events_domains_bounds check (cardinality(domains) between 1 and 4);

drop index if exists events_category_idx;
alter table events drop column if exists category;

create index if not exists events_format_idx  on events (format);
-- `&&` (overlap) is what the filter runs: "anything touching Design".
create index if not exists events_domains_idx on events using gin (domains);

comment on column events.format  is 'How the event runs. Drives the scoring weights.';
comment on column events.domains is 'What it is about, 1..4. Drives the focus areas.';

-- Cover images for events, and logos for teams.
--
-- Both are presentation rather than matching data — nothing in the compatibility
-- engine reads them — but an events list of thirteen text cards is hard to scan,
-- and a team with a logo reads as a real team rather than a row in a table.
--
-- `events.cover_image_url` is a plain URL rather than a path into our own
-- storage bucket: the seeded catalogue points at an external CDN, and an
-- organiser pasting a link should work without an upload. Nullable, and the UI
-- falls back to a generated cover derived from the category, so a missing or
-- dead URL degrades to something deliberate instead of a broken-image icon.
--
-- Teams carry both halves, the same way users do for avatars: `logo_url` is what
-- gets rendered, `logo_path` is the object key needed to delete the old file
-- when a new one replaces it. Without the path we would leak an orphaned object
-- into the bucket on every change.

alter table events add column if not exists cover_image_url text;

alter table teams add column if not exists logo_url  text;
alter table teams add column if not exists logo_path text;

comment on column events.cover_image_url is
  'Optional cover image. NULL falls back to a generated cover keyed on category.';
comment on column teams.logo_path is
  'Storage object key for the current logo, so it can be deleted when replaced.';

-- `skill-endorsed` joins the notification kinds.
--
-- The kind list is a check constraint rather than a lookup table, which keeps
-- bad data out at the cost of a migration whenever the list grows. That is the
-- right trade at this size — the constraint is what guarantees a typo'd kind
-- can never be written and then fail to render — but it does mean the enum in
-- `notification.store.ts` and this constraint have to move together.

alter table notifications drop constraint if exists notifications_kind_check;

alter table notifications add constraint notifications_kind_check check (kind in (
  'team-invitation',
  'team-application',
  'request-accepted',
  'request-declined',
  'team-member-joined',
  'removed-from-team',
  'connection-request',
  'connection-accepted',
  'skill-endorsed'
));

/**
 * `pg` hands back `timestamptz` columns as JS `Date`s. Every date the API emits
 * is an ISO-8601 UTC string, so row mappers funnel their timestamps through
 * here rather than each one re-deriving the conversion.
 */
export function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toIsoOrNull(value: Date | string | null | undefined): string | null {
  return value === null || value === undefined ? null : toIso(value);
}

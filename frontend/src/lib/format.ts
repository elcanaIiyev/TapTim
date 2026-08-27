// An event's date is a property of the event, not of whoever is reading the
// page: "12 Sept" must say 12 Sept in Baku and in Honolulu alike. The API sends
// UTC instants, so every formatter and every date component below is pinned to
// UTC. Reading them in the viewer's zone shifted the day for anyone west of UTC.
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});

/** "12 – 14 Sep 2026", collapsing the month when both ends share one. */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    // A single-day event has no range to show; "28 – 28 Sept" reads as a typo.
    if (start.getUTCDate() === end.getUTCDate()) {
      return dateFormatter.format(end);
    }
    return `${start.getUTCDate()} – ${dateFormatter.format(end)}`;
  }
  return `${shortDateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

export function formatTeamSize({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} members` : `${min}–${max} members`;
}

export function formatParticipants(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

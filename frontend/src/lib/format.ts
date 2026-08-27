const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

/** "12 – 14 Sep 2026", collapsing the month when both ends share one. */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    // A single-day event has no range to show; "28 – 28 Sept" reads as a typo.
    if (start.getDate() === end.getDate()) {
      return dateFormatter.format(end);
    }
    return `${start.getDate()} – ${dateFormatter.format(end)}`;
  }
  return `${shortDateFormatter.format(start)} – ${dateFormatter.format(end)}`;
}

export function formatTeamSize({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} members` : `${min}–${max} members`;
}

export function formatParticipants(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

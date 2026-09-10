import { queryOne } from '../../db/pool.js';

/**
 * The platform's real numbers, for the landing page.
 *
 * These replaced three invented ones — "12K+ builders matched, 480 teams
 * formed, 92% average match" — on a site with ten accounts and one team. A
 * small true number is a better argument than a large false one, and it is the
 * only kind that survives someone signing up and looking around.
 */
export interface PlatformStats {
  /** Accounts not currently banned. */
  participants: number;
  /** Teams that exist and have not been disbanded. */
  teams: number;
  /** People sitting on at least one team. */
  onTeams: number;
  events: number;
}

export async function platformStats(): Promise<PlatformStats> {
  const row = await queryOne<Record<keyof PlatformStats, string>>(`
    select
      (select count(*) from users
        where banned_until is null or banned_until < now())::text        as participants,
      (select count(*) from teams where status <> 'disbanded')::text     as teams,
      (select count(distinct user_id) from team_members)::text           as "onTeams",
      (select count(*) from events)::text                                as events
  `);

  return {
    participants: Number(row?.participants ?? 0),
    teams: Number(row?.teams ?? 0),
    onTeams: Number(row?.onTeams ?? 0),
    events: Number(row?.events ?? 0),
  };
}

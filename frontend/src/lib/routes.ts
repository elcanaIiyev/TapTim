/**
 * The admin console's path, declared once so the route, the switch, and the
 * "am I in admin mode?" check cannot drift apart.
 *
 * It is unlisted rather than secret: nothing links to it except the switch,
 * which only renders for admins. The access check that matters is server-side —
 * `requireAdmin` answers every non-admin with a 404 — so this constant being
 * readable in the bundle costs nothing.
 */
export const ADMIN_CONSOLE_PATH = '/staff/ops-console';

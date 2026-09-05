import type {
  AdminAccount,
  AdminSummary,
  ChatMessage,
  ConnectionsOverview,
  ConnectionView,
  Conversation,
  DirectoryUser,
  EventCandidate,
  EventStats,
  MyEventFit,
  Team,
  TeamDetail,
  NotificationFeed,
  ProfileEndorsements,
  SkillEndorsement,
  NotificationItem,
  TeamChannel,
  TeamChatMessage,
  TeamEventReport,
  TeamRequest,
  AuthResult,
  CategoryCount,
  EventItem,
  Experience,
  ExperiencePayload,
  FieldIssue,
  LoginPayload,
  MeResponse,
  ProfileOptions,
  ProfilePayload,
  ProviderStatus,
  SignupPayload,
  SignupResult,
  User,
} from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'taptim-token';

/** Mirrors the backend's `{ error: { code, message, details } }` envelope. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues: FieldIssue[];

  constructor(status: number, code: string, message: string, issues: FieldIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) — session stays in memory only */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nothing to clean up */
    }
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  // FormData sets its own multipart Content-Type including the boundary;
  // naming it here would produce a body the server cannot parse.
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = tokenStorage.get();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Could not reach the API at ${API_URL}. Is the backend running?`,
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = response.status === 204 || !isJson ? null : await response.json();

  if (!response.ok) {
    const error = payload?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN',
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details ?? [],
    );
  }

  return payload as T;
}

export const authApi = {
  /** Step 1 of the wizard: is this address free, before asking for anything else? */
  checkEmail: (email: string) =>
    request<{ data: { available: boolean } }>('/api/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }).then((r) => r.data.available),

  signup: (body: SignupPayload) =>
    request<{ data: SignupResult }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  login: (body: LoginPayload) =>
    request<{ data: AuthResult }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  me: () => request<{ data: MeResponse }>('/api/auth/me').then((r) => r.data),

  verifyEmail: (token: string) =>
    request<{ data: AuthResult }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }).then((r) => r.data),

  resendVerification: (email: string) =>
    request<{ data: { sent: boolean; error: string | null } }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }).then((r) => r.data),

  /** Which providers this deployment can actually offer. */
  providers: () =>
    request<{ data: ProviderStatus[] }>('/api/auth/providers').then((r) => r.data),

  /**
   * Full-page navigation, not fetch: the provider's consent screen has to own
   * the tab, and it will not render inside XHR.
   */
  startOAuth(provider: string) {
    window.location.href = `${API_URL}/api/auth/oauth/${provider}`;
  },

  /** Same flow, but attaches the provider to the account already signed in. */
  connectOAuth: (provider: string) =>
    request<{ data: { url: string } }>(`/api/auth/oauth/${provider}/connect`).then((r) => r.data.url),

  disconnectOAuth: (provider: string) =>
    request<void>(`/api/auth/oauth/${provider}`, { method: 'DELETE' }),
};

export const profileApi = {
  /** Public — the chips render from this before anyone signs in. */
  options: () =>
    request<{ data: ProfileOptions }>('/api/users/profile-options').then((r) => r.data),

  me: () => request<{ data: MeResponse }>('/api/users/me').then((r) => r.data),

  update: (body: ProfilePayload) =>
    request<{ data: User }>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /**
   * Multipart, so `Content-Type` is deliberately left unset — the browser has
   * to add its own `boundary` and would be overridden if we named the type.
   */
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return request<{ data: User }>('/api/users/me/avatar', {
      method: 'POST',
      body: form,
    }).then((r) => r.data);
  },

  removeAvatar: () =>
    request<{ data: User }>('/api/users/me/avatar', { method: 'DELETE' }).then((r) => r.data),

  /** One participant, as everyone but they themselves see them. */
  get: (id: string) =>
    request<{ data: DirectoryUser }>(`/api/users/${id}`).then((r) => r.data),

  /** Everyone open to joining a team. The caller is excluded server-side. */
  directory: (query: { search?: string; roles?: string[] } = {}) => {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    // `roles`, not `primaryRole`: the API stopped accepting the singular form
    // when roles became a set, so this filter had been silently doing nothing.
    if (query.roles?.length) params.set('roles', query.roles.join(','));
    params.set('lookingForTeam', 'true');
    params.set('limit', '50');
    return request<{ data: DirectoryUser[] }>(`/api/users?${params.toString()}`).then((r) => r.data);
  },

  experiences: () =>
    request<{ data: Experience[] }>('/api/users/me/experiences').then((r) => r.data),

  addExperience: (body: ExperiencePayload) =>
    request<{ data: Experience }>('/api/users/me/experiences', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  updateExperience: (id: string, body: Partial<ExperiencePayload>) =>
    request<{ data: Experience }>(`/api/users/me/experiences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  removeExperience: (id: string) =>
    request<void>(`/api/users/me/experiences/${id}`, { method: 'DELETE' }),
};

export interface EventQuery {
  category?: string;
  search?: string;
  featured?: boolean;
  limit?: number;
}

export const eventsApi = {
  list(query: EventQuery = {}) {
    const params = new URLSearchParams();
    if (query.category && query.category !== 'All') params.set('category', query.category);
    if (query.search) params.set('search', query.search);
    if (query.featured !== undefined) params.set('featured', String(query.featured));
    if (query.limit) params.set('limit', String(query.limit));

    const qs = params.toString();
    return request<{ data: EventItem[]; meta: { total: number } }>(
      `/api/events${qs ? `?${qs}` : ''}`,
    );
  },

  categories: () =>
    request<{ data: CategoryCount[] }>('/api/events/categories').then((r) => r.data),

  byId: (id: string) => request<{ data: EventItem }>(`/api/events/${id}`).then((r) => r.data),

  /** What this event rewards. Public — the event page renders it signed out. */
  stats: (id: string) => request<{ data: EventStats }>(`/api/events/${id}/stats`).then((r) => r.data),

  /** My stat sheet for this event: the profile, filtered to what it needs. */
  myFit: (id: string) =>
    request<{ data: MyEventFit }>(`/api/events/${id}/my-fit`).then((r) => r.data),
};

export interface TeamQuery {
  eventId?: string;
  status?: string;
  hasOpenSeats?: boolean;
  search?: string;
  mine?: boolean;
}

export const teamsApi = {
  list(query: TeamQuery = {}) {
    const params = new URLSearchParams();
    if (query.eventId) params.set('eventId', query.eventId);
    if (query.status) params.set('status', query.status);
    if (query.hasOpenSeats !== undefined) params.set('hasOpenSeats', String(query.hasOpenSeats));
    if (query.search) params.set('search', query.search);
    if (query.mine) params.set('mine', 'true');
    params.set('limit', '50');

    return request<{ data: Team[]; meta: { total: number } }>(`/api/teams?${params.toString()}`);
  },

  byId: (id: string) => request<{ data: TeamDetail }>(`/api/teams/${id}`).then((r) => r.data),

  create: (body: {
    eventId: string;
    name: string;
    description?: string | null;
    lookingFor?: string[];
    requiredSkills?: string[];
    maxSize: number;
  }) =>
    request<{ data: TeamDetail }>('/api/teams', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  remove: (id: string) => request<void>(`/api/teams/${id}`, { method: 'DELETE' }),

  leave: (id: string) => request<void>(`/api/teams/${id}/leave`, { method: 'POST' }),

  apply: (id: string, message: string | null) =>
    request<{ data: TeamRequest }>(`/api/teams/${id}/applications`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }).then((r) => r.data),

  invite: (id: string, userId: string, message: string | null) =>
    request<{ data: TeamRequest }>(`/api/teams/${id}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ userId, message }),
    }).then((r) => r.data),

  /** The team channel. Members only; reading it also marks it read. */
  channel: (id: string) =>
    request<{ data: TeamChannel }>(`/api/teams/${id}/messages`).then((r) => r.data),

  post: (id: string, body: string) =>
    request<{ data: TeamChatMessage }>(`/api/teams/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }).then((r) => r.data),

  /** Upload or replace the team logo. Owner only. */
  uploadLogo: (id: string, file: File) => {
    const form = new FormData();
    form.append('logo', file);
    return request<{ data: TeamDetail }>(`/api/teams/${id}/logo`, {
      method: 'POST',
      body: form,
    }).then((r) => r.data);
  },

  removeLogo: (id: string) =>
    request<{ data: TeamDetail }>(`/api/teams/${id}/logo`, { method: 'DELETE' }).then(
      (r) => r.data,
    ),

  /** What this team is missing for its event. */
  gaps: (id: string) =>
    request<{ data: TeamEventReport }>(`/api/teams/${id}/gaps`).then((r) => r.data),

  /** Candidates, scored under the event's weights and against the team's gaps. */
  suggestions: (id: string, limit = 8) =>
    request<{ data: EventCandidate[] }>(`/api/teams/${id}/suggestions?limit=${limit}`).then(
      (r) => r.data,
    ),

  requests: (direction: 'incoming' | 'outgoing' = 'incoming') =>
    request<{ data: TeamRequest[] }>(`/api/teams/requests?direction=${direction}&status=pending`).then(
      (r) => r.data,
    ),

  respond: (requestId: string, action: 'accept' | 'decline' | 'cancel') =>
    request<{ data: TeamRequest }>(`/api/teams/requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }).then((r) => r.data),
};

export interface AdminAccountQuery {
  search?: string;
  /** Site role — user, moderator, admin. */
  accountRole?: string;
  verified?: boolean;
}

/**
 * Admin console client.
 *
 * Mounted at `/api/ops`, not `/api/admin`, and absent from the Swagger
 * document. Every route behind it answers anyone below `moderator` with **404**,
 * so a `NOT_FOUND` here means "you are not staff" just as often as it means the
 * record is missing — the console treats both the same way and shows the
 * ordinary not-found page. Changing a site role additionally needs `admin`, and
 * that one *does* return 403, because by then the caller is known staff.
 */
export const adminApi = {
  accounts(query: AdminAccountQuery = {}) {
    const params = new URLSearchParams();
    if (query.search) params.set('search', query.search);
    if (query.accountRole && query.accountRole !== 'All') {
      params.set('accountRole', query.accountRole);
    }
    if (query.verified !== undefined) params.set('verified', String(query.verified));
    params.set('limit', '100');

    return request<{
      data: AdminAccount[];
      meta: { total: number; summary: AdminSummary };
    }>(`/api/ops/accounts?${params.toString()}`);
  },

  updateAccount(id: string, body: { accountRole: string }) {
    return request<{ data: AdminAccount }>(`/api/ops/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => r.data);
  },

  /** `permanent: true`, or a `durationDays`. A reason is always required. */
  banAccount: (id: string, body: { permanent?: boolean; durationDays?: number; reason: string }) =>
    request<{ data: AdminAccount }>(`/api/ops/accounts/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  unbanAccount: (id: string) =>
    request<{ data: AdminAccount }>(`/api/ops/accounts/${id}/ban`, { method: 'DELETE' }).then(
      (r) => r.data,
    ),

  /**
   * POST, not DELETE: the typed-back email has to travel with the request, and
   * DELETE bodies are dropped by proxies and ignored by some fetch stacks.
   */
  deleteAccount: (id: string, confirmEmail: string) =>
    request<{ data: { deleted: boolean; email: string } }>(`/api/ops/accounts/${id}/delete`, {
      method: 'POST',
      body: JSON.stringify({ confirmEmail }),
    }).then((r) => r.data),
};

export const connectionsApi = {
  overview: () =>
    request<{ data: ConnectionsOverview }>('/api/connections').then((r) => r.data),

  request: (userId: string) =>
    request<{ data: ConnectionView }>('/api/connections', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }).then((r) => r.data),

  respond: (id: string, action: 'accept' | 'decline' | 'cancel') =>
    request<{ data: { state: string } }>(`/api/connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    }).then((r) => r.data),

  disconnect: (id: string) => request<void>(`/api/connections/${id}`, { method: 'DELETE' }),

  /** Reading a thread also marks the other side's messages as read. */
  conversation: (userId: string) =>
    request<{ data: Conversation }>(`/api/connections/messages/${userId}`).then((r) => r.data),

  send: (userId: string, body: string) =>
    request<{ data: ChatMessage }>(`/api/connections/messages/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }).then((r) => r.data),
};

export { API_URL };

/** What happened while you were away. */
export const notificationsApi = {
  list: () => request<{ data: NotificationFeed }>('/api/notifications').then((r) => r.data),

  markRead: (id: string) =>
    request<{ data: NotificationItem }>(`/api/notifications/${id}/read`, { method: 'POST' }).then(
      (r) => r.data,
    ),

  markAllRead: () =>
    request<{ data: { marked: number } }>('/api/notifications/read-all', {
      method: 'POST',
    }).then((r) => r.data),
};

/** Endorsements: teammates vouching for a skill somebody claims. */
export const endorsementsApi = {
  forProfile: (userId: string) =>
    request<{ data: ProfileEndorsements }>(`/api/users/${userId}/endorsements`).then(
      (r) => r.data,
    ),

  endorse: (userId: string, skill: string) =>
    request<{ data: SkillEndorsement }>(`/api/users/${userId}/endorsements`, {
      method: 'POST',
      body: JSON.stringify({ skill }),
    }).then((r) => r.data),

  withdraw: (userId: string, skill: string) =>
    request<{ data: SkillEndorsement }>(`/api/users/${userId}/endorsements`, {
      method: 'DELETE',
      body: JSON.stringify({ skill }),
    }).then((r) => r.data),
};

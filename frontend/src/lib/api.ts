import type {
  AdminAccount,
  AdminSummary,
  AuthResult,
  CategoryCount,
  EventItem,
  FieldIssue,
  LoginPayload,
  SignupPayload,
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
  if (init.body && !headers.has('Content-Type')) {
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
  const payload = isJson ? await response.json() : null;

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
  signup: (body: SignupPayload) =>
    request<{ data: AuthResult }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  login: (body: LoginPayload) =>
    request<{ data: AuthResult }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  me: () => request<{ data: User }>('/api/auth/me').then((r) => r.data),
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
};

export { API_URL };

/**
 * Error carrying an HTTP status so the error middleware can translate any
 * thrown value into a well-formed response without per-route try/catch.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Authentication required.') {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource.') {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found.') {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown) {
    return new HttpError(409, 'CONFLICT', message, details);
  }

  /**
   * A suspended account. Its own code rather than a plain 403 so the client can
   * tell "you are banned" from "you lack permission" and show the reason and
   * expiry instead of a generic refusal.
   */
  static banned(message: string, details?: unknown) {
    return new HttpError(403, 'ACCOUNT_SUSPENDED', message, details);
  }
}

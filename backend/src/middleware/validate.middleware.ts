import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

const VALIDATED_QUERY = Symbol.for('taptim.validatedQuery');

/** Validates and replaces `req.body` with the parsed (typed, trimmed) value. */
export function validateBody(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Validates `req.query` and stashes the parsed value on the request.
 * It is not written back to `req.query`, which is a read-only getter in
 * newer Express versions.
 */
export function validateQuery(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(result.error);
      return;
    }
    Reflect.set(req, VALIDATED_QUERY, result.data);
    next();
  };
}

/** Reads back what `validateQuery` parsed for this request. */
export function getValidatedQuery<T>(req: Request): T {
  return Reflect.get(req, VALIDATED_QUERY) as T;
}

/**
 * Validates `req.params`. Without this, a malformed `:id` reaches Postgres and
 * comes back as a 500 ("invalid input syntax for type uuid") instead of the
 * 400 the client deserves.
 */
export function validateParams(schema: ZodTypeAny): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(result.error);
      return;
    }
    Object.assign(req.params, result.data);
    next();
  };
}

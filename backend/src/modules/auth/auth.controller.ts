import type { Request, Response } from 'express';
import { env } from '../../config/env.js';
import { identityStore } from '../../data/identity.store.js';
import {
  authorizeUrl,
  decodeState,
  encodeState,
  fetchProfile,
  isProviderConfigured,
  OAUTH_PROVIDERS,
  providerLabel,
  type OAuthProvider,
} from '../../services/oauth.js';
import { HttpError } from '../../utils/http-error.js';
import { toPublicUser } from '../users/user.model.js';
import { profileCompleteness } from '../users/user.service.js';
import type {
  CheckEmailInput,
  LoginInput,
  ResendVerificationInput,
  SignupInput,
  VerifyEmailInput,
} from './auth.schema.js';
import * as authService from './auth.service.js';

function requireUser(req: Request) {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}

function parseProvider(value: string): OAuthProvider {
  if (!OAUTH_PROVIDERS.includes(value as OAuthProvider)) {
    throw HttpError.notFound(`No sign-in provider called "${value}".`);
  }
  return value as OAuthProvider;
}

export async function checkEmailHandler(req: Request, res: Response) {
  const { email } = req.body as CheckEmailInput;
  res.status(200).json({ data: { available: await authService.isEmailAvailable(email) } });
}

export async function signupHandler(req: Request, res: Response) {
  const result = await authService.signup(req.body as SignupInput);
  res.status(201).json({ data: result });
}

export async function loginHandler(req: Request, res: Response) {
  const result = await authService.login(req.body as LoginInput);
  res.status(200).json({ data: result });
}

export async function meHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const identities = await identityStore.listIdentitiesFor(user.id);

  res.status(200).json({
    data: {
      ...toPublicUser(user),
      // The session endpoint is what the SPA reads on every load, so the
      // completeness meter has to come from here too — computing it only in
      // `/api/users/me` left the header showing 0% for a fully filled profile.
      profileCompleteness: profileCompleteness(user),
      // The same decision login and signup return, so the SPA has one source
      // for "where should this person be" instead of re-deriving it from three
      // flags and getting it wrong when one of the rules changes.
      next: authService.nextStepFor(user),
      connections: identities.map((identity) => ({
        provider: identity.provider,
        email: identity.email,
        connectedAt: identity.createdAt,
      })),
      hasPassword: user.passwordHash !== null,
    },
  });
}

export async function verifyEmailHandler(req: Request, res: Response) {
  const { token } = req.body as VerifyEmailInput;
  res.status(200).json({ data: await authService.verifyEmail(token) });
}

export async function resendVerificationHandler(req: Request, res: Response) {
  const { email } = req.body as ResendVerificationInput;
  const result = await authService.resendVerification(email);
  res.status(200).json({ data: { sent: result.sent, error: result.error } });
}

/** Which providers this deployment can actually offer, for the signup screen. */
export function providersHandler(_req: Request, res: Response) {
  res.status(200).json({
    data: OAUTH_PROVIDERS.map((provider) => ({
      provider,
      label: providerLabel(provider),
      configured: isProviderConfigured(provider),
    })),
  });
}

// -- OAuth redirects ----------------------------------------------------------

export function oauthStartHandler(req: Request, res: Response) {
  const provider = parseProvider(req.params.provider);
  const state = encodeState({ provider, intent: 'login' });
  res.redirect(authorizeUrl(provider, state));
}

/** Same dance, but the result attaches to the account already signed in. */
export function oauthConnectHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const provider = parseProvider(req.params.provider);
  const state = encodeState({ provider, intent: 'connect', userId: user.id });
  res.status(200).json({ data: { url: authorizeUrl(provider, state) } });
}

/**
 * The provider sends the browser here, so the response is a redirect rather
 * than JSON.
 *
 * The token goes back in the URL *fragment*: fragments are never sent to a
 * server, so it stays out of access logs and `Referer` headers on the way to
 * the SPA, which reads it and immediately clears it from the address bar.
 */
export async function oauthCallbackHandler(req: Request, res: Response) {
  const provider = parseProvider(req.params.provider);

  const fail = (message: string) =>
    res.redirect(`${env.appUrl}/auth/callback#error=${encodeURIComponent(message)}`);

  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;

  // The provider reports a refusal here rather than by failing the request.
  if (typeof req.query.error === 'string') {
    return fail(`${providerLabel(provider)} sign-in was cancelled.`);
  }
  if (!code || !state) {
    return fail('That sign-in response was incomplete. Start again.');
  }

  try {
    const decoded = decodeState(state);
    if (decoded.provider !== provider) {
      return fail('That sign-in response did not match the provider it started with.');
    }

    const profile = await fetchProfile(provider, code);

    if (decoded.intent === 'connect') {
      if (!decoded.userId) return fail('That connection request was incomplete.');
      await authService.connectProvider(decoded.userId, profile);
      return res.redirect(`${env.appUrl}/profile#connected=${provider}`);
    }

    const result = await authService.loginWithProvider(profile);
    const fragment = new URLSearchParams({
      token: result.accessToken,
      next: result.next,
      created: String(result.created),
    });
    return res.redirect(`${env.appUrl}/auth/callback#${fragment.toString()}`);
  } catch (error) {
    const message =
      error instanceof HttpError ? error.message : `Could not complete ${providerLabel(provider)} sign-in.`;
    console.error(`[oauth] ${provider} callback failed:`, error);
    return fail(message);
  }
}

export async function disconnectProviderHandler(req: Request, res: Response) {
  const user = requireUser(req);
  const provider = parseProvider(req.params.provider);
  await authService.disconnectProvider(user, provider);
  res.status(204).send();
}

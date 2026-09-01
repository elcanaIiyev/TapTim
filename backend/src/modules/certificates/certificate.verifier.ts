import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { env } from '../../config/env.js';
import type { CertificateRecord, CertificateStatus } from './certificate.model.js';

/**
 * Certificate verification.
 *
 * Two implementations sit behind one function. When `ANTHROPIC_API_KEY` is set,
 * Claude assesses the claim; otherwise a deterministic rule verifier runs so the
 * endpoint always works — including in tests and offline development.
 *
 * Scope note: both verifiers assess *plausibility* from the submitted metadata.
 * Neither fetches the credential URL, so a verdict is evidence for the badge,
 * not proof the credential exists. Live credential lookup is a separate piece of
 * work and is called out in the API docs so nothing here over-claims.
 */

export interface VerificationVerdict {
  status: CertificateStatus;
  /** 0–1. How confident the verifier is in the verdict it returned. */
  confidence: number;
  reason: string;
  /** `claude:<model>` or `rules`, recorded so a verdict can be traced later. */
  verifiedBy: string;
}

export type VerifiableCertificate = Pick<
  CertificateRecord,
  'title' | 'issuer' | 'issuedOn' | 'credentialId' | 'credentialUrl' | 'skills'
>;

/** Issuers whose certificate programmes are well known and machine-checkable. */
const KNOWN_ISSUERS: Array<{ name: string; domains: string[] }> = [
  { name: 'coursera', domains: ['coursera.org'] },
  { name: 'edx', domains: ['edx.org'] },
  { name: 'udacity', domains: ['udacity.com'] },
  { name: 'udemy', domains: ['udemy.com'] },
  { name: 'freecodecamp', domains: ['freecodecamp.org'] },
  { name: 'google', domains: ['google.com', 'grow.google', 'cloudskillsboost.google'] },
  { name: 'amazon web services', domains: ['aws.amazon.com', 'credly.com'] },
  { name: 'aws', domains: ['aws.amazon.com', 'credly.com'] },
  { name: 'microsoft', domains: ['microsoft.com', 'learn.microsoft.com'] },
  { name: 'meta', domains: ['meta.com', 'coursera.org'] },
  { name: 'ibm', domains: ['ibm.com', 'credly.com'] },
  { name: 'cisco', domains: ['cisco.com', 'credly.com'] },
  { name: 'oracle', domains: ['oracle.com'] },
  { name: 'hackerrank', domains: ['hackerrank.com'] },
  { name: 'kaggle', domains: ['kaggle.com'] },
  { name: 'linkedin', domains: ['linkedin.com'] },
  { name: 'credly', domains: ['credly.com'] },
];

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Deterministic verifier. Each signal is independent evidence that the claim is
 * real; the confidence is the weighted share of signals present.
 */
export function verifyWithRules(certificate: VerifiableCertificate): VerificationVerdict {
  const issuerKey = certificate.issuer.trim().toLowerCase();
  const known = KNOWN_ISSUERS.find(
    (entry) => issuerKey === entry.name || issuerKey.includes(entry.name),
  );

  const host = hostnameOf(certificate.credentialUrl);
  const urlMatchesIssuer =
    host !== null &&
    known !== undefined &&
    known.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));

  const issuedOn = certificate.issuedOn ? Date.parse(certificate.issuedOn) : null;
  const issuedInFuture = issuedOn !== null && issuedOn > Date.now();

  const signals: Array<{ label: string; weight: number; passed: boolean }> = [
    { label: 'a recognised issuer', weight: 0.3, passed: known !== undefined },
    { label: 'a verification link', weight: 0.2, passed: host !== null },
    { label: 'a link on the issuer’s own domain', weight: 0.25, passed: urlMatchesIssuer },
    { label: 'a credential id', weight: 0.15, passed: Boolean(certificate.credentialId?.trim()) },
    { label: 'a plausible issue date', weight: 0.1, passed: issuedOn !== null && !issuedInFuture },
  ];

  const confidence = Number(
    signals.reduce((total, signal) => total + (signal.passed ? signal.weight : 0), 0).toFixed(3),
  );

  // A future-dated certificate is not a weak claim, it is a wrong one.
  if (issuedInFuture) {
    return {
      status: 'rejected',
      confidence: 0.95,
      reason: 'The issue date is in the future, so this certificate cannot exist yet.',
      verifiedBy: 'rules',
    };
  }

  const present = signals.filter((signal) => signal.passed).map((signal) => signal.label);
  const missing = signals.filter((signal) => !signal.passed).map((signal) => signal.label);

  const status: CertificateStatus =
    confidence >= 0.65 ? 'verified' : confidence >= 0.35 ? 'pending' : 'rejected';

  const reason =
    present.length > 0
      ? `Found ${present.join(', ')}.${missing.length ? ` Missing ${missing.join(', ')}.` : ''}`
      : `No supporting evidence found — missing ${missing.join(', ')}.`;

  return { status, confidence, reason, verifiedBy: 'rules' };
}

const verdictSchema = z.object({
  status: z.enum(['verified', 'pending', 'rejected']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(400),
});

/**
 * Hand-written JSON Schema for the structured-output constraint.
 *
 * The SDK's `zodOutputFormat` helper is not used because it is typed against
 * Zod 4 while this project is on Zod 3; feeding it a v3 schema compiles to an
 * unusable `{}` result type. Declaring the schema here and validating the reply
 * with `verdictSchema` above keeps one Zod version in the project and still
 * guarantees the shape.
 */
const VERDICT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['status', 'confidence', 'reason'],
  properties: {
    status: {
      type: 'string',
      enum: ['verified', 'pending', 'rejected'],
      description:
        'verified when the claim is coherent and consistent with how this issuer names and numbers its certificates; ' +
        'rejected when something is contradictory or implausible; pending when there is not enough to judge.',
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
      description: 'How confident you are in this verdict, 0 to 1.',
    },
    reason: {
      type: 'string',
      description:
        'One or two sentences a participant would understand, addressed to them. At most 400 characters.',
    },
  },
} as const;

const SYSTEM_PROMPT = `You assess hackathon participants' certificate claims for a team-matching platform.

You are given only the metadata a participant typed in. You cannot open links or look anything up, so judge internal coherence and plausibility, not existence:
- Does the issuer actually run a programme like this?
- Does the title match how that issuer names its certificates?
- Do the credential id and URL look like that issuer's real format?
- Are the claimed skills consistent with the title?
- Is the issue date sensible?

Be fair. A sparse but plausible claim is "pending", not "rejected". Reserve "rejected" for claims that contradict themselves or the issuer's known programmes. Never state that you confirmed the credential exists.`;

async function verifyWithClaude(
  certificate: VerifiableCertificate,
): Promise<VerificationVerdict> {
  const client = new Anthropic({ apiKey: env.anthropicApiKey ?? undefined });

  const claim = [
    `Title: ${certificate.title}`,
    `Issuer: ${certificate.issuer}`,
    `Issued on: ${certificate.issuedOn ?? '(not provided)'}`,
    `Credential id: ${certificate.credentialId ?? '(not provided)'}`,
    `Credential URL: ${certificate.credentialUrl ?? '(not provided)'}`,
    `Claimed skills: ${certificate.skills.length ? certificate.skills.join(', ') : '(none listed)'}`,
  ].join('\n');

  const response = await client.messages.create({
    model: env.certVerifierModel,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    // A short judgement over a handful of fields, not a reasoning problem —
    // the lowest effort level is the right cost/quality trade here.
    output_config: {
      effort: 'low',
      format: { type: 'json_schema', schema: VERDICT_JSON_SCHEMA },
    },
    messages: [{ role: 'user', content: `Assess this certificate claim:\n\n${claim}` }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The model declined to assess this claim.');
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim();

  if (!text) {
    throw new Error('The model returned an empty response.');
  }

  const parsed = verdictSchema.parse(JSON.parse(text));

  return {
    status: parsed.status,
    confidence: parsed.confidence,
    reason: parsed.reason,
    verifiedBy: `claude:${env.certVerifierModel}`,
  };
}

export async function verifyCertificate(
  certificate: VerifiableCertificate,
): Promise<VerificationVerdict> {
  if (!env.anthropicApiKey) {
    return verifyWithRules(certificate);
  }

  try {
    return await verifyWithClaude(certificate);
  } catch (error) {
    // A verification outage must not block the participant. The rule verifier
    // still produces a defensible verdict, and `verifiedBy` records which one
    // actually ran so the fallback is visible rather than silent.
    console.error(
      '[certificates] Claude verification failed, falling back to rules:',
      error instanceof Error ? error.message : error,
    );
    return verifyWithRules(certificate);
  }
}

import { env } from '../config/env.js';

/**
 * Transactional email through Resend.
 *
 * Called over plain `fetch` rather than the `resend` package: this sends
 * exactly one shape of message to one endpoint, and a dependency that wraps a
 * single POST is a dependency to keep updated for no benefit.
 *
 * When `RESEND_API_KEY` is unset the mailer does not throw — it logs the link
 * and reports `delivered: false`. Signup must not fail because a side channel
 * is misconfigured; the caller surfaces "we could not send the email" and
 * offers a resend.
 */

export interface SendResult {
  delivered: boolean;
  /** Resend's message id, when it accepted the message. */
  id: string | null;
  reason: string | null;
}

interface SendInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send(input: SendInput): Promise<SendResult> {
  if (!env.mail.configured) {
    console.warn(
      `[mail] RESEND_API_KEY is not set — "${input.subject}" for ${input.to} was not sent.`,
    );
    console.warn(`[mail] Message body:\n${input.text}`);
    return { delivered: false, id: null, reason: 'Email delivery is not configured.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.mail.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.mail.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[mail] Resend rejected the message (${response.status}): ${detail}`);
      return {
        delivered: false,
        id: null,
        // Resend's own message is the useful one — "domain not verified" and
        // "invalid key" need different fixes and only it knows which.
        reason: `Email provider returned ${response.status}.`,
      };
    }

    const body = (await response.json()) as { id?: string };
    return { delivered: true, id: body.id ?? null, reason: null };
  } catch (error) {
    console.error('[mail] Could not reach Resend:', error instanceof Error ? error.message : error);
    return { delivered: false, id: null, reason: 'Could not reach the email provider.' };
  }
}

/** Shared shell so every message looks like it came from the same product. */
function layout(heading: string, body: string, cta?: { label: string; url: string }): string {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#0b0b12;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" style="max-width:520px;margin:0 auto;background:#14141f;border:1px solid #2a2a3d;border-radius:16px;">
    <tr><td style="padding:32px;">
      <p style="margin:0 0 24px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#8b5cf6;">TapTim</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;">${heading}</h1>
      <div style="font-size:15px;line-height:1.65;color:#b4b4c7;">${body}</div>
      ${
        cta
          ? `<p style="margin:28px 0 0;"><a href="${cta.url}" style="display:inline-block;padding:13px 26px;background:#8b5cf6;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:700;font-size:15px;">${cta.label}</a></p>
             <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#6b6b85;">Button not working? Paste this into your browser:<br><span style="color:#8b5cf6;word-break:break-all;">${cta.url}</span></p>`
          : ''
      }
    </td></tr>
  </table>
</body></html>`;
}

export function sendVerificationEmail(input: {
  to: string;
  firstName: string;
  url: string;
}): Promise<SendResult> {
  const text = [
    `Welcome to TapTim, ${input.firstName}.`,
    '',
    'Confirm your email address to finish setting up your account:',
    input.url,
    '',
    'This link is good for 24 hours. If you did not sign up, ignore this email.',
  ].join('\n');

  return send({
    to: input.to,
    subject: 'Confirm your TapTim account',
    text,
    html: layout(
      `Welcome, ${input.firstName}.`,
      `<p style="margin:0;">One step left. Confirm your email address and we'll take you
       straight to building your profile — that's what the matching runs on.</p>
       <p style="margin:16px 0 0;font-size:13px;color:#6b6b85;">This link expires in 24 hours.</p>`,
      { label: 'Confirm my email', url: input.url },
    ),
  });
}

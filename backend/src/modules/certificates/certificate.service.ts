import { certificateStore } from '../../data/certificate.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import type { CertificateRecord } from './certificate.model.js';
import type {
  CreateCertificateInput,
  ListCertificatesQuery,
  UpdateCertificateInput,
} from './certificate.schema.js';
import { verifyCertificate } from './certificate.verifier.js';

/**
 * The "Verified" badge means "this account has at least one verified
 * certificate". Recomputing it from the certificate table after every verdict
 * keeps the flag and the evidence from drifting apart — including when the
 * last verified certificate is deleted.
 */
async function syncVerifiedBadge(userId: string): Promise<void> {
  const verified = await certificateStore.countVerified(userId);
  await userStore.setVerified(userId, verified > 0);
}

async function requireOwnCertificate(id: string, userId: string): Promise<CertificateRecord> {
  const certificate = await certificateStore.findById(id);
  if (!certificate) {
    throw HttpError.notFound(`No certificate found with id "${id}".`);
  }
  // 404 rather than 403: whether someone else's certificate exists is not this
  // caller's business.
  if (certificate.userId !== userId) {
    throw HttpError.notFound(`No certificate found with id "${id}".`);
  }
  return certificate;
}

export async function listCertificates(
  userId: string,
  query: ListCertificatesQuery,
): Promise<CertificateRecord[]> {
  return certificateStore.listByUser(userId, query.status);
}

export async function getCertificate(id: string, userId: string): Promise<CertificateRecord> {
  return requireOwnCertificate(id, userId);
}

/**
 * Submitting a certificate runs verification immediately, so the participant
 * gets a verdict in the same request rather than having to poll or press a
 * second button.
 */
export async function createCertificate(
  input: CreateCertificateInput,
  userId: string,
): Promise<CertificateRecord> {
  const created = await certificateStore.create({
    userId,
    title: input.title,
    issuer: input.issuer,
    issuedOn: input.issuedOn,
    credentialId: input.credentialId,
    credentialUrl: input.credentialUrl,
    skills: input.skills,
  });

  return runVerification(created);
}

export async function updateCertificate(
  id: string,
  input: UpdateCertificateInput,
  userId: string,
): Promise<CertificateRecord> {
  await requireOwnCertificate(id, userId);

  // The store resets the verdict on any edit, so the claim is re-checked rather
  // than inheriting a verdict that was made about different details.
  const updated = await certificateStore.update(id, input);
  if (!updated) {
    throw HttpError.notFound(`No certificate found with id "${id}".`);
  }

  await syncVerifiedBadge(userId);
  return runVerification(updated);
}

export async function deleteCertificate(id: string, userId: string): Promise<void> {
  await requireOwnCertificate(id, userId);
  await certificateStore.remove(id);
  await syncVerifiedBadge(userId);
}

/** Re-runs verification on an existing certificate. */
export async function reverifyCertificate(
  id: string,
  userId: string,
): Promise<CertificateRecord> {
  const certificate = await requireOwnCertificate(id, userId);
  return runVerification(certificate);
}

async function runVerification(certificate: CertificateRecord): Promise<CertificateRecord> {
  const verdict = await verifyCertificate(certificate);

  const recorded = await certificateStore.recordVerdict(certificate.id, verdict);
  if (!recorded) {
    throw HttpError.notFound(`No certificate found with id "${certificate.id}".`);
  }

  await syncVerifiedBadge(certificate.userId);
  return recorded;
}

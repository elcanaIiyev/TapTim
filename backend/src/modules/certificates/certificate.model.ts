import { toIso, toIsoOrNull } from '../../utils/dates.js';

export const CERTIFICATE_STATUSES = ['pending', 'verified', 'rejected'] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export interface CertificateRecord {
  id: string;
  userId: string;
  title: string;
  issuer: string;
  /** Calendar day (`YYYY-MM-DD`), not a timestamp. */
  issuedOn: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  skills: string[];
  status: CertificateStatus;
  /** 0–1. Null until the certificate has been through verification. */
  confidence: number | null;
  verdictReason: string | null;
  /** Which verifier produced the verdict — `claude:<model>` or `rules`. */
  verifiedBy: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CertificateRow {
  id: string;
  user_id: string;
  title: string;
  issuer: string;
  issued_on: string | null;
  credential_id: string | null;
  credential_url: string | null;
  skills: string[];
  status: string;
  confidence: number | null;
  verdict_reason: string | null;
  verified_by: string | null;
  verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function mapCertificateRow(row: CertificateRow): CertificateRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    issuer: row.issuer,
    issuedOn: row.issued_on,
    credentialId: row.credential_id,
    credentialUrl: row.credential_url,
    skills: row.skills ?? [],
    status: row.status as CertificateStatus,
    confidence: row.confidence,
    verdictReason: row.verdict_reason,
    verifiedBy: row.verified_by,
    verifiedAt: toIsoOrNull(row.verified_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

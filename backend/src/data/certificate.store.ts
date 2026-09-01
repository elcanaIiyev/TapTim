import { query, queryOne } from '../db/pool.js';
import {
  mapCertificateRow,
  type CertificateRecord,
  type CertificateRow,
} from '../modules/certificates/certificate.model.js';

const COLUMNS = `
  id, user_id, title, issuer, issued_on, credential_id, credential_url, skills,
  status, confidence, verdict_reason, verified_by, verified_at, created_at, updated_at
`;

export interface CreateCertificateInput {
  userId: string;
  title: string;
  issuer: string;
  issuedOn: string | null;
  credentialId: string | null;
  credentialUrl: string | null;
  skills: string[];
}

const UPDATABLE_COLUMNS = {
  title: 'title',
  issuer: 'issuer',
  issuedOn: 'issued_on',
  credentialId: 'credential_id',
  credentialUrl: 'credential_url',
  skills: 'skills',
} as const;

export type CertificateUpdate = Partial<Record<keyof typeof UPDATABLE_COLUMNS, unknown>>;

export interface VerdictInput {
  status: string;
  confidence: number;
  reason: string;
  verifiedBy: string;
}

class CertificateStore {
  async create(input: CreateCertificateInput): Promise<CertificateRecord> {
    const row = await queryOne<CertificateRow>(
      `insert into certificates (user_id, title, issuer, issued_on, credential_id, credential_url, skills)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning ${COLUMNS}`,
      [
        input.userId,
        input.title,
        input.issuer,
        input.issuedOn,
        input.credentialId,
        input.credentialUrl,
        input.skills,
      ],
    );
    if (!row) throw new Error('Insert returned no certificate row.');
    return mapCertificateRow(row);
  }

  async findById(id: string): Promise<CertificateRecord | null> {
    const row = await queryOne<CertificateRow>(`select ${COLUMNS} from certificates where id = $1`, [
      id,
    ]);
    return row ? mapCertificateRow(row) : null;
  }

  async listByUser(userId: string, status?: string): Promise<CertificateRecord[]> {
    const values: unknown[] = [userId];
    let where = 'where user_id = $1';
    if (status) {
      values.push(status);
      where += ` and status = $${values.length}`;
    }
    const rows = await query<CertificateRow>(
      `select ${COLUMNS} from certificates ${where} order by created_at desc`,
      values,
    );
    return rows.map(mapCertificateRow);
  }

  async update(id: string, patch: CertificateUpdate): Promise<CertificateRecord | null> {
    const entries = Object.entries(patch).filter(([key]) => key in UPDATABLE_COLUMNS);
    if (entries.length === 0) return this.findById(id);

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of entries) {
      values.push(value);
      assignments.push(
        `${UPDATABLE_COLUMNS[key as keyof typeof UPDATABLE_COLUMNS]} = $${values.length}`,
      );
    }

    // Editing the claim invalidates any verdict already recorded against it,
    // otherwise a rejected certificate could be edited into a verified one.
    assignments.push(
      `status = 'pending'`,
      `confidence = null`,
      `verdict_reason = null`,
      `verified_by = null`,
      `verified_at = null`,
    );

    values.push(id);
    const row = await queryOne<CertificateRow>(
      `update certificates set ${assignments.join(', ')} where id = $${values.length}
       returning ${COLUMNS}`,
      values,
    );
    return row ? mapCertificateRow(row) : null;
  }

  async recordVerdict(id: string, verdict: VerdictInput): Promise<CertificateRecord | null> {
    const row = await queryOne<CertificateRow>(
      `update certificates
       set status = $2, confidence = $3, verdict_reason = $4, verified_by = $5, verified_at = now()
       where id = $1
       returning ${COLUMNS}`,
      [id, verdict.status, verdict.confidence, verdict.reason, verdict.verifiedBy],
    );
    return row ? mapCertificateRow(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>('delete from certificates where id = $1 returning id', [
      id,
    ]);
    return rows.length > 0;
  }

  async countVerified(userId: string): Promise<number> {
    const row = await queryOne<{ count: string }>(
      `select count(*)::text as count from certificates where user_id = $1 and status = 'verified'`,
      [userId],
    );
    return Number(row?.count ?? 0);
  }

  /** Verified-certificate counts for many users at once, for match scoring. */
  async verifiedCountsFor(userIds: readonly string[]): Promise<Map<string, number>> {
    if (userIds.length === 0) return new Map();
    const rows = await query<{ user_id: string; count: string }>(
      `select user_id, count(*)::text as count from certificates
       where status = 'verified' and user_id = any($1::uuid[])
       group by user_id`,
      [userIds],
    );
    return new Map(rows.map((row) => [row.user_id, Number(row.count)]));
  }
}

export const certificateStore = new CertificateStore();

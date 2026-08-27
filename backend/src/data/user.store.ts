import { randomUUID } from 'node:crypto';
import type { UserRecord } from '../modules/users/user.model.js';

/**
 * In-memory user store for the Sprint 1 MVP. The interface is deliberately
 * async and repository-shaped so swapping in Postgres/Prisma later touches
 * only this file.
 */
class UserStore {
  private readonly byId = new Map<string, UserRecord>();
  private readonly idByEmail = new Map<string, string>();

  private normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const id = this.idByEmail.get(this.normaliseEmail(email));
    return id ? (this.byId.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async create(
    input: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UserRecord> {
    const now = new Date().toISOString();
    const user: UserRecord = {
      ...input,
      email: this.normaliseEmail(input.email),
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    this.byId.set(user.id, user);
    this.idByEmail.set(user.email, user.id);
    return user;
  }

  async count(): Promise<number> {
    return this.byId.size;
  }
}

export const userStore = new UserStore();

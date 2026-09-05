import {
  notificationStore,
  type EmitInput,
  type NotificationRecord,
} from '../../data/notification.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';

/**
 * Telling people what happened.
 *
 * Two rules run through this module.
 *
 * **Emitting never fails the thing it describes.** Accepting an invitation is
 * the operation; telling the owner about it is a courtesy attached to it. If
 * the insert fails, the acceptance still happened and the caller still gets a
 * 200 — so `notify` swallows its own errors and logs them rather than throwing
 * into a request that has already done its real work.
 *
 * **Nobody is notified about their own action.** Every emit site would otherwise
 * have to remember the check, and forgetting it produces the most obviously
 * broken thing a feed can do: telling you that you did something you just did.
 */

export interface NotificationView extends NotificationRecord {
  /** Resolved for the avatar; null once the actor's account is gone. */
  actor: { id: string; fullName: string; avatarUrl: string | null } | null;
}

export interface NotificationFeed {
  items: NotificationView[];
  unread: number;
}

export async function notify(input: EmitInput & { actorId?: string | null }): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return;

  try {
    await notificationStore.emit(input);
  } catch (error) {
    console.warn(
      `[notify] could not record "${input.kind}" for ${input.userId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}

/** Fan-out to several recipients, skipping the actor. */
export async function notifyMany(
  userIds: readonly string[],
  input: Omit<EmitInput, 'userId'> & { actorId?: string | null },
): Promise<void> {
  await Promise.all(userIds.map((userId) => notify({ ...input, userId })));
}

export async function feed(userId: string): Promise<NotificationFeed> {
  const [items, unread] = await Promise.all([
    notificationStore.listFor(userId),
    notificationStore.unreadCount(userId),
  ]);

  // One lookup for the whole page rather than one per row.
  const actorIds = [...new Set(items.map((item) => item.actorId).filter(Boolean))] as string[];
  const people = await userStore.findManyByIds(actorIds);
  const byId = new Map(people.map((person) => [person.id, person]));

  return {
    items: items.map((item) => {
      const actor = item.actorId ? byId.get(item.actorId) : undefined;
      return {
        ...item,
        actor: actor
          ? { id: actor.id, fullName: actor.fullName, avatarUrl: actor.avatarUrl }
          : null,
      };
    }),
    unread,
  };
}

export async function markRead(userId: string, id: string): Promise<NotificationRecord> {
  const updated = await notificationStore.markRead(userId, id);
  if (!updated) {
    // Covers "not yours", "does not exist" and "already read" with one answer:
    // distinguishing them would tell a caller whether somebody else's id is
    // real, and none of the three is worth acting on differently.
    throw HttpError.notFound('No unread notification with that id.');
  }
  return updated;
}

export function markAllRead(userId: string): Promise<number> {
  return notificationStore.markAllRead(userId);
}

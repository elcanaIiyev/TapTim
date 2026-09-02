import {
  connectionStore,
  type ConnectionRecord,
  type MessageRecord,
} from '../../data/connection.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { toDirectoryUser, type DirectoryUser } from '../users/user.model.js';

/**
 * Connections and the conversations attached to them.
 *
 * One rule runs through all of it: you can message someone once, and only
 * once, you are actually connected. That keeps the inbox from becoming a
 * channel strangers can push into, which is the failure mode of every
 * "message anyone" directory.
 */

export type ConnectionState = 'none' | 'pending-sent' | 'pending-received' | 'connected' | 'declined';

export interface ConnectionView {
  /** Null when there is no row yet — the two have never interacted. */
  id: string | null;
  state: ConnectionState;
  person: DirectoryUser;
  unread: number;
  lastMessage: { body: string; sentByMe: boolean; at: string } | null;
  connectedAt: string | null;
}

/** How a connection row looks from one side of it. */
function stateFor(connection: ConnectionRecord | null, viewerId: string): ConnectionState {
  if (!connection) return 'none';
  if (connection.status === 'accepted') return 'connected';
  if (connection.status === 'declined') return 'declined';
  return connection.requestedBy === viewerId ? 'pending-sent' : 'pending-received';
}

function otherSide(connection: ConnectionRecord, viewerId: string): string {
  return connection.userA === viewerId ? connection.userB : connection.userA;
}

export interface ConnectionsOverview {
  connected: ConnectionView[];
  /** Requests waiting on the viewer to answer. */
  incoming: ConnectionView[];
  /** Requests the viewer has sent and nobody has answered. */
  outgoing: ConnectionView[];
  totalUnread: number;
}

export async function overview(viewerId: string): Promise<ConnectionsOverview> {
  const connections = await connectionStore.listFor(viewerId);
  const partnerIds = connections.map((connection) => otherSide(connection, viewerId));

  const [people, unread, latest] = await Promise.all([
    userStore.findManyByIds(partnerIds),
    connectionStore.unreadCounts(viewerId),
    connectionStore.latestPerPartner(viewerId),
  ]);
  const byId = new Map(people.map((person) => [person.id, person]));

  const views: ConnectionView[] = [];
  for (const connection of connections) {
    const partnerId = otherSide(connection, viewerId);
    const person = byId.get(partnerId);
    // A deleted account leaves its connection rows behind only until the
    // cascade runs; skip rather than rendering a hole.
    if (!person) continue;

    const message = latest.get(partnerId);
    views.push({
      id: connection.id,
      state: stateFor(connection, viewerId),
      person: toDirectoryUser(person),
      unread: unread.get(partnerId) ?? 0,
      lastMessage: message
        ? { body: message.body, sentByMe: message.senderId === viewerId, at: message.createdAt }
        : null,
      connectedAt: connection.status === 'accepted' ? connection.updatedAt : null,
    });
  }

  return {
    connected: views.filter((view) => view.state === 'connected'),
    incoming: views.filter((view) => view.state === 'pending-received'),
    outgoing: views.filter((view) => view.state === 'pending-sent'),
    totalUnread: [...unread.values()].reduce((sum, count) => sum + count, 0),
  };
}

export async function requestConnection(
  viewerId: string,
  targetId: string,
): Promise<ConnectionView> {
  if (viewerId === targetId) {
    throw HttpError.badRequest('You cannot connect with yourself.');
  }

  const target = await userStore.findById(targetId);
  if (!target) throw HttpError.notFound(`No participant found with id "${targetId}".`);

  const existing = await connectionStore.between(viewerId, targetId);
  if (existing?.status === 'accepted') {
    throw HttpError.conflict('You are already connected.');
  }

  // Somebody asking back while a request from the other side is open means
  // both want it — accept rather than opening a second, redundant request.
  if (existing?.status === 'pending' && existing.requestedBy !== viewerId) {
    const accepted = await connectionStore.setStatus(existing.id, 'accepted');
    return {
      id: accepted!.id,
      state: 'connected',
      person: toDirectoryUser(target),
      unread: 0,
      lastMessage: null,
      connectedAt: accepted!.updatedAt,
    };
  }

  const connection = await connectionStore.request(viewerId, targetId);
  return {
    id: connection.id,
    state: stateFor(connection, viewerId),
    person: toDirectoryUser(target),
    unread: 0,
    lastMessage: null,
    connectedAt: null,
  };
}

export async function respond(
  viewerId: string,
  connectionId: string,
  action: 'accept' | 'decline' | 'cancel',
): Promise<{ state: ConnectionState }> {
  const connection = await connectionStore.findById(connectionId);
  if (!connection) throw HttpError.notFound('No such connection request.');

  const involved = connection.userA === viewerId || connection.userB === viewerId;
  if (!involved) throw HttpError.forbidden('That request is not yours to answer.');

  if (action === 'cancel') {
    if (connection.requestedBy !== viewerId) {
      throw HttpError.forbidden('Only the person who sent a request can cancel it.');
    }
    await connectionStore.remove(connectionId);
    return { state: 'none' };
  }

  // Answering your own request would let anyone connect to anyone unilaterally.
  if (connection.requestedBy === viewerId) {
    throw HttpError.badRequest('You cannot answer your own request.');
  }
  if (connection.status !== 'pending') {
    throw HttpError.conflict(`That request was already ${connection.status}.`);
  }

  const updated = await connectionStore.setStatus(
    connectionId,
    action === 'accept' ? 'accepted' : 'declined',
  );
  return { state: stateFor(updated, viewerId) };
}

export async function disconnect(viewerId: string, connectionId: string): Promise<void> {
  const connection = await connectionStore.findById(connectionId);
  if (!connection) throw HttpError.notFound('No such connection.');
  if (connection.userA !== viewerId && connection.userB !== viewerId) {
    throw HttpError.forbidden('That connection is not yours.');
  }
  await connectionStore.remove(connectionId);
}

// -- messages -----------------------------------------------------------------

export interface Conversation {
  partner: DirectoryUser;
  state: ConnectionState;
  /** False when the two are not connected, so the UI disables the composer. */
  canSend: boolean;
  messages: MessageRecord[];
}

/** Reading a conversation also marks the other side's messages as read. */
export async function conversation(viewerId: string, partnerId: string): Promise<Conversation> {
  const partner = await userStore.findById(partnerId);
  if (!partner) throw HttpError.notFound(`No participant found with id "${partnerId}".`);

  const connection = await connectionStore.between(viewerId, partnerId);
  const state = stateFor(connection, viewerId);

  await connectionStore.markRead(viewerId, partnerId);

  return {
    partner: toDirectoryUser(partner),
    state,
    canSend: state === 'connected',
    messages: await connectionStore.messages(viewerId, partnerId),
  };
}

export async function sendMessage(
  viewerId: string,
  partnerId: string,
  body: string,
): Promise<MessageRecord> {
  const connection = await connectionStore.between(viewerId, partnerId);

  // The whole point of connections: an inbox nobody can push into uninvited.
  if (connection?.status !== 'accepted') {
    throw HttpError.forbidden(
      'You can only message people you are connected with. Send a connection request first.',
    );
  }

  return connectionStore.send(viewerId, partnerId, body.trim());
}

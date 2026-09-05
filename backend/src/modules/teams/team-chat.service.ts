import { teamChatStore, type TeamMessageRecord } from '../../data/team-chat.store.js';
import { teamStore } from '../../data/team.store.js';
import { userStore } from '../../data/user.store.js';
import { HttpError } from '../../utils/http-error.js';
import { toDirectoryUser, type DirectoryUser } from '../users/user.model.js';

/**
 * The team channel.
 *
 * One rule: you can read and write a channel only while you are on the roster.
 * Not "were on it" — leaving a team ends access to its channel, the same way it
 * ends everything else about being on that team. The history stays for the
 * people still there.
 */

export interface TeamChatMessage extends TeamMessageRecord {
  /** Denormalised so the UI does not fetch a profile per message. */
  sender: { id: string; fullName: string; firstName: string; avatarUrl: string | null };
}

export interface TeamChannel {
  teamId: string;
  teamName: string;
  members: DirectoryUser[];
  messages: TeamChatMessage[];
}

/** Membership is the gate for both reading and writing. */
async function requireMembership(teamId: string, userId: string) {
  const team = await teamStore.findDetail(teamId);
  if (!team) throw HttpError.notFound(`No team found with id "${teamId}".`);

  if (!team.members.some((member) => member.userId === userId)) {
    throw HttpError.forbidden('Only members of this team can use its channel.');
  }
  return team;
}

/**
 * Attaches sender details to a batch of messages.
 *
 * One lookup for the whole batch rather than one per message — a channel of two
 * hundred messages between four people otherwise issues two hundred queries for
 * four distinct answers.
 */
async function withSenders(messages: TeamMessageRecord[]): Promise<TeamChatMessage[]> {
  const ids = [...new Set(messages.map((message) => message.senderId))];
  const people = await userStore.findManyByIds(ids);
  const byId = new Map(people.map((person) => [person.id, person]));

  return messages.map((message) => {
    const sender = byId.get(message.senderId);
    return {
      ...message,
      sender: {
        id: message.senderId,
        // A deleted account's rows are gone by cascade, but a message read
        // mid-deletion should render a name rather than crash on undefined.
        fullName: sender?.fullName ?? 'Former member',
        firstName: sender?.firstName ?? '?',
        avatarUrl: sender?.avatarUrl ?? null,
      },
    };
  });
}

/** Opening the channel also marks it read. */
export async function channel(teamId: string, viewerId: string): Promise<TeamChannel> {
  const team = await requireMembership(teamId, viewerId);

  const [messages, members] = await Promise.all([
    teamChatStore.messages(teamId),
    userStore.findManyByIds(team.members.map((member) => member.userId)),
  ]);

  await teamChatStore.markRead(teamId, viewerId);

  return {
    teamId,
    teamName: team.name,
    members: members.map(toDirectoryUser),
    messages: await withSenders(messages),
  };
}

export async function send(
  teamId: string,
  senderId: string,
  body: string,
): Promise<TeamChatMessage> {
  await requireMembership(teamId, senderId);

  const message = await teamChatStore.send(teamId, senderId, body.trim());
  const [withSender] = await withSenders([message]);
  return withSender;
}

/** Unread per team for the badge. */
export function unreadCounts(userId: string): Promise<Map<string, number>> {
  return teamChatStore.unreadCounts(userId);
}

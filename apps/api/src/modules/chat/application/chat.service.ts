import type { CommunityService } from '../../communities/application/community.service.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { ChatRepository } from './chat-repository.js';

export class ChatService {
  constructor(
    private readonly repo: ChatRepository,
    private readonly communities: CommunityService,
  ) {}

  private async room(userId: string, eventId: string) {
    const room = await this.repo.roomForEvent(eventId);
    if (!room) throw new AppError(404, 'CHAT_ROOM_NOT_FOUND', 'Event chat room not found.');
    await this.communities.requireMembership(userId, room.communityId);
    return room;
  }

  async list(userId: string, eventId: string, input: { cursor?: string; limit?: number }) {
    const room = await this.room(userId, eventId);
    return this.repo.listMessages(room.id, {
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
      limit: Math.min(input.limit ?? 50, 100),
    });
  }

  async post(userId: string, eventId: string, body: string) {
    const room = await this.room(userId, eventId);
    const now = new Date();
    if (now < room.opensAt || now > room.closesAt) {
      throw new AppError(409, 'CHAT_CLOSED', 'This event chat is currently closed.');
    }
    return this.repo.createMessage(room.id, userId, body);
  }

  async remove(userId: string, eventId: string, messageId: string) {
    const room = await this.room(userId, eventId);
    let isManager = false;
    try {
      await this.communities.requireManager(userId, room.communityId);
      isManager = true;
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'COMMUNITY_MANAGER_REQUIRED') throw error;
    }
    return this.repo.softDelete(messageId, userId, isManager);
  }
}

import { Prisma } from '@hooma/database';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type { TeamMemberReadRepository } from '../application/team-member-read.repository.js';

const memberTeamSelect = {
  id: true,
  communityId: true,
  name: true,
  city: true,
  houma: true,
  badgeUrl: true,
  status: true,
  isPublic: true,
  acceptingChallenges: true,
  createdAt: true,
  community: { select: { id: true, name: true, avatarUrl: true } },
  players: {
    where: { isActive: true },
    select: {
      id: true,
      userId: true,
      displayName: true,
      shirtNumber: true,
      position: true,
      photoUrl: true,
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  lineups: {
    where: { isCurrent: true, isPublished: true, deletedAt: null },
    take: 1,
    select: {
      id: true,
      name: true,
      formation: true,
      matchFormat: true,
      isCurrent: true,
      isPublished: true,
      slots: {
        select: {
          id: true,
          role: true,
          x: true,
          y: true,
          isStarter: true,
          sortOrder: true,
          player: {
            select: {
              id: true,
              userId: true,
              displayName: true,
              shirtNumber: true,
              position: true,
              photoUrl: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
      },
    },
    orderBy: [{ updatedAt: 'desc' as const }],
  },
  _count: { select: { players: { where: { isActive: true } } } },
} satisfies Prisma.TeamSelect;

export class PrismaTeamMemberReadRepository implements TeamMemberReadRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listMine(userId: string) {
    const items = await this.db.team.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        players: { some: { userId, isActive: true } },
      },
      select: memberTeamSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return { items };
  }
}

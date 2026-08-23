import { Prisma } from '@hooma/database';
import type {
  TeamChallengeCreateInput,
  TeamChallengeMessageCreateInput,
  TeamCreateInput,
  TeamLineupCreateInput,
  TeamLineupUpdateInput,
  TeamPlayerCreateInput,
  TeamUpdateInput,
} from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { AppError } from '../../../http/errors/app-error.js';
import { decodeTimeIdCursor, encodeTimeIdCursor } from '../../../infrastructure/database/cursor.js';
import type { TeamListInput, TeamRepository } from '../application/team-repository.js';

const lineupSlotSelect = {
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
} satisfies Prisma.TeamLineupSlotSelect;

const lineupSelect = {
  id: true,
  name: true,
  formation: true,
  matchFormat: true,
  isCurrent: true,
  isPublished: true,
  slots: {
    select: lineupSlotSelect,
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.TeamLineupSelect;

const publicTeamSelect = {
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
    take: 8,
    select: {
      id: true,
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
    },
    orderBy: [{ updatedAt: 'desc' as const }],
  },
  _count: { select: { players: { where: { isActive: true } } } },
} satisfies Prisma.TeamSelect;

const teamDetailSelect = {
  ...publicTeamSelect,
  lineups: {
    where: { deletedAt: null },
    take: 1,
    select: lineupSelect,
    orderBy: [{ isCurrent: 'desc' as const }, { updatedAt: 'desc' as const }],
  },
} satisfies Prisma.TeamSelect;

const publicTeamDetailSelect = {
  ...teamDetailSelect,
  lineups: {
    ...teamDetailSelect.lineups,
    where: { isCurrent: true, isPublished: true, deletedAt: null },
  },
} satisfies Prisma.TeamSelect;

const challengeInclude = {
  challengerTeam: {
    select: { id: true, name: true, badgeUrl: true, city: true, houma: true, communityId: true },
  },
  challengedTeam: {
    select: { id: true, name: true, badgeUrl: true, city: true, houma: true, communityId: true },
  },
  game: true,
} satisfies Prisma.TeamChallengeInclude;

const challengeDetailInclude = {
  challengerTeam: { select: teamDetailSelect },
  challengedTeam: { select: teamDetailSelect },
  game: {
    include: {
      homeTeam: { select: teamDetailSelect },
      awayTeam: { select: teamDetailSelect },
      challenge: true,
    },
  },
} satisfies Prisma.TeamChallengeInclude;

const gameDetailInclude = {
  homeTeam: { select: teamDetailSelect },
  awayTeam: { select: teamDetailSelect },
  challenge: {
    include: {
      challengerTeam: { select: teamDetailSelect },
      challengedTeam: { select: teamDetailSelect },
      game: true,
    },
  },
} satisfies Prisma.TeamGameInclude;

const matchSize: Record<TeamLineupCreateInput['matchFormat'], number> = {
  FIVE_V_FIVE: 5,
  SIX_V_SIX: 6,
  SEVEN_V_SEVEN: 7,
  EIGHT_V_EIGHT: 8,
  NINE_V_NINE: 9,
  ELEVEN_V_ELEVEN: 11,
};

async function validateLineupInput(
  tx: Prisma.TransactionClient,
  teamId: string,
  input: TeamLineupCreateInput | TeamLineupUpdateInput,
) {
  const starters = input.slots.filter((slot) => slot.isStarter);
  if (starters.length > matchSize[input.matchFormat]) {
    throw new AppError(
      409,
      'TEAM_LINEUP_TOO_MANY_STARTERS',
      `This match format allows ${matchSize[input.matchFormat]} starters.`,
    );
  }

  const playerIds = input.slots.flatMap((slot) => (slot.playerId ? [slot.playerId] : []));
  if (new Set(playerIds).size !== playerIds.length) {
    throw new AppError(409, 'TEAM_LINEUP_DUPLICATE_PLAYER', 'A Team player can appear only once.');
  }
  if (!playerIds.length) return;

  const activePlayers = await tx.teamPlayer.findMany({
    where: { id: { in: playerIds }, teamId, isActive: true },
    select: { id: true },
  });
  if (activePlayers.length !== playerIds.length) {
    throw new AppError(
      409,
      'TEAM_LINEUP_PLAYER_INVALID',
      'Lineup players must be active players on this Team.',
    );
  }
}

export class PrismaTeamRepository implements TeamRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listPublic(input: TeamListInput) {
    const cursor = input.cursor ? decodeTimeIdCursor(input.cursor, 'Team') : null;
    const rows = await this.db.team.findMany({
      where: {
        status: 'ACTIVE',
        isPublic: true,
        deletedAt: null,
        ...(input.city ? { city: { contains: input.city, mode: 'insensitive' } } : {}),
        ...(input.houma ? { houma: { contains: input.houma, mode: 'insensitive' } } : {}),
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: 'insensitive' } },
                { city: { contains: input.search, mode: 'insensitive' } },
                { houma: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.at } },
                { createdAt: cursor.at, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      select: publicTeamSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });
    const hasMore = rows.length > input.limit;
    const items = hasMore ? rows.slice(0, input.limit) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last ? encodeTimeIdCursor(last.createdAt, last.id) : null,
    };
  }

  getPublic(teamId: string) {
    return this.db.team.findFirst({
      where: { id: teamId, status: 'ACTIVE', isPublic: true, deletedAt: null },
      select: publicTeamDetailSelect,
    });
  }

  getCurrentLineup(teamId: string) {
    return this.db.teamLineup.findFirst({
      where: { teamId, isCurrent: true, deletedAt: null },
      select: lineupSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async listManagedTeams(teamIds: string[]) {
    if (!teamIds.length) return { items: [] };
    const items = await this.db.team.findMany({
      where: { id: { in: teamIds }, status: 'ACTIVE', deletedAt: null },
      select: teamDetailSelect,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    return { items };
  }

  async getChallenge(challengeId: string, managedTeamIds: string[]) {
    const challenge = await this.db.teamChallenge.findUnique({
      where: { id: challengeId },
      include: challengeDetailInclude,
    });
    if (!challenge) throw new AppError(404, 'TEAM_CHALLENGE_NOT_FOUND', 'Challenge not found.');
    const canAccess = [challenge.challengerTeamId, challenge.challengedTeamId].some((teamId) =>
      managedTeamIds.includes(teamId),
    );
    if (!canAccess) {
      throw new AppError(403, 'TEAM_CHALLENGE_ACCESS_DENIED', 'Not allowed for this challenge.');
    }
    return challenge;
  }

  async getGame(gameId: string) {
    const game = await this.db.teamGame.findUnique({
      where: { id: gameId },
      include: gameDetailInclude,
    });
    if (!game) throw new AppError(404, 'TEAM_GAME_NOT_FOUND', 'Game not found.');
    return game;
  }

  getTeamAccess(teamId: string) {
    return this.db.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: { id: true, communityId: true, status: true },
    });
  }

  async getCommunityCoachAccess(userId: string, communityId: string) {
    const membership = await this.db.membership.findFirst({
      where: {
        userId,
        communityId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN'] },
        community: { deletedAt: null },
      },
      select: { communityId: true, role: true },
    });
    if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) return null;
    return { communityId: membership.communityId, role: membership.role };
  }

  async getTeamManagerAccess(userId: string, teamId: string) {
    const team = await this.db.team.findFirst({
      where: { id: teamId, deletedAt: null },
      select: {
        id: true,
        communityId: true,
        community: {
          select: {
            memberships: {
              where: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
              take: 1,
              select: { role: true },
            },
          },
        },
      },
    });
    const role = team?.community.memberships[0]?.role;
    if (!team || (role !== 'OWNER' && role !== 'ADMIN')) return null;
    return { id: team.id, communityId: team.communityId, role };
  }

  async getManagedTeamIds(userId: string) {
    const rows = await this.db.team.findMany({
      where: {
        deletedAt: null,
        community: {
          memberships: {
            some: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
          },
        },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async create(userId: string, input: TeamCreateInput) {
    try {
      return await this.db.team.create({
        data: {
          communityId: input.communityId,
          createdByUserId: userId,
          name: input.name,
          city: input.city || null,
          houma: input.houma || null,
          badgeUrl: input.badgeUrl || null,
          isPublic: input.isPublic,
          acceptingChallenges: input.acceptingChallenges,
        },
        select: publicTeamSelect,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'TEAM_ALREADY_EXISTS', 'This community already has a team for v1.');
      }
      throw error;
    }
  }

  update(teamId: string, input: TeamUpdateInput) {
    return this.db.team.update({
      where: { id: teamId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.city !== undefined ? { city: input.city || null } : {}),
        ...(input.houma !== undefined ? { houma: input.houma || null } : {}),
        ...(input.badgeUrl !== undefined ? { badgeUrl: input.badgeUrl || null } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        ...(input.acceptingChallenges !== undefined
          ? { acceptingChallenges: input.acceptingChallenges }
          : {}),
      },
      select: publicTeamSelect,
    });
  }

  addPlayer(teamId: string, input: TeamPlayerCreateInput) {
    return this.db.teamPlayer.create({
      data: {
        teamId,
        userId: input.userId || null,
        displayName: input.displayName,
        shirtNumber: input.shirtNumber ?? null,
        position: input.position ?? null,
        photoUrl: input.photoUrl || null,
      },
    });
  }

  createLineup(userId: string, teamId: string, input: TeamLineupCreateInput) {
    return this.db.$transaction(async (tx) => {
      await validateLineupInput(tx, teamId, input);
      if (input.isCurrent) {
        await tx.teamLineup.updateMany({
          where: { teamId, deletedAt: null },
          data: { isCurrent: false },
        });
      }
      return tx.teamLineup.create({
        data: {
          teamId,
          createdByUserId: userId,
          name: input.name,
          formation: input.formation,
          matchFormat: input.matchFormat,
          isCurrent: input.isCurrent,
          isPublished: input.isPublished,
          slots: {
            create: input.slots.map((slot) => ({
              playerId: slot.playerId || null,
              role: slot.role,
              x: slot.x,
              y: slot.y,
              isStarter: slot.isStarter,
              sortOrder: slot.sortOrder,
            })),
          },
        },
        select: lineupSelect,
      });
    });
  }

  updateLineup(
    userId: string,
    teamId: string,
    lineupId: string,
    input: TeamLineupUpdateInput,
  ) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.teamLineup.findFirst({
        where: { id: lineupId, teamId, deletedAt: null },
        select: { id: true },
      });
      if (!existing) throw new AppError(404, 'TEAM_LINEUP_NOT_FOUND', 'Team lineup not found.');

      await validateLineupInput(tx, teamId, input);
      if (input.isCurrent) {
        await tx.teamLineup.updateMany({
          where: { teamId, id: { not: lineupId }, deletedAt: null },
          data: { isCurrent: false },
        });
      }
      await tx.teamLineupSlot.deleteMany({ where: { lineupId } });
      return tx.teamLineup.update({
        where: { id: lineupId },
        data: {
          name: input.name,
          formation: input.formation,
          matchFormat: input.matchFormat,
          isCurrent: input.isCurrent,
          isPublished: input.isPublished,
          slots: {
            create: input.slots.map((slot) => ({
              playerId: slot.playerId || null,
              role: slot.role,
              x: slot.x,
              y: slot.y,
              isStarter: slot.isStarter,
              sortOrder: slot.sortOrder,
            })),
          },
        },
        select: lineupSelect,
      });
    });
  }

  async createChallenge(userId: string, input: TeamChallengeCreateInput) {
    return this.db.$transaction(
      async (tx) => {
        const [challenger, challenged] = await Promise.all([
          tx.team.findFirst({ where: { id: input.challengerTeamId, deletedAt: null } }),
          tx.team.findFirst({ where: { id: input.challengedTeamId, deletedAt: null } }),
        ]);
        if (!challenger || !challenged) {
          throw new AppError(404, 'TEAM_NOT_FOUND', 'One of the teams was not found.');
        }
        if (
          challenged.status !== 'ACTIVE' ||
          !challenged.isPublic ||
          !challenged.acceptingChallenges
        ) {
          throw new AppError(
            409,
            'TEAM_NOT_ACCEPTING_CHALLENGES',
            'This team is not accepting challenges.',
          );
        }
        const duplicate = await tx.teamChallenge.findFirst({
          where: {
            status: 'PENDING',
            OR: [
              { challengerTeamId: challenger.id, challengedTeamId: challenged.id },
              { challengerTeamId: challenged.id, challengedTeamId: challenger.id },
            ],
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new AppError(
            409,
            'TEAM_CHALLENGE_PENDING_EXISTS',
            'A pending challenge already exists between these teams.',
          );
        }
        return tx.teamChallenge.create({
          data: {
            challengerTeamId: challenger.id,
            challengedTeamId: challenged.id,
            proposedByCommunityId: challenger.communityId,
            challengedCommunityId: challenged.communityId,
            proposedStartsAt: input.proposedStartsAt || null,
            proposedVenue: input.proposedVenue || null,
            proposedFormat: input.proposedFormat || null,
            message: input.message || null,
          },
          include: challengeInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  listIncomingChallenges(teamIds: string[], limit: number) {
    if (!teamIds.length) return Promise.resolve({ items: [] });
    return this.db.teamChallenge
      .findMany({
        where: { challengedTeamId: { in: teamIds } },
        include: challengeInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
      .then((items) => ({ items }));
  }

  listOutgoingChallenges(teamIds: string[], limit: number) {
    if (!teamIds.length) return Promise.resolve({ items: [] });
    return this.db.teamChallenge
      .findMany({
        where: { challengerTeamId: { in: teamIds } },
        include: challengeInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
      })
      .then((items) => ({ items }));
  }

  acceptChallenge(userId: string, challengeId: string, managedTeamIds: string[]) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "TeamChallenge" WHERE id = ${challengeId} FOR UPDATE`;
        const challenge = await tx.teamChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge) throw new AppError(404, 'TEAM_CHALLENGE_NOT_FOUND', 'Challenge not found.');
        if (!managedTeamIds.includes(challenge.challengedTeamId)) {
          throw new AppError(403, 'TEAM_CHALLENGE_ACCESS_DENIED', 'Not allowed for this team.');
        }
        if (challenge.status !== 'PENDING') {
          throw new AppError(409, 'TEAM_CHALLENGE_CLOSED', 'This challenge is no longer pending.');
        }
        const updated = await tx.teamChallenge.update({
          where: { id: challengeId },
          data: { status: 'ACCEPTED', acceptedByUserId: userId, acceptedAt: new Date() },
          include: challengeInclude,
        });
        await tx.teamGame.create({
          data: {
            challengeId,
            homeTeamId: challenge.challengerTeamId,
            awayTeamId: challenge.challengedTeamId,
            scheduledAt: challenge.proposedStartsAt,
            venueName: challenge.proposedVenue,
            matchFormat: challenge.proposedFormat,
            status: challenge.proposedStartsAt ? 'CONFIRMED' : 'SCHEDULING',
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  declineChallenge(userId: string, challengeId: string, managedTeamIds: string[]) {
    return this.closePendingChallenge(userId, challengeId, managedTeamIds, 'DECLINED');
  }

  cancelChallenge(userId: string, challengeId: string, managedTeamIds: string[]) {
    return this.closePendingChallenge(userId, challengeId, managedTeamIds, 'CANCELLED');
  }

  listGames(teamIds: string[], limit: number) {
    if (!teamIds.length) return Promise.resolve({ items: [] });
    return this.db.teamGame
      .findMany({
        where: { OR: [{ homeTeamId: { in: teamIds } }, { awayTeamId: { in: teamIds } }] },
        include: {
          homeTeam: { select: { id: true, name: true, badgeUrl: true } },
          awayTeam: { select: { id: true, name: true, badgeUrl: true } },
          challenge: true,
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
        take: limit,
      })
      .then((items) => ({ items }));
  }

  async listMessages(challengeId: string, managedTeamIds: string[]) {
    const challenge = await this.db.teamChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError(404, 'TEAM_CHALLENGE_NOT_FOUND', 'Challenge not found.');
    if (
      challenge.status !== 'ACCEPTED' ||
      ![challenge.challengerTeamId, challenge.challengedTeamId].some((id) =>
        managedTeamIds.includes(id),
      )
    ) {
      throw new AppError(403, 'TEAM_CHALLENGE_ACCESS_DENIED', 'Not allowed for this challenge.');
    }
    const items = await this.db.teamChallengeMessage.findMany({
      where: { challengeId, deletedAt: null },
      include: { user: { select: { id: true, firstName: true, username: true } }, team: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    return { items };
  }

  async createMessage(
    userId: string,
    challengeId: string,
    managedTeamIds: string[],
    input: TeamChallengeMessageCreateInput,
  ) {
    const challenge = await this.db.teamChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppError(404, 'TEAM_CHALLENGE_NOT_FOUND', 'Challenge not found.');
    if (challenge.status !== 'ACCEPTED') {
      throw new AppError(
        409,
        'TEAM_CHALLENGE_MESSAGES_LOCKED',
        'Messages are available after acceptance.',
      );
    }
    const teamId = [challenge.challengerTeamId, challenge.challengedTeamId].find((id) =>
      managedTeamIds.includes(id),
    );
    if (!teamId) {
      throw new AppError(403, 'TEAM_CHALLENGE_ACCESS_DENIED', 'Not allowed for this challenge.');
    }
    return this.db.teamChallengeMessage.create({
      data: { challengeId, teamId, userId, body: input.body },
    });
  }

  private closePendingChallenge(
    userId: string,
    challengeId: string,
    managedTeamIds: string[],
    status: 'DECLINED' | 'CANCELLED',
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "TeamChallenge" WHERE id = ${challengeId} FOR UPDATE`;
        const challenge = await tx.teamChallenge.findUnique({ where: { id: challengeId } });
        if (!challenge) throw new AppError(404, 'TEAM_CHALLENGE_NOT_FOUND', 'Challenge not found.');
        const requiredTeamId =
          status === 'DECLINED' ? challenge.challengedTeamId : challenge.challengerTeamId;
        if (!managedTeamIds.includes(requiredTeamId)) {
          throw new AppError(403, 'TEAM_CHALLENGE_ACCESS_DENIED', 'Not allowed for this team.');
        }
        if (challenge.status !== 'PENDING') {
          throw new AppError(409, 'TEAM_CHALLENGE_CLOSED', 'This challenge is no longer pending.');
        }
        return tx.teamChallenge.update({
          where: { id: challengeId },
          data:
            status === 'DECLINED'
              ? { status, declinedByUserId: userId, declinedAt: new Date() }
              : { status, cancelledByUserId: userId, cancelledAt: new Date() },
          include: challengeInclude,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

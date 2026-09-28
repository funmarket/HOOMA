import { Prisma } from '@hooma/database';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type {
  GamerArenaMatchPage,
  GamerArenaMatchRecord,
  GamerChallengeAccessRecord,
  GamerChallengeRecord,
  GamerChallengeRepository,
} from '../application/gamer-challenge.repository.js';
import { loadGamerPresentations } from './gamer-presentation.js';

const challengeSelect = {
  id: true,
  gameId: true,
  status: true,
  createdAt: true,
  respondedAt: true,
  cancelledAt: true,
  challenger: {
    select: { id: true, userId: true, gamerTag: true },
  },
  challenged: {
    select: { id: true, userId: true, gamerTag: true },
  },
} satisfies Prisma.GamerChallengeSelect;

const arenaSelect = {
  id: true,
  status: true,
  game: {
    select: { id: true, slug: true, name: true },
  },
  challenger: challengeSelect.challenger,
  challenged: challengeSelect.challenged,
} satisfies Prisma.GamerChallengeSelect;

type ChallengeRow = Prisma.GamerChallengeGetPayload<{ select: typeof challengeSelect }>;
type ArenaRow = Prisma.GamerChallengeGetPayload<{ select: typeof arenaSelect }>;

function isUniqueConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

export class PrismaGamerChallengeRepository implements GamerChallengeRepository {
  constructor(private readonly db: DatabaseClient) {}

  async createPending(input: {
    gameId: string;
    challengerProfileId: string;
    challengedProfileId: string;
    pairKey: string;
  }) {
    try {
      const row = await this.db.gamerChallenge.create({
        data: input,
        select: challengeSelect,
      });
      return this.mapChallenge(row);
    } catch (error) {
      if (isUniqueConstraint(error)) return null;
      throw error;
    }
  }

  async getAccessRecord(challengeId: string): Promise<GamerChallengeAccessRecord | null> {
    const row = await this.db.gamerChallenge.findUnique({
      where: { id: challengeId },
      select: challengeSelect,
    });
    if (!row) return null;
    const record = await this.mapChallenge(row);
    if (!record) return null;
    return {
      record,
      challengerUserId: row.challenger.userId,
      challengedUserId: row.challenged.userId,
    };
  }

  async listForUserAndGame(userId: string, gameId: string) {
    const rows = await this.db.gamerChallenge.findMany({
      where: {
        gameId,
        OR: [{ challenger: { userId } }, { challenged: { userId } }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: challengeSelect,
    });
    return this.mapChallenges(rows);
  }

  async listAcceptedAcrossActiveGames(input: {
    cursor?: string;
    limit: number;
  }): Promise<GamerArenaMatchPage> {
    const rows = await this.db.gamerChallenge.findMany({
      where: {
        status: 'ACCEPTED',
        game: { status: 'ACTIVE' },
      },
      orderBy: [{ respondedAt: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: arenaSelect,
    });
    const hasMore = rows.length > input.limit;
    const pageRows = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: await this.mapArenaRows(pageRows),
      nextCursor: hasMore ? (pageRows.at(-1)?.id ?? null) : null,
    };
  }

  acceptForChallengedUser(challengeId: string, userId: string) {
    return this.transitionForChallengedUser(challengeId, userId, 'ACCEPTED');
  }

  declineForChallengedUser(challengeId: string, userId: string) {
    return this.transitionForChallengedUser(challengeId, userId, 'DECLINED');
  }

  async cancelForChallengerUser(challengeId: string, userId: string) {
    const existing = await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challenger: { userId } },
      select: challengeSelect,
    });
    if (!existing) return null;
    if (existing.status === 'CANCELLED') return this.mapChallenge(existing);
    if (existing.status !== 'PENDING') return null;

    await this.db.gamerChallenge.updateMany({
      where: { id: challengeId, status: 'PENDING', challenger: { userId } },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const updated = await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challenger: { userId } },
      select: challengeSelect,
    });
    return updated?.status === 'CANCELLED' ? this.mapChallenge(updated) : null;
  }

  private async transitionForChallengedUser(
    challengeId: string,
    userId: string,
    nextStatus: 'ACCEPTED' | 'DECLINED',
  ) {
    const existing = await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challenged: { userId } },
      select: challengeSelect,
    });
    if (!existing) return null;
    if (existing.status === nextStatus) return this.mapChallenge(existing);
    if (existing.status !== 'PENDING') return null;

    await this.db.gamerChallenge.updateMany({
      where: { id: challengeId, status: 'PENDING', challenged: { userId } },
      data: { status: nextStatus, respondedAt: new Date() },
    });
    const updated = await this.db.gamerChallenge.findFirst({
      where: { id: challengeId, challenged: { userId } },
      select: challengeSelect,
    });
    return updated?.status === nextStatus ? this.mapChallenge(updated) : null;
  }

  private async mapChallenge(row: ChallengeRow): Promise<GamerChallengeRecord | null> {
    const presentations = await loadGamerPresentations(this.db, [
      row.challenger.userId,
      row.challenged.userId,
    ]);
    const challengerPresentation = presentations.get(row.challenger.userId);
    const challengedPresentation = presentations.get(row.challenged.userId);
    if (!challengerPresentation || !challengedPresentation) return null;

    return {
      id: row.id,
      gameId: row.gameId,
      status: row.status,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
      cancelledAt: row.cancelledAt,
      challenger: {
        id: row.challenger.id,
        handle: row.challenger.gamerTag,
        presentation: challengerPresentation,
      },
      challenged: {
        id: row.challenged.id,
        handle: row.challenged.gamerTag,
        presentation: challengedPresentation,
      },
    };
  }

  private async mapChallenges(rows: ChallengeRow[]) {
    const presentations = await loadGamerPresentations(
      this.db,
      rows.flatMap((row) => [row.challenger.userId, row.challenged.userId]),
    );
    return rows.flatMap((row) => {
      const challengerPresentation = presentations.get(row.challenger.userId);
      const challengedPresentation = presentations.get(row.challenged.userId);
      if (!challengerPresentation || !challengedPresentation) return [];
      return [
        {
          id: row.id,
          gameId: row.gameId,
          status: row.status,
          createdAt: row.createdAt,
          respondedAt: row.respondedAt,
          cancelledAt: row.cancelledAt,
          challenger: {
            id: row.challenger.id,
            handle: row.challenger.gamerTag,
            presentation: challengerPresentation,
          },
          challenged: {
            id: row.challenged.id,
            handle: row.challenged.gamerTag,
            presentation: challengedPresentation,
          },
        },
      ];
    });
  }

  private async mapArenaRows(rows: ArenaRow[]): Promise<GamerArenaMatchRecord[]> {
    const presentations = await loadGamerPresentations(
      this.db,
      rows.flatMap((row) => [row.challenger.userId, row.challenged.userId]),
    );
    return rows.flatMap((row) => {
      if (row.status !== 'ACCEPTED') return [];
      const challengerPresentation = presentations.get(row.challenger.userId);
      const challengedPresentation = presentations.get(row.challenged.userId);
      if (!challengerPresentation || !challengedPresentation) return [];
      return [
        {
          id: row.id,
          status: 'ACCEPTED' as const,
          game: row.game,
          challenger: {
            id: row.challenger.id,
            handle: row.challenger.gamerTag,
            presentation: challengerPresentation,
          },
          challenged: {
            id: row.challenged.id,
            handle: row.challenged.gamerTag,
            presentation: challengedPresentation,
          },
        },
      ];
    });
  }
}

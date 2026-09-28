import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type {
  GamerChallengerSummary,
  GamerDiscoverySummary,
  GamerParticipationProfile,
  GamerParticipationRepository,
} from '../application/gamer-participation.repository.js';
import { loadGamerPresentations } from './gamer-presentation.js';

const participationSelect = {
  id: true,
  userId: true,
  gameId: true,
  gamerTag: true,
  openToChallenge: true,
} as const;

function mapParticipation(row: {
  id: string;
  userId: string;
  gameId: string;
  gamerTag: string;
  openToChallenge: boolean;
}): GamerParticipationProfile {
  return row;
}

export class PrismaGamerParticipationRepository implements GamerParticipationRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getByUserAndGame(userId: string, gameId: string) {
    const row = await this.db.gamerProfile.findUnique({
      where: { userId_gameId: { userId, gameId } },
      select: participationSelect,
    });
    return row ? mapParticipation(row) : null;
  }

  async getById(profileId: string) {
    const row = await this.db.gamerProfile.findUnique({
      where: { id: profileId },
      select: participationSelect,
    });
    return row ? mapParticipation(row) : null;
  }

  async listOpenByGame(gameId: string): Promise<GamerChallengerSummary[]> {
    const eligibleUserIds = await this.listEligibleUserIds();
    if (eligibleUserIds.length === 0) return [];

    const rows = await this.db.gamerProfile.findMany({
      where: {
        gameId,
        openToChallenge: true,
        visibility: 'PUBLIC',
        userId: { in: eligibleUserIds },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        userId: true,
        gamerTag: true,
      },
    });
    const presentations = await loadGamerPresentations(
      this.db,
      rows.map((row) => row.userId),
    );

    return rows.flatMap((row) => {
      const presentation = presentations.get(row.userId);
      return presentation ? [{ id: row.id, handle: row.gamerTag, presentation }] : [];
    });
  }

  async listDiscoverable(): Promise<GamerDiscoverySummary[]> {
    const eligibleUserIds = await this.listEligibleUserIds();
    if (eligibleUserIds.length === 0) return [];

    const rows = await this.db.gamerProfile.findMany({
      where: {
        visibility: 'PUBLIC',
        userId: { in: eligibleUserIds },
        game: { status: 'ACTIVE' },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        userId: true,
        gamerTag: true,
        openToChallenge: true,
        game: { select: { id: true, slug: true, name: true } },
      },
    });
    const presentations = await loadGamerPresentations(
      this.db,
      rows.map((row) => row.userId),
    );

    return rows.flatMap((row) => {
      const presentation = presentations.get(row.userId);
      return presentation
        ? [
            {
              id: row.id,
              handle: row.gamerTag,
              openToChallenge: row.openToChallenge,
              game: row.game,
              presentation,
            },
          ]
        : [];
    });
  }

  private async listEligibleUserIds() {
    const identities = await this.db.userProfileIdentity.findMany({
      where: { type: 'GAMER' },
      select: { userId: true },
    });
    return identities.map((identity) => identity.userId);
  }
}

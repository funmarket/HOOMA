import { Prisma } from '@hooma/database';
import type { GamerGameListQuery } from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import {
  decodeTimeIdCursor,
  encodeTimeIdCursor,
} from '../../../infrastructure/database/cursor.js';
import type {
  GamerGameRecord,
  GamerGameRepository,
} from '../application/gamer-game.repository.js';

const publicSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  logoUrl: true,
  coverUrl: true,
  publisher: true,
  platforms: true,
  status: true,
  featured: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GamerGameSelect;

type PublicRow = Prisma.GamerGameGetPayload<{ select: typeof publicSelect }>;

function mapPublic(row: PublicRow): GamerGameRecord {
  return row;
}

export class PrismaGamerGameRepository implements GamerGameRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listPublic(input: GamerGameListQuery) {
    const cursor = input.cursor ? decodeTimeIdCursor(input.cursor, 'Gamer game') : null;
    const rows = await this.db.gamerGame.findMany({
      where: {
        status: 'ACTIVE',
        ...(input.platform ? { platforms: { has: input.platform } } : {}),
        ...(input.featured !== undefined ? { featured: input.featured } : {}),
        ...(input.q
          ? {
              OR: [
                { name: { contains: input.q, mode: 'insensitive' } },
                { publisher: { contains: input.q, mode: 'insensitive' } },
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
      select: publicSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
    });

    const hasMore = rows.length > input.limit;
    const selected = hasMore ? rows.slice(0, input.limit) : rows;
    const last = selected.at(-1);
    return {
      items: selected.map(mapPublic),
      nextCursor: hasMore && last ? encodeTimeIdCursor(last.createdAt, last.id) : null,
    };
  }

  async getPublic(identifier: string) {
    const row = await this.db.gamerGame.findFirst({
      where: {
        status: 'ACTIVE',
        OR: [{ id: identifier }, { slug: identifier }],
      },
      select: publicSelect,
    });
    return row ? mapPublic(row) : null;
  }
}

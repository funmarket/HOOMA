import { Prisma } from '@hooma/database';
import type { GamerGameListQuery } from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { decodeTimeIdCursor, encodeTimeIdCursor } from '../../../infrastructure/database/cursor.js';
import type {
  GamerGameCreateData,
  GamerGameRecord,
  GamerGameRepository,
  GamerGameUpdateData,
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

function prismaCode(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}

function createData(input: GamerGameCreateData): Prisma.GamerGameCreateInput {
  return {
    slug: input.slug,
    name: input.name,
    normalizedName: input.normalizedName,
    description: input.description ?? null,
    logoUrl: input.logoUrl ?? null,
    coverUrl: input.coverUrl ?? null,
    publisher: input.publisher ?? null,
    platforms: input.platforms,
    status: input.status,
    featured: input.featured,
  };
}

function updateData(input: GamerGameUpdateData): Prisma.GamerGameUpdateInput {
  return {
    ...(input.slug !== undefined ? { slug: input.slug } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.normalizedName !== undefined ? { normalizedName: input.normalizedName } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
    ...(input.publisher !== undefined ? { publisher: input.publisher } : {}),
    ...(input.platforms !== undefined ? { platforms: input.platforms } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.featured !== undefined ? { featured: input.featured } : {}),
  };
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

  async create(input: GamerGameCreateData) {
    try {
      const game = await this.db.gamerGame.create({
        data: createData(input),
        select: publicSelect,
      });
      return { kind: 'created' as const, game: mapPublic(game) };
    } catch (error) {
      if (prismaCode(error) === 'P2002') return { kind: 'conflict' as const };
      throw error;
    }
  }

  async update(id: string, input: GamerGameUpdateData) {
    try {
      const game = await this.db.gamerGame.update({
        where: { id },
        data: updateData(input),
        select: publicSelect,
      });
      return { kind: 'updated' as const, game: mapPublic(game) };
    } catch (error) {
      const code = prismaCode(error);
      if (code === 'P2025') return { kind: 'not_found' as const };
      if (code === 'P2002') return { kind: 'conflict' as const };
      throw error;
    }
  }
}

import { Prisma } from '@hooma/database';
import type {
  GamerCardCreateInput,
  GamerCardUpdateInput,
  GamerGameListQuery,
} from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { decodeTimeIdCursor, encodeTimeIdCursor } from '../../../infrastructure/database/cursor.js';
import type {
  GamerGameCreateData,
  GamerGameRecord,
  GamerGameRepository,
  GamerGameUpdateData,
} from '../application/gamer-game.repository.js';
import type {
  GamerProfileRecord,
  GamerProfileRepository,
} from '../application/gamer-profile.repository.js';

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

const profileSelect = {
  id: true,
  userId: true,
  gameId: true,
  gamerTag: true,
  bio: true,
  playStyle: true,
  openToChallenge: true,
  region: true,
  language: true,
  preferredTimes: true,
  visibility: true,
  createdAt: true,
  updatedAt: true,
  game: {
    select: {
      id: true,
      slug: true,
      name: true,
      logoUrl: true,
      coverUrl: true,
    },
  },
  platformIdentities: {
    select: { id: true, provider: true, label: true, handle: true, visibility: true },
    orderBy: { createdAt: 'asc' },
  },
  socialLinks: {
    select: { id: true, provider: true, label: true, url: true, visibility: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.GamerProfileSelect;

type PublicRow = Prisma.GamerGameGetPayload<{ select: typeof publicSelect }>;
type ProfileRow = Prisma.GamerProfileGetPayload<{ select: typeof profileSelect }>;

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

function displayName(user: {
  authName: string | null;
  firstName: string | null;
  lastName: string | null;
  displayAuthUsername: string | null;
  authUsername: string | null;
  username: string | null;
}) {
  if (user.authName?.trim()) return user.authName.trim();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  return user.displayAuthUsername ?? user.authUsername ?? user.username;
}

export class PrismaGamerGameRepository implements GamerGameRepository, GamerProfileRepository {
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

  async createProfile(userId: string, input: GamerCardCreateInput) {
    const game = await this.db.gamerGame.findFirst({
      where: { status: 'ACTIVE', OR: [{ id: input.gameId }, { slug: input.gameId }] },
      select: { id: true },
    });
    if (!game) return { kind: 'game_not_found' as const };

    try {
      const row = await this.db.$transaction(async (tx) => {
        const created = await tx.gamerProfile.create({
          data: {
            userId,
            gameId: game.id,
            gamerTag: input.gamerTag,
            bio: input.bio ?? null,
            playStyle: input.playStyle,
            openToChallenge: input.openToChallenge,
            region: input.region ?? null,
            language: input.language ?? null,
            preferredTimes: input.preferredTimes ?? null,
            visibility: input.visibility,
            platformIdentities: {
              create: input.platformIdentities.map((item) => ({
                provider: item.provider,
                label: item.label ?? null,
                handle: item.handle,
                visibility: item.visibility,
              })),
            },
            socialLinks: {
              create: input.socialLinks.map((item) => ({
                provider: item.provider,
                label: item.label ?? null,
                url: item.url,
                visibility: item.visibility,
              })),
            },
          },
          select: profileSelect,
        });
        await tx.userProfileIdentity.upsert({
          where: { userId_type: { userId, type: 'GAMER' } },
          create: { userId, type: 'GAMER' },
          update: {},
        });
        return created;
      });
      return { kind: 'created' as const, profile: await this.hydrateOwner(row) };
    } catch (error) {
      if (prismaCode(error) === 'P2002') return { kind: 'conflict' as const };
      throw error;
    }
  }

  async updateProfile(userId: string, profileId: string, input: GamerCardUpdateInput) {
    const existing = await this.db.gamerProfile.findFirst({
      where: { id: profileId, userId },
      select: { id: true },
    });
    if (!existing) return { kind: 'not_found' as const };

    const row = await this.db.$transaction(async (tx) => {
      if (input.platformIdentities !== undefined) {
        await tx.gamerPlatformIdentity.deleteMany({ where: { gamerProfileId: profileId } });
        if (input.platformIdentities.length) {
          await tx.gamerPlatformIdentity.createMany({
            data: input.platformIdentities.map((item) => ({
              gamerProfileId: profileId,
              provider: item.provider,
              label: item.label ?? null,
              handle: item.handle,
              visibility: item.visibility,
            })),
          });
        }
      }
      if (input.socialLinks !== undefined) {
        await tx.gamerSocialLink.deleteMany({ where: { gamerProfileId: profileId } });
        if (input.socialLinks.length) {
          await tx.gamerSocialLink.createMany({
            data: input.socialLinks.map((item) => ({
              gamerProfileId: profileId,
              provider: item.provider,
              label: item.label ?? null,
              url: item.url,
              visibility: item.visibility,
            })),
          });
        }
      }
      return tx.gamerProfile.update({
        where: { id: profileId },
        data: {
          ...(input.gamerTag !== undefined ? { gamerTag: input.gamerTag } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.playStyle !== undefined ? { playStyle: input.playStyle } : {}),
          ...(input.openToChallenge !== undefined
            ? { openToChallenge: input.openToChallenge }
            : {}),
          ...(input.region !== undefined ? { region: input.region } : {}),
          ...(input.language !== undefined ? { language: input.language } : {}),
          ...(input.preferredTimes !== undefined ? { preferredTimes: input.preferredTimes } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        },
        select: profileSelect,
      });
    });
    return { kind: 'updated' as const, profile: await this.hydrateOwner(row) };
  }

  async listMine(userId: string) {
    const rows = await this.db.gamerProfile.findMany({
      where: { userId },
      select: profileSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return Promise.all(rows.map((row) => this.hydrateOwner(row)));
  }

  async getMine(userId: string, profileId: string) {
    const row = await this.db.gamerProfile.findFirst({
      where: { id: profileId, userId },
      select: profileSelect,
    });
    return row ? this.hydrateOwner(row) : null;
  }

  async getPublicProfile(profileId: string) {
    const row = await this.db.gamerProfile.findUnique({
      where: { id: profileId },
      select: profileSelect,
    });
    return row ? this.hydrateOwner(row) : null;
  }

  private async hydrateOwner(row: ProfileRow): Promise<GamerProfileRecord> {
    const user = await this.db.user.findUnique({
      where: { id: row.userId },
      select: {
        id: true,
        username: true,
        authUsername: true,
        displayAuthUsername: true,
        authName: true,
        firstName: true,
        lastName: true,
        photoUrl: true,
      },
    });
    return {
      ...row,
      owner: {
        id: row.userId,
        username: user?.displayAuthUsername ?? user?.authUsername ?? user?.username ?? null,
        displayName: user ? displayName(user) : null,
        photoUrl: user?.photoUrl ?? null,
      },
    };
  }
}

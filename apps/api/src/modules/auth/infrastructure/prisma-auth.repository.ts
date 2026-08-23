import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type {
  AuthRepository,
  AuthSessionMetadata,
  RegisterCredentialInput,
} from '../application/auth-repository.js';

const identityUserSelect = {
  id: true,
  telegramUserId: true,
  username: true,
  authUsername: true,
  displayAuthUsername: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  languageCode: true,
  isPremium: true,
} as const;

type IdentityUserRecord = {
  id: string;
  telegramUserId: string | null;
  username: string | null;
  authUsername: string | null;
  displayAuthUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  isPremium: boolean;
};

function toIdentityUser(user: IdentityUserRecord) {
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    username: user.displayAuthUsername ?? user.authUsername ?? user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
    isPremium: user.isPremium,
  };
}

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly db: DatabaseClient) {}

  async registerCredential(input: RegisterCredentialInput) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const usernameOwner = await tx.user.findUnique({
            where: { authUsername: input.normalizedUsername },
            select: { id: true },
          });
          if (usernameOwner) return { status: 'username-taken' as const };

          if (input.email) {
            const emailOwner = await tx.user.findUnique({
              where: { email: input.email },
              select: { id: true },
            });
            if (emailOwner) return { status: 'email-taken' as const };
          }

          const user = await tx.user.create({
            data: {
              authUsername: input.normalizedUsername,
              displayAuthUsername: input.username,
              authName: input.displayName ?? input.username,
              ...(input.email ? { email: input.email, emailVerified: false } : {}),
              profile: { create: {} },
              preference: { create: {} },
              authAccounts: {
                create: {
                  id: randomUUID(),
                  accountId: input.normalizedUsername,
                  providerId: 'credential',
                  password: input.passwordHash,
                },
              },
            },
            select: identityUserSelect,
          });

          if (input.displayName) {
            await tx.userProfilePresentation.create({
              data: { userId: user.id, displayName: input.displayName },
            });
          }

          return { status: 'created' as const, user: toIdentityUser(user) };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = Array.isArray(error.meta?.target)
          ? error.meta.target.map(String).join(',')
          : String(error.meta?.target ?? '');
        if (target.includes('email')) return { status: 'email-taken' as const };
        return { status: 'username-taken' as const };
      }
      throw error;
    }
  }

  async findCredentialByUsername(normalizedUsername: string) {
    const user = await this.db.user.findUnique({
      where: { authUsername: normalizedUsername, deletedAt: null },
      select: {
        ...identityUserSelect,
        authAccounts: {
          where: { providerId: 'credential' },
          select: { password: true },
          take: 1,
        },
      },
    });
    const passwordHash = user?.authAccounts[0]?.password;
    if (!user || !passwordHash) return null;
    return { user: toIdentityUser(user), passwordHash };
  }

  async createSession(
    userId: string,
    token: string,
    expiresAt: Date,
    metadata: AuthSessionMetadata,
  ) {
    await this.db.authSession.create({
      data: {
        id: randomUUID(),
        userId,
        token,
        expiresAt,
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
        ...(metadata.userAgent ? { userAgent: metadata.userAgent.slice(0, 500) } : {}),
      },
    });
  }

  async resolveSession(token: string, now: Date) {
    const session = await this.db.authSession.findUnique({
      where: { token },
      select: {
        expiresAt: true,
        user: { select: { ...identityUserSelect, deletedAt: true } },
      },
    });
    if (!session || session.expiresAt <= now || session.user.deletedAt) return null;
    return toIdentityUser(session.user);
  }

  async deleteSession(token: string) {
    await this.db.authSession.deleteMany({ where: { token } });
  }
}

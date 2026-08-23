import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type {
  PlatformAdminBootstrapResult,
  PlatformAdminRepository,
  PlatformRole,
} from '../application/platform-admin.repository.js';

export class PrismaPlatformAdminRepository implements PlatformAdminRepository {
  constructor(private readonly db: DatabaseClient) {}

  async getActiveRoles(userId: string): Promise<PlatformRole[]> {
    const assignments = await this.db.platformRoleAssignment.findMany({
      where: { userId, revokedAt: null },
      select: { role: true },
    });

    return assignments.map((assignment) => assignment.role);
  }

  async bootstrapPlatformAdmin(
    userId: string,
    normalizedAuthUsername: string,
  ): Promise<PlatformAdminBootstrapResult> {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const user = await tx.user.findFirst({
            where: {
              id: userId,
              authUsername: normalizedAuthUsername,
              deletedAt: null,
            },
            select: { id: true },
          });
          if (!user) return 'identity-mismatch';

          const existing = await tx.platformRoleAssignment.findUnique({
            where: {
              userId_role: {
                userId,
                role: 'PLATFORM_ADMIN',
              },
            },
            select: { id: true },
          });
          if (existing) return 'already-assigned';

          await tx.platformRoleAssignment.create({
            data: {
              id: randomUUID(),
              userId,
              role: 'PLATFORM_ADMIN',
            },
          });
          return 'granted';
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return 'already-assigned';
      }
      throw error;
    }
  }
}

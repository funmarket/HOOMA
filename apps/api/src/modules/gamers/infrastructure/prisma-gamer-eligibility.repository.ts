import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type { GamerEligibilityRepository } from '../application/gamer-eligibility.repository.js';

export class PrismaGamerEligibilityRepository implements GamerEligibilityRepository {
  constructor(private readonly db: DatabaseClient) {}

  async hasGamerIdentity(userId: string) {
    const identity = await this.db.userProfileIdentity.findUnique({
      where: { userId_type: { userId, type: 'GAMER' } },
      select: { userId: true },
    });
    return Boolean(identity);
  }
}

import type { GamerPublicPresentation } from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { resolveUserPresentation } from '../../identity/domain/profile-presentation.js';

const userSelect = {
  id: true,
  username: true,
  authName: true,
  authUsername: true,
  displayAuthUsername: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
} as const;

const presentationSelect = {
  userId: true,
  displayName: true,
  photoUrl: true,
} as const;

export async function loadGamerPresentations(
  db: DatabaseClient,
  userIds: string[],
): Promise<Map<string, GamerPublicPresentation>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();

  const [users, overrides] = await Promise.all([
    db.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: userSelect,
    }),
    db.userProfilePresentation.findMany({
      where: { userId: { in: ids } },
      select: presentationSelect,
    }),
  ]);
  const overrideByUserId = new Map(overrides.map((item) => [item.userId, item]));

  return new Map(
    users.map((user) => {
      const resolved = resolveUserPresentation(user, overrideByUserId.get(user.id) ?? null);
      return [
        user.id,
        {
          username: resolved.effectiveUsername ?? resolved.effectiveDisplayName,
          displayName: resolved.effectiveDisplayName,
          photoUrl: resolved.effectivePhotoUrl,
        },
      ];
    }),
  );
}

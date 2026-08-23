import { Prisma } from '@hooma/database';
import type { TeamPlayerCreateInput } from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { TeamRosterRepository } from '../application/team-roster.repository.js';

const rosterPlayerSelect = {
  id: true,
  userId: true,
  displayName: true,
  shirtNumber: true,
  position: true,
  photoUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeamPlayerSelect;

const rosterCandidateUserSelect = {
  id: true,
  username: true,
  authName: true,
  authUsername: true,
  displayAuthUsername: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  profile: { select: { preferredPositions: true } },
} satisfies Prisma.UserSelect;

type RosterCandidateUser = Prisma.UserGetPayload<{ select: typeof rosterCandidateUserSelect }>;

type Presentation = {
  displayName: string | null;
  photoUrl: string | null;
};

function nonBlank(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function canonicalRosterPresentation(user: RosterCandidateUser, presentation: Presentation | null) {
  const displayName =
    nonBlank(presentation?.displayName) ??
    nonBlank(user.authName) ??
    nonBlank([user.firstName, user.lastName].filter(Boolean).join(' ')) ??
    nonBlank(user.displayAuthUsername) ??
    nonBlank(user.authUsername) ??
    nonBlank(user.username) ??
    'HOOMA player';
  const photoUrl = nonBlank(presentation?.photoUrl) ?? nonBlank(user.photoUrl);
  return { displayName, photoUrl };
}

export class PrismaTeamRosterRepository implements TeamRosterRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listActive(teamId: string) {
    const items = await this.db.teamPlayer.findMany({
      where: { teamId, isActive: true },
      select: rosterPlayerSelect,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return { items };
  }

  async listCandidates(teamId: string) {
    const team = await this.db.team.findFirst({
      where: { id: teamId, status: 'ACTIVE', deletedAt: null },
      select: { communityId: true },
    });
    if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');

    const memberships = await this.db.membership.findMany({
      where: {
        communityId: team.communityId,
        status: 'ACTIVE',
        user: { deletedAt: null },
      },
      select: {
        role: true,
        joinedAt: true,
        user: { select: rosterCandidateUserSelect },
      },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    });
    const userIds = memberships.map((membership) => membership.user.id);
    if (!userIds.length) return { items: [] };

    const [activePlayers, presentations] = await Promise.all([
      this.db.teamPlayer.findMany({
        where: { teamId, isActive: true, userId: { in: userIds } },
        select: { userId: true },
      }),
      this.db.userProfilePresentation.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, displayName: true, photoUrl: true },
      }),
    ]);
    const activeUserIds = new Set(activePlayers.map((player) => player.userId).filter(Boolean));
    const presentationByUserId = new Map(
      presentations.map((presentation) => [presentation.userId, presentation]),
    );

    return {
      items: memberships
        .filter((membership) => !activeUserIds.has(membership.user.id))
        .map((membership) => {
          const presentation = canonicalRosterPresentation(
            membership.user,
            presentationByUserId.get(membership.user.id) ?? null,
          );
          return {
            userId: membership.user.id,
            displayName: presentation.displayName,
            photoUrl: presentation.photoUrl,
            preferredPositions: membership.user.profile?.preferredPositions ?? [],
            communityRole: membership.role,
          };
        }),
    };
  }

  addPlayer(actorUserId: string, teamId: string, input: TeamPlayerCreateInput, requestId: string) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
        const team = await tx.team.findFirst({
          where: { id: teamId, status: 'ACTIVE', deletedAt: null },
          select: { id: true, communityId: true },
        });
        if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');

        let saved;
        let action = 'TEAM_PLAYER_ADDED';
        if (input.userId) {
          const membership = await tx.membership.findFirst({
            where: {
              communityId: team.communityId,
              userId: input.userId,
              status: 'ACTIVE',
              user: { deletedAt: null },
            },
            select: { user: { select: rosterCandidateUserSelect } },
          });
          if (!membership) {
            throw new AppError(
              409,
              'TEAM_PLAYER_MEMBERSHIP_REQUIRED',
              'Only an active member of this HOOMA can be added as a registered Team player.',
            );
          }
          const presentationRow = await tx.userProfilePresentation.findUnique({
            where: { userId: input.userId },
            select: { displayName: true, photoUrl: true },
          });
          const presentation = canonicalRosterPresentation(membership.user, presentationRow);

          const existingRows = await tx.teamPlayer.findMany({
            where: { teamId, userId: input.userId },
            orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
          });
          if (existingRows.some((player) => player.isActive)) {
            throw new AppError(
              409,
              'TEAM_PLAYER_ALREADY_ACTIVE',
              'This HOOMA user is already an active player on the Team.',
            );
          }

          const previous = existingRows[0];
          if (previous) {
            saved = await tx.teamPlayer.update({
              where: { id: previous.id },
              data: {
                isActive: true,
                displayName: presentation.displayName,
                shirtNumber: input.shirtNumber ?? null,
                position: input.position ?? null,
                photoUrl: presentation.photoUrl,
              },
              select: rosterPlayerSelect,
            });
            action = 'TEAM_PLAYER_REACTIVATED';
          } else {
            saved = await tx.teamPlayer.create({
              data: {
                teamId,
                userId: input.userId,
                displayName: presentation.displayName,
                shirtNumber: input.shirtNumber ?? null,
                position: input.position ?? null,
                photoUrl: presentation.photoUrl,
              },
              select: rosterPlayerSelect,
            });
          }
        } else {
          const displayName = input.displayName?.trim();
          if (!displayName) {
            throw new AppError(400, 'TEAM_GUEST_PLAYER_NAME_REQUIRED', 'Guest player name is required.');
          }
          saved = await tx.teamPlayer.create({
            data: {
              teamId,
              userId: null,
              displayName,
              shirtNumber: input.shirtNumber ?? null,
              position: input.position ?? null,
              photoUrl: input.photoUrl || null,
            },
            select: rosterPlayerSelect,
          });
        }

        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId: team.communityId,
            action,
            entityType: 'TeamPlayer',
            entityId: saved.id,
            beforeJson: Prisma.JsonNull,
            afterJson: {
              teamId,
              userId: saved.userId,
              displayName: saved.displayName,
              isActive: saved.isActive,
            },
            requestId,
          },
        });
        return saved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  removePlayer(actorUserId: string, teamId: string, teamPlayerId: string, requestId: string) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
        const team = await tx.team.findFirst({
          where: { id: teamId, status: 'ACTIVE', deletedAt: null },
          select: { id: true, communityId: true },
        });
        if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');

        await tx.$queryRaw`
          SELECT id FROM "TeamPlayer" WHERE id = ${teamPlayerId} AND "teamId" = ${teamId} FOR UPDATE
        `;
        const player = await tx.teamPlayer.findFirst({
          where: { id: teamPlayerId, teamId, isActive: true },
          select: rosterPlayerSelect,
        });
        if (!player) {
          throw new AppError(404, 'TEAM_PLAYER_NOT_FOUND', 'Active Team player not found.');
        }

        const responsibility = player.userId
          ? await tx.teamResponsibility.findUnique({
              where: { teamId_userId: { teamId, userId: player.userId } },
            })
          : null;
        if (responsibility?.revokedAt === null && responsibility.role === 'COACH') {
          throw new AppError(
            409,
            'TEAM_COACH_REMOVE_FORBIDDEN',
            'Transfer Coach responsibility before removing this player.',
          );
        }

        const lineupCleanup = await tx.teamLineupSlot.updateMany({
          where: {
            playerId: player.id,
            lineup: { teamId, isCurrent: true, deletedAt: null },
          },
          data: { playerId: null },
        });

        let revokedAssistantId: string | null = null;
        if (
          responsibility &&
          responsibility.revokedAt === null &&
          responsibility.role === 'ASSISTANT'
        ) {
          const revokedAt = new Date();
          const revoked = await tx.teamResponsibility.update({
            where: { id: responsibility.id },
            data: { revokedAt },
          });
          revokedAssistantId = revoked.id;
          await tx.auditLog.create({
            data: {
              actorUserId,
              communityId: team.communityId,
              action: 'TEAM_ASSISTANT_REVOKED',
              entityType: 'TeamResponsibility',
              entityId: revoked.id,
              beforeJson: {
                role: responsibility.role,
                permissions: responsibility.permissions,
                revokedAt: null,
              },
              afterJson: {
                role: revoked.role,
                permissions: revoked.permissions,
                revokedAt,
                reason: 'TEAM_PLAYER_REMOVED',
              },
              requestId,
            },
          });
        }

        const saved = await tx.teamPlayer.update({
          where: { id: player.id },
          data: { isActive: false },
          select: rosterPlayerSelect,
        });
        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId: team.communityId,
            action: 'TEAM_PLAYER_REMOVED',
            entityType: 'TeamPlayer',
            entityId: saved.id,
            beforeJson: {
              teamId,
              userId: player.userId,
              displayName: player.displayName,
              isActive: true,
            },
            afterJson: {
              teamId,
              userId: saved.userId,
              displayName: saved.displayName,
              isActive: false,
              lineupSlotsCleared: lineupCleanup.count,
              revokedAssistantId,
            },
            requestId,
          },
        });
        return saved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

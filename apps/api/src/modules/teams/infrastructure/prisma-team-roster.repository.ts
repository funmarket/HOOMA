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

  addPlayer(
    actorUserId: string,
    teamId: string,
    input: TeamPlayerCreateInput,
    requestId: string,
  ) {
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
          const users = await tx.$queryRaw<Array<{ id: string }>>`
            SELECT id FROM "User" WHERE id = ${input.userId} AND "deletedAt" IS NULL FOR UPDATE
          `;
          if (!users.length) {
            throw new AppError(
              404,
              'TEAM_PLAYER_USER_NOT_FOUND',
              'HOOMA user not found.',
            );
          }

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
                displayName: input.displayName,
                shirtNumber: input.shirtNumber ?? null,
                position: input.position ?? null,
                photoUrl: input.photoUrl || null,
              },
              select: rosterPlayerSelect,
            });
            action = 'TEAM_PLAYER_REACTIVATED';
          } else {
            saved = await tx.teamPlayer.create({
              data: {
                teamId,
                userId: input.userId,
                displayName: input.displayName,
                shirtNumber: input.shirtNumber ?? null,
                position: input.position ?? null,
                photoUrl: input.photoUrl || null,
              },
              select: rosterPlayerSelect,
            });
          }
        } else {
          saved = await tx.teamPlayer.create({
            data: {
              teamId,
              userId: null,
              displayName: input.displayName,
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

  removePlayer(
    actorUserId: string,
    teamId: string,
    teamPlayerId: string,
    requestId: string,
  ) {
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
          throw new AppError(
            404,
            'TEAM_PLAYER_NOT_FOUND',
            'Active Team player not found.',
          );
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

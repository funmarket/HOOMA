import { Prisma } from '@hooma/database';
import type { TeamAssistantDelegationInput } from '@hooma/contracts';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { TeamAuthorityRepository } from '../application/team-authority.repository.js';
import {
  legacyRoleToTeamResponsibility,
  type LegacyTeamRole,
  type TeamAuthority,
  type TeamDelegatedPermission,
} from '../domain/team-access.js';

function normalizePermissions(
  permissions: readonly TeamDelegatedPermission[],
): TeamDelegatedPermission[] {
  return [...new Set(permissions)].sort();
}

function responsibilityAuthority(input: {
  teamId: string;
  communityId: string;
  role: 'COACH' | 'MANAGER' | 'ASSISTANT';
  permissions: TeamDelegatedPermission[];
}): TeamAuthority {
  return {
    teamId: input.teamId,
    communityId: input.communityId,
    role: input.role,
    permissions: input.permissions,
    source: 'RESPONSIBILITY',
  };
}

function legacyAuthority(input: {
  teamId: string;
  communityId: string;
  role: LegacyTeamRole;
}): TeamAuthority {
  return {
    teamId: input.teamId,
    communityId: input.communityId,
    role: legacyRoleToTeamResponsibility(input.role),
    permissions: [],
    source: 'LEGACY',
  };
}

export class PrismaTeamAuthorityRepository implements TeamAuthorityRepository {
  constructor(private readonly db: DatabaseClient) {}

  async get(userId: string, teamId: string): Promise<TeamAuthority | null> {
    const team = await this.db.team.findFirst({
      where: { id: teamId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!team) return null;

    const responsibility = await this.db.teamResponsibility.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true, permissions: true, revokedAt: true },
    });

    // Any persisted responsibility is authoritative, including a revoked one.
    // Revocation must never fall through and re-grant access from legacy Community roles.
    if (responsibility) {
      if (responsibility.revokedAt) return null;
      if (responsibility.role === 'ASSISTANT') {
        const activePlayer = await this.db.teamPlayer.findFirst({
          where: { teamId, userId, isActive: true },
          select: { id: true },
        });
        if (!activePlayer) return null;
      }
      return responsibilityAuthority({
        teamId,
        communityId: team.communityId,
        role: responsibility.role,
        permissions: responsibility.permissions,
      });
    }

    const membership = await this.db.membership.findUnique({
      where: { communityId_userId: { communityId: team.communityId, userId } },
      select: { role: true, status: true },
    });
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      (membership.role !== 'OWNER' && membership.role !== 'ADMIN')
    ) {
      return null;
    }

    return legacyAuthority({
      teamId,
      communityId: team.communityId,
      role: membership.role,
    });
  }

  async list(userId: string): Promise<TeamAuthority[]> {
    const [responsibilities, legacyTeams, activePlayerRows] = await Promise.all([
      this.db.teamResponsibility.findMany({
        where: { userId },
        select: {
          teamId: true,
          role: true,
          permissions: true,
          revokedAt: true,
        },
      }),
      this.db.team.findMany({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
          community: {
            memberships: {
              some: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
            },
          },
        },
        select: {
          id: true,
          communityId: true,
          community: {
            select: {
              memberships: {
                where: { userId, status: 'ACTIVE', role: { in: ['OWNER', 'ADMIN'] } },
                take: 1,
                select: { role: true },
              },
            },
          },
        },
      }),
      this.db.teamPlayer.findMany({
        where: { userId, isActive: true },
        select: { teamId: true },
      }),
    ]);

    const responsibilityTeamIds = new Set(responsibilities.map((item) => item.teamId));
    const activePlayerTeamIds = new Set(activePlayerRows.map((item) => item.teamId));
    const responsibilityTeamRows = responsibilityTeamIds.size
      ? await this.db.team.findMany({
          where: {
            id: { in: [...responsibilityTeamIds] },
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: { id: true, communityId: true },
        })
      : [];
    const activeTeams = new Map(
      responsibilityTeamRows.map((team) => [team.id, team.communityId] as const),
    );

    const authorities: TeamAuthority[] = [];
    for (const responsibility of responsibilities) {
      const communityId = activeTeams.get(responsibility.teamId);
      if (!communityId || responsibility.revokedAt) continue;
      if (
        responsibility.role === 'ASSISTANT' &&
        !activePlayerTeamIds.has(responsibility.teamId)
      ) {
        continue;
      }
      authorities.push(
        responsibilityAuthority({
          teamId: responsibility.teamId,
          communityId,
          role: responsibility.role,
          permissions: responsibility.permissions,
        }),
      );
    }

    for (const team of legacyTeams) {
      // A persisted row, even revoked, suppresses compatibility fallback.
      if (responsibilityTeamIds.has(team.id)) continue;
      const role = team.community.memberships[0]?.role;
      if (role !== 'OWNER' && role !== 'ADMIN') continue;
      authorities.push(legacyAuthority({ teamId: team.id, communityId: team.communityId, role }));
    }

    return authorities;
  }

  async listAssistants(teamId: string) {
    const assignments = await this.db.teamResponsibility.findMany({
      where: { teamId, role: 'ASSISTANT', revokedAt: null },
      select: {
        id: true,
        userId: true,
        role: true,
        permissions: true,
        appointedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    if (!assignments.length) return { items: [] };

    const players = await this.db.teamPlayer.findMany({
      where: {
        teamId,
        isActive: true,
        userId: { in: assignments.map((assignment) => assignment.userId) },
      },
      select: {
        id: true,
        userId: true,
        displayName: true,
        shirtNumber: true,
        position: true,
        photoUrl: true,
      },
    });
    const playersByUserId = new Map(
      players.flatMap((player) => (player.userId ? [[player.userId, player] as const] : [])),
    );

    return {
      items: assignments.flatMap((assignment) => {
        const player = playersByUserId.get(assignment.userId);
        return player ? [{ ...assignment, player }] : [];
      }),
    };
  }

  appointAssistant(
    actorUserId: string,
    teamId: string,
    input: TeamAssistantDelegationInput,
    requestId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const team = await this.requireCoachInTransaction(tx, actorUserId, teamId);
        const player = await tx.teamPlayer.findFirst({
          where: { id: input.teamPlayerId, teamId, isActive: true },
          select: { id: true, userId: true, displayName: true },
        });
        if (!player || !player.userId) {
          throw new AppError(
            409,
            'TEAM_ASSISTANT_PLAYER_REQUIRED',
            'Assistant must be an active Team player linked to a HOOMA user.',
          );
        }
        if (player.userId === actorUserId) {
          throw new AppError(
            409,
            'TEAM_ASSISTANT_SELF_FORBIDDEN',
            'Coach cannot appoint themselves as Assistant.',
          );
        }

        const permissions = normalizePermissions(input.permissions);
        const existing = await tx.teamResponsibility.findUnique({
          where: { teamId_userId: { teamId, userId: player.userId } },
        });
        if (existing && existing.role !== 'ASSISTANT') {
          throw new AppError(
            409,
            'TEAM_RESPONSIBILITY_CONFLICT',
            'This user already has a different Team responsibility.',
          );
        }

        if (
          existing &&
          existing.revokedAt === null &&
          normalizePermissions(existing.permissions).join('|') === permissions.join('|')
        ) {
          return existing;
        }

        const saved = existing
          ? await tx.teamResponsibility.update({
              where: { id: existing.id },
              data: {
                permissions,
                appointedByUserId: actorUserId,
                revokedAt: null,
              },
            })
          : await tx.teamResponsibility.create({
              data: {
                teamId,
                userId: player.userId,
                role: 'ASSISTANT',
                permissions,
                appointedByUserId: actorUserId,
              },
            });

        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId: team.communityId,
            action: existing ? 'TEAM_ASSISTANT_UPDATED' : 'TEAM_ASSISTANT_APPOINTED',
            entityType: 'TeamResponsibility',
            entityId: saved.id,
            beforeJson: existing
              ? {
                  role: existing.role,
                  permissions: existing.permissions,
                  revokedAt: existing.revokedAt,
                }
              : Prisma.JsonNull,
            afterJson: {
              role: saved.role,
              permissions: saved.permissions,
              revokedAt: saved.revokedAt,
              teamPlayerId: player.id,
            },
            requestId,
          },
        });
        return saved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  revokeAssistant(
    actorUserId: string,
    teamId: string,
    responsibilityId: string,
    requestId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        const team = await this.requireCoachInTransaction(tx, actorUserId, teamId);
        const existing = await tx.teamResponsibility.findFirst({
          where: { id: responsibilityId, teamId, role: 'ASSISTANT' },
        });
        if (!existing) {
          throw new AppError(404, 'TEAM_ASSISTANT_NOT_FOUND', 'Assistant assignment not found.');
        }
        if (existing.revokedAt) return existing;

        const revokedAt = new Date();
        const saved = await tx.teamResponsibility.update({
          where: { id: existing.id },
          data: { revokedAt },
        });
        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId: team.communityId,
            action: 'TEAM_ASSISTANT_REVOKED',
            entityType: 'TeamResponsibility',
            entityId: saved.id,
            beforeJson: {
              role: existing.role,
              permissions: existing.permissions,
              revokedAt: null,
            },
            afterJson: {
              role: saved.role,
              permissions: saved.permissions,
              revokedAt,
            },
            requestId,
          },
        });
        return saved;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async requireCoachInTransaction(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    teamId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${teamId} FOR UPDATE`;
    const team = await tx.team.findFirst({
      where: { id: teamId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, communityId: true },
    });
    if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');

    const responsibility = await tx.teamResponsibility.findUnique({
      where: { teamId_userId: { teamId, userId: actorUserId } },
      select: { role: true, revokedAt: true },
    });
    if (responsibility) {
      if (responsibility.revokedAt === null && responsibility.role === 'COACH') return team;
      throw new AppError(403, 'TEAM_COACH_REQUIRED', 'Coach access required for this Team.');
    }

    const membership = await tx.membership.findUnique({
      where: { communityId_userId: { communityId: team.communityId, userId: actorUserId } },
      select: { role: true, status: true },
    });
    if (!membership || membership.status !== 'ACTIVE' || membership.role !== 'OWNER') {
      throw new AppError(403, 'TEAM_COACH_REQUIRED', 'Coach access required for this Team.');
    }
    return team;
  }
}

import { Prisma } from '@hooma/database';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { CommunityRepository } from '../application/community-repository.js';
import { loadHoomaNow } from './hooma-now-read-model.js';

export class PrismaCommunityRepository implements CommunityRepository {
  constructor(private readonly db: DatabaseClient) {}

  async listForUser(userId: string) {
    const memberships = await this.db.membership.findMany({
      where: { userId, status: 'ACTIVE', community: { deletedAt: null } },
      include: {
        community: { include: { paymentDefaults: { orderBy: { sortOrder: 'asc' } } } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    const preference = await this.db.userPreference.findUnique({ where: { userId } });
    return {
      activeCommunityId: preference?.activeCommunityId ?? memberships[0]?.communityId ?? null,
      communities: memberships.map((membership) => ({
        ...membership.community,
        role: membership.role,
      })),
    };
  }

  hoomaNow(userId: string) {
    return loadHoomaNow(this.db, userId);
  }

  async createWithOwner(
    userId: string,
    input: {
      name: string;
      slug: string;
      description?: string;
      city?: string;
      visibility: 'PUBLIC' | 'PRIVATE';
    },
  ) {
    return this.db.$transaction(
      async (tx) => {
        const created = await tx.community.create({
          data: {
            name: input.name,
            slug: input.slug,
            description: input.description || null,
            city: input.city || null,
            visibility: input.visibility,
            createdByUserId: userId,
          },
        });
        await tx.membership.create({
          data: { communityId: created.id, userId, role: 'OWNER' },
        });
        await tx.communityPaymentDefault.create({
          data: { communityId: created.id, method: 'CASH', enabled: true, sortOrder: 0 },
        });
        await tx.userPreference.upsert({
          where: { userId },
          create: { userId, activeCommunityId: created.id },
          update: { activeCommunityId: created.id },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async joinPublic(userId: string, slug: string) {
    const community = await this.db.community.findFirst({ where: { slug, deletedAt: null } });
    if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    if (community.visibility !== 'PUBLIC') {
      throw new AppError(403, 'COMMUNITY_INVITE_REQUIRED', 'This community requires an invite');
    }
    return this.db.$transaction(async (tx) => {
      const existing = await tx.membership.findUnique({
        where: { communityId_userId: { communityId: community.id, userId } },
      });
      if (existing?.status === 'BANNED') {
        throw new AppError(403, 'COMMUNITY_BANNED', 'You cannot rejoin this community.');
      }
      const membership = await tx.membership.upsert({
        where: { communityId_userId: { communityId: community.id, userId } },
        create: { communityId: community.id, userId, role: 'MEMBER', status: 'ACTIVE' },
        update: { status: 'ACTIVE', leftAt: null },
        include: { community: true },
      });
      await tx.userPreference.upsert({
        where: { userId },
        create: { userId, activeCommunityId: community.id },
        update: { activeCommunityId: community.id },
      });
      return membership;
    });
  }

  async consumeInvite(userId: string, codeHash: string) {
    return this.db.$transaction(
      async (tx) => {
        const inviteCandidate = await tx.communityInvite.findUnique({ where: { codeHash } });
        if (!inviteCandidate) {
          throw new AppError(404, 'INVITE_NOT_FOUND', 'Invite is invalid or expired.');
        }
        await tx.$queryRaw`SELECT id FROM "CommunityInvite" WHERE id = ${inviteCandidate.id} FOR UPDATE`;
        const invite = await tx.communityInvite.findUniqueOrThrow({
          where: { id: inviteCandidate.id },
        });
        const now = new Date();
        if (invite.revokedAt || (invite.expiresAt && invite.expiresAt <= now)) {
          throw new AppError(410, 'INVITE_EXPIRED', 'Invite is no longer active.');
        }
        if (invite.maxUses != null && invite.useCount >= invite.maxUses) {
          throw new AppError(410, 'INVITE_EXHAUSTED', 'Invite has reached its maximum uses.');
        }
        const community = await tx.community.findFirst({
          where: { id: invite.communityId, deletedAt: null },
        });
        if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found.');

        const existing = await tx.membership.findUnique({
          where: { communityId_userId: { communityId: invite.communityId, userId } },
        });
        if (existing?.status === 'BANNED') {
          throw new AppError(403, 'COMMUNITY_BANNED', 'You cannot rejoin this community.');
        }

        const membership = await tx.membership.upsert({
          where: { communityId_userId: { communityId: invite.communityId, userId } },
          create: {
            communityId: invite.communityId,
            userId,
            role: invite.role,
            status: 'ACTIVE',
          },
          update: { status: 'ACTIVE', leftAt: null, role: invite.role },
          include: { community: true },
        });
        await tx.communityInvite.update({
          where: { id: invite.id },
          data: { useCount: { increment: 1 } },
        });
        await tx.userPreference.upsert({
          where: { userId },
          create: { userId, activeCommunityId: invite.communityId },
          update: { activeCommunityId: invite.communityId },
        });
        return membership;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async createInvite(input: {
    communityId: string;
    createdByUserId: string;
    codeHash: string;
    codePrefix: string;
    role: 'MEMBER' | 'ADMIN';
    maxUses?: number | null;
    expiresAt?: Date | null;
    requestId: string;
  }) {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.communityInvite.create({
        data: {
          communityId: input.communityId,
          createdByUserId: input.createdByUserId,
          codeHash: input.codeHash,
          codePrefix: input.codePrefix,
          role: input.role,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt ?? null,
        },
        select: {
          id: true,
          codePrefix: true,
          role: true,
          maxUses: true,
          useCount: true,
          expiresAt: true,
          createdAt: true,
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: input.createdByUserId,
          communityId: input.communityId,
          action: 'COMMUNITY_INVITE_CREATED',
          entityType: 'CommunityInvite',
          entityId: invite.id,
          afterJson: { role: input.role, maxUses: input.maxUses ?? null },
          requestId: input.requestId,
        },
      });
      return invite;
    });
  }

  listInvites(communityId: string) {
    return this.db.communityInvite.findMany({
      where: { communityId },
      select: {
        id: true,
        codePrefix: true,
        role: true,
        maxUses: true,
        useCount: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async revokeInvite(
    communityId: string,
    inviteId: string,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const invite = await tx.communityInvite.findFirst({ where: { id: inviteId, communityId } });
      if (!invite) throw new AppError(404, 'INVITE_NOT_FOUND', 'Invite not found.');
      if (invite.revokedAt) return invite;
      const updated = await tx.communityInvite.update({
        where: { id: invite.id },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          communityId,
          action: 'COMMUNITY_INVITE_REVOKED',
          entityType: 'CommunityInvite',
          entityId: invite.id,
          requestId,
        },
      });
      return updated;
    });
  }

  getMembership(userId: string, communityId: string) {
    return this.db.membership.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: { id: true, role: true, status: true },
    });
  }

  switchActive(userId: string, communityId: string) {
    return this.db.userPreference.upsert({
      where: { userId },
      create: { userId, activeCommunityId: communityId },
      update: { activeCommunityId: communityId },
    });
  }

  getCommunity(_userId: string, communityId: string) {
    return this.db.community.findFirst({
      where: { id: communityId, deletedAt: null },
      include: {
        paymentDefaults: { orderBy: { sortOrder: 'asc' } },
        _count: {
          select: {
            memberships: { where: { status: 'ACTIVE' } },
            events: { where: { deletedAt: null } },
            requests: { where: { deletedAt: null } },
            rideOffers: { where: { deletedAt: null } },
            fundraisers: { where: { deletedAt: null } },
          },
        },
      },
    });
  }

  getPaymentDefaults(communityId: string) {
    return this.db.communityPaymentDefault.findMany({
      where: { communityId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async setCashDefault(communityId: string, enabled: boolean) {
    return [
      await this.db.communityPaymentDefault.upsert({
        where: { communityId_method: { communityId, method: 'CASH' } },
        create: { communityId, method: 'CASH', enabled, sortOrder: 0 },
        update: { enabled, sortOrder: 0 },
      }),
    ];
  }

  listMembers(communityId: string) {
    return this.db.membership.findMany({
      where: { communityId, status: 'ACTIVE' },
      include: { user: { include: { profile: true } } },
      orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    });
  }

  async setMemberRolePreservingOwner(
    communityId: string,
    membershipId: string,
    role: 'ADMIN' | 'MEMBER',
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Community" WHERE id = ${communityId} FOR UPDATE`;
        const actor = await tx.membership.findUnique({
          where: { communityId_userId: { communityId, userId: actorUserId } },
        });
        if (!actor || actor.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(actor.role)) {
          throw new AppError(403, 'ADMIN_REQUIRED', 'Community admin access required.');
        }
        const target = await tx.membership.findFirst({ where: { id: membershipId, communityId } });
        if (!target) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Membership not found');
        if (target.role === 'OWNER') {
          throw new AppError(
            409,
            'OWNER_ROLE_PROTECTED',
            'Transfer ownership before changing the owner role',
          );
        }
        if (target.status !== 'ACTIVE') {
          throw new AppError(
            409,
            'MEMBERSHIP_INACTIVE',
            'Only active members can have roles changed.',
          );
        }
        if (target.role === role) return target;
        const updated = await tx.membership.update({ where: { id: membershipId }, data: { role } });
        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId,
            action: role === 'ADMIN' ? 'ADMIN_PROMOTED' : 'ADMIN_REMOVED',
            entityType: 'Membership',
            entityId: membershipId,
            beforeJson: { role: target.role, status: target.status },
            afterJson: { role, status: target.status },
            requestId,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async transferOwnership(
    communityId: string,
    actorUserId: string,
    targetMembershipId: string,
    requestId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Community" WHERE id = ${communityId} FOR UPDATE`;
        const actor = await tx.membership.findUnique({
          where: { communityId_userId: { communityId, userId: actorUserId } },
        });
        if (!actor || actor.status !== 'ACTIVE' || actor.role !== 'OWNER') {
          throw new AppError(403, 'OWNER_REQUIRED', 'Only an active owner can transfer ownership.');
        }

        const target = await tx.membership.findFirst({
          where: { id: targetMembershipId, communityId, status: 'ACTIVE' },
        });
        if (!target) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Target member not found.');
        if (target.userId === actorUserId) {
          throw new AppError(
            409,
            'OWNERSHIP_TRANSFER_INVALID',
            'Choose a different active member.',
          );
        }

        await tx.membership.update({
          where: { id: target.id },
          data: { role: 'OWNER' },
        });
        await tx.membership.update({
          where: { id: actor.id },
          data: { role: 'ADMIN' },
        });
        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId,
            action: 'COMMUNITY_OWNERSHIP_TRANSFERRED',
            entityType: 'Membership',
            entityId: target.id,
            beforeJson: { previousOwnerMembershipId: actor.id, targetRole: target.role },
            afterJson: { newOwnerMembershipId: target.id, previousOwnerRole: 'ADMIN' },
            requestId,
          },
        });

        return tx.membership.findUniqueOrThrow({
          where: { id: target.id },
          include: { user: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async banMember(
    communityId: string,
    membershipId: string,
    actorUserId: string,
    requestId: string,
  ) {
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Community" WHERE id = ${communityId} FOR UPDATE`;
        const actor = await tx.membership.findUnique({
          where: { communityId_userId: { communityId, userId: actorUserId } },
        });
        if (!actor || actor.status !== 'ACTIVE' || !['OWNER', 'ADMIN'].includes(actor.role)) {
          throw new AppError(403, 'ADMIN_REQUIRED', 'Community admin access required.');
        }
        const target = await tx.membership.findFirst({ where: { id: membershipId, communityId } });
        if (!target) throw new AppError(404, 'MEMBERSHIP_NOT_FOUND', 'Membership not found');
        if (target.role === 'OWNER') {
          throw new AppError(
            409,
            'OWNER_ROLE_PROTECTED',
            'The owner cannot be banned without transferring ownership',
          );
        }
        if (target.role === 'ADMIN' && actor.role !== 'OWNER') {
          throw new AppError(403, 'OWNER_REQUIRED', 'Only an owner can ban an admin.');
        }
        if (target.userId === actorUserId) {
          throw new AppError(409, 'SELF_BAN_FORBIDDEN', 'You cannot ban your own membership.');
        }
        const updated = await tx.membership.update({
          where: { id: membershipId },
          data: { status: 'BANNED', leftAt: new Date() },
        });
        await tx.auditLog.create({
          data: {
            actorUserId,
            communityId,
            action: 'MEMBER_BANNED',
            entityType: 'Membership',
            entityId: membershipId,
            beforeJson: { status: target.status, role: target.role },
            afterJson: { status: 'BANNED', role: target.role },
            requestId,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}

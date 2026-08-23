import type { CommunityCreateInput } from '@hooma/contracts';
import { createHash, randomBytes } from 'node:crypto';
import type { TransactionHandle } from '../../../application/unit-of-work.js';
import { AppError } from '../../../http/errors/app-error.js';
import type { CommunityRepository } from './community-repository.js';
import type { MembershipAccessRepository } from './membership-access.repository.js';

function hashInvite(code: string) {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

export class CommunityService {
  constructor(
    private readonly repo: CommunityRepository,
    private readonly access: MembershipAccessRepository,
  ) {}

  async requireMembership(userId: string, communityId: string, tx?: TransactionHandle) {
    const membership = await this.access.get(userId, communityId, tx);
    if (!membership || membership.status !== 'ACTIVE') {
      throw new AppError(403, 'COMMUNITY_ACCESS_DENIED', 'Not an active member of this community');
    }
    return membership;
  }

  async requireAdmin(userId: string, communityId: string, tx?: TransactionHandle) {
    const membership = await this.requireMembership(userId, communityId, tx);
    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AppError(403, 'ADMIN_REQUIRED', 'Community admin access required');
    }
    return membership;
  }

  list(userId: string) {
    return this.repo.listForUser(userId);
  }

  now(userId: string) {
    return this.repo.hoomaNow(userId);
  }

  create(userId: string, input: CommunityCreateInput) {
    return this.repo.createWithOwner(userId, {
      name: input.name,
      slug: input.slug,
      visibility: input.visibility,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
    });
  }

  join(userId: string, slug: string) {
    return this.repo.joinPublic(userId, slug);
  }

  joinWithInvite(userId: string, code: string) {
    return this.repo.consumeInvite(userId, hashInvite(code));
  }

  async createInvite(
    userId: string,
    communityId: string,
    input: {
      role: 'MEMBER' | 'ADMIN';
      maxUses?: number | null | undefined;
      expiresAt?: Date | null | undefined;
    },
    requestId: string,
  ) {
    const actor = await this.requireAdmin(userId, communityId);
    if (input.role === 'ADMIN' && actor.role !== 'OWNER') {
      throw new AppError(403, 'OWNER_REQUIRED', 'Only the owner can create admin invites.');
    }
    const code = randomBytes(24).toString('base64url');
    const invite = await this.repo.createInvite({
      communityId,
      createdByUserId: userId,
      codeHash: hashInvite(code),
      codePrefix: code.slice(0, 8),
      role: input.role,
      ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}),
      requestId,
    });
    return { invite, code };
  }

  async invites(userId: string, communityId: string) {
    await this.requireAdmin(userId, communityId);
    return this.repo.listInvites(communityId);
  }

  async revokeInvite(userId: string, communityId: string, inviteId: string, requestId: string) {
    await this.requireAdmin(userId, communityId);
    return this.repo.revokeInvite(communityId, inviteId, userId, requestId);
  }

  async switchActive(userId: string, communityId: string) {
    await this.requireMembership(userId, communityId);
    return this.repo.switchActive(userId, communityId);
  }

  async get(userId: string, communityId: string) {
    const membership = await this.requireMembership(userId, communityId);
    const community = await this.repo.getCommunity(userId, communityId);
    if (!community) throw new AppError(404, 'COMMUNITY_NOT_FOUND', 'Community not found');
    return { community, role: membership.role };
  }

  async paymentDefaults(userId: string, communityId: string) {
    await this.requireMembership(userId, communityId);
    return this.repo.getPaymentDefaults(communityId);
  }

  async setCashDefault(userId: string, communityId: string, enabled: boolean) {
    await this.requireAdmin(userId, communityId);
    return this.repo.setCashDefault(communityId, enabled);
  }

  async members(userId: string, communityId: string) {
    await this.requireMembership(userId, communityId);
    return this.repo.listMembers(communityId);
  }

  async setRole(
    userId: string,
    communityId: string,
    membershipId: string,
    role: 'ADMIN' | 'MEMBER',
    requestId: string,
  ) {
    const actor = await this.requireAdmin(userId, communityId);
    if (actor.role !== 'OWNER') {
      throw new AppError(403, 'OWNER_REQUIRED', 'Only an owner can change admin roles.');
    }
    return this.repo.setMemberRolePreservingOwner(
      communityId,
      membershipId,
      role,
      userId,
      requestId,
    );
  }

  async transferOwnership(
    userId: string,
    communityId: string,
    targetMembershipId: string,
    requestId: string,
  ) {
    const actor = await this.requireAdmin(userId, communityId);
    if (actor.role !== 'OWNER') {
      throw new AppError(403, 'OWNER_REQUIRED', 'Only an owner can transfer ownership.');
    }
    return this.repo.transferOwnership(communityId, userId, targetMembershipId, requestId);
  }

  async ban(userId: string, communityId: string, membershipId: string, requestId: string) {
    await this.requireAdmin(userId, communityId);
    return this.repo.banMember(communityId, membershipId, userId, requestId);
  }
}

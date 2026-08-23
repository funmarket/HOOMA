export interface CommunityRepository {
  listForUser(userId: string): Promise<unknown>;
  hoomaNow(userId: string): Promise<unknown>;
  createWithOwner(
    userId: string,
    input: {
      name: string;
      slug: string;
      description?: string;
      city?: string;
      visibility: 'PUBLIC' | 'PRIVATE';
    },
  ): Promise<unknown>;
  joinPublic(userId: string, slug: string): Promise<unknown>;
  consumeInvite(userId: string, codeHash: string): Promise<unknown>;
  createInvite(input: {
    communityId: string;
    createdByUserId: string;
    codeHash: string;
    codePrefix: string;
    role: 'MEMBER' | 'ADMIN';
    maxUses?: number | null;
    expiresAt?: Date | null;
    requestId: string;
  }): Promise<unknown>;
  listInvites(communityId: string): Promise<unknown>;
  revokeInvite(
    communityId: string,
    inviteId: string,
    actorUserId: string,
    requestId: string,
  ): Promise<unknown>;
  getMembership(
    userId: string,
    communityId: string,
  ): Promise<{
    id: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    status: 'ACTIVE' | 'BANNED' | 'LEFT';
  } | null>;
  switchActive(userId: string, communityId: string): Promise<unknown>;
  getCommunity(userId: string, communityId: string): Promise<unknown>;
  getPaymentDefaults(communityId: string): Promise<unknown>;
  setCashDefault(communityId: string, enabled: boolean): Promise<unknown>;
  listMembers(communityId: string): Promise<unknown>;
  setMemberRolePreservingOwner(
    communityId: string,
    membershipId: string,
    role: 'ADMIN' | 'MEMBER',
    actorUserId: string,
    requestId: string,
  ): Promise<unknown>;
  transferOwnership(
    communityId: string,
    actorUserId: string,
    targetMembershipId: string,
    requestId: string,
  ): Promise<unknown>;
  banMember(
    communityId: string,
    membershipId: string,
    actorUserId: string,
    requestId: string,
  ): Promise<unknown>;
}

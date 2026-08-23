import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDatabase } from '../apps/api/src/infrastructure/database/prisma.js';
import {
  legacyTeamRoleHasCapability,
  teamAuthorityHasCapability,
  type LegacyTeamRole,
  type TeamAuthority,
  type TeamCapability,
} from '../apps/api/src/modules/teams/domain/team-access.ts';
import { PrismaTeamAuthorityRepository } from '../apps/api/src/modules/teams/infrastructure/prisma-team-authority.repository.ts';

const capabilities: TeamCapability[] = [
  'CREATE_TEAM',
  'EDIT_TEAM',
  'MANAGE_ROSTER',
  'MANAGE_LINEUP',
  'CREATE_CHALLENGE',
  'RESPOND_CHALLENGE',
  'MESSAGE_CHALLENGE',
];

const teamManagementCapabilities = capabilities.filter(
  (capability) => capability !== 'CREATE_TEAM',
);

test('legacy Team managers retain current capabilities during migration', () => {
  for (const role of ['OWNER', 'ADMIN'] satisfies LegacyTeamRole[]) {
    for (const capability of capabilities) {
      assert.equal(legacyTeamRoleHasCapability(role, capability), true);
    }
  }
});

test('Coach and Manager retain full existing Team management capabilities', () => {
  for (const role of ['COACH', 'MANAGER'] as const) {
    const authority: TeamAuthority = {
      teamId: 'team-1',
      communityId: 'community-1',
      role,
      permissions: [],
      source: 'RESPONSIBILITY',
    };
    for (const capability of teamManagementCapabilities) {
      assert.equal(teamAuthorityHasCapability(authority, capability), true);
    }
    assert.equal(teamAuthorityHasCapability(authority, 'CREATE_TEAM'), false);
  }
});

test('Assistant receives only explicitly delegated Team capabilities', () => {
  const authority: TeamAuthority = {
    teamId: 'team-1',
    communityId: 'community-1',
    role: 'ASSISTANT',
    permissions: ['MANAGE_LINEUP', 'RESPOND_CHALLENGE'],
    source: 'RESPONSIBILITY',
  };

  assert.equal(teamAuthorityHasCapability(authority, 'MANAGE_LINEUP'), true);
  assert.equal(teamAuthorityHasCapability(authority, 'RESPOND_CHALLENGE'), true);
  assert.equal(teamAuthorityHasCapability(authority, 'EDIT_TEAM'), false);
  assert.equal(teamAuthorityHasCapability(authority, 'MANAGE_ROSTER'), false);
  assert.equal(teamAuthorityHasCapability(authority, 'CREATE_CHALLENGE'), false);
  assert.equal(teamAuthorityHasCapability(authority, 'MESSAGE_CHALLENGE'), false);
  assert.equal(teamAuthorityHasCapability(authority, 'CREATE_TEAM'), false);
});

test('Assistant authority is Team-scoped', () => {
  const authority: TeamAuthority = {
    teamId: 'team-a',
    communityId: 'community-a',
    role: 'ASSISTANT',
    permissions: ['EDIT_TEAM'],
    source: 'RESPONSIBILITY',
  };

  assert.equal(authority.teamId, 'team-a');
  assert.notEqual(authority.teamId, 'team-b');
  assert.equal(teamAuthorityHasCapability(authority, 'EDIT_TEAM'), true);
});

test('real Assistant lifecycle requires an active linked Team player and revocation suppresses legacy fallback', async () => {
  const db = buildDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const coachUserId = `coach_${suffix}`;
  const assistantUserId = `assistant_${suffix}`;
  const communityId = `community_${suffix}`;
  const teamId = `team_${suffix}`;
  const playerId = `player_${suffix}`;
  const requestId = `request_${suffix}`;

  await db.user.createMany({
    data: [{ id: coachUserId }, { id: assistantUserId }],
  });
  await db.community.create({
    data: {
      id: communityId,
      slug: `team-auth-${suffix}`.slice(0, 48),
      name: 'Team authority test',
      createdByUserId: coachUserId,
      memberships: {
        create: [
          { userId: coachUserId, role: 'OWNER', status: 'ACTIVE' },
          { userId: assistantUserId, role: 'MEMBER', status: 'ACTIVE' },
        ],
      },
      team: {
        create: {
          id: teamId,
          createdByUserId: coachUserId,
          name: 'Authority FC',
          players: {
            create: {
              id: playerId,
              userId: assistantUserId,
              displayName: 'Assistant Player',
              isActive: true,
            },
          },
        },
      },
    },
  });

  const repository = new PrismaTeamAuthorityRepository(db);
  const coach = await repository.get(coachUserId, teamId);
  assert.equal(coach?.role, 'COACH');
  assert.equal(coach?.source, 'LEGACY');

  const appointed = (await repository.appointAssistant(
    coachUserId,
    teamId,
    { teamPlayerId: playerId, permissions: ['MANAGE_LINEUP', 'RESPOND_CHALLENGE'] },
    requestId,
  )) as { id: string };

  const activeAssistant = await repository.get(assistantUserId, teamId);
  assert.equal(activeAssistant?.role, 'ASSISTANT');
  assert.deepEqual(activeAssistant?.permissions, ['MANAGE_LINEUP', 'RESPOND_CHALLENGE']);
  assert.equal(teamAuthorityHasCapability(activeAssistant!, 'MANAGE_LINEUP'), true);
  assert.equal(teamAuthorityHasCapability(activeAssistant!, 'EDIT_TEAM'), false);

  await db.teamPlayer.update({ where: { id: playerId }, data: { isActive: false } });
  assert.equal(await repository.get(assistantUserId, teamId), null);

  await db.teamPlayer.update({ where: { id: playerId }, data: { isActive: true } });
  assert.equal((await repository.get(assistantUserId, teamId))?.role, 'ASSISTANT');

  await db.membership.update({
    where: { communityId_userId: { communityId, userId: assistantUserId } },
    data: { role: 'ADMIN' },
  });
  await repository.revokeAssistant(coachUserId, teamId, appointed.id, `${requestId}_revoke`);

  assert.equal(
    await repository.get(assistantUserId, teamId),
    null,
    'revoked persisted responsibility must suppress legacy ADMIN fallback',
  );

  const auditActions = await db.auditLog.findMany({
    where: { entityId: appointed.id },
    select: { action: true },
    orderBy: { createdAt: 'asc' },
  });
  assert.deepEqual(
    auditActions.map((entry) => entry.action),
    ['TEAM_ASSISTANT_APPOINTED', 'TEAM_ASSISTANT_REVOKED'],
  );

  await db.community.delete({ where: { id: communityId } });
  await db.user.deleteMany({ where: { id: { in: [coachUserId, assistantUserId] } } });
});

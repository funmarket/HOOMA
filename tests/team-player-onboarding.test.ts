import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDatabase } from '../apps/api/src/infrastructure/database/prisma.js';
import type { TeamRepository } from '../apps/api/src/modules/teams/application/team-repository.js';
import { TeamService } from '../apps/api/src/modules/teams/application/team.service.js';
import { PrismaTeamAuthorityRepository } from '../apps/api/src/modules/teams/infrastructure/prisma-team-authority.repository.ts';
import { PrismaTeamRosterRepository } from '../apps/api/src/modules/teams/infrastructure/prisma-team-roster.repository.ts';

test('Coach rosters a joined HOOMA user with canonical profile presentation', async () => {
  const db = buildDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const coachUserId = `onboard_coach_${suffix}`;
  const playerUserId = `onboard_player_${suffix}`;
  const outsiderUserId = `onboard_outsider_${suffix}`;
  const communityId = `onboard_community_${suffix}`;
  const teamId = `onboard_team_${suffix}`;
  const requestId = `onboard_request_${suffix}`;

  await db.user.createMany({
    data: [
      { id: coachUserId, firstName: 'Coach' },
      { id: playerUserId, firstName: 'Raw', lastName: 'Player' },
      { id: outsiderUserId, firstName: 'Outsider' },
    ],
  });
  await db.userProfilePresentation.create({
    data: {
      userId: playerUserId,
      displayName: 'Le Coin Midfielder',
      photoUrl: 'https://example.com/player.jpg',
    },
  });
  await db.playerProfile.create({
    data: { userId: playerUserId, preferredPositions: ['CM', 'AM'] },
  });
  await db.community.create({
    data: {
      id: communityId,
      slug: `onboard-${suffix}`.slice(0, 48),
      name: 'Player onboarding test',
      createdByUserId: coachUserId,
      memberships: {
        create: [
          { userId: coachUserId, role: 'OWNER', status: 'ACTIVE' },
          { userId: playerUserId, role: 'MEMBER', status: 'ACTIVE' },
        ],
      },
      team: {
        create: {
          id: teamId,
          createdByUserId: coachUserId,
          name: 'Le Coin Test',
        },
      },
    },
  });

  const authority = new PrismaTeamAuthorityRepository(db);
  const roster = new PrismaTeamRosterRepository(db);
  const service = new TeamService({} as TeamRepository, authority, roster);

  const before = (await service.rosterCandidates(coachUserId, teamId)) as {
    items: Array<{
      userId: string;
      displayName: string;
      photoUrl: string | null;
      preferredPositions: string[];
    }>;
  };
  const playerCandidate = before.items.find((candidate) => candidate.userId === playerUserId);
  assert.ok(playerCandidate);
  assert.equal(playerCandidate.displayName, 'Le Coin Midfielder');
  assert.equal(playerCandidate.photoUrl, 'https://example.com/player.jpg');
  assert.deepEqual(playerCandidate.preferredPositions, ['CM', 'AM']);

  await assert.rejects(
    () =>
      service.addPlayer(
        coachUserId,
        teamId,
        { userId: outsiderUserId, displayName: 'Outsider' },
        `${requestId}_bad`,
      ),
    /active member of this HOOMA/i,
  );

  const added = (await service.addPlayer(
    coachUserId,
    teamId,
    { userId: playerUserId, displayName: 'Client supplied wrong name' },
    requestId,
  )) as {
    id: string;
    userId: string | null;
    displayName: string;
    photoUrl: string | null;
    isActive: boolean;
  };
  assert.equal(added.userId, playerUserId);
  assert.equal(added.displayName, 'Le Coin Midfielder');
  assert.equal(added.photoUrl, 'https://example.com/player.jpg');
  assert.equal(added.isActive, true);

  const after = (await service.rosterCandidates(coachUserId, teamId)) as {
    items: Array<{ userId: string }>;
  };
  assert.equal(
    after.items.some((candidate) => candidate.userId === playerUserId),
    false,
  );

  const stored = await db.teamPlayer.findFirst({ where: { teamId, userId: playerUserId } });
  assert.equal(stored?.displayName, 'Le Coin Midfielder');
  assert.equal(stored?.photoUrl, 'https://example.com/player.jpg');

  await db.community.delete({ where: { id: communityId } });
  await db.user.deleteMany({ where: { id: { in: [coachUserId, playerUserId, outsiderUserId] } } });
});

test('roster request contract stays backward compatible for linked and guest players', async () => {
  const { teamPlayerCreateSchema } = await import('@hooma/contracts');

  assert.deepEqual(
    teamPlayerCreateSchema.parse({ userId: 'canonical-user', displayName: 'Canonical player' }),
    { userId: 'canonical-user', displayName: 'Canonical player' },
  );
  assert.throws(() => teamPlayerCreateSchema.parse({ userId: 'canonical-user' }));
  assert.deepEqual(teamPlayerCreateSchema.parse({ displayName: 'Guest striker' }), {
    displayName: 'Guest striker',
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { teamUpdateSchema } from '@hooma/contracts';
import type { DatabaseClient } from '../apps/api/src/infrastructure/database/prisma.js';
import type { TeamAuthorityRepository } from '../apps/api/src/modules/teams/application/team-authority.repository.js';
import type { TeamRepository } from '../apps/api/src/modules/teams/application/team-repository.js';
import type { TeamRosterRepository } from '../apps/api/src/modules/teams/application/team-roster.repository.js';
import { TeamService } from '../apps/api/src/modules/teams/application/team.service.js';
import { PrismaTeamRepository } from '../apps/api/src/modules/teams/infrastructure/prisma-team.repository.js';

const teamProfilePage = readFileSync('apps/miniapp/src/pages/TeamProfilePage.tsx', 'utf8');
const teamAssistantManager = readFileSync(
  'apps/miniapp/src/components/teams/TeamAssistantManager.tsx',
  'utf8',
);
const teamApi = readFileSync('apps/miniapp/src/features/teams/api.ts', 'utf8');

test('public Team detail only selects published lineups', async () => {
  let findFirstArgs: unknown;
  const db = {
    team: {
      findFirst(args: unknown) {
        findFirstArgs = args;
        return Promise.resolve(null);
      },
    },
  } as unknown as DatabaseClient;

  const repo = new PrismaTeamRepository(db);
  await repo.getPublic('team-1');

  const args = findFirstArgs as {
    where: { id: string; status: string; isPublic: boolean; deletedAt: null };
    select: { lineups: { where: { isPublished: boolean; deletedAt: null } } };
  };

  assert.deepEqual(args.where, {
    id: 'team-1',
    status: 'ACTIVE',
    isPublic: true,
    deletedAt: null,
  });
  assert.equal(args.select.lineups.where.isPublished, true);
  assert.equal(args.select.lineups.where.deletedAt, null);
});

test('managed Team discovery cannot grant edit UI without canonical EDIT_TEAM authority', async () => {
  const repo = {
    listManagedTeams: async () => ({
      items: [{ id: 'coach-team' }, { id: 'legacy-only-team' }],
    }),
  } as unknown as TeamRepository;
  const authority = {
    list: async () => [
      {
        teamId: 'coach-team',
        communityId: 'community-1',
        role: 'COACH' as const,
        permissions: [],
        source: 'RESPONSIBILITY' as const,
      },
    ],
  } as unknown as TeamAuthorityRepository;
  const roster = {} as TeamRosterRepository;

  const service = new TeamService(repo, authority, roster);
  const result = await service.managedTeams('coach-user');

  assert.deepEqual(result, { items: [{ id: 'coach-team' }] });
});

test('Team edit UI prefers authenticated managed Team state and writes through protected PATCH', () => {
  assert.match(teamProfilePage, /queryFn: listManagedTeams/);
  assert.match(teamProfilePage, /const managedTeam = managedTeamsQuery\.data\?\.items\.find/);
  assert.match(teamProfilePage, /const team = managedTeam \?\? teamQuery\.data/);
  assert.match(teamProfilePage, /const canManage = Boolean\(managedTeam\)/);
  assert.match(teamProfilePage, /Edit Team/);
  assert.match(teamProfilePage, /editing && canManage/);
  assert.match(teamProfilePage, /mutation\.error instanceof Error/);
  assert.match(teamApi, /patch<TeamDetailItem>\(`\/api\/v1\/teams\/\$\{teamId\}`/);
});

test('Team roster management uses protected API, confirmation, and real API errors', () => {
  assert.match(teamApi, /get<TeamRosterPage>\(`\/api\/v1\/teams\/\$\{teamId\}\/players`/);
  assert.match(teamApi, /del<TeamRosterPlayer>/);
  assert.match(teamProfilePage, /queryFn: \(\) => listTeamRoster\(teamId\)/);
  assert.match(teamProfilePage, /enabled: Boolean\(teamId\) && canManage/);
  assert.match(teamProfilePage, /window\.confirm/);
  assert.match(teamProfilePage, /removePlayerMutation\.error instanceof Error/);
  assert.match(teamProfilePage, /Assistant authority will be cleaned safely/);
});

test('Coach Assistant UI uses linked roster players and canonical Team authority endpoints', () => {
  assert.match(teamApi, /get<TeamAssistantPage>\(`\/api\/v1\/teams\/\$\{teamId\}\/assistants`/);
  assert.match(
    teamApi,
    /post<TeamAssistantAssignment>\(`\/api\/v1\/teams\/\$\{teamId\}\/assistants`/,
  );
  assert.match(teamApi, /del<TeamAssistantAssignment>/);
  assert.match(teamProfilePage, /TeamAssistantManager/);
  assert.match(teamProfilePage, /rosterPlayers=\{managedRosterPlayers\}/);
  assert.match(teamAssistantManager, /rosterPlayers\.filter\(\(player\) => Boolean\(player\.userId\)\)/);
  assert.match(teamAssistantManager, /Guest roster entries cannot receive Assistant authority/);
  assert.match(teamAssistantManager, /window\.confirm/);
  assert.match(teamAssistantManager, /EDIT_TEAM/);
  assert.match(teamAssistantManager, /MANAGE_ROSTER/);
  assert.match(teamAssistantManager, /MANAGE_LINEUP/);
  assert.match(teamAssistantManager, /CREATE_CHALLENGE/);
  assert.match(teamAssistantManager, /RESPOND_CHALLENGE/);
  assert.match(teamAssistantManager, /MESSAGE_CHALLENGE/);
  assert.doesNotMatch(teamAssistantManager, /User ID/);
});

test('Team edit contract permits explicit clearing of optional fields', () => {
  const parsed = teamUpdateSchema.parse({ city: '', houma: '', badgeUrl: '' });
  assert.deepEqual(parsed, { city: '', houma: '', badgeUrl: '' });
  assert.match(teamProfilePage, /city: city\.trim\(\)/);
  assert.match(teamProfilePage, /houma: houma\.trim\(\)/);
  assert.match(teamProfilePage, /badgeUrl: badgeUrl\.trim\(\)/);
});

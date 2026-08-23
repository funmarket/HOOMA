import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { teamLineupCreateSchema, teamUpdateSchema } from '@hooma/contracts';
import type { DatabaseClient } from '../apps/api/src/infrastructure/database/prisma.js';
import type { TeamAuthorityRepository } from '../apps/api/src/modules/teams/application/team-authority.repository.js';
import type { TeamRepository } from '../apps/api/src/modules/teams/application/team-repository.js';
import type { TeamRosterRepository } from '../apps/api/src/modules/teams/application/team-roster.repository.js';
import { TeamService } from '../apps/api/src/modules/teams/application/team.service.js';
import { PrismaTeamRepository } from '../apps/api/src/modules/teams/infrastructure/prisma-team.repository.js';

const teamProfilePage = readFileSync('apps/miniapp/src/pages/TeamProfilePage.tsx', 'utf8');
const teamLineupBuilderPage = readFileSync(
  'apps/miniapp/src/pages/TeamLineupBuilderPage.tsx',
  'utf8',
);
const teamLineupManager = readFileSync(
  'apps/miniapp/src/components/teams/TeamLineupManager.tsx',
  'utf8',
);
const teamAssistantManager = readFileSync(
  'apps/miniapp/src/components/teams/TeamAssistantManager.tsx',
  'utf8',
);
const teamApi = readFileSync('apps/miniapp/src/features/teams/api.ts', 'utf8');

test('public Team detail only selects current published lineups', async () => {
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
    select: {
      lineups: { where: { isCurrent: boolean; isPublished: boolean; deletedAt: null } };
    };
  };

  assert.deepEqual(args.where, {
    id: 'team-1',
    status: 'ACTIVE',
    isPublic: true,
    deletedAt: null,
  });
  assert.equal(args.select.lineups.where.isCurrent, true);
  assert.equal(args.select.lineups.where.isPublished, true);
  assert.equal(args.select.lineups.where.deletedAt, null);
});

test('managed Team discovery cannot grant edit UI without canonical EDIT_TEAM authority', async () => {
  let requestedTeamIds: string[] = [];
  const repo = {
    listManagedTeams: async (teamIds: string[]) => {
      requestedTeamIds = teamIds;
      return {
        items: [{ id: 'coach-team' }, { id: 'legacy-only-team' }],
      };
    },
  } as unknown as TeamRepository;
  const coachAuthority = {
    teamId: 'coach-team',
    communityId: 'community-1',
    role: 'COACH' as const,
    permissions: [],
    source: 'RESPONSIBILITY' as const,
  };
  const authority = {
    list: async () => [coachAuthority],
  } as unknown as TeamAuthorityRepository;
  const roster = {} as TeamRosterRepository;

  const service = new TeamService(repo, authority, roster);
  const result = await service.managedTeams('coach-user');

  assert.deepEqual(requestedTeamIds, ['coach-team']);
  assert.deepEqual(result, { items: [{ id: 'coach-team', authority: coachAuthority }] });
});

test('managed Team detail read is scoped to canonical Team IDs, not community Admin membership', async () => {
  let findManyArgs: unknown;
  const db = {
    team: {
      findMany(args: unknown) {
        findManyArgs = args;
        return Promise.resolve([]);
      },
    },
  } as unknown as DatabaseClient;

  const repo = new PrismaTeamRepository(db);
  await repo.listManagedTeams(['delegated-team']);

  const args = findManyArgs as {
    where: {
      id: { in: string[] };
      status: string;
      deletedAt: null;
      community?: unknown;
    };
  };
  assert.deepEqual(args.where.id.in, ['delegated-team']);
  assert.equal(args.where.status, 'ACTIVE');
  assert.equal(args.where.deletedAt, null);
  assert.equal(args.where.community, undefined);
});

test('lineup-only Assistant can read roster and current lineup without roster mutation authority', async () => {
  const assistantAuthority = {
    teamId: 'team-1',
    communityId: 'community-1',
    role: 'ASSISTANT' as const,
    permissions: ['MANAGE_LINEUP'] as const,
    source: 'RESPONSIBILITY' as const,
  };
  const authority = {
    get: async () => assistantAuthority,
  } as unknown as TeamAuthorityRepository;
  const repo = {
    getCurrentLineup: async () => ({ id: 'lineup-1' }),
  } as unknown as TeamRepository;
  const roster = {
    listActive: async () => ({ items: [{ id: 'player-1' }] }),
  } as unknown as TeamRosterRepository;
  const service = new TeamService(repo, authority, roster);

  assert.deepEqual(await service.roster('assistant-user', 'team-1'), {
    items: [{ id: 'player-1' }],
  });
  assert.deepEqual(await service.currentLineup('assistant-user', 'team-1'), { id: 'lineup-1' });
});

test('Team lineup contract supports all match sizes and Custom shape', () => {
  const parsed = teamLineupCreateSchema.parse({
    name: 'Matchday',
    formation: 'CUSTOM',
    matchFormat: 'FIVE_V_FIVE',
    slots: [],
  });
  assert.equal(parsed.formation, 'CUSTOM');
  assert.equal(parsed.matchFormat, 'FIVE_V_FIVE');
});

test('Team edit UI uses exact server authority instead of one broad management flag', () => {
  assert.match(teamProfilePage, /getTeamAuthority/);
  assert.match(teamProfilePage, /hasCapability\(authority, 'EDIT_TEAM'\)/);
  assert.match(teamProfilePage, /hasCapability\(authority, 'MANAGE_ROSTER'\)/);
  assert.match(teamProfilePage, /hasCapability\(authority, 'MANAGE_LINEUP'\)/);
  assert.doesNotMatch(teamProfilePage, /const canManage = Boolean\(managedTeam\)/);
  assert.match(teamProfilePage, /canEditTeam \?/);
  assert.match(teamProfilePage, /canManageRoster \?/);
  assert.match(teamProfilePage, /Build lineup/);
  assert.match(teamApi, /patch<TeamDetailItem>\(`\/api\/v1\/teams\/\$\{teamId\}`/);
});

test('Team roster management stays mutation-gated while lineup managers can read the roster', () => {
  assert.match(teamApi, /get<TeamRosterPage>\(`\/api\/v1\/teams\/\$\{teamId\}\/players`/);
  assert.match(teamApi, /del<TeamRosterPlayer>/);
  assert.match(teamProfilePage, /enabled: Boolean\(teamId\) && canReadManagedRoster/);
  assert.match(teamProfilePage, /enabled: Boolean\(teamId\) && canManageRoster && addingPlayer/);
  assert.match(teamProfilePage, /window\.confirm/);
  assert.match(teamProfilePage, /Assistant authority will be cleaned safely/);
});

test('Team lineup builder uses canonical Team endpoints and supports publish lifecycle', () => {
  assert.match(
    teamApi,
    /get<TeamEditableLineup \| null>\(`\/api\/v1\/teams\/\$\{teamId\}\/lineups\/current`/,
  );
  assert.match(teamApi, /post<TeamEditableLineup>\(`\/api\/v1\/teams\/\$\{teamId\}\/lineups`/);
  assert.match(
    teamApi,
    /put<TeamEditableLineup>\(`\/api\/v1\/teams\/\$\{teamId\}\/lineups\/\$\{lineupId\}`/,
  );
  assert.match(teamLineupBuilderPage, /hasLineupAuthority/);
  assert.match(teamLineupBuilderPage, /getCurrentTeamLineup/);
  assert.match(teamLineupBuilderPage, /listTeamRoster/);
  assert.match(teamLineupManager, /FIVE_V_FIVE/);
  assert.match(teamLineupManager, /SIX_V_SIX/);
  assert.match(teamLineupManager, /SEVEN_V_SEVEN/);
  assert.match(teamLineupManager, /EIGHT_V_EIGHT/);
  assert.match(teamLineupManager, /NINE_V_NINE/);
  assert.match(teamLineupManager, /ELEVEN_V_ELEVEN/);
  assert.match(teamLineupManager, /CUSTOM/);
  assert.match(teamLineupManager, /Save draft/);
  assert.match(teamLineupManager, /Publish lineup/);
  assert.match(teamLineupManager, /Unpublish/);
});

test('Coach Assistant UI uses canonical role metadata and linked Team players only', () => {
  assert.match(teamApi, /authority: TeamManagedAuthority/);
  assert.match(teamApi, /get<TeamAssistantPage>\(`\/api\/v1\/teams\/\$\{teamId\}\/assistants`/);
  assert.match(
    teamApi,
    /post<TeamAssistantAssignment>\(`\/api\/v1\/teams\/\$\{teamId\}\/assistants`/,
  );
  assert.match(teamApi, /del<TeamAssistantAssignment>/);
  assert.match(teamProfilePage, /const isCoach = authority\?\.role === 'COACH'/);
  assert.match(teamProfilePage, /TeamAssistantManager/);
  assert.match(teamProfilePage, /rosterPlayers=\{managedRosterPlayers\}/);
  assert.match(teamProfilePage, /enabled=\{isCoach\}/);
  assert.match(
    teamAssistantManager,
    /rosterPlayers\.filter\(\(player\) => Boolean\(player\.userId\)\)/,
  );
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

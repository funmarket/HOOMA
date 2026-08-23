import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { DatabaseClient } from '../apps/api/src/infrastructure/database/prisma.js';
import type { TeamAuthorityRepository } from '../apps/api/src/modules/teams/application/team-authority.repository.js';
import type { TeamMemberReadRepository } from '../apps/api/src/modules/teams/application/team-member-read.repository.js';
import type { TeamRepository } from '../apps/api/src/modules/teams/application/team-repository.js';
import type { TeamRosterRepository } from '../apps/api/src/modules/teams/application/team-roster.repository.js';
import { TeamService } from '../apps/api/src/modules/teams/application/team.service.js';
import { PrismaTeamMemberReadRepository } from '../apps/api/src/modules/teams/infrastructure/prisma-team-member-read.repository.js';

const teamController = readFileSync('apps/api/src/modules/teams/http/team.controller.ts', 'utf8');
const teamsPage = readFileSync('apps/miniapp/src/pages/TeamsPage.tsx', 'utf8');
const teamProfilePage = readFileSync('apps/miniapp/src/pages/TeamProfilePage.tsx', 'utf8');
const teamApi = readFileSync('apps/miniapp/src/features/teams/api.ts', 'utf8');

test('My Team read model is based on active canonical TeamPlayer linkage and includes private Teams', async () => {
  let findManyArgs: unknown;
  const db = {
    team: {
      findMany(args: unknown) {
        findManyArgs = args;
        return Promise.resolve([]);
      },
    },
  } as unknown as DatabaseClient;

  const repo = new PrismaTeamMemberReadRepository(db);
  assert.deepEqual(await repo.listMine('user-1'), { items: [] });

  const args = findManyArgs as {
    where: {
      status: string;
      deletedAt: null;
      players: { some: { userId: string; isActive: boolean } };
      isPublic?: boolean;
    };
    select: {
      players: { select: { userId: boolean } };
      lineups: { where: { isCurrent: boolean; isPublished: boolean; deletedAt: null } };
    };
  };
  assert.equal(args.where.status, 'ACTIVE');
  assert.equal(args.where.deletedAt, null);
  assert.deepEqual(args.where.players, { some: { userId: 'user-1', isActive: true } });
  assert.equal(args.where.isPublic, undefined);
  assert.equal(args.select.players.select.userId, true);
  assert.equal(args.select.lineups.where.isCurrent, true);
  assert.equal(args.select.lineups.where.isPublished, true);
  assert.equal(args.select.lineups.where.deletedAt, null);
});

test('My Team service read does not grant or consult Team management authority', async () => {
  const repo = {} as TeamRepository;
  const authority = {
    list: async () => {
      throw new Error('authority must not be consulted for player membership reads');
    },
  } as unknown as TeamAuthorityRepository;
  const roster = {} as TeamRosterRepository;
  const memberRead = {
    listMine: async (userId: string) => ({ items: [{ id: 'team-1', viewerUserId: userId }] }),
  } as TeamMemberReadRepository;

  const service = new TeamService(repo, authority, roster, memberRead);
  assert.deepEqual(await service.myTeams('player-1'), {
    items: [{ id: 'team-1', viewerUserId: 'player-1' }],
  });
});

test('fixed /mine route is registered before dynamic Team detail route', () => {
  const mine = teamController.indexOf("'/mine'");
  const dynamic = teamController.indexOf("'/:teamId'");
  assert.ok(mine >= 0);
  assert.ok(dynamic >= 0);
  assert.ok(mine < dynamic);
});

test('Mini App exposes My Team without turning player membership into management authority', () => {
  assert.match(teamApi, /listMyTeams/);
  assert.match(teamApi, /\/api\/v1\/teams\/mine/);
  assert.match(teamsPage, /label: 'My Team'/);
  assert.match(teamsPage, /My Team \/ Team HQ/);
  assert.match(teamsPage, /queryFn: listMyTeams/);
  assert.match(teamProfilePage, /const memberTeam = myTeamsQuery\.data\?\.items\.find/);
  assert.match(teamProfilePage, /const authority = managedTeam\?\.authority \?\? authorityQuery\.data \?\? null/);
  assert.match(teamProfilePage, /const canEditTeam = hasCapability\(authority, 'EDIT_TEAM'\)/);
  assert.match(teamProfilePage, /const canManageRoster = hasCapability\(authority, 'MANAGE_ROSTER'\)/);
  assert.match(teamProfilePage, /const canManageLineup = hasCapability\(authority, 'MANAGE_LINEUP'\)/);
  assert.match(teamProfilePage, /const isTeamPlayer = Boolean\(memberTeam\)/);
  assert.match(teamProfilePage, /team\.acceptingChallenges && !authority && !isTeamPlayer/);
  assert.match(teamProfilePage, /memberTeam\.players \?\? \[\]/);
  assert.match(teamProfilePage, /authority \? 'Your Team' : isTeamPlayer \? 'My Team' : 'Public team'/);
  assert.doesNotMatch(teamProfilePage, /const canManage = Boolean\(managedTeam\)/);
});

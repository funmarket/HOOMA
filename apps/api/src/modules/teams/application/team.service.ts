import type {
  TeamAssistantDelegationInput,
  TeamChallengeCreateInput,
  TeamChallengeMessageCreateInput,
  TeamCreateInput,
  TeamLineupCreateInput,
  TeamPlayerCreateInput,
  TeamUpdateInput,
} from '@hooma/contracts';
import { AppError } from '../../../http/errors/app-error.js';
import {
  legacyTeamRoleHasCapability,
  teamAuthorityHasCapability,
  type TeamCapability,
} from '../domain/team-access.js';
import type { TeamAuthorityRepository } from './team-authority.repository.js';
import type { TeamListInput, TeamRepository } from './team-repository.js';
import type { TeamRosterRepository } from './team-roster.repository.js';

export class TeamService {
  constructor(
    private readonly repo: TeamRepository,
    private readonly authority: TeamAuthorityRepository,
    private readonly rosterRepo: TeamRosterRepository,
  ) {}

  listPublic(input: TeamListInput) {
    return this.repo.listPublic(input);
  }

  async managedTeams(userId: string) {
    const editableTeamIds = new Set(await this.authorizedTeamIds(userId, 'EDIT_TEAM'));
    if (!editableTeamIds.size) return { items: [] };

    const managed = await this.repo.listManagedTeams(userId);
    return {
      items: managed.items.filter((team) => editableTeamIds.has(team.id)),
    };
  }

  async getPublic(teamId: string) {
    const team = await this.repo.getPublic(teamId);
    if (!team) throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');
    return team;
  }

  async getChallenge(userId: string, challengeId: string) {
    const teamIds = await this.authorizedTeamIds(userId);
    return this.repo.getChallenge(challengeId, teamIds);
  }

  async getGame(userId: string, gameId: string) {
    return this.repo.getGame(gameId);
  }

  async create(userId: string, input: TeamCreateInput) {
    await this.requireCommunityCapability(userId, input.communityId, 'CREATE_TEAM');
    return this.repo.create(userId, input);
  }

  async update(userId: string, teamId: string, input: TeamUpdateInput) {
    await this.requireTeamCapability(userId, teamId, 'EDIT_TEAM');
    return this.repo.update(teamId, input);
  }

  async roster(userId: string, teamId: string) {
    await this.requireTeamCapability(userId, teamId, 'MANAGE_ROSTER');
    return this.rosterRepo.listActive(teamId);
  }

  async rosterCandidates(userId: string, teamId: string) {
    await this.requireTeamCapability(userId, teamId, 'MANAGE_ROSTER');
    return this.rosterRepo.listCandidates(teamId);
  }

  async addPlayer(userId: string, teamId: string, input: TeamPlayerCreateInput, requestId: string) {
    await this.requireTeamCapability(userId, teamId, 'MANAGE_ROSTER');
    return this.rosterRepo.addPlayer(userId, teamId, input, requestId);
  }

  async removePlayer(userId: string, teamId: string, teamPlayerId: string, requestId: string) {
    await this.requireTeamCapability(userId, teamId, 'MANAGE_ROSTER');
    return this.rosterRepo.removePlayer(userId, teamId, teamPlayerId, requestId);
  }

  async listAssistants(userId: string, teamId: string) {
    await this.requireCoach(userId, teamId);
    return this.authority.listAssistants(teamId);
  }

  async appointAssistant(
    userId: string,
    teamId: string,
    input: TeamAssistantDelegationInput,
    requestId: string,
  ) {
    await this.requireCoach(userId, teamId);
    return this.authority.appointAssistant(userId, teamId, input, requestId);
  }

  async revokeAssistant(
    userId: string,
    teamId: string,
    responsibilityId: string,
    requestId: string,
  ) {
    await this.requireCoach(userId, teamId);
    return this.authority.revokeAssistant(userId, teamId, responsibilityId, requestId);
  }

  async createLineup(userId: string, teamId: string, input: TeamLineupCreateInput) {
    await this.requireTeamCapability(userId, teamId, 'MANAGE_LINEUP');
    return this.repo.createLineup(userId, teamId, input);
  }

  async createChallenge(userId: string, input: TeamChallengeCreateInput) {
    if (input.challengerTeamId === input.challengedTeamId) {
      throw new AppError(400, 'TEAM_CHALLENGE_SELF', 'A team cannot challenge itself.');
    }
    await this.requireTeamCapability(userId, input.challengerTeamId, 'CREATE_CHALLENGE');
    return this.repo.createChallenge(userId, input);
  }

  async incomingChallenges(userId: string, limit = 30) {
    const teamIds = await this.authorizedTeamIds(userId, 'RESPOND_CHALLENGE');
    return this.repo.listIncomingChallenges(teamIds, Math.min(limit, 100));
  }

  async outgoingChallenges(userId: string, limit = 30) {
    const teamIds = await this.authorizedTeamIds(userId, 'CREATE_CHALLENGE');
    return this.repo.listOutgoingChallenges(teamIds, Math.min(limit, 100));
  }

  async acceptChallenge(userId: string, challengeId: string) {
    const teamIds = await this.authorizedTeamIds(userId, 'RESPOND_CHALLENGE');
    return this.repo.acceptChallenge(userId, challengeId, teamIds);
  }

  async declineChallenge(userId: string, challengeId: string) {
    const teamIds = await this.authorizedTeamIds(userId, 'RESPOND_CHALLENGE');
    return this.repo.declineChallenge(userId, challengeId, teamIds);
  }

  async cancelChallenge(userId: string, challengeId: string) {
    const teamIds = await this.authorizedTeamIds(userId, 'CREATE_CHALLENGE');
    return this.repo.cancelChallenge(userId, challengeId, teamIds);
  }

  async games(userId: string, limit = 30) {
    const teamIds = await this.authorizedTeamIds(userId);
    return this.repo.listGames(teamIds, Math.min(limit, 100));
  }

  async messages(userId: string, challengeId: string) {
    const teamIds = await this.authorizedTeamIds(userId);
    return this.repo.listMessages(challengeId, teamIds);
  }

  async createMessage(userId: string, challengeId: string, input: TeamChallengeMessageCreateInput) {
    const teamIds = await this.authorizedTeamIds(userId, 'MESSAGE_CHALLENGE');
    return this.repo.createMessage(userId, challengeId, teamIds, input);
  }

  private async requireCommunityCapability(
    userId: string,
    communityId: string,
    capability: TeamCapability,
  ) {
    const access = await this.repo.getCommunityCoachAccess(userId, communityId);
    if (!access || !legacyTeamRoleHasCapability(access.role, capability)) {
      throw new AppError(403, 'TEAM_COACH_REQUIRED', 'Coach access required for this HOOMA.');
    }
    return access;
  }

  private async requireTeamCapability(userId: string, teamId: string, capability: TeamCapability) {
    const access = await this.authority.get(userId, teamId);
    if (!access || !teamAuthorityHasCapability(access, capability)) {
      throw new AppError(404, 'TEAM_NOT_FOUND', 'Team not found.');
    }
    return access;
  }

  private async requireCoach(userId: string, teamId: string) {
    const access = await this.authority.get(userId, teamId);
    if (!access || access.role !== 'COACH') {
      throw new AppError(403, 'TEAM_COACH_REQUIRED', 'Coach access required for this Team.');
    }
    return access;
  }

  private async authorizedTeamIds(userId: string, capability?: TeamCapability) {
    const access = await this.authority.list(userId);
    return access
      .filter((item) => !capability || teamAuthorityHasCapability(item, capability))
      .map((item) => item.teamId);
  }
}

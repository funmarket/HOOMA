import type {
  TeamAssistantDelegationInput,
  TeamChallengeCreateInput,
  TeamChallengeMessageCreateInput,
  TeamCreateInput,
  TeamLineupCreateInput,
  TeamPlayerCreateInput,
  TeamUpdateInput,
} from '@hooma/contracts';
import type { TeamAuthority } from '../domain/team-access.js';

export type TeamListInput = {
  cursor?: string;
  limit: number;
  search?: string;
  city?: string;
  houma?: string;
};

export interface TeamRepository {
  listPublic(input: TeamListInput): Promise<unknown>;
  listManagedTeams(userId: string): Promise<unknown>;
  getPublic(teamId: string): Promise<unknown>;
  getChallenge(challengeId: string, managedTeamIds: string[]): Promise<unknown>;
  getGame(gameId: string): Promise<unknown>;
  getCommunityCoachAccess(
    userId: string,
    communityId: string,
  ): Promise<{ communityId: string; role: 'OWNER' | 'ADMIN' } | null>;
  getTeamAuthority(userId: string, teamId: string): Promise<TeamAuthority | null>;
  listTeamAuthorities(userId: string): Promise<TeamAuthority[]>;
  getTeamAccess(
    teamId: string,
  ): Promise<{ id: string; communityId: string; status: string } | null>;
  create(userId: string, input: TeamCreateInput): Promise<unknown>;
  update(teamId: string, input: TeamUpdateInput): Promise<unknown>;
  addPlayer(teamId: string, input: TeamPlayerCreateInput): Promise<unknown>;
  listAssistants(teamId: string): Promise<unknown>;
  appointAssistant(
    actorUserId: string,
    teamId: string,
    input: TeamAssistantDelegationInput,
    requestId: string,
  ): Promise<unknown>;
  revokeAssistant(
    actorUserId: string,
    teamId: string,
    responsibilityId: string,
    requestId: string,
  ): Promise<unknown>;
  createLineup(userId: string, teamId: string, input: TeamLineupCreateInput): Promise<unknown>;
  createChallenge(userId: string, input: TeamChallengeCreateInput): Promise<unknown>;
  listIncomingChallenges(teamIds: string[], limit: number): Promise<unknown>;
  listOutgoingChallenges(teamIds: string[], limit: number): Promise<unknown>;
  acceptChallenge(userId: string, challengeId: string, managedTeamIds: string[]): Promise<unknown>;
  declineChallenge(userId: string, challengeId: string, managedTeamIds: string[]): Promise<unknown>;
  cancelChallenge(userId: string, challengeId: string, managedTeamIds: string[]): Promise<unknown>;
  listGames(teamIds: string[], limit: number): Promise<unknown>;
  listMessages(challengeId: string, managedTeamIds: string[]): Promise<unknown>;
  createMessage(
    userId: string,
    challengeId: string,
    managedTeamIds: string[],
    input: TeamChallengeMessageCreateInput,
  ): Promise<unknown>;
}

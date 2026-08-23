import type {
  TeamChallengeCreateInput,
  TeamChallengeMessageCreateInput,
  TeamCreateInput,
  TeamLineupCreateInput,
  TeamLineupUpdateInput,
  TeamPlayerCreateInput,
  TeamUpdateInput,
} from '@hooma/contracts';

export type TeamListInput = {
  cursor?: string;
  limit: number;
  search?: string;
  city?: string;
  houma?: string;
};

export type ManagedTeamResult = {
  items: Array<{ id: string }>;
};

export interface TeamRepository {
  listPublic(input: TeamListInput): Promise<unknown>;
  listManagedTeams(teamIds: string[]): Promise<ManagedTeamResult>;
  getPublic(teamId: string): Promise<unknown>;
  getCurrentLineup(teamId: string): Promise<unknown>;
  getChallenge(challengeId: string, managedTeamIds: string[]): Promise<unknown>;
  getGame(gameId: string): Promise<unknown>;
  getCommunityCoachAccess(
    userId: string,
    communityId: string,
  ): Promise<{ communityId: string; role: 'OWNER' | 'ADMIN' } | null>;
  getTeamManagerAccess(
    userId: string,
    teamId: string,
  ): Promise<{ id: string; communityId: string; role: 'OWNER' | 'ADMIN' } | null>;
  getTeamAccess(
    teamId: string,
  ): Promise<{ id: string; communityId: string; status: string } | null>;
  getManagedTeamIds(userId: string): Promise<string[]>;
  create(userId: string, input: TeamCreateInput): Promise<unknown>;
  update(teamId: string, input: TeamUpdateInput): Promise<unknown>;
  addPlayer(teamId: string, input: TeamPlayerCreateInput): Promise<unknown>;
  createLineup(userId: string, teamId: string, input: TeamLineupCreateInput): Promise<unknown>;
  updateLineup(
    userId: string,
    teamId: string,
    lineupId: string,
    input: TeamLineupUpdateInput,
  ): Promise<unknown>;
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

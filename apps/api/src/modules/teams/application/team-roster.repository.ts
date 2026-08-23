import type { TeamPlayerCreateInput } from '@hooma/contracts';

export interface TeamRosterRepository {
  listActive(teamId: string): Promise<unknown>;
  addPlayer(
    actorUserId: string,
    teamId: string,
    input: TeamPlayerCreateInput,
    requestId: string,
  ): Promise<unknown>;
  removePlayer(
    actorUserId: string,
    teamId: string,
    teamPlayerId: string,
    requestId: string,
  ): Promise<unknown>;
}

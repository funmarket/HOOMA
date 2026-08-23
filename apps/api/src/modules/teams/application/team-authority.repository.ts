import type { TeamAssistantDelegationInput } from '@hooma/contracts';
import type { TeamAuthority } from '../domain/team-access.js';

export interface TeamAuthorityRepository {
  get(userId: string, teamId: string): Promise<TeamAuthority | null>;
  list(userId: string): Promise<TeamAuthority[]>;
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
}

import type {
  TeamAssistantDelegationInput,
  TeamChallengeCreateInput,
  TeamLineupCreateInput,
  TeamLineupUpdateInput,
  TeamPlayerCreateInput,
  TeamUpdateInput,
} from '@hooma/contracts';
import { del, get, patch, post, put } from '../../shared/api/http-client';
import type {
  TeamChallengeDetailItem,
  TeamChallengeItem,
  TeamChallengePage,
  TeamDetailItem,
  TeamGameDetailItem,
  TeamGamePage,
  TeamLineupItem,
  TeamPage,
} from '../../types/domain';

export type TeamRosterPlayer = {
  id: string;
  userId?: string | null;
  displayName: string;
  shirtNumber?: number | null;
  position?: string | null;
  photoUrl?: string | null;
  isActive: boolean;
};

export type TeamRosterPage = { items: TeamRosterPlayer[] };

export type TeamMemberPlayer = Omit<TeamRosterPlayer, 'isActive'>;
export type TeamMemberTeam = Omit<TeamDetailItem, 'players'> & {
  players?: TeamMemberPlayer[];
};
export type TeamMinePage = { items: TeamMemberTeam[] };

export type TeamPlayerCandidate = {
  userId: string;
  displayName: string;
  photoUrl?: string | null;
  preferredPositions: string[];
  communityRole: 'OWNER' | 'ADMIN' | 'MEMBER';
};

export type TeamPlayerCandidatePage = { items: TeamPlayerCandidate[] };

export type TeamDelegatedPermission = TeamAssistantDelegationInput['permissions'][number];

export type TeamManagedAuthority = {
  teamId: string;
  communityId: string;
  role: 'COACH' | 'MANAGER' | 'ASSISTANT';
  permissions: TeamDelegatedPermission[];
  source: 'RESPONSIBILITY' | 'LEGACY';
};

export type TeamManagedItem = TeamDetailItem & {
  authority: TeamManagedAuthority;
};
export type TeamManagedPage = { items: TeamManagedItem[] };

export type TeamAssistantAssignment = {
  id: string;
  userId: string;
  role: 'ASSISTANT';
  permissions: TeamDelegatedPermission[];
  appointedByUserId: string;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TeamAssistantItem = TeamAssistantAssignment & {
  player: {
    id: string;
    userId?: string | null;
    displayName: string;
    shirtNumber?: number | null;
    position?: string | null;
    photoUrl?: string | null;
  };
};

export type TeamAssistantPage = { items: TeamAssistantItem[] };

export type TeamEditableLineup = TeamLineupItem & {
  isCurrent: boolean;
  isPublished: boolean;
};

export const teamQueryKeys = {
  all: ['teams'] as const,
  list: (filters: { search: string; city: string; houma: string }) =>
    [...teamQueryKeys.all, 'list', filters] as const,
  detail: (teamId: string) => [...teamQueryKeys.all, 'detail', teamId] as const,
  managed: () => [...teamQueryKeys.all, 'managed'] as const,
  mine: () => [...teamQueryKeys.all, 'mine'] as const,
  authority: (teamId: string) => [...teamQueryKeys.all, 'authority', teamId] as const,
  roster: (teamId: string) => [...teamQueryKeys.all, 'roster', teamId] as const,
  publicRoster: (teamId: string) => [...teamQueryKeys.all, 'public-roster', teamId] as const,
  rosterCandidates: (teamId: string) => [...teamQueryKeys.roster(teamId), 'candidates'] as const,
  assistants: (teamId: string) => [...teamQueryKeys.all, 'assistants', teamId] as const,
  currentLineup: (teamId: string) => [...teamQueryKeys.all, 'current-lineup', teamId] as const,
  challenges: () => [...teamQueryKeys.all, 'challenges'] as const,
  incomingChallenges: () => [...teamQueryKeys.challenges(), 'incoming'] as const,
  outgoingChallenges: () => [...teamQueryKeys.challenges(), 'outgoing'] as const,
  challengeDetail: (challengeId: string) =>
    [...teamQueryKeys.challenges(), 'detail', challengeId] as const,
  games: () => [...teamQueryKeys.all, 'games'] as const,
  gameDetail: (gameId: string) => [...teamQueryKeys.games(), 'detail', gameId] as const,
};

function teamListPath(search: string, city: string, houma: string) {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (city.trim()) params.set('city', city.trim());
  if (houma.trim()) params.set('houma', houma.trim());
  const query = params.toString();
  return query ? `/api/v1/teams?${query}` : '/api/v1/teams';
}

export function listTeams(filters: { search: string; city: string; houma: string }) {
  return get<TeamPage>(teamListPath(filters.search, filters.city, filters.houma));
}

export function getTeam(teamId: string) {
  return get<TeamDetailItem>(`/api/v1/teams/${teamId}`);
}

export function listManagedTeams() {
  return get<TeamManagedPage>('/api/v1/teams/managed');
}

export function listMyTeams() {
  return get<TeamMinePage>('/api/v1/teams/mine');
}

export function getTeamAuthority(teamId: string) {
  return get<TeamManagedAuthority | null>(`/api/v1/teams/${teamId}/authority`);
}

export function updateTeam(teamId: string, input: TeamUpdateInput) {
  return patch<TeamDetailItem>(`/api/v1/teams/${teamId}`, input);
}

export function listTeamRoster(teamId: string) {
  return get<TeamRosterPage>(`/api/v1/teams/${teamId}/players`);
}

export function listPublicTeamRoster(teamId: string) {
  return get<TeamRosterPage>(`/api/v1/teams/${teamId}/public-players`);
}

export function listTeamPlayerCandidates(teamId: string) {
  return get<TeamPlayerCandidatePage>(`/api/v1/teams/${teamId}/player-candidates`);
}

export function addTeamPlayer(teamId: string, input: TeamPlayerCreateInput) {
  return post<TeamRosterPlayer>(`/api/v1/teams/${teamId}/players`, input);
}

export function removeTeamPlayer(teamId: string, teamPlayerId: string) {
  return del<TeamRosterPlayer>(`/api/v1/teams/${teamId}/players/${teamPlayerId}`);
}

export function listTeamAssistants(teamId: string) {
  return get<TeamAssistantPage>(`/api/v1/teams/${teamId}/assistants`);
}

export function saveTeamAssistant(teamId: string, input: TeamAssistantDelegationInput) {
  return post<TeamAssistantAssignment>(`/api/v1/teams/${teamId}/assistants`, input);
}

export function revokeTeamAssistant(teamId: string, responsibilityId: string) {
  return del<TeamAssistantAssignment>(`/api/v1/teams/${teamId}/assistants/${responsibilityId}`);
}

export function getCurrentTeamLineup(teamId: string) {
  return get<TeamEditableLineup | null>(`/api/v1/teams/${teamId}/lineups/current`);
}

export function createTeamLineup(teamId: string, input: TeamLineupCreateInput) {
  return post<TeamEditableLineup>(`/api/v1/teams/${teamId}/lineups`, input);
}

export function updateTeamLineup(teamId: string, lineupId: string, input: TeamLineupUpdateInput) {
  return put<TeamEditableLineup>(`/api/v1/teams/${teamId}/lineups/${lineupId}`, input);
}

export function listIncomingChallenges() {
  return get<TeamChallengePage>('/api/v1/teams/challenges/incoming');
}

export function listOutgoingChallenges() {
  return get<TeamChallengePage>('/api/v1/teams/challenges/outgoing');
}

export function createTeamChallenge(input: TeamChallengeCreateInput) {
  return post<TeamChallengeItem>('/api/v1/teams/challenges', input);
}

export function getTeamChallenge(challengeId: string) {
  return get<TeamChallengeDetailItem>(`/api/v1/teams/challenges/${challengeId}`);
}

export function acceptTeamChallenge(challengeId: string) {
  return post<TeamChallengeItem>(`/api/v1/teams/challenges/${challengeId}/accept`);
}

export function declineTeamChallenge(challengeId: string) {
  return post(`/api/v1/teams/challenges/${challengeId}/decline`);
}

export function listTeamGames() {
  return get<TeamGamePage>('/api/v1/teams/games');
}

export function getTeamGame(gameId: string) {
  return get<TeamGameDetailItem>(`/api/v1/teams/games/${gameId}`);
}

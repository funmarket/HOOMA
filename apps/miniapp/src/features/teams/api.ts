import type {
  TeamChallengeCreateInput,
  TeamPlayerCreateInput,
  TeamUpdateInput,
} from '@hooma/contracts';
import { del, get, patch, post } from '../../shared/api/http-client';
import type {
  TeamChallengeDetailItem,
  TeamChallengeItem,
  TeamChallengePage,
  TeamDetailItem,
  TeamGameDetailItem,
  TeamGamePage,
  TeamManagedPage,
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

export const teamQueryKeys = {
  all: ['teams'] as const,
  list: (filters: { search: string; city: string; houma: string }) =>
    [...teamQueryKeys.all, 'list', filters] as const,
  detail: (teamId: string) => [...teamQueryKeys.all, 'detail', teamId] as const,
  managed: () => [...teamQueryKeys.all, 'managed'] as const,
  roster: (teamId: string) => [...teamQueryKeys.all, 'roster', teamId] as const,
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

export function updateTeam(teamId: string, input: TeamUpdateInput) {
  return patch<TeamDetailItem>(`/api/v1/teams/${teamId}`, input);
}

export function listTeamRoster(teamId: string) {
  return get<TeamRosterPage>(`/api/v1/teams/${teamId}/players`);
}

export function addTeamPlayer(teamId: string, input: TeamPlayerCreateInput) {
  return post<TeamRosterPlayer>(`/api/v1/teams/${teamId}/players`, input);
}

export function removeTeamPlayer(teamId: string, teamPlayerId: string) {
  return del<TeamRosterPlayer>(`/api/v1/teams/${teamId}/players/${teamPlayerId}`);
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

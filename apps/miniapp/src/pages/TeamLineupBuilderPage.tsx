import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TeamLineupManager } from '../components/teams/TeamLineupManager';
import {
  getCurrentTeamLineup,
  getTeamAuthority,
  listManagedTeams,
  listMyTeams,
  listTeamRoster,
  teamQueryKeys,
  type TeamManagedAuthority,
} from '../features/teams/api';

function hasLineupAuthority(authority: TeamManagedAuthority | null | undefined) {
  if (!authority) return false;
  return (
    authority.role === 'COACH' ||
    authority.role === 'MANAGER' ||
    authority.permissions.includes('MANAGE_LINEUP')
  );
}

export function TeamLineupBuilderPage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const managedQuery = useQuery({
    queryKey: teamQueryKeys.managed(),
    queryFn: listManagedTeams,
    retry: false,
  });
  const mineQuery = useQuery({
    queryKey: teamQueryKeys.mine(),
    queryFn: listMyTeams,
    retry: false,
  });
  const managedTeam = managedQuery.data?.items.find((item) => item.id === teamId);
  const memberTeam = mineQuery.data?.items.find((item) => item.id === teamId);
  const authorityQuery = useQuery({
    queryKey: teamQueryKeys.authority(teamId),
    queryFn: () => getTeamAuthority(teamId),
    enabled: Boolean(teamId) && !managedTeam && Boolean(memberTeam),
    retry: false,
  });
  const authority = managedTeam?.authority ?? authorityQuery.data ?? null;
  const canManageLineup = hasLineupAuthority(authority);

  const rosterQuery = useQuery({
    queryKey: teamQueryKeys.roster(teamId),
    queryFn: () => listTeamRoster(teamId),
    enabled: Boolean(teamId) && canManageLineup,
    retry: false,
  });
  const lineupQuery = useQuery({
    queryKey: teamQueryKeys.currentLineup(teamId),
    queryFn: () => getCurrentTeamLineup(teamId),
    enabled: Boolean(teamId) && canManageLineup,
    retry: false,
  });

  const team = managedTeam ?? memberTeam;
  const loading =
    managedQuery.isLoading ||
    mineQuery.isLoading ||
    (!managedTeam && Boolean(memberTeam) && authorityQuery.isLoading);

  if (loading) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty h-72 animate-pulse" />
      </div>
    );
  }

  if (!team || !canManageLineup) {
    return (
      <div className="page-shell vintage-page">
        <button type="button" className="ghost-button mb-4" onClick={() => navigate(`/teams/${teamId}`)}>
          <ArrowLeft size={16} /> Team HQ
        </button>
        <div className="vintage-empty">
          <Shield size={22} />
          <strong>Lineup management is not available for this account.</strong>
          <small>The Coach controls this permission through Team authority.</small>
        </div>
      </div>
    );
  }

  if (rosterQuery.isLoading || lineupQuery.isLoading) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty h-72 animate-pulse" />
      </div>
    );
  }

  if (rosterQuery.isError || lineupQuery.isError) {
    const error = rosterQuery.error ?? lineupQuery.error;
    return (
      <div className="page-shell vintage-page">
        <button type="button" className="ghost-button mb-4" onClick={() => navigate(`/teams/${teamId}`)}>
          <ArrowLeft size={16} /> Team HQ
        </button>
        <div className="vintage-empty" role="alert">
          {error instanceof Error ? error.message : 'Team lineup data could not be loaded.'}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell vintage-page">
      <button type="button" className="ghost-button mb-4" onClick={() => navigate(`/teams/${teamId}`)}>
        <ArrowLeft size={16} /> Team HQ
      </button>
      <TeamLineupManager
        key={lineupQuery.data?.id ?? 'new-lineup'}
        teamId={teamId}
        teamName={team.name}
        lineup={lineupQuery.data ?? null}
        roster={rosterQuery.data?.items ?? []}
        onSaved={async () => {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: teamQueryKeys.currentLineup(teamId) }),
            queryClient.invalidateQueries({ queryKey: teamQueryKeys.managed() }),
            queryClient.invalidateQueries({ queryKey: teamQueryKeys.mine() }),
            queryClient.invalidateQueries({ queryKey: teamQueryKeys.detail(teamId) }),
          ]);
        }}
      />
    </div>
  );
}

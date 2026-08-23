import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MapPin, Shield, SlidersHorizontal, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { TeamLineupPitch } from '../components/teams/TeamLineupPitch';
import {
  getTeam,
  getTeamAuthority,
  listManagedTeams,
  listMyTeams,
  listPublicTeamRoster,
  listTeamRoster,
  teamQueryKeys,
  type TeamDelegatedPermission,
  type TeamManagedAuthority,
  type TeamManagedItem,
} from '../features/teams/api';

function hasCapability(
  authority: TeamManagedAuthority | null | undefined,
  capability: TeamDelegatedPermission,
) {
  if (!authority) return false;
  return (
    authority.role === 'COACH' ||
    authority.role === 'MANAGER' ||
    authority.permissions.includes(capability)
  );
}

export function TeamProfilePage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();

  const managedTeamsQuery = useQuery({
    queryKey: teamQueryKeys.managed(),
    queryFn: listManagedTeams,
    retry: false,
  });
  const myTeamsQuery = useQuery({
    queryKey: teamQueryKeys.mine(),
    queryFn: listMyTeams,
    retry: false,
  });
  const managedTeam = managedTeamsQuery.data?.items.find((item) => item.id === teamId) as
    TeamManagedItem | undefined;
  const memberTeam = myTeamsQuery.data?.items.find((item) => item.id === teamId);
  const authorityQuery = useQuery({
    queryKey: teamQueryKeys.authority(teamId),
    queryFn: () => getTeamAuthority(teamId),
    enabled: Boolean(teamId) && !managedTeam && Boolean(memberTeam),
    retry: false,
  });
  const teamQuery = useQuery({
    queryKey: teamQueryKeys.detail(teamId),
    queryFn: () => getTeam(teamId),
    enabled:
      Boolean(teamId) &&
      !managedTeamsQuery.isLoading &&
      !myTeamsQuery.isLoading &&
      !managedTeam &&
      !memberTeam,
  });

  const team = managedTeam ?? memberTeam ?? teamQuery.data;
  const authority = managedTeam?.authority ?? authorityQuery.data ?? null;
  const canReadManagedRoster =
    hasCapability(authority, 'MANAGE_ROSTER') || hasCapability(authority, 'MANAGE_LINEUP');
  const isTeamPlayer = Boolean(memberTeam);

  const rosterQuery = useQuery({
    queryKey: teamQueryKeys.roster(teamId),
    queryFn: () => listTeamRoster(teamId),
    enabled: Boolean(teamId) && canReadManagedRoster,
    retry: false,
  });
  const publicRosterQuery = useQuery({
    queryKey: teamQueryKeys.publicRoster(teamId),
    queryFn: () => listPublicTeamRoster(teamId),
    enabled:
      Boolean(teamId) &&
      !managedTeamsQuery.isLoading &&
      !myTeamsQuery.isLoading &&
      !canReadManagedRoster &&
      !isTeamPlayer,
    retry: false,
  });

  const lineup = team?.lineups?.[0] ?? null;
  const rosterPlayers = canReadManagedRoster
    ? (rosterQuery.data?.items ?? [])
    : memberTeam
      ? (memberTeam.players ?? [])
      : (publicRosterQuery.data?.items ?? []);

  if (
    managedTeamsQuery.isLoading ||
    myTeamsQuery.isLoading ||
    (!managedTeam && Boolean(memberTeam) && authorityQuery.isLoading) ||
    (!managedTeam && !memberTeam && teamQuery.isLoading)
  ) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty h-72 animate-pulse" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty">Team not found.</div>
      </div>
    );
  }

  return (
    <div className="page-shell vintage-page">
      <section className="team-profile-hero">
        <span className="team-profile-badge">
          {team.badgeUrl ? (
            <img src={team.badgeUrl} alt={`${team.name} badge`} />
          ) : (
            <Shield size={56} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="vintage-kicker">
            {authority ? 'Your Team' : isTeamPlayer ? 'My Team' : 'Public team'}
          </div>
          <h1 className="team-profile-title">{team.name}</h1>
          <p className="team-profile-meta">
            <MapPin size={16} />{' '}
            {[team.city, team.houma].filter(Boolean).join(', ') || 'Location TBA'}
          </p>
          <p className="team-profile-meta">
            <Users size={16} /> {team._count?.players ?? rosterPlayers.length} players
          </p>
        </div>
        {authority ? (
          <button
            type="button"
            className="ghost-button shrink-0 px-3 py-2.5"
            onClick={() => navigate(`/teams/${team.id}/control`)}
          >
            <SlidersHorizontal size={17} /> Control Room
          </button>
        ) : null}
      </section>

      <section className="teams-section">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Lineup</div>
            <h2 className="section-title">Published shape</h2>
          </div>
          {team.acceptingChallenges && !authority && !isTeamPlayer ? (
            <button
              type="button"
              className="accent-button shrink-0 px-4"
              onClick={() => navigate(`/teams/${team.id}/challenge`)}
            >
              Challenge
            </button>
          ) : null}
        </div>
        <TeamLineupPitch
          teamName={team.name}
          lineup={lineup}
          roster={rosterPlayers}
          onOpenProfile={(userId) => navigate(`/profile/${userId}`)}
        />
      </section>

      <section className="teams-section">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Roster</div>
            <h2 className="section-title">Players</h2>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          {(
            canReadManagedRoster
              ? rosterQuery.isLoading
              : isTeamPlayer
                ? false
                : publicRosterQuery.isLoading
          ) ? (
            <div className="vintage-empty">Loading active roster…</div>
          ) : rosterPlayers.length ? (
            rosterPlayers.map((player) => (
              <article className="team-roster-row" key={player.id}>
                {player.userId ? (
                  <button
                    type="button"
                    className="contents"
                    onClick={() => navigate(`/profile/${player.userId}`)}
                    aria-label={`Open ${player.displayName} profile`}
                  >
                    <span>
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt="" />
                      ) : (
                        player.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <strong>{player.displayName}</strong>
                  </button>
                ) : (
                  <>
                    <span>
                      {player.photoUrl ? (
                        <img src={player.photoUrl} alt="" />
                      ) : (
                        player.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <strong>{player.displayName}</strong>
                  </>
                )}
                <small>
                  {player.position ?? 'ANY'}
                  {player.shirtNumber != null ? ` #${player.shirtNumber}` : ''}
                </small>
              </article>
            ))
          ) : (
            <div className="vintage-empty">
              <strong>No active players.</strong>
            </div>
          )}
        </div>
      </section>

      <button
        type="button"
        className="vintage-outline-cta mt-5 w-full"
        onClick={() => navigate('/teams')}
      >
        Back to Teams <ChevronRight size={18} />
      </button>
    </div>
  );
}

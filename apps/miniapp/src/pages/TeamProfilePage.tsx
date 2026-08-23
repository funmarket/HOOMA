import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, MapPin, Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import { TeamAssistantManager } from '../components/teams/TeamAssistantManager';
import { TeamLineupPitch } from '../components/teams/TeamLineupPitch';
import {
  addTeamPlayer,
  getTeam,
  getTeamAuthority,
  listManagedTeams,
  listMyTeams,
  listPublicTeamRoster,
  listTeamPlayerCandidates,
  listTeamRoster,
  removeTeamPlayer,
  teamQueryKeys,
  updateTeam,
  type TeamManagedAuthority,
  type TeamManagedItem,
} from '../features/teams/api';
import { notify } from '../lib/telegram';
import type { TeamDetailItem } from '../types/domain';

function hasCapability(
  authority: TeamManagedAuthority | null | undefined,
  capability: 'EDIT_TEAM' | 'MANAGE_ROSTER' | 'MANAGE_LINEUP',
) {
  if (!authority) return false;
  return (
    authority.role === 'COACH' ||
    authority.role === 'MANAGER' ||
    authority.permissions.includes(capability)
  );
}

function TeamEditForm({ team, onDone }: { team: TeamDetailItem; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(team.name);
  const [city, setCity] = useState(team.city ?? '');
  const [houma, setHouma] = useState(team.houma ?? '');
  const [badgeUrl, setBadgeUrl] = useState(team.badgeUrl ?? '');
  const [isPublic, setIsPublic] = useState(team.isPublic);
  const [acceptingChallenges, setAcceptingChallenges] = useState(team.acceptingChallenges);

  const mutation = useMutation({
    mutationFn: () =>
      updateTeam(team.id, {
        name: name.trim(),
        city: city.trim(),
        houma: houma.trim(),
        badgeUrl: badgeUrl.trim(),
        isPublic,
        acceptingChallenges,
      }),
    onSuccess: async (updated) => {
      queryClient.setQueryData(teamQueryKeys.detail(team.id), updated);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamQueryKeys.managed() }),
        queryClient.invalidateQueries({ queryKey: teamQueryKeys.mine() }),
        queryClient.invalidateQueries({ queryKey: teamQueryKeys.all }),
      ]);
      notify('success');
      onDone();
    },
    onError: () => notify('error'),
  });

  return (
    <section className="teams-section">
      <div className="vintage-kicker">Team management</div>
      <h2 className="section-title">Edit Team</h2>
      <div className="mt-4 grid gap-4">
        <label className="grid gap-2 text-[17px] font-semibold">
          Team name
          <input
            className="hooma-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="grid gap-2 text-[17px] font-semibold">
          Badge / photo URL
          <input
            className="hooma-input"
            type="url"
            value={badgeUrl}
            onChange={(event) => setBadgeUrl(event.target.value)}
            placeholder="https://example.com/team-badge.png"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-[17px] font-semibold">
            City
            <input
              className="hooma-input"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-[17px] font-semibold">
            Houma
            <input
              className="hooma-input"
              value={houma}
              onChange={(event) => setHouma(event.target.value)}
            />
          </label>
        </div>
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[17px] font-semibold">
          Public Team
          <input
            type="checkbox"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-[17px] font-semibold">
          Accept challenges
          <input
            type="checkbox"
            checked={acceptingChallenges}
            onChange={(event) => setAcceptingChallenges(event.target.checked)}
          />
        </label>
        {mutation.isError ? (
          <div className="vintage-empty">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Team changes could not be saved.'}
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="ghost-button"
            onClick={onDone}
            disabled={mutation.isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="accent-button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || name.trim().length < 2}
          >
            {mutation.isPending ? 'Saving…' : 'Save Team'}
          </button>
        </div>
      </div>
    </section>
  );
}

export function TeamProfilePage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addMode, setAddMode] = useState<'member' | 'guest'>('member');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [guestPlayerName, setGuestPlayerName] = useState('');

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
    | TeamManagedItem
    | undefined;
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
  const canEditTeam = hasCapability(authority, 'EDIT_TEAM');
  const canManageRoster = hasCapability(authority, 'MANAGE_ROSTER');
  const canManageLineup = hasCapability(authority, 'MANAGE_LINEUP');
  const canReadManagedRoster = canManageRoster || canManageLineup;
  const isCoach = authority?.role === 'COACH';
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
  const candidatesQuery = useQuery({
    queryKey: teamQueryKeys.rosterCandidates(teamId),
    queryFn: () => listTeamPlayerCandidates(teamId),
    enabled: Boolean(teamId) && canManageRoster && addingPlayer && addMode === 'member',
    retry: false,
  });
  const lineup = team?.lineups?.[0] ?? null;
  const managedRosterPlayers = rosterQuery.data?.items ?? [];
  const rosterPlayers = canReadManagedRoster
    ? managedRosterPlayers
    : memberTeam
      ? (memberTeam.players ?? [])
      : (publicRosterQuery.data?.items ?? []);
  const selectedCandidate = candidatesQuery.data?.items.find(
    (candidate) => candidate.userId === selectedCandidateId,
  );

  const refreshTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.roster(teamId) }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.publicRoster(teamId) }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.rosterCandidates(teamId) }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.managed() }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.mine() }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.detail(teamId) }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.all }),
    ]);
  };

  const addPlayerMutation = useMutation({
    mutationFn: (input: Parameters<typeof addTeamPlayer>[1]) => addTeamPlayer(teamId, input),
    onSuccess: async () => {
      setSelectedCandidateId('');
      setGuestPlayerName('');
      setAddingPlayer(false);
      await refreshTeam();
      notify('success');
    },
    onError: () => notify('error'),
  });

  const removePlayerMutation = useMutation({
    mutationFn: (teamPlayerId: string) => removeTeamPlayer(teamId, teamPlayerId),
    onSuccess: async () => {
      await refreshTeam();
      notify('success');
    },
    onError: () => notify('error'),
  });

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
        {canEditTeam ? (
          <button
            type="button"
            className="ghost-button shrink-0 px-3 py-2.5"
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil size={17} /> {editing ? 'Close' : 'Edit Team'}
          </button>
        ) : null}
      </section>

      {editing && managedTeam && canEditTeam ? (
        <TeamEditForm team={managedTeam} onDone={() => setEditing(false)} />
      ) : null}

      <section className="teams-section">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Lineup</div>
            <h2 className="section-title">Published shape</h2>
          </div>
          {canManageLineup ? (
            <button
              type="button"
              className="accent-button shrink-0 px-4"
              onClick={() => navigate(`/teams/${team.id}/lineup`)}
            >
              Build lineup
            </button>
          ) : team.acceptingChallenges && !authority && !isTeamPlayer ? (
            <button
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
          {canManageRoster ? (
            <button
              type="button"
              className="ghost-button shrink-0 px-3 py-2.5"
              onClick={() => {
                addPlayerMutation.reset();
                setAddingPlayer((value) => !value);
                setAddMode('member');
                setSelectedCandidateId('');
                setGuestPlayerName('');
              }}
            >
              <Plus size={17} /> {addingPlayer ? 'Close' : 'Add player'}
            </button>
          ) : null}
        </div>

        {addingPlayer && canManageRoster ? (
          <div className="mt-4 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={addMode === 'member' ? 'accent-button' : 'ghost-button'}
                onClick={() => {
                  addPlayerMutation.reset();
                  setAddMode('member');
                }}
              >
                HOOMA member
              </button>
              <button
                type="button"
                className={addMode === 'guest' ? 'accent-button' : 'ghost-button'}
                onClick={() => {
                  addPlayerMutation.reset();
                  setAddMode('guest');
                  setSelectedCandidateId('');
                }}
              >
                Guest player
              </button>
            </div>

            {addMode === 'member' ? (
              <div className="grid gap-3">
                <p className="text-sm leading-6 muted">
                  Select a real HOOMA member. Their canonical account and profile photo stay linked
                  to this Team roster.
                </p>
                {candidatesQuery.isLoading ? (
                  <div className="vintage-empty">Loading eligible HOOMA members…</div>
                ) : candidatesQuery.isError ? (
                  <div className="vintage-empty">
                    {candidatesQuery.error instanceof Error
                      ? candidatesQuery.error.message
                      : 'Eligible members could not be loaded.'}
                  </div>
                ) : candidatesQuery.data?.items.length ? (
                  <div className="grid gap-2">
                    {candidatesQuery.data.items.map((candidate) => (
                      <button
                        type="button"
                        key={candidate.userId}
                        className={`reference-row flex items-center gap-3 p-3 text-left ${
                          selectedCandidateId === candidate.userId
                            ? 'ring-1 ring-[var(--accent)]'
                            : ''
                        }`}
                        onClick={() => {
                          addPlayerMutation.reset();
                          setSelectedCandidateId(candidate.userId);
                        }}
                      >
                        <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10 font-black">
                          {candidate.photoUrl ? (
                            <img
                              className="h-full w-full object-cover"
                              src={candidate.photoUrl}
                              alt=""
                            />
                          ) : (
                            candidate.displayName.slice(0, 1).toUpperCase()
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate">{candidate.displayName}</strong>
                          <small className="muted">
                            {candidate.preferredPositions.length
                              ? candidate.preferredPositions.join(' · ')
                              : 'Any position'}
                          </small>
                        </span>
                        <span className="chip shrink-0">HOOMA</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="vintage-empty">
                    <strong>No unrostered HOOMA members.</strong>
                    <small>
                      Members who join the HOOMA appear here until the Coach adds them to the Team.
                    </small>
                  </div>
                )}
                <button
                  type="button"
                  className="accent-button"
                  disabled={addPlayerMutation.isPending || !selectedCandidate}
                  onClick={() => {
                    if (!selectedCandidate) return;
                    addPlayerMutation.mutate({
                      userId: selectedCandidate.userId,
                      displayName: selectedCandidate.displayName,
                    });
                  }}
                >
                  {addPlayerMutation.isPending ? 'Adding…' : 'Add selected player'}
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                <p className="text-sm leading-6 muted">
                  Guest players are not linked to a HOOMA account or public player profile.
                </p>
                <label className="grid gap-2 text-[17px] font-semibold">
                  Guest player name
                  <input
                    className="hooma-input"
                    value={guestPlayerName}
                    onChange={(event) => {
                      addPlayerMutation.reset();
                      setGuestPlayerName(event.target.value);
                    }}
                    placeholder="Player display name"
                  />
                </label>
                <button
                  type="button"
                  className="accent-button"
                  disabled={addPlayerMutation.isPending || !guestPlayerName.trim()}
                  onClick={() => addPlayerMutation.mutate({ displayName: guestPlayerName.trim() })}
                >
                  {addPlayerMutation.isPending ? 'Adding…' : 'Add guest player'}
                </button>
              </div>
            )}

            {addPlayerMutation.isError ? (
              <div className="vintage-empty">
                {addPlayerMutation.error instanceof Error
                  ? addPlayerMutation.error.message
                  : 'Player could not be added.'}
              </div>
            ) : null}
          </div>
        ) : null}

        {removePlayerMutation.isError ? (
          <div className="vintage-empty mt-4">
            {removePlayerMutation.error instanceof Error
              ? removePlayerMutation.error.message
              : 'Player could not be removed.'}
          </div>
        ) : null}

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
                {canManageRoster ? (
                  <button
                    type="button"
                    className="ghost-button ml-auto px-3 py-2"
                    disabled={removePlayerMutation.isPending}
                    onClick={() => {
                      removePlayerMutation.reset();
                      if (
                        window.confirm(
                          `Remove ${player.displayName} from the active Team roster? Current lineup slots and Assistant authority will be cleaned safely.`,
                        )
                      ) {
                        removePlayerMutation.mutate(player.id);
                      }
                    }}
                    aria-label={`Remove ${player.displayName}`}
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                ) : null}
              </article>
            ))
          ) : (
            <div className="vintage-empty">
              <strong>No active players.</strong>
            </div>
          )}
        </div>
      </section>

      <TeamAssistantManager
        teamId={teamId}
        rosterPlayers={managedRosterPlayers}
        enabled={isCoach}
      />

      <button className="vintage-outline-cta mt-5 w-full" onClick={() => navigate('/teams')}>
        Back to Teams <ChevronRight size={18} />
      </button>
    </div>
  );
}

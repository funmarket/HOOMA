import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight, MapPin, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TeamAssistantManager } from '../components/teams/TeamAssistantManager';
import {
  addTeamPlayer,
  getTeamAuthority,
  listManagedTeams,
  listMyTeams,
  listTeamPlayerCandidates,
  listTeamRoster,
  removeTeamPlayer,
  teamQueryKeys,
  updateTeam,
  type TeamDelegatedPermission,
  type TeamManagedAuthority,
} from '../features/teams/api';
import { notify } from '../lib/telegram';
import type { TeamDetailItem } from '../types/domain';

type EditableTeam = Pick<
  TeamDetailItem,
  'id' | 'name' | 'city' | 'houma' | 'badgeUrl' | 'isPublic' | 'acceptingChallenges'
>;

const CAPABILITIES: Array<{
  value: TeamDelegatedPermission;
  label: string;
  detail: string;
}> = [
  {
    value: 'EDIT_TEAM',
    label: 'Team settings',
    detail: 'Identity, visibility and challenge status.',
  },
  { value: 'MANAGE_ROSTER', label: 'Roster', detail: 'Add and remove active Team players.' },
  { value: 'MANAGE_LINEUP', label: 'Lineup', detail: 'Build, save and publish Team lineups.' },
  { value: 'CREATE_CHALLENGE', label: 'Send challenges', detail: 'Challenge another Team.' },
  {
    value: 'RESPOND_CHALLENGE',
    label: 'Respond',
    detail: 'Accept or decline incoming challenges.',
  },
  {
    value: 'MESSAGE_CHALLENGE',
    label: 'Challenge messages',
    detail: 'Use accepted challenge threads.',
  },
];

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

function TeamEditForm({ team }: { team: EditableTeam }) {
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
    },
    onError: () => notify('error'),
  });

  return (
    <section className="teams-section">
      <div className="vintage-kicker">Team identity</div>
      <h2 className="section-title">Team settings</h2>
      <p className="mt-1 text-sm muted">
        These settings belong to this Team only. They do not change HOOMA Platform Admin access.
      </p>
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
          <div className="vintage-empty" role="alert">
            {mutation.error instanceof Error
              ? mutation.error.message
              : 'Team changes could not be saved.'}
          </div>
        ) : null}
        <button
          type="button"
          className="accent-button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || name.trim().length < 2}
        >
          {mutation.isPending ? 'Saving…' : 'Save Team settings'}
        </button>
      </div>
    </section>
  );
}

export function TeamControlRoomPage() {
  const { teamId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
  const managedTeam = managedTeamsQuery.data?.items.find((item) => item.id === teamId);
  const memberTeam = myTeamsQuery.data?.items.find((item) => item.id === teamId);
  const authorityQuery = useQuery({
    queryKey: teamQueryKeys.authority(teamId),
    queryFn: () => getTeamAuthority(teamId),
    enabled: Boolean(teamId) && !managedTeam && Boolean(memberTeam),
    retry: false,
  });
  const team = managedTeam ?? memberTeam;
  const authority = managedTeam?.authority ?? authorityQuery.data ?? null;

  const canEditTeam = hasCapability(authority, 'EDIT_TEAM');
  const canManageRoster = hasCapability(authority, 'MANAGE_ROSTER');
  const canManageLineup = hasCapability(authority, 'MANAGE_LINEUP');
  const canCreateChallenge = hasCapability(authority, 'CREATE_CHALLENGE');
  const canRespondChallenge = hasCapability(authority, 'RESPOND_CHALLENGE');
  const canMessageChallenge = hasCapability(authority, 'MESSAGE_CHALLENGE');
  const canReadRoster = canManageRoster || canManageLineup || authority?.role === 'COACH';
  const isCoach = authority?.role === 'COACH';

  const rosterQuery = useQuery({
    queryKey: teamQueryKeys.roster(teamId),
    queryFn: () => listTeamRoster(teamId),
    enabled: Boolean(teamId) && canReadRoster,
    retry: false,
  });
  const candidatesQuery = useQuery({
    queryKey: teamQueryKeys.rosterCandidates(teamId),
    queryFn: () => listTeamPlayerCandidates(teamId),
    enabled: Boolean(teamId) && canManageRoster && addingPlayer && addMode === 'member',
    retry: false,
  });

  const rosterPlayers = rosterQuery.data?.items ?? [];
  const selectedCandidate = candidatesQuery.data?.items.find(
    (candidate) => candidate.userId === selectedCandidateId,
  );

  const refreshTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.roster(teamId) }),
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

  const loading =
    managedTeamsQuery.isLoading ||
    myTeamsQuery.isLoading ||
    (!managedTeam && Boolean(memberTeam) && authorityQuery.isLoading);

  if (loading) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty h-72 animate-pulse" />
      </div>
    );
  }

  if (!team || !authority) {
    return (
      <div className="page-shell vintage-page">
        <button
          type="button"
          className="ghost-button mb-4"
          onClick={() => navigate(`/teams/${teamId}`)}
        >
          <ArrowLeft size={16} /> Team
        </button>
        <div className="vintage-empty">
          <Shield size={22} />
          <strong>Team Control Room is not available for this account.</strong>
          <small>Team membership alone never grants management authority.</small>
        </div>
      </div>
    );
  }

  const enabledCapabilities = CAPABILITIES.filter((item) => hasCapability(authority, item.value));
  const hasMatchAuthority = canCreateChallenge || canRespondChallenge || canMessageChallenge;

  return (
    <div className="page-shell vintage-page">
      <button
        type="button"
        className="ghost-button mb-4"
        onClick={() => navigate(`/teams/${teamId}`)}
      >
        <ArrowLeft size={16} /> Team
      </button>

      <section className="team-profile-hero">
        <span className="team-profile-badge">
          {team.badgeUrl ? (
            <img src={team.badgeUrl} alt={`${team.name} badge`} />
          ) : (
            <Shield size={56} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="vintage-kicker">Team Control Room</div>
          <h1 className="team-profile-title">{team.name}</h1>
          <p className="team-profile-meta">
            <MapPin size={16} />{' '}
            {[team.city, team.houma].filter(Boolean).join(', ') || 'Location TBA'}
          </p>
          <p className="team-profile-meta">
            <Users size={16} /> {authority.role} authority
          </p>
        </div>
        <span className="chip shrink-0">{authority.role}</span>
      </section>

      <section className="teams-section">
        <div className="vintage-kicker">Canonical authority</div>
        <h2 className="section-title">What this account can control</h2>
        <p className="mt-1 text-sm muted">
          Coach and Manager retain full Team authority. Assistants receive only permissions
          delegated by the Coach.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {enabledCapabilities.map((capability) => (
            <article
              className="rounded-2xl border border-white/10 bg-white/5 p-3"
              key={capability.value}
            >
              <strong className="block">{capability.label}</strong>
              <small className="muted">{capability.detail}</small>
            </article>
          ))}
        </div>
      </section>

      {canEditTeam ? <TeamEditForm team={team} /> : null}

      {canManageLineup ? (
        <section className="teams-section">
          <div className="vintage-section-heading">
            <div>
              <div className="vintage-kicker">Matchday shape</div>
              <h2 className="section-title">Lineup control</h2>
            </div>
            <button
              type="button"
              className="accent-button shrink-0 px-4"
              onClick={() => navigate(`/teams/${teamId}/lineup`)}
            >
              Open builder
            </button>
          </div>
          <p className="mt-2 text-sm muted">
            The lineup builder remains the single Team lineup editor. Draft, publish and unpublish
            there.
          </p>
        </section>
      ) : null}

      {canManageRoster ? (
        <section className="teams-section">
          <div className="vintage-section-heading">
            <div>
              <div className="vintage-kicker">Football roster</div>
              <h2 className="section-title">Roster control</h2>
            </div>
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
          </div>

          {addingPlayer ? (
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
                    Select a real HOOMA member. Their canonical account and public player profile
                    remain linked.
                  </p>
                  {candidatesQuery.isLoading ? (
                    <div className="vintage-empty">Loading eligible HOOMA members…</div>
                  ) : candidatesQuery.isError ? (
                    <div className="vintage-empty" role="alert">
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
                    Guest players are roster-only entries and never receive a HOOMA account or
                    Assistant authority.
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
                    onClick={() =>
                      addPlayerMutation.mutate({ displayName: guestPlayerName.trim() })
                    }
                  >
                    {addPlayerMutation.isPending ? 'Adding…' : 'Add guest player'}
                  </button>
                </div>
              )}

              {addPlayerMutation.isError ? (
                <div className="vintage-empty" role="alert">
                  {addPlayerMutation.error instanceof Error
                    ? addPlayerMutation.error.message
                    : 'Player could not be added.'}
                </div>
              ) : null}
            </div>
          ) : null}

          {rosterQuery.isLoading ? (
            <div className="vintage-empty mt-4">Loading active roster…</div>
          ) : rosterQuery.isError ? (
            <div className="vintage-empty mt-4" role="alert">
              {rosterQuery.error instanceof Error
                ? rosterQuery.error.message
                : 'Active roster could not be loaded.'}
            </div>
          ) : rosterPlayers.length ? (
            <div className="mt-4 grid gap-2">
              {rosterPlayers.map((player) => (
                <article className="team-roster-row" key={player.id}>
                  <span>
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt="" />
                    ) : (
                      player.displayName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <strong>{player.displayName}</strong>
                  <small>
                    {player.position ?? 'ANY'}
                    {player.shirtNumber != null ? ` #${player.shirtNumber}` : ''}
                  </small>
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
                </article>
              ))}
            </div>
          ) : (
            <div className="vintage-empty mt-4">
              <strong>No active players.</strong>
            </div>
          )}

          {removePlayerMutation.isError ? (
            <div className="vintage-empty mt-4" role="alert">
              {removePlayerMutation.error instanceof Error
                ? removePlayerMutation.error.message
                : 'Player could not be removed.'}
            </div>
          ) : null}
        </section>
      ) : null}

      <TeamAssistantManager teamId={teamId} rosterPlayers={rosterPlayers} enabled={isCoach} />

      {hasMatchAuthority ? (
        <section className="teams-section">
          <div className="vintage-kicker">Match operations</div>
          <h2 className="section-title">Challenge desk</h2>
          <p className="mt-1 text-sm muted">
            Challenge requests, accepted games and challenge threads remain in the canonical Teams
            match flow.
          </p>
          <button
            type="button"
            className="vintage-outline-cta mt-4 w-full"
            onClick={() => navigate('/teams')}
          >
            Open Teams match desk <ChevronRight size={18} />
          </button>
        </section>
      ) : null}
    </div>
  );
}

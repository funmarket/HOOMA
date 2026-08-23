import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, MapPin, Pencil, Plus, Shield, Trash2, Users } from 'lucide-react';
import { TeamAssistantManager } from '../components/teams/TeamAssistantManager';
import { TeamLineupPitch } from '../components/teams/TeamLineupPitch';
import {
  addTeamPlayer,
  getTeam,
  listManagedTeams,
  listTeamRoster,
  removeTeamPlayer,
  teamQueryKeys,
  updateTeam,
} from '../features/teams/api';
import { notify } from '../lib/telegram';
import type { TeamDetailItem } from '../types/domain';

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
  const [playerName, setPlayerName] = useState('');

  const managedTeamsQuery = useQuery({
    queryKey: teamQueryKeys.managed(),
    queryFn: listManagedTeams,
    retry: false,
  });
  const managedTeam = managedTeamsQuery.data?.items.find((item) => item.id === teamId) as
    TeamDetailItem | undefined;
  const teamQuery = useQuery({
    queryKey: teamQueryKeys.detail(teamId),
    queryFn: () => getTeam(teamId),
    enabled: Boolean(teamId) && !managedTeamsQuery.isLoading && !managedTeam,
  });
  const team = managedTeam ?? teamQuery.data;
  const canManage = Boolean(managedTeam);
  const rosterQuery = useQuery({
    queryKey: teamQueryKeys.roster(teamId),
    queryFn: () => listTeamRoster(teamId),
    enabled: Boolean(teamId) && canManage,
    retry: false,
  });
  const lineup = team?.lineups?.[0] ?? null;
  const managedRosterPlayers = rosterQuery.data?.items ?? [];
  const rosterPlayers = canManage ? managedRosterPlayers : (team?.players ?? []);

  const refreshTeam = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.roster(teamId) }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.managed() }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.detail(teamId) }),
      queryClient.invalidateQueries({ queryKey: teamQueryKeys.all }),
    ]);
  };

  const addPlayerMutation = useMutation({
    mutationFn: () => addTeamPlayer(teamId, { displayName: playerName.trim() }),
    onSuccess: async () => {
      setPlayerName('');
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

  if (managedTeamsQuery.isLoading || (!managedTeam && teamQuery.isLoading)) {
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
          <div className="vintage-kicker">{canManage ? 'Your Team' : 'Public team'}</div>
          <h1 className="team-profile-title">{team.name}</h1>
          <p className="team-profile-meta">
            <MapPin size={16} />{' '}
            {[team.city, team.houma].filter(Boolean).join(', ') || 'Location TBA'}
          </p>
          <p className="team-profile-meta">
            <Users size={16} /> {team._count?.players ?? rosterPlayers.length} players
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="ghost-button shrink-0 px-3 py-2.5"
            onClick={() => setEditing((value) => !value)}
          >
            <Pencil size={17} /> {editing ? 'Close' : 'Edit Team'}
          </button>
        ) : null}
      </section>

      {editing && canManage ? <TeamEditForm team={team} onDone={() => setEditing(false)} /> : null}

      <section className="teams-section">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Lineup</div>
            <h2 className="section-title">Published shape</h2>
          </div>
          {team.acceptingChallenges && !canManage ? (
            <button
              className="accent-button shrink-0 px-4"
              onClick={() => navigate(`/teams/${team.id}/challenge`)}
            >
              Challenge
            </button>
          ) : null}
        </div>
        <TeamLineupPitch teamName={team.name} lineup={lineup} />
      </section>

      <section className="teams-section">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Roster</div>
            <h2 className="section-title">Players</h2>
          </div>
          {canManage ? (
            <button
              type="button"
              className="ghost-button shrink-0 px-3 py-2.5"
              onClick={() => {
                addPlayerMutation.reset();
                setAddingPlayer((value) => !value);
              }}
            >
              <Plus size={17} /> {addingPlayer ? 'Close' : 'Add player'}
            </button>
          ) : null}
        </div>

        {addingPlayer && canManage ? (
          <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="grid gap-2 text-[17px] font-semibold">
              Player name
              <input
                className="hooma-input"
                value={playerName}
                onChange={(event) => {
                  addPlayerMutation.reset();
                  setPlayerName(event.target.value);
                }}
                placeholder="Player display name"
              />
            </label>
            <p className="text-sm muted">
              This creates a guest roster entry. Existing HOOMA-account linking stays server-backed
              and will use the canonical player selector rather than exposing internal user IDs.
            </p>
            {addPlayerMutation.isError ? (
              <div className="vintage-empty">
                {addPlayerMutation.error instanceof Error
                  ? addPlayerMutation.error.message
                  : 'Player could not be added.'}
              </div>
            ) : null}
            <button
              type="button"
              className="accent-button"
              disabled={addPlayerMutation.isPending || !playerName.trim()}
              onClick={() => addPlayerMutation.mutate()}
            >
              {addPlayerMutation.isPending ? 'Adding…' : 'Add to roster'}
            </button>
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
          {canManage && rosterQuery.isLoading ? (
            <div className="vintage-empty">Loading active roster…</div>
          ) : rosterPlayers.length ? (
            rosterPlayers.map((player) => (
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
                {canManage ? (
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

      <TeamAssistantManager teamId={teamId} rosterPlayers={managedRosterPlayers} enabled={canManage} />

      <button className="vintage-outline-cta mt-5 w-full" onClick={() => navigate('/teams')}>
        Back to Teams <ChevronRight size={18} />
      </button>
    </div>
  );
}

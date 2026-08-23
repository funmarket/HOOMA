import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, MapPin, Pencil, Shield, Users } from 'lucide-react';
import { TeamLineupPitch } from '../components/teams/TeamLineupPitch';
import { getTeam, listManagedTeams, teamQueryKeys, updateTeam } from '../features/teams/api';
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
  const [searchParams] = useSearchParams();
  const [editing, setEditing] = useState(searchParams.get('edit') === '1');
  const managedTeamsQuery = useQuery({
    queryKey: teamQueryKeys.managed(),
    queryFn: listManagedTeams,
    retry: false,
  });
  const managedTeam = managedTeamsQuery.data?.items.find((item) => item.id === teamId) as
    | TeamDetailItem
    | undefined;
  const teamQuery = useQuery({
    queryKey: teamQueryKeys.detail(teamId),
    queryFn: () => getTeam(teamId),
    enabled: Boolean(teamId) && !managedTeamsQuery.isLoading && !managedTeam,
  });
  const team = managedTeam ?? teamQuery.data;
  const lineup = team?.lineups?.[0] ?? null;
  const canManage = Boolean(managedTeam);

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
            <Users size={16} /> {team._count?.players ?? team.players?.length ?? 0} players
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
        <div className="vintage-kicker">Roster</div>
        <h2 className="section-title">Players</h2>
        <div className="mt-4 grid gap-2">
          {team.players?.length ? (
            team.players.map((player) => (
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
              </article>
            ))
          ) : (
            <div className="vintage-empty">
              <strong>No roster published.</strong>
            </div>
          )}
        </div>
      </section>

      <button className="vintage-outline-cta mt-5 w-full" onClick={() => navigate('/teams')}>
        Back to Teams <ChevronRight size={18} />
      </button>
    </div>
  );
}

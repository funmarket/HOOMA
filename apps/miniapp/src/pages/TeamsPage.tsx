import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Shield, SlidersHorizontal } from 'lucide-react';
import { TeamsHero } from '../components/teams/TeamsHero';
import { TeamDiscoveryCard } from '../components/teams/TeamDiscoveryCard';
import { UpcomingGameCard } from '../components/teams/UpcomingGameCard';
import {
  acceptTeamChallenge,
  declineTeamChallenge,
  listIncomingChallenges,
  listMyTeams,
  listOutgoingChallenges,
  listTeamGames,
  listTeams,
  teamQueryKeys,
} from '../features/teams/api';
import { UsersIcon } from '../icons/UsersIcon';
import { BellIcon } from '../icons/BellIcon';
import { CalendarIcon } from '../icons/CalendarIcon';
import { BallIcon } from '../icons/BallIcon';
import { ChevronDownIcon } from '../icons/ChevronDownIcon';
import { RequestFlagIcon } from '../icons/RequestFlagIcon';
import { eventDate } from '../lib/format';
import type { TeamChallengeItem } from '../types/domain';

type TeamsTab = 'discover' | 'mine' | 'requests' | 'games';
type RequestMode = 'incoming' | 'outgoing';

const tabs = [
  { id: 'discover' as const, label: 'Discover', icon: UsersIcon },
  { id: 'mine' as const, label: 'My Team', icon: Shield },
  { id: 'requests' as const, label: 'Requests', icon: BellIcon },
  { id: 'games' as const, label: 'Games', icon: CalendarIcon },
];

function ChallengeRow({
  challenge,
  onAccept,
  onDecline,
  onOpen,
  busy,
}: {
  challenge: TeamChallengeItem;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onOpen: (id: string) => void;
  busy: boolean;
}) {
  return (
    <article className="challenge-card">
      <button className="team-request-open" type="button" onClick={() => onOpen(challenge.id)}>
        <div className="min-w-0">
          <div className="vintage-kicker">Challenge request</div>
          <h3>
            {challenge.challengerTeam.name} vs {challenge.challengedTeam.name}
          </h3>
          <p>
            {challenge.proposedStartsAt ? eventDate(challenge.proposedStartsAt) : 'Scheduling TBA'}
            {challenge.proposedVenue ? ` · ${challenge.proposedVenue}` : ''}
          </p>
        </div>
        <span className="chip shrink-0">{challenge.status}</span>
      </button>
      {challenge.message && <p className="mt-3 text-sm leading-6 muted">{challenge.message}</p>}
      {challenge.status === 'PENDING' && (
        <div className="challenge-actions">
          <button
            className="accent-button py-2.5"
            disabled={busy}
            onClick={() => onAccept(challenge.id)}
          >
            Accept
          </button>
          <button
            className="ghost-button py-2.5"
            disabled={busy}
            onClick={() => onDecline(challenge.id)}
          >
            Decline
          </button>
        </div>
      )}
    </article>
  );
}

export function TeamsPage() {
  const [activeTab, setActiveTab] = useState<TeamsTab>('discover');
  const [requestMode, setRequestMode] = useState<RequestMode>('incoming');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [houma, setHouma] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const filters = { search, city, houma };

  const teams = useQuery({
    queryKey: teamQueryKeys.list(filters),
    queryFn: () => listTeams(filters),
  });
  const myTeams = useQuery({
    queryKey: teamQueryKeys.mine(),
    queryFn: listMyTeams,
    retry: false,
  });
  const incoming = useQuery({
    queryKey: teamQueryKeys.incomingChallenges(),
    queryFn: listIncomingChallenges,
  });
  const outgoing = useQuery({
    queryKey: teamQueryKeys.outgoingChallenges(),
    queryFn: listOutgoingChallenges,
  });
  const games = useQuery({
    queryKey: teamQueryKeys.games(),
    queryFn: listTeamGames,
  });
  const accept = useMutation({
    mutationFn: acceptTeamChallenge,
    onSuccess: async (challenge) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: teamQueryKeys.challenges() }),
        queryClient.invalidateQueries({ queryKey: teamQueryKeys.games() }),
      ]);
      if (challenge.game?.id) navigate(`/teams/games/${challenge.game.id}`);
    },
  });
  const decline = useMutation({
    mutationFn: declineTeamChallenge,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: teamQueryKeys.challenges() });
    },
  });
  const visibleRequests = requestMode === 'incoming' ? incoming.data?.items : outgoing.data?.items;
  const requestBusy = accept.isPending || decline.isPending;

  return (
    <div className="page-shell vintage-page teams-page">
      <TeamsHero />
      <nav className="teams-tabs" aria-label="Teams sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`teams-tab ${activeTab === id ? 'teams-tab-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={20} />
            {label}
            {id === 'requests' && incoming.data?.items.length ? (
              <span className="chip py-1 text-[10px]">{incoming.data.items.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {activeTab === 'discover' && (
        <section className="teams-section">
          <div className="vintage-section-heading">
            <div>
              <h2 className="section-title">Discover teams</h2>
              <p className="mt-1 text-sm muted">Browse public teams from across communities.</p>
            </div>
            <button type="button" className="ghost-button shrink-0 px-3 py-2.5">
              <BallIcon size={17} /> All communities <ChevronDownIcon size={16} />
            </button>
          </div>
          <div className="teams-filter-bar">
            <label className="teams-search-field">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search teams, city or houma"
              />
            </label>
            <label>
              <span>City</span>
              <input
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Any city"
              />
            </label>
            <label>
              <span>Houma</span>
              <input
                value={houma}
                onChange={(event) => setHouma(event.target.value)}
                placeholder="Any houma"
              />
            </label>
            <button type="button" className="teams-filter-icon" aria-label="Filters">
              <SlidersHorizontal size={18} />
            </button>
          </div>
          {teams.isLoading ? (
            <div className="vintage-empty">Loading teams...</div>
          ) : teams.isError ? (
            <div className="vintage-empty">Teams could not load.</div>
          ) : teams.data?.items.length ? (
            <div className="grid gap-3">
              {teams.data.items.map((team) => (
                <TeamDiscoveryCard
                  key={team.id}
                  name={team.name}
                  badgeUrl={team.badgeUrl}
                  city={team.city}
                  houma={team.houma}
                  playerCount={team._count?.players ?? 0}
                  formation={team.lineups?.[0]?.formation}
                  players={team.players ?? []}
                  isPublic={team.isPublic}
                  acceptingChallenges={team.acceptingChallenges}
                  onViewLineup={() => navigate(`/teams/${team.id}`)}
                  onChallenge={
                    team.acceptingChallenges
                      ? () => navigate(`/teams/${team.id}/challenge`)
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <div className="vintage-empty">
              <strong>No public teams found.</strong>
              <small>Try a different search, city, or houma.</small>
            </div>
          )}
        </section>
      )}

      {activeTab === 'mine' && (
        <section className="teams-section">
          <div className="vintage-kicker">Player access</div>
          <h2 className="section-title">My Team / Team HQ</h2>
          <p className="mt-1 text-sm muted">
            Teams where your HOOMA account is on the active football roster.
          </p>
          <div className="mt-4 grid gap-3">
            {myTeams.isLoading ? (
              <div className="vintage-empty">Loading your Teams…</div>
            ) : myTeams.isError ? (
              <div className="vintage-empty">Your Team access could not be loaded.</div>
            ) : myTeams.data?.items.length ? (
              myTeams.data.items.map((team) => (
                <TeamDiscoveryCard
                  key={team.id}
                  name={team.name}
                  badgeUrl={team.badgeUrl}
                  city={team.city}
                  houma={team.houma}
                  playerCount={team._count?.players ?? team.players?.length ?? 0}
                  formation={team.lineups?.[0]?.formation}
                  players={team.players ?? []}
                  isPublic={team.isPublic}
                  acceptingChallenges={team.acceptingChallenges}
                  onViewLineup={() => navigate(`/teams/${team.id}`)}
                />
              ))
            ) : (
              <div className="vintage-empty">
                <strong>No active Team roster yet.</strong>
                <small>
                  Once a Coach adds your HOOMA account as a Team player, it appears here.
                </small>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'requests' && (
        <section className="teams-section">
          <div className="vintage-kicker">Challenges</div>
          <h2 className="section-title">Game requests</h2>
          <p className="mt-1 text-sm muted">Incoming and outgoing team challenges for Coaches.</p>
          <div className="team-request-toggle">
            <button
              className={requestMode === 'incoming' ? 'active' : ''}
              onClick={() => setRequestMode('incoming')}
            >
              Incoming
            </button>
            <button
              className={requestMode === 'outgoing' ? 'active' : ''}
              onClick={() => setRequestMode('outgoing')}
            >
              Outgoing
            </button>
          </div>
          <div className="mt-4 grid gap-3">
            {visibleRequests?.length ? (
              visibleRequests.map((challenge) => (
                <ChallengeRow
                  key={challenge.id}
                  challenge={challenge}
                  onAccept={(id) => accept.mutate(id)}
                  onDecline={(id) => decline.mutate(id)}
                  onOpen={(id) => navigate(`/teams/challenges/${id}`)}
                  busy={requestBusy}
                />
              ))
            ) : (
              <div className="vintage-empty">
                <RequestFlagIcon className="mb-3 h-7 w-7" />
                <strong>No {requestMode} challenge requests.</strong>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'games' && (
        <section className="teams-section">
          <div className="vintage-kicker">Accepted challenges</div>
          <h2 className="section-title">Upcoming games</h2>
          <p className="mt-1 text-sm muted">Your accepted team matches.</p>
          <div className="game-strip mt-4">
            {games.data?.items.length ? (
              games.data.items.map((game) => (
                <UpcomingGameCard
                  key={game.id}
                  homeName={game.homeTeam.name}
                  awayName={game.awayTeam.name}
                  homeBadgeUrl={game.homeTeam.badgeUrl}
                  awayBadgeUrl={game.awayTeam.badgeUrl}
                  dateLabel={game.scheduledAt ? eventDate(game.scheduledAt) : 'Scheduling TBA'}
                  status={game.status}
                  onClick={() => navigate(`/teams/games/${game.id}`)}
                />
              ))
            ) : (
              <div className="vintage-empty min-w-full">
                <strong>No upcoming games yet.</strong>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

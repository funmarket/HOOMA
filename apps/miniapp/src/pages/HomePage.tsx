import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MatchDayHero } from '../components/hero/MatchDayHero';
import { HomeEventTicketCard } from '../components/home/HomeEventTicketCard';
import { HoomaNowFeed } from '../components/home/HoomaNowFeed';
import { QuickActionCard } from '../components/home/QuickActionCard';
import hoomaActionArtwork from '../assets/quick-actions/hooma.png';
import teamsActionArtwork from '../assets/quick-actions/teams.png';
import ultrasActionArtwork from '../assets/quick-actions/ultras.png';
import gamersActionArtwork from '../assets/quick-actions/gamers.png';
import placesActionArtwork from '../assets/quick-actions/places.png';
import requestsActionArtwork from '../assets/quick-actions/requests.png';
import rideActionArtwork from '../assets/quick-actions/ride.png';
import fundmeActionArtwork from '../assets/quick-actions/fundme.png';
import { get } from '../shared/api/http-client';
import { useCommunity } from '../providers/CommunityProvider';
import type {
  CursorPage,
  EventItem,
  FundPage,
  RequestPage,
  RideListResponse,
} from '../types/domain';

function dateParts(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function eventTeams(event: EventItem, fallbackName?: string) {
  if (event.type === 'WATCH') {
    const home = event.watchDetails?.homeClub;
    const away = event.watchDetails?.awayClub;
    return {
      homeTeamName: home?.name || fallbackName || 'Home',
      awayTeamName: away?.name || 'Away',
      homeTeamLogoUrl: home?.logoUrl,
      awayTeamLogoUrl: away?.logoUrl,
    };
  }

  return {
    homeTeamName: fallbackName || 'HOOMA',
    awayTeamName: event.playDetails?.format?.replaceAll('_', ' ') || 'Open Match',
    homeTeamLogoUrl: undefined,
    awayTeamLogoUrl: undefined,
  };
}

function nextUpcomingEvent(items: EventItem[]) {
  const now = Date.now();
  return [...items]
    .filter((event) => new Date(event.startsAt).getTime() >= now)
    .sort(
      (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
    )[0];
}

export function HomePage() {
  const navigate = useNavigate();
  const { active } = useCommunity();
  const id = active?.id;
  const events = useQuery({
    queryKey: ['events', id],
    queryFn: () => get<CursorPage<EventItem>>(`/api/v1/events?communityId=${id}`),
    enabled: !!id,
  });
  const requests = useQuery({
    queryKey: ['requests', id],
    queryFn: () => get<RequestPage>(`/api/v1/requests?communityId=${id}`),
    enabled: !!id,
  });
  const rides = useQuery({
    queryKey: ['rides', id],
    queryFn: () => get<RideListResponse>(`/api/v1/rides?communityId=${id}`),
    enabled: !!id,
  });
  const funds = useQuery({
    queryKey: ['funds', id],
    queryFn: () => get<FundPage>(`/api/v1/fundraisers?communityId=${id}`),
    enabled: !!id,
  });
  const rideCount = (rides.data?.offers.length || 0) + (rides.data?.requests.length || 0);
  const nextEvent = nextUpcomingEvent(events.data?.items ?? []);
  const hoomaNowHasData =
    (events.data?.items.length ?? 0) > 0 ||
    (requests.data?.items.length ?? 0) > 0 ||
    (rides.data?.offers.length ?? 0) > 0 ||
    (rides.data?.requests.length ?? 0) > 0 ||
    (funds.data?.items.length ?? 0) > 0;
  const hoomaNowLoading =
    !hoomaNowHasData &&
    (events.isLoading || requests.isLoading || rides.isLoading || funds.isLoading);
  const hoomaNowHasError = events.isError || requests.isError || rides.isError || funds.isError;

  return (
    <div className="page-shell vintage-page">
      <MatchDayHero onCreateMatch={() => navigate('/events/new')} />

      <section className="vintage-home-section">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Next up</div>
            <h2 className="vintage-section-title">Events</h2>
          </div>
          <button type="button" className="vintage-text-button" onClick={() => navigate('/events')}>
            See all →
          </button>
        </div>
        {events.isLoading ? (
          <div className="vintage-empty">Loading events…</div>
        ) : events.isError ? (
          <div className="vintage-empty">Events could not be loaded.</div>
        ) : nextEvent ? (
          (() => {
            const parts = dateParts(nextEvent.startsAt);
            const teams = eventTeams(nextEvent, active?.name);
            return (
              <HomeEventTicketCard
                title={nextEvent.title}
                homeTeamName={teams.homeTeamName}
                awayTeamName={teams.awayTeamName}
                homeTeamLogoUrl={teams.homeTeamLogoUrl}
                awayTeamLogoUrl={teams.awayTeamLogoUrl}
                venueName={nextEvent.venueName || 'Venue TBA'}
                venueLocation={nextEvent.address || active?.name || 'Location TBA'}
                dateLabel={parts.date}
                timeLabel={parts.time}
                goingCount={nextEvent._count?.rsvps ?? 0}
                onClick={() => navigate(`/events/${nextEvent.id}`)}
              />
            );
          })()
        ) : (
          <button
            className="vintage-empty vintage-empty-action"
            onClick={() => navigate('/events/new')}
          >
            <span>
              <strong>No upcoming events yet.</strong>
              <small>Create the first match or watch meetup.</small>
            </span>
          </button>
        )}
      </section>

      <section className="vintage-home-section" aria-labelledby="home-quick-actions">
        <div id="home-quick-actions" className="vintage-kicker vintage-actions-kicker">
          Quick actions
        </div>
        <div className="vintage-home-grid">
          <QuickActionCard
            title="HOOMA"
            subtitle="Community"
            artworkSrc={hoomaActionArtwork}
            onClick={() => navigate('/community')}
          />
          <QuickActionCard
            title="Teams"
            subtitle="Manage squads"
            artworkSrc={teamsActionArtwork}
            onClick={() => navigate('/teams')}
          />
          <QuickActionCard
            title="Ultras"
            subtitle="Coming soon"
            artworkSrc={ultrasActionArtwork}
            disabled
          />
          <QuickActionCard
            title="Gamers"
            subtitle="Find opponents"
            artworkSrc={gamersActionArtwork}
            onClick={() => navigate('/gamers')}
          />
          <QuickActionCard
            title="Places"
            subtitle="Watch + Pitch"
            artworkSrc={placesActionArtwork}
            onClick={() => navigate('/places')}
          />
          <QuickActionCard
            title="Requests"
            subtitle={`${requests.data?.items.length ?? 0} open`}
            accentValue={String(requests.data?.items.length ?? 0)}
            artworkSrc={requestsActionArtwork}
            onClick={() => navigate('/requests')}
          />
          <QuickActionCard
            title="Ride"
            subtitle={`${rideCount} active`}
            accentValue={String(rideCount)}
            artworkSrc={rideActionArtwork}
            onClick={() => navigate('/rides')}
          />
          <QuickActionCard
            title="FundMe"
            subtitle={`${funds.data?.items.length ?? 0} active`}
            accentValue={String(funds.data?.items.length ?? 0)}
            artworkSrc={fundmeActionArtwork}
            onClick={() => navigate('/fundme')}
          />
        </div>
      </section>

      <HoomaNowFeed
        communityName={active?.name}
        events={events.data?.items ?? []}
        requests={requests.data?.items ?? []}
        rideOffers={rides.data?.offers ?? []}
        rideRequests={rides.data?.requests ?? []}
        funds={funds.data?.items ?? []}
        isLoading={hoomaNowLoading}
        hasError={hoomaNowHasError}
        onNavigate={navigate}
      />
    </div>
  );
}

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { WatchHero } from '../components/hero/WatchHero';
import { WatchCreateButton } from '../components/watch/WatchCreateButton';
import { WatchSearchControls } from '../components/watch/WatchSearchControls';
import { VintageCollectorTicket } from '../components/ticket/VintageCollectorTicket';
import { listWatchClubs, watchQueryKeys } from '../features/watch/api';
import { get } from '../shared/api/http-client';
import { useCommunity } from '../providers/CommunityProvider';
import { hoomaSourceLabel, proximityRankedEvents } from '../lib/hooma-proximity-feed';
import { watchEventMatchesFilters } from '../lib/watch-event-filters';
import { isOfficialWatchPlace, watchPlaceLocation } from '../lib/watch-place-display';
import type { HoomaNowResponse } from '../types/hooma-now';

function dateParts(value: string) {
  const date = new Date(value);
  return {
    date: date.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }),
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function WatchPage() {
  const { active } = useCommunity();
  const navigate = useNavigate();
  const [clubId, setClubId] = useState('');
  const [search, setSearch] = useState('');

  const clubs = useQuery({
    queryKey: watchQueryKeys.clubs(),
    queryFn: () => listWatchClubs(100),
  });
  const events = useQuery({
    queryKey: ['hooma-now', active?.id],
    queryFn: () => get<HoomaNowResponse>('/api/v1/communities/now'),
    enabled: Boolean(active),
  });
  const rankedEvents = proximityRankedEvents(
    events.data?.events ?? [],
    events.data?.communities ?? [],
    'WATCH',
  );
  const visibleEvents = rankedEvents.filter((event) =>
    watchEventMatchesFilters(event, { clubId, query: search }),
  );
  const communityById = new Map(
    (events.data?.communities ?? []).map((community) => [community.id, community] as const),
  );
  const hasError = clubs.isError || events.isError;

  return (
    <div className="page-shell vintage-page">
      <div className="grid gap-4">
        <WatchHero />
        <div className="watch-action-grid" aria-label="Watch actions">
          <WatchCreateButton
            label="Create Event"
            onClick={() => navigate('/events/new?type=WATCH')}
          />
          <WatchCreateButton
            label="Places"
            variant="secondary"
            onClick={() => navigate('/watch/places')}
          />
          <WatchCreateButton
            label="Add a Place"
            variant="secondary"
            onClick={() => navigate('/watch/places/new')}
          />
        </div>
        <WatchSearchControls
          search={search}
          onSearchChange={setSearch}
          clubId={clubId}
          clubs={(clubs.data ?? []).map((club) => ({ id: club.id, name: club.name }))}
          onClubChange={setClubId}
        />
        {hasError && (
          <div className="vintage-empty" role="alert">
            <strong>Watch data unavailable.</strong>
            <small>
              The page keeps the real server data contract and does not insert demo events.
            </small>
          </div>
        )}
        <section className="grid gap-3" aria-label="Watch events">
          {events.isLoading ? (
            <div className="vintage-empty">Loading collector tickets...</div>
          ) : visibleEvents.length ? (
            visibleEvents.map((event, index) => {
              const hub = event.watchDetails?.fanHub;
              const place = hub?.place;
              const officialVenue = isOfficialWatchPlace(place, hub);
              const home = event.watchDetails?.homeClub;
              const away = event.watchDetails?.awayClub;
              const parts = dateParts(event.startsAt);
              const source = communityById.get(event.communityId);
              const sourceLabel = hoomaSourceLabel(source, events.data?.activeCommunityId ?? null);
              return (
                <VintageCollectorTicket
                  key={event.id}
                  collectorNumber={index + 1}
                  matchTitle={event.title}
                  teamAName={home?.name || 'Home'}
                  teamBName={away?.name || 'Away'}
                  teamALogoUrl={home?.logoUrl}
                  teamBLogoUrl={away?.logoUrl}
                  venueName={place?.name || event.venueName || hub?.venueName || 'Venue TBA'}
                  venueLocation={
                    watchPlaceLocation(place) ||
                    place?.address ||
                    event.address ||
                    hub?.address ||
                    sourceLabel ||
                    'Location TBA'
                  }
                  dateLabel={parts.date}
                  timeLabel={parts.time}
                  goingCount={event._count?.rsvps ?? 0}
                  officialVenue={officialVenue}
                  suggestedByCommunity={Boolean(hub) && !officialVenue}
                  stubLabel={sourceLabel || event.community?.name || event.title}
                  venuePhotoUrl={place?.photoUrl}
                  onClick={() => navigate(`/events/${event.id}`)}
                />
              );
            })
          ) : (
            <div className="vintage-empty">
              <strong>No watch events yet.</strong>
              <small>New watch events across HOOMA will appear here.</small>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

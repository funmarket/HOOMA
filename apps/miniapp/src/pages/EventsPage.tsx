import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { EventCard } from '../components/EventCard';
import { proximityRankedEvents } from '../lib/hooma-proximity-feed';
import { useCommunity } from '../providers/CommunityProvider';
import { get } from '../shared/api/http-client';
import type { HoomaNowResponse } from '../types/hooma-now';

export function EventsPage() {
  const navigate = useNavigate();
  const { active, isLoading: communityIsLoading } = useCommunity();
  const query = useQuery({
    queryKey: ['hooma-now', active?.id],
    queryFn: () => get<HoomaNowResponse>('/api/v1/communities/now'),
    enabled: Boolean(active),
  });

  const events = proximityRankedEvents(query.data?.events ?? [], query.data?.communities ?? []);
  const playEvents = events.filter((event) => event.type === 'PLAY');
  const watchEvents = events.filter((event) => event.type === 'WATCH');

  if (communityIsLoading) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty">Loading events…</div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-kicker">Events</div>
        <h1 className="vintage-display">All events</h1>
        <div className="vintage-empty mt-5">
          <strong>No community selected.</strong>
          <small>Create or join a HOOMA community to establish your local starting point.</small>
          <button
            type="button"
            className="vintage-outline-cta mt-4"
            onClick={() => navigate('/community/new')}
          >
            Create or join
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-kicker">Events</div>
      <h1 className="vintage-display">All events</h1>
      <p className="vintage-copy mt-2 text-sm">
        {active.name} first, then nearby Play and Watch events across the wider HOOMA network.
      </p>

      {query.isLoading ? (
        <div className="vintage-empty mt-5">Loading events…</div>
      ) : query.isError ? (
        <div className="vintage-empty mt-5">Events could not be loaded.</div>
      ) : events.length ? (
        <div className="mt-5 grid gap-6">
          {playEvents.length ? (
            <section aria-labelledby="events-play-title" className="grid gap-3">
              <div className="vintage-section-heading">
                <div>
                  <div className="vintage-kicker">Pickup matches</div>
                  <h2 id="events-play-title" className="vintage-section-title">
                    Play
                  </h2>
                </div>
              </div>
              <div className="grid gap-3">
                {playEvents.map((event) => (
                  <EventCard key={event.id} event={event} variant="vintage" />
                ))}
              </div>
            </section>
          ) : null}

          {watchEvents.length ? (
            <section aria-labelledby="events-watch-title" className="grid gap-3">
              <div className="vintage-section-heading">
                <div>
                  <div className="vintage-kicker">Watch together</div>
                  <h2 id="events-watch-title" className="vintage-section-title">
                    Watch
                  </h2>
                </div>
              </div>
              <div className="grid gap-3">
                {watchEvents.map((event) => (
                  <EventCard key={event.id} event={event} variant="vintage" />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : (
        <div className="vintage-empty mt-5">
          <strong>No events yet.</strong>
          <small>New Play and Watch events across HOOMA will appear here.</small>
          <button
            type="button"
            className="vintage-outline-cta mt-4"
            onClick={() => navigate('/events/new')}
          >
            Create event
          </button>
        </div>
      )}
    </div>
  );
}

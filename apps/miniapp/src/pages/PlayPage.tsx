import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PlayHero } from '../components/hero/PlayHero';
import { PickupMatchCard } from '../components/play/PickupMatchCard';
import { WhistleBoard } from '../components/whistle/WhistleBoard';
import { UsersIcon } from '../icons/UsersIcon';
import { hoomaSourceLabel, proximityRankedEvents } from '../lib/hooma-proximity-feed';
import { useCommunity } from '../providers/CommunityProvider';
import { get } from '../shared/api/http-client';
import type { HoomaNowResponse } from '../types/hooma-now';

function dateLabel(value: string) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PlayPage() {
  const { active } = useCommunity();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['hooma-now', active?.id],
    queryFn: () => get<HoomaNowResponse>('/api/v1/communities/now'),
    enabled: Boolean(active),
  });
  const events = proximityRankedEvents(
    query.data?.events ?? [],
    query.data?.communities ?? [],
    'PLAY',
  );
  const communityById = new Map(
    (query.data?.communities ?? []).map((community) => [community.id, community] as const),
  );

  return (
    <div className="page-shell vintage-page">
      <PlayHero onCreateMatch={() => navigate('/events/new?type=PLAY')} />
      {active ? <WhistleBoard communityId={active.id} /> : null}
      <section className="vintage-home-section" aria-labelledby="players-looking-title">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Players</div>
            <h2 id="players-looking-title" className="vintage-section-title">
              Looking to play
            </h2>
          </div>
        </div>
        <div className="play-player-strip">
          <div className="vintage-empty play-player-empty">
            <div className="flex items-center gap-4">
              <span className="vintage-icon">
                <UsersIcon size={26} />
              </span>
              <div>
                <strong>Player listings will appear here.</strong>
                <small>
                  Only real player listings and explicitly published contact details render in this
                  feed.
                </small>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="vintage-home-section" aria-labelledby="open-matches-title">
        <div className="vintage-section-heading">
          <div>
            <div className="vintage-kicker">Open matches</div>
            <h2 id="open-matches-title" className="vintage-section-title">
              Pickup games
            </h2>
          </div>
          <UsersIcon size={22} />
        </div>
        {query.isLoading ? (
          <div className="vintage-empty">Loading matches…</div>
        ) : query.isError ? (
          <div className="vintage-empty">Matches could not be loaded.</div>
        ) : events.length ? (
          <div className="play-match-list">
            {events.map((event) => {
              const source = communityById.get(event.communityId);
              return (
                <PickupMatchCard
                  key={event.id}
                  title={event.title}
                  dateLabel={dateLabel(event.startsAt)}
                  venueName={event.venueName}
                  sourceLabel={hoomaSourceLabel(source, query.data?.activeCommunityId ?? null)}
                  goingCount={event._count?.rsvps ?? 0}
                  capacity={event.capacity}
                  format={event.playDetails?.format}
                  onClick={() => navigate(`/events/${event.id}`)}
                />
              );
            })}
          </div>
        ) : (
          <div className="vintage-empty">
            <strong>No open matches yet.</strong>
            <small>New pickup matches across HOOMA will appear here.</small>
          </div>
        )}
      </section>
    </div>
  );
}

import { ArrowUpRight, Car, Clock3, MapPin, Users } from 'lucide-react';
import { FundCupIcon } from '../../icons/FundCupIcon';
import { RequestFlagIcon } from '../../icons/RequestFlagIcon';
import { money } from '../../lib/format';
import type {
  EventItem,
  FundItem,
  RequestItem,
  RideOfferItem,
  RideRequestItem,
} from '../../types/domain';
import './HoomaNowFeed.css';

type HoomaNowFeedProps = {
  communityName?: string;
  events: EventItem[];
  requests: RequestItem[];
  rideOffers: RideOfferItem[];
  rideRequests: RideRequestItem[];
  funds: FundItem[];
  isLoading: boolean;
  hasError: boolean;
  onNavigate: (path: string) => void;
};

type FeedCard = {
  id: string;
  priority: number;
  sortAt: number;
  kicker: string;
  title: string;
  meta: string;
  detail?: string;
  action: string;
  path: string;
  tone: 'match' | 'watch' | 'request' | 'ride' | 'fund';
  progress?: number;
  icon: 'match' | 'request' | 'ride' | 'fund';
};

function timestamp(value: string) {
  return new Date(value).getTime();
}

function matchTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function compactTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function futureEvents(events: EventItem[], now: number) {
  return events
    .filter((event) => timestamp(event.startsAt) >= now)
    .sort((left, right) => timestamp(left.startsAt) - timestamp(right.startsAt));
}

function activeRequests(requests: RequestItem[], now: number) {
  return requests
    .filter((request) => timestamp(request.expiresAt) >= now)
    .sort((left, right) => timestamp(left.expiresAt) - timestamp(right.expiresAt));
}

function openSeats(ride: RideOfferItem) {
  const used = (ride.matches ?? [])
    .filter((match) => ['REQUESTED', 'ACCEPTED'].includes(match.status))
    .reduce((sum, match) => sum + match.seats, 0);
  return Math.max(0, ride.seatsTotal - used);
}

function fundProgress(fund: FundItem) {
  const goal = Number(fund.goalMinor);
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.min(100, Math.round((Number(fund.collectedMinor) / goal) * 100));
}

function buildCards({
  events,
  requests,
  rideOffers,
  rideRequests,
  funds,
}: Pick<
  HoomaNowFeedProps,
  'events' | 'requests' | 'rideOffers' | 'rideRequests' | 'funds'
>): FeedCard[] {
  const now = Date.now();
  const upcoming = futureEvents(events, now);
  const play = upcoming.find((event) => event.type === 'PLAY');
  const watch = upcoming.find((event) => event.type === 'WATCH');
  const request = activeRequests(requests, now)[0];
  const rideOffer = [...rideOffers]
    .filter((ride) => timestamp(ride.departureAt) >= now && openSeats(ride) > 0)
    .sort((left, right) => timestamp(left.departureAt) - timestamp(right.departureAt))[0];
  const rideRequest = [...rideRequests]
    .filter((ride) => timestamp(ride.desiredDepartureAt) >= now)
    .sort(
      (left, right) =>
        timestamp(left.desiredDepartureAt) - timestamp(right.desiredDepartureAt),
    )[0];
  const fund = [...funds]
    .filter((item) => item.status !== 'COMPLETED' && item.status !== 'CANCELLED')
    .sort((left, right) => fundProgress(right) - fundProgress(left))[0];

  const cards: FeedCard[] = [];

  if (play) {
    cards.push({
      id: `play-${play.id}`,
      priority: 10,
      sortAt: timestamp(play.startsAt),
      kicker: 'PLAY · NEXT MATCH',
      title: play.title,
      meta: `${matchTime(play.startsAt)} · ${play._count?.rsvps ?? 0}${play.capacity ? `/${play.capacity}` : ''} going`,
      detail: play.venueName || play.address || undefined,
      action: 'Open match',
      path: `/events/${play.id}`,
      tone: 'match',
      icon: 'match',
    });
  }

  if (watch) {
    const home = watch.watchDetails?.homeClub?.name;
    const away = watch.watchDetails?.awayClub?.name;
    cards.push({
      id: `watch-${watch.id}`,
      priority: 20,
      sortAt: timestamp(watch.startsAt),
      kicker: 'WATCH · MATCHDAY',
      title: home && away ? `${home} vs ${away}` : watch.title,
      meta: `${matchTime(watch.startsAt)} · ${watch._count?.rsvps ?? 0} going`,
      detail:
        watch.watchDetails?.fanHub?.place?.name ||
        watch.venueName ||
        watch.watchDetails?.fanHub?.venueName ||
        undefined,
      action: 'View watch event',
      path: `/events/${watch.id}`,
      tone: 'watch',
      icon: 'match',
    });
  }

  if (request) {
    const claimed = (request.claims ?? [])
      .filter((claim) => claim.status !== 'WITHDRAWN')
      .reduce((sum, claim) => sum + claim.quantity, 0);
    cards.push({
      id: `request-${request.id}`,
      priority: 5,
      sortAt: timestamp(request.expiresAt),
      kicker: 'COMMUNITY NEEDS YOU',
      title: request.title,
      meta: `${claimed}/${request.quantity} claimed · closes ${compactTime(request.expiresAt)}`,
      detail: request.event?.title || request.details || undefined,
      action: 'Help out',
      path: '/requests',
      tone: 'request',
      icon: 'request',
    });
  }

  if (rideOffer) {
    const seats = openSeats(rideOffer);
    cards.push({
      id: `ride-offer-${rideOffer.id}`,
      priority: 15,
      sortAt: timestamp(rideOffer.departureAt),
      kicker: 'GET THERE · RIDE',
      title: `${seats} seat${seats === 1 ? '' : 's'} available`,
      meta: `${compactTime(rideOffer.departureAt)} · ${rideOffer.originLabel} → ${rideOffer.destinationLabel}`,
      detail:
        rideOffer.costSplitMode === 'FREE'
          ? 'Free ride'
          : `${money(rideOffer.seatPriceMinor, rideOffer.currency)} / seat`,
      action: 'View ride',
      path: `/rides/${rideOffer.id}`,
      tone: 'ride',
      icon: 'ride',
    });
  } else if (rideRequest) {
    cards.push({
      id: `ride-request-${rideRequest.id}`,
      priority: 16,
      sortAt: timestamp(rideRequest.desiredDepartureAt),
      kicker: 'RIDE NEEDED',
      title: rideRequest.title,
      meta: `${compactTime(rideRequest.desiredDepartureAt)} · ${rideRequest.seatsNeeded} seat${rideRequest.seatsNeeded === 1 ? '' : 's'} needed`,
      detail: rideRequest.pickupLabel,
      action: 'Open rides',
      path: '/rides',
      tone: 'ride',
      icon: 'ride',
    });
  }

  if (fund) {
    const progress = fundProgress(fund);
    cards.push({
      id: `fund-${fund.id}`,
      priority: 40,
      sortAt: fund.deadline ? timestamp(fund.deadline) : Number.MAX_SAFE_INTEGER,
      kicker: `FUNDME · ${fund.purpose.replaceAll('_', ' ')}`,
      title: fund.title,
      meta: `${money(fund.collectedMinor, fund.currency)} of ${money(fund.goalMinor, fund.currency)} · ${progress}%`,
      detail: fund.event?.title ? `For ${fund.event.title}` : fund.description || undefined,
      action: 'See fundraiser',
      path: `/fundme/${fund.id}`,
      tone: 'fund',
      progress,
      icon: 'fund',
    });
  }

  return cards
    .sort((left, right) => {
      const urgentWindow = 6 * 60 * 60 * 1000;
      const leftUrgent = left.sortAt - now <= urgentWindow ? 0 : left.priority;
      const rightUrgent = right.sortAt - now <= urgentWindow ? 0 : right.priority;
      if (leftUrgent !== rightUrgent) return leftUrgent - rightUrgent;
      return left.sortAt - right.sortAt;
    })
    .slice(0, 5);
}

function FeedIcon({ icon }: Pick<FeedCard, 'icon'>) {
  if (icon === 'request') return <RequestFlagIcon className="h-5 w-5" />;
  if (icon === 'ride') return <Car size={20} />;
  if (icon === 'fund') return <FundCupIcon className="h-5 w-5" />;
  return <Users size={20} />;
}

export function HoomaNowFeed(props: HoomaNowFeedProps) {
  const cards = buildCards(props);

  return (
    <section className="hooma-now" aria-labelledby="hooma-now-title">
      <header className="hooma-now-header">
        <div>
          <div className="hooma-now-eyebrow">LIVE FROM YOUR FOOTBALL WORLD</div>
          <h2 id="hooma-now-title">HOOMA NOW</h2>
          <p>{props.communityName ? `What's moving in ${props.communityName}.` : 'What matters next.'}</p>
        </div>
        <span className="hooma-now-live" aria-label="Live">
          <i /> LIVE
        </span>
      </header>

      {props.isLoading ? (
        <div className="hooma-now-empty">Building your matchday board…</div>
      ) : cards.length ? (
        <div className="hooma-now-stack">
          {cards.map((card, index) => (
            <button
              key={card.id}
              type="button"
              className={`hooma-now-card hooma-now-card-${card.tone}`}
              onClick={() => props.onNavigate(card.path)}
            >
              <span className="hooma-now-rank">{String(index + 1).padStart(2, '0')}</span>
              <span className="hooma-now-icon">
                <FeedIcon icon={card.icon} />
              </span>
              <span className="hooma-now-copy">
                <span className="hooma-now-kicker">{card.kicker}</span>
                <strong>{card.title}</strong>
                <span className="hooma-now-meta">
                  <Clock3 size={13} /> {card.meta}
                </span>
                {card.detail ? (
                  <span className="hooma-now-detail">
                    <MapPin size={13} /> {card.detail}
                  </span>
                ) : null}
                {typeof card.progress === 'number' ? (
                  <span className="hooma-now-progress" aria-label={`${card.progress}% funded`}>
                    <span style={{ width: `${card.progress}%` }} />
                  </span>
                ) : null}
              </span>
              <span className="hooma-now-action">
                {card.action} <ArrowUpRight size={15} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="hooma-now-empty">
          <strong>The board is quiet.</strong>
          <span>
            Real matches, watch events, requests, rides and fundraisers will surface here as they
            become active.
          </span>
        </div>
      )}

      {props.hasError ? (
        <p className="hooma-now-warning">Some live sources could not be refreshed.</p>
      ) : null}
    </section>
  );
}

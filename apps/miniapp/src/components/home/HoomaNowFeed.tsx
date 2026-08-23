import { ArrowUpRight, Car, Clock3, MapPin, Users } from 'lucide-react';
import { FundCupIcon } from '../../icons/FundCupIcon';
import { RequestFlagIcon } from '../../icons/RequestFlagIcon';
import { money } from '../../lib/format';
import type {
  HoomaNowCommunity,
  HoomaNowEvent,
  HoomaNowFund,
  HoomaNowRequest,
  HoomaNowRideOffer,
  HoomaNowRideRequest,
} from '../../types/hooma-now';
import './HoomaNowFeed.css';

type HoomaNowFeedProps = {
  communityName: string | undefined;
  communities: HoomaNowCommunity[];
  events: HoomaNowEvent[];
  requests: HoomaNowRequest[];
  rideOffers: HoomaNowRideOffer[];
  rideRequests: HoomaNowRideRequest[];
  funds: HoomaNowFund[];
  isLoading: boolean;
  hasError: boolean;
  onNavigate: (path: string) => void;
};

type FeedCard = {
  id: string;
  communityId: string;
  communityName: string;
  communityRank: number;
  distanceKm: number | null;
  priority: number;
  sortAt: number;
  kicker: string;
  title: string;
  meta: string;
  detail: string | undefined;
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

function claimedQuantity(request: HoomaNowRequest) {
  return (request.claims ?? [])
    .filter((claim) => claim.status !== 'WITHDRAWN')
    .reduce((sum, claim) => sum + claim.quantity, 0);
}

function openSeats(ride: HoomaNowRideOffer) {
  const used = (ride.matches ?? [])
    .filter((match) => ['REQUESTED', 'ACCEPTED'].includes(match.status))
    .reduce((sum, match) => sum + match.seats, 0);
  return Math.max(0, ride.seatsTotal - used);
}

function fundProgress(fund: HoomaNowFund) {
  const goal = Number(fund.goalMinor);
  if (!Number.isFinite(goal) || goal <= 0) return 0;
  return Math.min(100, Math.round((Number(fund.collectedMinor) / goal) * 100));
}

function buildCards(props: HoomaNowFeedProps): FeedCard[] {
  const now = Date.now();
  const communityById = new Map(props.communities.map((community) => [community.id, community]));
  const cards: FeedCard[] = [];

  const source = (communityId: string, fallbackName?: string) => {
    const community = communityById.get(communityId);
    return {
      communityId,
      communityName: community?.name ?? fallbackName ?? 'HOOMA',
      communityRank: community?.rank ?? Number.MAX_SAFE_INTEGER,
      distanceKm: community?.distanceKm ?? null,
    };
  };

  for (const event of props.events) {
    if (timestamp(event.startsAt) < now) continue;
    const common = source(event.communityId, event.community?.name);
    if (event.type === 'PLAY') {
      cards.push({
        id: `play-${event.id}`,
        ...common,
        priority: 10,
        sortAt: timestamp(event.startsAt),
        kicker: 'PLAY · NEXT MATCH',
        title: event.title,
        meta: `${matchTime(event.startsAt)} · ${event._count?.rsvps ?? 0}${event.capacity ? `/${event.capacity}` : ''} going`,
        detail: event.venueName || event.address || undefined,
        action: 'Open match',
        path: `/events/${event.id}`,
        tone: 'match',
        icon: 'match',
      });
      continue;
    }

    const home = event.watchDetails?.homeClub?.name;
    const away = event.watchDetails?.awayClub?.name;
    cards.push({
      id: `watch-${event.id}`,
      ...common,
      priority: 20,
      sortAt: timestamp(event.startsAt),
      kicker: 'WATCH · MATCHDAY',
      title: home && away ? `${home} vs ${away}` : event.title,
      meta: `${matchTime(event.startsAt)} · ${event._count?.rsvps ?? 0} going`,
      detail:
        event.watchDetails?.fanHub?.place?.name ||
        event.venueName ||
        event.watchDetails?.fanHub?.venueName ||
        undefined,
      action: 'View watch event',
      path: `/events/${event.id}`,
      tone: 'watch',
      icon: 'match',
    });
  }

  for (const request of props.requests) {
    const claimed = claimedQuantity(request);
    if (timestamp(request.expiresAt) < now || claimed >= request.quantity) continue;
    cards.push({
      id: `request-${request.id}`,
      ...source(request.communityId, request.community?.name),
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

  for (const ride of props.rideOffers) {
    const seats = openSeats(ride);
    if (timestamp(ride.departureAt) < now || seats <= 0) continue;
    cards.push({
      id: `ride-offer-${ride.id}`,
      ...source(ride.communityId, ride.community?.name),
      priority: 15,
      sortAt: timestamp(ride.departureAt),
      kicker: 'GET THERE · RIDE',
      title: `${seats} seat${seats === 1 ? '' : 's'} available`,
      meta: `${compactTime(ride.departureAt)} · ${ride.originLabel} → ${ride.destinationLabel}`,
      detail:
        ride.costSplitMode === 'FREE'
          ? 'Free ride'
          : `${money(ride.seatPriceMinor, ride.currency)} / seat`,
      action: 'View ride',
      path: `/rides/${ride.id}`,
      tone: 'ride',
      icon: 'ride',
    });
  }

  for (const ride of props.rideRequests) {
    if (timestamp(ride.desiredDepartureAt) < now) continue;
    cards.push({
      id: `ride-request-${ride.id}`,
      ...source(ride.communityId, ride.community?.name),
      priority: 16,
      sortAt: timestamp(ride.desiredDepartureAt),
      kicker: 'RIDE NEEDED',
      title: ride.title,
      meta: `${compactTime(ride.desiredDepartureAt)} · ${ride.seatsNeeded} seat${ride.seatsNeeded === 1 ? '' : 's'} needed`,
      detail: ride.pickupLabel,
      action: 'Open rides',
      path: '/rides',
      tone: 'ride',
      icon: 'ride',
    });
  }

  for (const fund of props.funds) {
    if (
      !['OPEN', 'FUNDED'].includes(fund.status) ||
      (fund.deadline && timestamp(fund.deadline) < now)
    ) {
      continue;
    }
    const progress = fundProgress(fund);
    cards.push({
      id: `fund-${fund.id}`,
      ...source(fund.communityId, fund.community?.name),
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

  return cards.sort((left, right) => {
    if (left.communityRank !== right.communityRank) {
      return left.communityRank - right.communityRank;
    }
    const urgentWindow = 6 * 60 * 60 * 1000;
    const leftUrgent = left.sortAt - now <= urgentWindow ? 0 : left.priority;
    const rightUrgent = right.sortAt - now <= urgentWindow ? 0 : right.priority;
    if (leftUrgent !== rightUrgent) return leftUrgent - rightUrgent;
    return left.sortAt - right.sortAt;
  });
}

function FeedIcon({ icon }: Pick<FeedCard, 'icon'>) {
  if (icon === 'request') return <RequestFlagIcon className="h-5 w-5" />;
  if (icon === 'ride') return <Car size={20} />;
  if (icon === 'fund') return <FundCupIcon className="h-5 w-5" />;
  return <Users size={20} />;
}

function communityLabel(card: FeedCard) {
  if (card.communityRank === 0) return `${card.communityName} · YOUR HOOMA`;
  if (card.distanceKm !== null) {
    return `${card.communityName} · ${card.distanceKm < 10 ? card.distanceKm.toFixed(1) : Math.round(card.distanceKm)} km`;
  }
  return card.communityName;
}

export function HoomaNowFeed(props: HoomaNowFeedProps) {
  const cards = buildCards(props);

  return (
    <section className="hooma-now" aria-labelledby="hooma-now-title">
      <header className="hooma-now-header">
        <div>
          <div className="hooma-now-eyebrow">LIVE FROM YOUR FOOTBALL WORLD</div>
          <h2 id="hooma-now-title">HOOMA NOW</h2>
          <p>
            {props.communityName
              ? `${props.communityName} first, then nearby activity across HOOMA.`
              : 'Nearby activity first, then the rest of HOOMA.'}
          </p>
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
                <span className="hooma-now-kicker">
                  {communityLabel(card)} · {card.kicker}
                </span>
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
            Real matches, watch events, requests, rides and fundraisers will surface here from
            across HOOMA as they become active.
          </span>
        </div>
      )}

      {props.hasError ? (
        <p className="hooma-now-warning">Some live sources could not be refreshed.</p>
      ) : null}
    </section>
  );
}

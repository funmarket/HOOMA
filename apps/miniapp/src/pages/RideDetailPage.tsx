import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Car, Check, MapPin, Play, Square, Users, X } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { get, patch, post } from '../shared/api/http-client';
import { eventDate, money } from '../lib/format';
import { notify } from '../lib/telegram';
import type { Me } from '../types/domain';
import type { DiscoveredRideOffer } from '../types/ride-discovery';

export function RideDetailPage() {
  const { rideId = '' } = useParams();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/api/v1/me') });
  const query = useQuery({
    queryKey: ['ride', rideId],
    queryFn: () => get<DiscoveredRideOffer>(`/api/v1/rides/offers/${rideId}`),
    enabled: Boolean(rideId),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['ride', rideId] });
    void queryClient.invalidateQueries({ queryKey: ['rides'] });
  };

  const join = useMutation({
    mutationFn: () => post(`/api/v1/rides/offers/${rideId}/matches`, { seats: 1 }),
    onSuccess: () => {
      notify('success');
      refresh();
    },
    onError: () => notify('error'),
  });

  const lifecycle = useMutation({
    mutationFn: (status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED') =>
      patch(`/api/v1/rides/offers/${rideId}/status`, { status }),
    onSuccess: () => {
      notify('success');
      refresh();
    },
    onError: () => notify('error'),
  });

  const matchStatus = useMutation({
    mutationFn: (input: { matchId: string; status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED' }) =>
      patch(`/api/v1/rides/offers/${rideId}/matches/${input.matchId}`, { status: input.status }),
    onSuccess: () => {
      notify('success');
      refresh();
    },
    onError: () => notify('error'),
  });

  const ride = query.data;
  if (!ride) {
    return (
      <div className="page-shell">
        <div className="surface-card p-6">
          {query.isError ? 'Ride could not be loaded.' : 'Loading ride…'}
        </div>
      </div>
    );
  }

  const used = (ride.matches || [])
    .filter((match) => ['REQUESTED', 'ACCEPTED'].includes(match.status))
    .reduce((sum, match) => sum + match.seats, 0);
  const remaining = Math.max(0, ride.seatsTotal - used);
  const paidRide = ride.costSplitMode !== 'FREE' && Number(ride.seatPriceMinor) > 0;
  const cashAccepted = Boolean(
    ride.paymentMethods?.some((item) => item.method === 'CASH' && item.enabled),
  );
  const isDriver = me.data?.id === ride.driver?.id;
  const canJoin = ['OPEN', 'FULL'].includes(ride.status) && remaining > 0 && !isDriver;
  const acceptedCount = (ride.matches || []).filter((match) => match.status === 'ACCEPTED').length;

  return (
    <div className="page-shell pt-4">
      <div className="section-kicker">Ride offer · {ride.community.name}</div>
      <h1 className="section-title">{ride.title}</h1>
      <div className="surface-card mt-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <Car size={30} style={{ color: 'var(--accent)' }} />
          <span className="chip">{ride.status.replaceAll('_', ' ')}</span>
        </div>
        <div className="mt-4 grid gap-3 text-sm font-bold">
          <span className="flex gap-2">
            <MapPin size={17} /> {ride.originLabel} → {ride.destinationLabel}
          </span>
          <span>{eventDate(ride.departureAt)}</span>
          <span className="flex gap-2">
            <Users size={17} /> {remaining} seats remaining
          </span>
          <span>
            {ride.costSplitMode === 'FREE'
              ? 'Free ride'
              : `${money(ride.seatPriceMinor, ride.currency)} / seat · cash`}
          </span>
        </div>

        {paidRide && !cashAccepted && (
          <p className="mt-4 text-sm font-bold">This paid ride has no enabled payment method.</p>
        )}

        {!isDriver && (
          <button
            className="accent-button mt-5 w-full"
            disabled={join.isPending || !canJoin || (paidRide && !cashAccepted)}
            onClick={() => join.mutate()}
          >
            Request a seat
          </button>
        )}
      </div>

      {isDriver && (
        <section className="surface-card mt-4 p-5">
          <div className="section-kicker">Driver controls</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {['OPEN', 'FULL'].includes(ride.status) && (
              <button
                className="accent-button"
                disabled={lifecycle.isPending || acceptedCount === 0}
                onClick={() => lifecycle.mutate('IN_PROGRESS')}
              >
                <Play size={15} /> Start ride
              </button>
            )}
            {ride.status === 'IN_PROGRESS' && (
              <button
                className="accent-button"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate('COMPLETED')}
              >
                <Check size={15} /> Complete ride
              </button>
            )}
            {['OPEN', 'FULL', 'IN_PROGRESS'].includes(ride.status) && (
              <button
                className="ghost-button"
                disabled={lifecycle.isPending}
                onClick={() => lifecycle.mutate('CANCELLED')}
              >
                <Square size={15} /> Cancel ride
              </button>
            )}
          </div>
          {acceptedCount === 0 && ['OPEN', 'FULL'].includes(ride.status) && (
            <p className="mt-3 text-xs muted">Accept at least one rider before starting.</p>
          )}
        </section>
      )}

      {(ride.matches?.length ?? 0) > 0 && (
        <section className="surface-card mt-4 p-5">
          <div className="section-kicker">Riders</div>
          <div className="mt-3 grid gap-3">
            {ride.matches?.map((match) => (
              <div
                key={match.id}
                className="rounded-2xl border p-3"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black">
                      {match.rider?.firstName || match.rider?.username || 'HOOMA player'}
                    </div>
                    <div className="mt-1 text-xs muted">
                      {match.seats} seat{match.seats === 1 ? '' : 's'} ·{' '}
                      {match.status.replaceAll('_', ' ')}
                    </div>
                  </div>
                  {isDriver && match.status === 'REQUESTED' && (
                    <div className="flex gap-2">
                      <button
                        className="ghost-button px-3"
                        disabled={matchStatus.isPending}
                        onClick={() =>
                          matchStatus.mutate({ matchId: match.id, status: 'DECLINED' })
                        }
                        aria-label="Decline rider"
                      >
                        <X size={15} />
                      </button>
                      <button
                        className="accent-button px-3"
                        disabled={matchStatus.isPending}
                        onClick={() =>
                          matchStatus.mutate({ matchId: match.id, status: 'ACCEPTED' })
                        }
                        aria-label="Accept rider"
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  )}
                </div>
                {match.paymentIntent && (
                  <div className="mt-2 text-xs font-bold muted">
                    Payment: {match.paymentIntent.status.replaceAll('_', ' ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="mt-4 text-xs leading-5 muted">
        Exact pickup location and live tracking are exposed only to accepted participants. Live
        location pings expire automatically.
      </p>
    </div>
  );
}

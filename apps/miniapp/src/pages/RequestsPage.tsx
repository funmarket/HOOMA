import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Clock3, Plus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RequestFlagIcon } from '../icons/RequestFlagIcon';
import { get, post } from '../shared/api/http-client';
import { eventDate } from '../lib/format';
import { notify } from '../lib/telegram';
import type {
  RankedRequestCommunity,
  RequestDiscoveryResponse,
} from '../types/request-discovery';

function communityLabel(
  community: RankedRequestCommunity | undefined,
  activeCommunityId: string | null,
) {
  if (!community) return null;
  if (community.id === activeCommunityId) return 'YOUR HOOMA';
  if (community.distanceKm !== null) {
    return `${community.name} · ${Math.round(community.distanceKm)} km`;
  }
  return community.city ? `${community.name} · ${community.city}` : community.name;
}

export function RequestsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['requests', 'discover'],
    queryFn: () => get<RequestDiscoveryResponse>('/api/v1/requests/discover'),
  });
  const communityById = new Map(
    (query.data?.communities ?? []).map((community) => [community.id, community] as const),
  );
  const claim = useMutation({
    mutationFn: (id: string) => post(`/api/v1/requests/${id}/claim`, { quantity: 1 }),
    onSuccess: () => {
      notify('success');
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
    onError: () => notify('error'),
  });

  return (
    <div className="page-shell">
      <div className="flex items-end justify-between">
        <div>
          <div className="section-kicker">Short-lived asks</div>
          <h1 className="section-title">Requests</h1>
          <p className="mt-1 text-sm muted">
            Your HOOMA first, then nearby asks and the wider HOOMA network.
          </p>
        </div>
        <button className="accent-button p-3" onClick={() => navigate('/requests/new')}>
          <Plus />
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {query.data?.items.map((request) => {
          const claimed = (request.claims || [])
            .filter((item) => item.status !== 'WITHDRAWN')
            .reduce((sum, item) => sum + item.quantity, 0);
          const source = communityById.get(request.communityId);
          const sourceLabel = communityLabel(source, query.data?.activeCommunityId ?? null);
          return (
            <article className="surface-card p-4" key={request.id}>
              <div className="flex gap-3">
                <span className="icon-well">
                  <RequestFlagIcon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="section-kicker">
                      {request.kind}
                      {request.position ? ` · ${request.position}` : ''}
                    </span>
                    {sourceLabel ? <span className="chip py-1">{sourceLabel}</span> : null}
                    <span className="chip py-1">
                      {claimed}/{request.quantity} claimed
                    </span>
                  </div>
                  <h2 className="mt-1 text-lg font-black">{request.title}</h2>
                  {request.details && <p className="mt-1 text-sm muted">{request.details}</p>}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold muted">
                    {request.event && (
                      <span className="flex items-center gap-1">
                        <Users size={13} />
                        {request.event.title}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock3 size={13} /> until {eventDate(request.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                disabled={claim.isPending || claimed >= request.quantity}
                onClick={() => claim.mutate(request.id)}
                className="accent-button mt-4 w-full"
              >
                <Check size={17} /> I can help
              </button>
            </article>
          );
        })}
        {!query.isLoading && !query.isError && !query.data?.items.length ? (
          <div className="surface-card p-5 text-sm muted">No open requests right now.</div>
        ) : null}
      </div>
    </div>
  );
}

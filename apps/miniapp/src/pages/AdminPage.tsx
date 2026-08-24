import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Car,
  CircleDollarSign,
  Copy,
  HandHelping,
  Link2,
  ShieldCheck,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import { del, get, patch, post, put } from '../shared/api/http-client';
import { money } from '../lib/format';
import { notify } from '../lib/telegram';
import type {
  Community,
  CommunityInvite,
  DigitalProduct,
  MinorAmount,
  PaymentMethodSetting,
  PaymentStatus,
  Person,
  TeamItem,
  TeamManagedPage,
} from '../types/domain';

type CommunityManagementMembership = {
  id: string;
  role: 'OWNER' | 'ADMIN';
  community: Community & {
    _count: {
      memberships: number;
      events: number;
      requests: number;
      rideOffers: number;
      fundraisers: number;
    };
  };
};

type Dashboard = {
  members: number;
  upcomingEvents: number;
  openRequests: number;
  rideOffers: number;
  openFunds: number;
  awaitingCash: number;
  paidVolumes: Array<{
    currency: string;
    _sum: { amountMinor: MinorAmount | null };
    _count: { _all: number };
  }>;
};

type ManagedPayment = {
  id: string;
  purpose: string;
  status: PaymentStatus;
  amountMinor: MinorAmount;
  currency: string;
  selectedMethod?: 'CASH' | 'TELEGRAM_STARS' | null;
  user: Person;
  telegramStarPayment?: {
    telegramPaymentChargeId: string;
    starsAmount: number;
    refundedAt?: string | null;
  } | null;
  eventRsvp?: { event?: { id: string; title: string } | null } | null;
  rideMatch?: { offer?: { id: string; title: string } | null } | null;
  fundContribution?: { fundraiser?: { id: string; title: string } | null } | null;
};

type PaymentPage = {
  items: ManagedPayment[];
  nextCursor: string | null;
};

type InviteCreateResponse = {
  invite: CommunityInvite;
  code: string;
};

function payerName(user: Person): string {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return full || user.username || 'HOOMA member';
}

function paymentContext(payment: ManagedPayment): string {
  return (
    payment.eventRsvp?.event?.title ||
    payment.rideMatch?.offer?.title ||
    payment.fundContribution?.fundraiser?.title ||
    payment.purpose.replaceAll('_', ' ')
  );
}

function inviteState(invite: CommunityInvite): string {
  if (invite.revokedAt) return 'Revoked';
  if (invite.expiresAt && new Date(invite.expiresAt) <= new Date()) return 'Expired';
  if (invite.maxUses != null && invite.useCount >= invite.maxUses) return 'Used up';
  return 'Active';
}

function communityRoleLabel(role: 'OWNER' | 'ADMIN' | 'MEMBER'): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'ADMIN') return 'Manager';
  return 'Member';
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState('');
  const [inviteRoleSelection, setInviteRoleSelection] = useState<{
    communityId: string;
    role: 'MEMBER' | 'ADMIN';
  } | null>(null);
  const [inviteMaxUses, setInviteMaxUses] = useState('10');
  const [freshInvite, setFreshInvite] = useState<{ communityId: string; code: string } | null>(
    null,
  );
  const [supporterDraft, setSupporterDraft] = useState<{
    communityId: string;
    stars: string;
    active: boolean;
  } | null>(null);
  const [teamDraft, setTeamDraft] = useState({
    name: '',
    city: '',
    houma: '',
    badgeUrl: '',
    isPublic: true,
    acceptingChallenges: true,
  });

  const managedCommunities = useQuery({
    queryKey: ['community-management', 'communities'],
    queryFn: () =>
      get<CommunityManagementMembership[]>('/api/v1/community-management/communities'),
  });

  const communityId = selected || managedCommunities.data?.[0]?.community.id || '';
  const selectedMembership = useMemo(
    () =>
      managedCommunities.data?.find((membership) => membership.community.id === communityId) ??
      null,
    [managedCommunities.data, communityId],
  );
  const isOwner = selectedMembership?.role === 'OWNER';

  const dashboard = useQuery({
    queryKey: ['community-management', 'dashboard', communityId],
    queryFn: () =>
      get<Dashboard>(`/api/v1/community-management/communities/${communityId}/dashboard`),
    enabled: Boolean(communityId),
  });

  const cashDue = useQuery({
    queryKey: ['community-management', 'cash-due', communityId],
    queryFn: () =>
      get<PaymentPage>(
        `/api/v1/community-management/communities/${communityId}/payments?method=CASH&status=AWAITING_CASH&limit=50`,
      ),
    enabled: Boolean(communityId),
  });

  const starsPaid = useQuery({
    queryKey: ['community-management', 'stars-paid', communityId],
    queryFn: () =>
      get<PaymentPage>(
        `/api/v1/community-management/communities/${communityId}/payments?method=TELEGRAM_STARS&status=PAID&limit=20`,
      ),
    enabled: Boolean(communityId),
  });

  const paymentDefaults = useQuery({
    queryKey: ['community-payment-defaults', communityId],
    queryFn: () =>
      get<PaymentMethodSetting[]>(`/api/v1/communities/${communityId}/payment-defaults`),
    enabled: Boolean(communityId),
  });

  const products = useQuery({
    queryKey: ['digital-products', communityId],
    queryFn: () =>
      get<DigitalProduct[]>(
        `/api/v1/payments/digital/products?communityId=${encodeURIComponent(communityId)}`,
      ),
    enabled: Boolean(communityId),
  });

  const managedTeams = useQuery({
    queryKey: ['teams', 'managed'],
    queryFn: () => get<TeamManagedPage>('/api/v1/teams/managed'),
  });

  const invites = useQuery({
    queryKey: ['community-invites', communityId],
    queryFn: () => get<CommunityInvite[]>(`/api/v1/communities/${communityId}/invites`),
    enabled: Boolean(communityId),
  });

  const supporterBadge = products.data?.find((product) => product.sku === 'SUPPORTER_BADGE');
  const ownedTeam = managedTeams.data?.items.find((team) => team.communityId === communityId);
  const supporterStars =
    supporterDraft?.communityId === communityId
      ? supporterDraft.stars
      : String(supporterBadge?.starsAmount ?? 100);
  const supporterActive =
    supporterDraft?.communityId === communityId
      ? supporterDraft.active
      : (supporterBadge?.active ?? false);
  const inviteRole =
    inviteRoleSelection?.communityId === communityId ? inviteRoleSelection.role : 'MEMBER';
  const freshInviteCode = freshInvite?.communityId === communityId ? freshInvite.code : '';

  const cashDefaultEnabled =
    paymentDefaults.data?.find((item) => item.method === 'CASH')?.enabled ?? true;

  const updateCashDefault = useMutation({
    mutationFn: (cashEnabled: boolean) =>
      patch<PaymentMethodSetting[]>(`/api/v1/communities/${communityId}/payment-defaults`, {
        cashEnabled,
      }),
    onSuccess: async () => {
      notify('success');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['community-payment-defaults', communityId],
        }),
        queryClient.invalidateQueries({ queryKey: ['communities'] }),
      ]);
    },
    onError: () => notify('error'),
  });

  const configureSupporter = useMutation({
    mutationFn: () => {
      const starsAmount = Number(supporterStars);
      if (!Number.isInteger(starsAmount) || starsAmount < 1) {
        throw new Error('Stars amount must be a positive whole number.');
      }
      return put<DigitalProduct>('/api/v1/payments/digital/products/supporter-badge', {
        communityId,
        starsAmount,
        active: supporterActive,
      });
    },
    onSuccess: async () => {
      notify('success');
      await queryClient.invalidateQueries({ queryKey: ['digital-products', communityId] });
      setSupporterDraft(null);
    },
    onError: () => notify('error'),
  });

  const createTeam = useMutation({
    mutationFn: () => {
      const name = teamDraft.name.trim();
      if (name.length < 2) throw new Error('Team name is required.');
      return post<TeamItem>('/api/v1/teams', {
        communityId,
        name,
        ...(teamDraft.city.trim() ? { city: teamDraft.city.trim() } : {}),
        ...(teamDraft.houma.trim() ? { houma: teamDraft.houma.trim() } : {}),
        ...(teamDraft.badgeUrl.trim() ? { badgeUrl: teamDraft.badgeUrl.trim() } : {}),
        isPublic: teamDraft.isPublic,
        acceptingChallenges: teamDraft.acceptingChallenges,
      });
    },
    onSuccess: async () => {
      notify('success');
      setTeamDraft({
        name: '',
        city: '',
        houma: '',
        badgeUrl: '',
        isPublic: true,
        acceptingChallenges: true,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teams', 'managed'] }),
        queryClient.invalidateQueries({ queryKey: ['teams'] }),
      ]);
    },
    onError: () => notify('error'),
  });

  const createInvite = useMutation({
    mutationFn: () => {
      const maxUses = inviteMaxUses.trim() ? Number(inviteMaxUses) : null;
      if (maxUses != null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500)) {
        throw new Error('Invite uses must be between 1 and 500.');
      }
      return post<InviteCreateResponse>(`/api/v1/communities/${communityId}/invites`, {
        role: inviteRole,
        maxUses,
      });
    },
    onSuccess: async (result) => {
      setFreshInvite({ communityId, code: result.code });
      notify('success');
      await queryClient.invalidateQueries({ queryKey: ['community-invites', communityId] });
    },
    onError: () => notify('error'),
  });

  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => del(`/api/v1/communities/${communityId}/invites/${inviteId}`),
    onSuccess: async () => {
      notify('success');
      await queryClient.invalidateQueries({ queryKey: ['community-invites', communityId] });
    },
    onError: () => notify('error'),
  });

  const confirmCash = useMutation({
    mutationFn: (paymentId: string) => post(`/api/v1/payments/${paymentId}/cash/confirm`, {}),
    onSuccess: async () => {
      notify('success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['community-management', 'cash-due', communityId] }),
        queryClient.invalidateQueries({
          queryKey: ['community-management', 'dashboard', communityId],
        }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['fundraisers'] }),
        queryClient.invalidateQueries({ queryKey: ['rides'] }),
      ]);
    },
    onError: () => notify('error'),
  });

  const refundStars = useMutation({
    mutationFn: (paymentId: string) =>
      post(`/api/v1/payments/${paymentId}/stars/refund`, {
        reason: 'Community manager refund',
      }),
    onSuccess: async () => {
      notify('success');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['community-management', 'stars-paid', communityId],
        }),
        queryClient.invalidateQueries({
          queryKey: ['community-management', 'dashboard', communityId],
        }),
        queryClient.invalidateQueries({ queryKey: ['digital-products', communityId] }),
      ]);
    },
    onError: () => notify('error'),
  });

  const copyInvite = async () => {
    if (!freshInviteCode) return;
    await navigator.clipboard.writeText(freshInviteCode);
    notify('success');
  };

  const cards = [
    ['Members', dashboard.data?.members ?? 0, Users],
    ['Upcoming', dashboard.data?.upcomingEvents ?? 0, CalendarDays],
    ['Requests', dashboard.data?.openRequests ?? 0, HandHelping],
    ['Rides', dashboard.data?.rideOffers ?? 0, Car],
    ['Funds', dashboard.data?.openFunds ?? 0, CircleDollarSign],
  ] as const;

  if (!managedCommunities.isLoading && !managedCommunities.data?.length) {
    return (
      <div className="page-shell">
        <div className="section-kicker">Community management</div>
        <h1 className="section-title">Control room</h1>
        <div className="surface-card mt-5 p-5 text-sm muted">
          You do not manage a HOOMA community yet.
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="section-kicker">Community management</div>
      <h1 className="section-title">Control room</h1>
      <p className="mt-1 text-sm muted">
        Switch between every community you manage without leaving the control room.
      </p>

      <select
        className="hooma-input mt-5"
        value={communityId}
        onChange={(event) => {
          setSelected(event.target.value);
          setFreshInvite(null);
          setInviteRoleSelection(null);
          setSupporterDraft(null);
        }}
      >
        {managedCommunities.data?.map((membership) => (
          <option value={membership.community.id} key={membership.community.id}>
            {membership.community.name} · {communityRoleLabel(membership.role)}
          </option>
        ))}
      </select>

      <section className="surface-card mt-4 p-5">
        <div className="section-kicker">Coach Control Room</div>
        <h2 className="mt-1 text-lg font-black">Team</h2>
        <p className="mt-2 text-xs leading-5 muted">
          The HOOMA community owns the Team, but the Team appears globally only after a Coach
          creates it.
        </p>
        {ownedTeam ? (
          <div className="reference-row mt-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-black">{ownedTeam.name}</div>
                <div className="mt-1 text-xs font-bold muted">
                  {[ownedTeam.city, ownedTeam.houma].filter(Boolean).join(' · ') || 'Location TBA'}
                </div>
              </div>
              <span className="chip">{ownedTeam.isPublic ? 'Public' : 'Private'}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="ghost-button justify-center py-2.5"
                onClick={() => navigate(`/teams/${ownedTeam.id}`)}
              >
                Team profile
              </button>
              <button
                className="accent-button justify-center py-2.5"
                onClick={() => navigate('/teams')}
              >
                Challenges
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3">
            <input
              className="hooma-input"
              value={teamDraft.name}
              onChange={(event) =>
                setTeamDraft((draft) => ({ ...draft, name: event.target.value }))
              }
              placeholder="Team name"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="hooma-input"
                value={teamDraft.city}
                onChange={(event) =>
                  setTeamDraft((draft) => ({ ...draft, city: event.target.value }))
                }
                placeholder="City"
              />
              <input
                className="hooma-input"
                value={teamDraft.houma}
                onChange={(event) =>
                  setTeamDraft((draft) => ({ ...draft, houma: event.target.value }))
                }
                placeholder="Houma"
              />
            </div>
            <input
              className="hooma-input"
              value={teamDraft.badgeUrl}
              onChange={(event) =>
                setTeamDraft((draft) => ({ ...draft, badgeUrl: event.target.value }))
              }
              placeholder="Badge URL optional"
            />
            <label className="flex items-center justify-between gap-3 text-sm font-bold">
              <span>Public team</span>
              <input
                type="checkbox"
                checked={teamDraft.isPublic}
                onChange={(event) =>
                  setTeamDraft((draft) => ({ ...draft, isPublic: event.target.checked }))
                }
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm font-bold">
              <span>Accept challenges</span>
              <input
                type="checkbox"
                checked={teamDraft.acceptingChallenges}
                onChange={(event) =>
                  setTeamDraft((draft) => ({ ...draft, acceptingChallenges: event.target.checked }))
                }
              />
            </label>
            <button
              className="accent-button w-full"
              disabled={createTeam.isPending || !communityId}
              onClick={() => createTeam.mutate()}
            >
              Create Team
            </button>
          </div>
        )}
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value, Icon]) => (
          <div key={label} className="surface-card p-4">
            <Icon size={20} style={{ color: 'var(--accent)' }} />
            <div className="mt-3 text-2xl font-black">{value}</div>
            <div className="text-xs font-bold muted">{label}</div>
          </div>
        ))}
      </div>

      <section className="surface-card mt-4 p-5">
        <div className="section-kicker">Community defaults</div>
        <h2 className="mt-1 text-lg font-black">Real-world payments</h2>
        <label
          className="mt-4 flex items-center justify-between gap-4 rounded-2xl border p-4"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <div className="font-black">Accept cash by default</div>
            <div className="mt-1 text-xs leading-5 muted">
              New paid events, rides, and fundraisers start with this choice. The resource keeps its
              own saved policy after creation.
            </div>
          </div>
          <input
            type="checkbox"
            checked={cashDefaultEnabled}
            disabled={updateCashDefault.isPending}
            onChange={(event) => updateCashDefault.mutate(event.target.checked)}
          />
        </label>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="flex items-center gap-2">
          <Star size={20} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="section-kicker">Telegram Stars</div>
            <h2 className="mt-1 text-lg font-black">Supporter badge</h2>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 muted">
          Stars are only used for digital HOOMA goods. The price is stored server-side and users
          cannot submit their own Stars amount.
        </p>
        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <input
            className="hooma-input"
            inputMode="numeric"
            value={supporterStars}
            onChange={(event) =>
              setSupporterDraft({ communityId, stars: event.target.value, active: supporterActive })
            }
            placeholder="100"
          />
          <div
            className="flex items-center rounded-2xl border px-4 text-sm font-black"
            style={{ borderColor: 'var(--border)' }}
          >
            Stars
          </div>
        </div>
        <label className="mt-3 flex items-center justify-between gap-3 text-sm font-bold">
          <span>Offer this digital badge</span>
          <input
            type="checkbox"
            checked={supporterActive}
            onChange={(event) =>
              setSupporterDraft({
                communityId,
                stars: supporterStars,
                active: event.target.checked,
              })
            }
          />
        </label>
        <button
          className="accent-button mt-4 w-full"
          disabled={configureSupporter.isPending || !communityId}
          onClick={() => configureSupporter.mutate()}
        >
          Save Stars product
        </button>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="flex items-center gap-2">
          <Link2 size={20} style={{ color: 'var(--accent)' }} />
          <div>
            <div className="section-kicker">Private access</div>
            <h2 className="mt-1 text-lg font-black">Invite codes</h2>
          </div>
        </div>
        <p className="mt-2 text-xs leading-5 muted">
          HOOMA stores only a hash of each invite. The full code below is shown once after creation.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <select
            className="hooma-input"
            value={inviteRole}
            onChange={(event) =>
              setInviteRoleSelection({
                communityId,
                role: event.target.value as 'MEMBER' | 'ADMIN',
              })
            }
          >
            <option value="MEMBER">Member</option>
            {isOwner && <option value="ADMIN">Manager</option>}
          </select>
          <input
            className="hooma-input"
            inputMode="numeric"
            value={inviteMaxUses}
            onChange={(event) => setInviteMaxUses(event.target.value)}
            placeholder="Max uses"
          />
        </div>
        <button
          className="accent-button mt-3 w-full"
          disabled={createInvite.isPending || !communityId}
          onClick={() => createInvite.mutate()}
        >
          Create invite
        </button>

        {freshInviteCode && (
          <div className="mt-3 rounded-2xl border p-4" style={{ borderColor: 'var(--accent)' }}>
            <div className="text-xs font-black uppercase tracking-wider muted">Copy now</div>
            <div className="mt-2 break-all font-mono text-sm">{freshInviteCode}</div>
            <button className="ghost-button mt-3 w-full" onClick={copyInvite}>
              <Copy size={16} /> Copy invite code
            </button>
          </div>
        )}

        <div className="mt-4 grid gap-2">
          {invites.data?.map((invite) => (
            <div className="reference-row flex items-center gap-3 p-3" key={invite.id}>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-sm font-black">{invite.codePrefix}••••</div>
                <div className="mt-1 text-xs muted">
                  {communityRoleLabel(invite.role)} · {invite.useCount}/{invite.maxUses ?? '∞'} uses ·{' '}
                  {inviteState(invite)}
                </div>
              </div>
              {!invite.revokedAt && (
                <button
                  aria-label="Revoke invite"
                  className="ghost-button px-3"
                  disabled={revokeInvite.isPending}
                  onClick={() => revokeInvite.mutate(invite.id)}
                >
                  <Trash2 size={17} />
                </button>
              )}
            </div>
          ))}
          {!invites.isLoading && !invites.data?.length && (
            <div className="text-sm muted">No invite codes have been created.</div>
          )}
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck style={{ color: 'var(--accent)' }} />
          <h2 className="text-lg font-black">Paid totals</h2>
        </div>
        <div className="mt-3 grid gap-2">
          {dashboard.data?.paidVolumes.length ? (
            dashboard.data.paidVolumes.map((volume) => (
              <div className="flex items-center justify-between gap-3" key={volume.currency}>
                <span className="text-xl font-black">
                  {money(volume._sum.amountMinor ?? 0, volume.currency)}
                </span>
                <span className="text-xs font-bold muted">{volume._count._all} payments</span>
              </div>
            ))
          ) : (
            <div className="text-sm muted">No settled payments yet.</div>
          )}
        </div>
        <p className="mt-3 text-xs leading-5 muted">
          Totals are grouped by currency. Different currencies are never added together.
        </p>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-kicker">Cash reconciliation</div>
            <h2 className="mt-1 text-lg font-black">Awaiting cash</h2>
          </div>
          <span className="chip">
            {dashboard.data?.awaitingCash ?? cashDue.data?.items.length ?? 0} due
          </span>
        </div>

        <div className="mt-4 grid gap-3">
          {cashDue.data?.items.map((payment) => (
            <article className="reference-row p-4" key={payment.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-black">{payerName(payment.user)}</div>
                  <div className="mt-1 truncate text-xs font-bold muted">
                    {paymentContext(payment)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-black">{money(payment.amountMinor, payment.currency)}</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider muted">Cash</div>
                </div>
              </div>
              <button
                className="accent-button mt-3 w-full"
                disabled={confirmCash.isPending}
                onClick={() => confirmCash.mutate(payment.id)}
              >
                Mark paid in cash
              </button>
            </article>
          ))}

          {!cashDue.isLoading && !cashDue.data?.items.length && (
            <div className="text-sm muted">No cash payments need confirmation.</div>
          )}
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="section-kicker">Stars support</div>
        <h2 className="mt-1 text-lg font-black">Recent paid digital purchases</h2>
        <p className="mt-2 text-xs leading-5 muted">
          Refunds call Telegram first, then revoke the matching HOOMA entitlement. Retrying is
          idempotent if Telegram already refunded the charge.
        </p>
        <div className="mt-4 grid gap-3">
          {starsPaid.data?.items.map((payment) => (
            <article className="reference-row p-4" key={payment.id}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-black">{payerName(payment.user)}</div>
                  <div className="mt-1 text-xs muted">HOOMA Supporter Badge</div>
                </div>
                <div className="font-black">{String(payment.amountMinor)} ★</div>
              </div>
              <button
                className="ghost-button mt-3 w-full"
                disabled={refundStars.isPending}
                onClick={() => refundStars.mutate(payment.id)}
              >
                Refund Stars purchase
              </button>
            </article>
          ))}
          {!starsPaid.isLoading && !starsPaid.data?.items.length && (
            <div className="text-sm muted">No paid Stars purchases.</div>
          )}
        </div>
      </section>
    </div>
  );
}

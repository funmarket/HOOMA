import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CommunityOfficeCard } from '../components/community/CommunityOfficeCard';
import { CommunityActionButton } from '../components/community/CommunityActionButton';
import { UsersIcon } from '../icons/UsersIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { get } from '../shared/api/http-client';
import { useCommunity } from '../providers/CommunityProvider';
import { initials } from '../lib/format';
import type { Community, Role } from '../types/domain';

type CommunityDetailResponse = {
  role: Role;
  community: Omit<Community, 'role'> & {
    _count: {
      memberships: number;
      events: number;
      requests: number;
      rideOffers: number;
      fundraisers: number;
    };
  };
};

export function CommunityPage() {
  const { active } = useCommunity();
  const navigate = useNavigate();
  const detail = useQuery({
    queryKey: ['community', active?.id],
    queryFn: () => get<CommunityDetailResponse>(`/api/v1/communities/${active?.id}`),
    enabled: Boolean(active),
  });
  if (!active)
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-kicker">Your football community</div>
        <h1 className="vintage-display">HOOMA</h1>
        <div className="vintage-empty mt-5">
          <strong>No HOOMA yet.</strong>
          <small>Create or join a community to organize matches and fan meetups.</small>
          <button className="vintage-outline-cta mt-4" onClick={() => navigate('/community/new')}>
            <PlusIcon size={20} />
            Get started
          </button>
        </div>
      </div>
    );
  const community = detail.data?.community;
  const role = detail.data?.role ?? active.role;
  return (
    <div className="page-shell vintage-page">
      <div className="vintage-kicker">Your football community</div>
      <h1 className="vintage-display">HOOMA</h1>
      <p className="vintage-copy mt-2 text-sm">
        Your club office for people, events and community operations.
      </p>
      <div className="mt-5">
        <CommunityOfficeCard
          initials={initials(active.name)}
          name={active.name}
          description={community?.description || 'Your football community.'}
          roleLabel={role === 'OWNER' ? 'Owner' : role === 'ADMIN' ? 'Manager' : null}
          members={community?._count.memberships ?? 0}
          events={community?._count.events ?? 0}
          rides={community?._count.rideOffers ?? 0}
          city={community?.city || '—'}
        />
      </div>
      <section className="mt-6 grid gap-3">
        <CommunityActionButton
          icon={<UsersIcon size={22} />}
          label="Members & roles"
          onClick={() => navigate('/community/members')}
        />
        <CommunityActionButton
          icon={<PlusIcon size={22} />}
          label="Create or join another community"
          onClick={() => navigate('/community/new')}
        />
        {['OWNER', 'ADMIN'].includes(role) && (
          <CommunityActionButton
            icon={<ShieldIcon size={22} />}
            label="Community Management"
            onClick={() => navigate('/community-management')}
          />
        )}
      </section>
    </div>
  );
}

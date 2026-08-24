import { useQuery } from '@tanstack/react-query';
import { Crown, LogOut, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ActionRow } from '../components/ui/ActionRow';
import { logout } from '../features/auth/api';
import { clearWebSession, getWebSession } from '../features/auth/session';
import { useCommunity } from '../providers/CommunityProvider';
import { get } from '../shared/api/http-client';

type PlatformAdminAccess = {
  isPlatformAdmin: boolean;
  roles: string[];
  bootstrapAvailable: boolean;
};

export function MorePage() {
  const navigate = useNavigate();
  const { active } = useCommunity();
  const webSession = getWebSession();
  const platformAdmin = useQuery({
    queryKey: ['platform-admin', 'me'],
    queryFn: () => get<PlatformAdminAccess>('/api/v1/admin/me'),
  });

  async function signOut() {
    try {
      await logout();
    } finally {
      clearWebSession();
      navigate('/login', { replace: true });
    }
  }

  const showPlatformAdminEntry =
    platformAdmin.data?.isPlatformAdmin || platformAdmin.data?.bootstrapAvailable;

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-kicker">HOOMA</div>
      <h1 className="vintage-display">More</h1>
      <div className="mt-5 grid gap-3">
        <ActionRow
          icon={<UserRound />}
          title="My HOOMA profile"
          subtitle="Create or edit your HOOMA identity"
          onClick={() => navigate('/profile')}
          variant="vintage"
        />
        {active && ['OWNER', 'ADMIN'].includes(active.role) && (
          <ActionRow
            icon={<ShieldCheck />}
            title="Community Management"
            subtitle="Manage your scoped Team and community responsibilities"
            onClick={() => navigate('/community-management')}
            variant="vintage"
          />
        )}
        {showPlatformAdminEntry ? (
          <ActionRow
            icon={<Crown />}
            title={platformAdmin.data?.isPlatformAdmin ? 'HOOMA Admin' : 'HOOMA Admin Setup'}
            subtitle={
              platformAdmin.data?.isPlatformAdmin
                ? 'App Owner administration'
                : 'Claim the one-time App Owner Admin role'
            }
            onClick={() => navigate('/admin')}
            variant="vintage"
          />
        ) : null}
        <ActionRow
          icon={<Settings />}
          title="Settings"
          onClick={() => navigate('/settings')}
          variant="vintage"
        />
        {webSession ? (
          <ActionRow
            icon={<LogOut />}
            title="Log out"
            subtitle="End this web session"
            onClick={() => void signOut()}
            variant="vintage"
          />
        ) : null}
      </div>
    </div>
  );
}

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
};

export function MorePage() {
  const navigate = useNavigate();
  const { active } = useCommunity();
  const webSession = getWebSession();
  const platformAdmin = useQuery({
    queryKey: ['app-admin', 'me'],
    queryFn: () => get<PlatformAdminAccess>('/api/v1/app-admin/me'),
  });

  async function signOut() {
    try {
      await logout();
    } finally {
      clearWebSession();
      navigate('/login', { replace: true });
    }
  }

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
            title="Coach Control Room"
            subtitle="Manage your scoped Team and community responsibilities"
            onClick={() => navigate('/admin')}
            variant="vintage"
          />
        )}
        {platformAdmin.data?.isPlatformAdmin ? (
          <ActionRow
            icon={<Crown />}
            title="HOOMA Admin"
            subtitle="Global application administration"
            onClick={() => navigate('/app-admin')}
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

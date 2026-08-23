import { useQuery } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { get } from '../shared/api/http-client';

type PlatformAdminAccess = {
  isPlatformAdmin: boolean;
  roles: string[];
};

export function AppAdminPage() {
  const access = useQuery({
    queryKey: ['app-admin', 'me'],
    queryFn: () => get<PlatformAdminAccess>('/api/v1/app-admin/me'),
  });

  if (access.isLoading) {
    return (
      <div className="page-shell vintage-page">
        <div className="surface-card p-5 text-sm muted">Checking HOOMA Admin access…</div>
      </div>
    );
  }

  if (access.isError || !access.data?.isPlatformAdmin) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-kicker">HOOMA</div>
        <h1 className="vintage-display">Admin</h1>
        <div className="surface-card mt-5 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            <div>
              <div className="font-black">Platform Admin access required</div>
              <p className="mt-1 text-sm muted">
                Team, Coach, Assistant, and community roles do not grant authority over HOOMA.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-kicker">HOOMA PLATFORM</div>
      <h1 className="vintage-display">Admin</h1>
      <p className="mt-2 text-sm muted">
        Global application authority. Community and Team management remain separate.
      </p>

      <section className="surface-card mt-5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <div>
            <div className="font-black">Platform Admin verified</div>
            <p className="mt-1 text-sm muted">
              This access comes only from an active PLATFORM_ADMIN assignment on your canonical
              HOOMA user.
            </p>
          </div>
        </div>
      </section>

      <section className="surface-card mt-4 p-5">
        <div className="section-kicker">Next admin modules</div>
        <p className="mt-2 text-sm muted">
          Watch and Pitch moderation will be wired here only after their approval workflows are
          traced and protected by the same Platform Admin boundary.
        </p>
      </section>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { get, post } from '../shared/api/http-client';

type PlatformAdminAccess = {
  isPlatformAdmin: boolean;
  roles: string[];
  bootstrapAvailable: boolean;
};

export function AppAdminPage() {
  const queryClient = useQueryClient();
  const [bootstrapToken, setBootstrapToken] = useState('');
  const access = useQuery({
    queryKey: ['platform-admin', 'me'],
    queryFn: () => get<PlatformAdminAccess>('/api/v1/admin/me'),
  });
  const bootstrap = useMutation({
    mutationFn: () =>
      post<PlatformAdminAccess>('/api/v1/admin/bootstrap', { token: bootstrapToken.trim() }),
    onSuccess: async () => {
      setBootstrapToken('');
      await queryClient.invalidateQueries({ queryKey: ['platform-admin', 'me'] });
    },
  });

  function submitBootstrap(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (bootstrapToken.trim().length < 32 || bootstrap.isPending) return;
    bootstrap.mutate();
  }

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
              <div className="font-black">App Owner Admin access required</div>
              <p className="mt-1 text-sm muted">
                Team, Coach, Manager, Assistant, and community roles do not grant Admin authority
                over HOOMA.
              </p>
            </div>
          </div>
        </div>

        {access.data?.bootstrapAvailable ? (
          <section className="surface-card mt-4 p-5">
            <div className="section-kicker">Owner setup</div>
            <h2 className="mt-1 font-black">Claim the HOOMA App Owner Admin role</h2>
            <p className="mt-2 text-sm muted">
              Use the private one-time setup key while signed in to the HOOMA account that should
              own platform administration. Your canonical user ID becomes the database authority;
              Telegram usernames and Team roles are not used for future access.
            </p>
            <form className="mt-4 grid gap-3" onSubmit={submitBootstrap}>
              <label className="grid gap-1 text-sm font-bold">
                One-time setup key
                <input
                  type="password"
                  autoComplete="off"
                  value={bootstrapToken}
                  onChange={(event) => {
                    bootstrap.reset();
                    setBootstrapToken(event.target.value);
                  }}
                  className="input"
                />
              </label>
              <button
                type="submit"
                className="accent-button"
                disabled={bootstrapToken.trim().length < 32 || bootstrap.isPending}
              >
                {bootstrap.isPending ? 'Claiming…' : 'Claim HOOMA Admin'}
              </button>
              {bootstrap.isError ? (
                <div role="alert" className="text-sm text-red-500">
                  {bootstrap.error instanceof Error
                    ? bootstrap.error.message
                    : 'Unable to claim HOOMA Admin.'}
                </div>
              ) : null}
            </form>
          </section>
        ) : null}
      </div>
    );
  }

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-kicker">HOOMA APP OWNER</div>
      <h1 className="vintage-display">Admin</h1>
      <p className="mt-2 text-sm muted">
        Global application authority. Community and Team management remain separate.
      </p>

      <section className="surface-card mt-5 p-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <div>
            <div className="font-black">App Owner Admin verified</div>
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
          traced and protected by the same App Owner Admin boundary.
        </p>
      </section>
    </div>
  );
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, ShieldCheck, UserMinus } from 'lucide-react';
import { get, patch, post } from '../shared/api/http-client';
import { notify } from '../lib/telegram';
import { useCommunity } from '../providers/CommunityProvider';
import type { Me } from '../types/domain';

type Member = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    photoUrl?: string | null;
    profile?: { skillLevel: string; preferredPositions: string[] } | null;
  };
};

function communityRoleLabel(role: Member['role']): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'ADMIN') return 'Manager';
  return 'Member';
}

export function MembersPage() {
  const { active } = useCommunity();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ['me'], queryFn: () => get<Me>('/api/v1/me') });
  const query = useQuery({
    queryKey: ['members', active?.id],
    queryFn: () => get<Member[]>(`/api/v1/communities/${active?.id}/members`),
    enabled: Boolean(active),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['members', active?.id] });
    void queryClient.invalidateQueries({ queryKey: ['communities'] });
  };

  const role = useMutation({
    mutationFn: (input: { membershipId: string; role: 'ADMIN' | 'MEMBER' }) =>
      patch(`/api/v1/communities/${active?.id}/members/${input.membershipId}`, {
        role: input.role,
      }),
    onSuccess: () => {
      notify('success');
      refresh();
    },
    onError: () => notify('error'),
  });

  const transfer = useMutation({
    mutationFn: (membershipId: string) =>
      post(`/api/v1/communities/${active?.id}/ownership/transfer`, { membershipId }),
    onSuccess: () => {
      notify('success');
      refresh();
    },
    onError: () => notify('error'),
  });

  const ban = useMutation({
    mutationFn: (membershipId: string) =>
      patch(
        `/api/v1/community-management/communities/${active?.id}/members/${membershipId}/ban`,
        {},
      ),
    onSuccess: () => {
      notify('success');
      refresh();
    },
    onError: () => notify('error'),
  });

  const isOwner = active?.role === 'OWNER';
  const canModerate = active?.role === 'OWNER' || active?.role === 'ADMIN';

  return (
    <div className="page-shell">
      <div className="section-kicker">Squad</div>
      <h1 className="section-title">Members</h1>
      <div className="mt-5 grid gap-2">
        {query.data?.map((membership) => {
          const isSelf = membership.user.id === me.data?.id;
          return (
            <div className="reference-row px-4 py-3" key={membership.id}>
              <div className="flex items-center gap-3">
                <div
                  className="grid h-11 w-11 place-items-center rounded-full font-black"
                  style={{ background: 'var(--surface-3)' }}
                >
                  {(membership.user.firstName || membership.user.username || 'G')[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black">
                    {[membership.user.firstName, membership.user.lastName]
                      .filter(Boolean)
                      .join(' ') ||
                      membership.user.username ||
                      'HOOMA member'}
                  </div>
                  <div className="text-xs muted">
                    {membership.user.profile?.skillLevel || 'MIXED'} ·{' '}
                    {membership.user.profile?.preferredPositions?.join(', ') || 'Any position'}
                  </div>
                </div>
                <span className="chip">
                  {membership.role === 'OWNER' ? (
                    <Crown size={12} />
                  ) : membership.role === 'ADMIN' ? (
                    <ShieldCheck size={12} />
                  ) : null}{' '}
                  {communityRoleLabel(membership.role)}
                </span>
              </div>

              {canModerate && !isSelf && membership.role !== 'OWNER' && (
                <div
                  className="mt-3 flex flex-wrap gap-2 border-t pt-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {isOwner && (
                    <button
                      className="ghost-button py-2"
                      disabled={role.isPending}
                      onClick={() =>
                        role.mutate({
                          membershipId: membership.id,
                          role: membership.role === 'ADMIN' ? 'MEMBER' : 'ADMIN',
                        })
                      }
                    >
                      <ShieldCheck size={14} />
                      {membership.role === 'ADMIN' ? 'Remove manager' : 'Make manager'}
                    </button>
                  )}
                  {isOwner && (
                    <button
                      className="ghost-button py-2"
                      disabled={transfer.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Transfer community ownership to this member? You will become a manager.',
                          )
                        ) {
                          transfer.mutate(membership.id);
                        }
                      }}
                    >
                      <Crown size={14} /> Transfer ownership
                    </button>
                  )}
                  <button
                    className="ghost-button py-2"
                    disabled={ban.isPending}
                    onClick={() => {
                      if (window.confirm('Ban this member from the community?'))
                        ban.mutate(membership.id);
                    }}
                  >
                    <UserMinus size={14} /> Ban
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

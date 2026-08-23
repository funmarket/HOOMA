import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Shield, UserRound } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { getPublicPlayerProfile, profileQueryKeys } from '../features/profile/api';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export function PublicPlayerProfilePage() {
  const { userId = '' } = useParams();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: profileQueryKeys.public(userId),
    queryFn: () => getPublicPlayerProfile(userId),
    enabled: Boolean(userId),
    retry: false,
  });

  if (query.isLoading) {
    return (
      <div className="page-shell vintage-page">
        <div className="vintage-empty h-72 animate-pulse" />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="page-shell vintage-page">
        <button type="button" className="ghost-button mb-4" onClick={() => navigate(-1)}>
          <ArrowLeft size={17} /> Back
        </button>
        <div className="vintage-empty">
          {query.error instanceof Error ? query.error.message : 'Player profile not found.'}
        </div>
      </div>
    );
  }

  const player = query.data;
  const profile = player.profile;
  const isPlayer = profile?.effectiveIdentities.includes('PLAYER') ?? false;
  const positions = profile?.preferredPositions.length
    ? profile.preferredPositions.join(' · ')
    : 'Flexible role';

  return (
    <div className="page-shell vintage-page">
      <button type="button" className="ghost-button mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft size={17} /> Back
      </button>

      <section className="surface-card overflow-hidden border border-[#d6ff38]/20 bg-black/60 p-4 shadow-[0_32px_80px_rgba(0,0,0,0.45)] sm:p-5">
        <div className="section-kicker">HOOMA player profile</div>
        <div className="mt-4 grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="aspect-square overflow-hidden rounded-[1.5rem] border border-[#d6ff38]/25 bg-black/60">
            {player.effectivePhotoUrl ? (
              <img
                src={player.effectivePhotoUrl}
                alt={player.effectiveDisplayName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center text-4xl font-black text-[#f4efe2]">
                {initials(player.effectiveDisplayName) || <UserRound size={42} />}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="break-words text-[2.2rem] font-black leading-none text-[#f4efe2]">
              {player.effectiveDisplayName}
            </h1>
            <p className="mt-2 text-[17px] text-[#d2ccbc]">
              {player.effectiveUsername ? `@${player.effectiveUsername}` : 'HOOMA football profile'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {profile?.effectiveIdentities.map((identity) => (
                <span key={identity} className="chip">
                  {identity.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {isPlayer ? (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="vintage-kicker">Position</div>
                <strong className="mt-2 block text-[17px] text-[#f4efe2]">{positions}</strong>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="vintage-kicker">Player level</div>
                <strong className="mt-2 block text-[17px] text-[#f4efe2]">
                  {profile?.skillLevel ?? 'MIXED'} · OVR {profile?.skillRating ?? 50}
                </strong>
              </div>
            </>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="vintage-kicker">Favorite club</div>
            <strong className="mt-2 flex items-center gap-2 text-[17px] text-[#f4efe2]">
              <Shield size={17} /> {profile?.favoriteClub?.name ?? 'No club selected'}
            </strong>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:col-span-2">
            <div className="vintage-kicker">Bio</div>
            <p className="mt-2 text-[17px] leading-7 text-[#d2ccbc]">
              {profile?.bio ?? 'No public football bio yet.'}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

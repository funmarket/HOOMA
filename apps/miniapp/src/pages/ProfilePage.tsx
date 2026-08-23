import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCurrentProfile,
  listFavoriteClubOptions,
  profileQueryKeys,
  updateCurrentProfile,
} from '../features/profile/api';
import type {
  EffectiveProfileIdentity,
  ProfileMe,
  SelectedProfileIdentity,
} from '../features/profile/types';
import { notify } from '../lib/telegram';
import type { Club } from '../types/domain';

const POSITION_OPTIONS = ['GK', 'CB', 'FB', 'WB', 'DM', 'CM', 'AM', 'W', 'ST', 'ANY'] as const;

const IDENTITY_OPTIONS: Array<{
  value: SelectedProfileIdentity;
  title: string;
  detail: string;
}> = [
  {
    value: 'PLAYER',
    title: 'Player',
    detail: 'I play football and want player details on my HOOMA passport.',
  },
  {
    value: 'FAN',
    title: 'Fan',
    detail: 'Football supporter identity. No Team or community membership is required.',
  },
  {
    value: 'GAMER',
    title: 'Gamer',
    detail: 'Football gaming is part of my HOOMA identity.',
  },
];

const IDENTITY_LABELS: Record<EffectiveProfileIdentity, string> = {
  PLAYER: 'Player',
  FAN: 'Fan',
  ULTRAFAN: 'UltraFan',
  GAMER: 'Gamer',
  GHOST_RIDER: 'Ghost Rider',
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function previewEffectiveIdentities(
  selected: SelectedProfileIdentity[],
  current: EffectiveProfileIdentity[],
): EffectiveProfileIdentity[] {
  const effective: EffectiveProfileIdentity[] = [];
  if (selected.includes('PLAYER')) effective.push('PLAYER');
  if (selected.includes('FAN')) effective.push('FAN');
  if (current.includes('ULTRAFAN')) effective.push('ULTRAFAN');
  if (selected.includes('GAMER')) effective.push('GAMER');
  return effective.length ? effective : ['GHOST_RIDER'];
}

function ProfileCard({
  me,
  displayName,
  photoUrl,
  selectedIdentities,
  photoBroken,
  onPhotoError,
}: {
  me: ProfileMe;
  displayName: string;
  photoUrl: string;
  selectedIdentities: SelectedProfileIdentity[];
  photoBroken: boolean;
  onPhotoError: () => void;
}) {
  const profile = me.profile;
  const name = displayName.trim() || me.effectiveDisplayName;
  const visibleUsername = me.effectiveUsername ?? '';
  const visiblePhotoUrl = photoUrl.trim() || me.effectivePhotoUrl || '';
  const isPlayer = selectedIdentities.includes('PLAYER');
  const effectiveIdentities = previewEffectiveIdentities(
    selectedIdentities,
    profile?.effectiveIdentities ?? ['GHOST_RIDER'],
  );
  const positions = profile?.preferredPositions?.length
    ? profile.preferredPositions.join(' · ')
    : 'Flexible role';

  return (
    <section className="surface-card overflow-hidden border border-[#d6ff38]/20 bg-black/60 shadow-[0_0_0_1px_rgba(214,255,56,0.08),0_32px_80px_rgba(0,0,0,0.45)]">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,255,56,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(255,196,72,0.12),transparent_28%),linear-gradient(180deg,rgba(10,10,10,0.9),rgba(0,0,0,0.98))]" />
        <div className="relative grid gap-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="section-kicker">HOOMA identity</div>
              <div className="mt-1 break-words text-[2rem] font-black leading-none tracking-tight text-[#f4efe2] sm:text-[2.4rem]">
                {name}
              </div>
              <div className="mt-2 text-[17px] font-medium text-[#d2ccbc]">
                {visibleUsername ? `@${visibleUsername}` : 'Football passport'}
              </div>
            </div>

            {isPlayer ? (
              <div className="shrink-0 rounded-2xl border border-[#d6ff38]/25 bg-black/55 px-3 py-2 text-right">
                <div className="text-[0.75rem] font-black uppercase tracking-[0.28em] text-[#d6ff38]">
                  OVR
                </div>
                <div className="text-[2rem] font-black leading-none text-[#f4efe2]">
                  {profile?.skillRating ?? 50}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {effectiveIdentities.map((identity) => (
              <span
                key={identity}
                className="chip border-[#d6ff38]/30 bg-[#d6ff38]/5 text-[#f4efe2]"
              >
                {IDENTITY_LABELS[identity]}
              </span>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-[#d6ff38]/20 bg-[#0a0a0a]">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(214,255,56,0.06),rgba(0,0,0,0.85))]" />
              <div className="relative aspect-[3/4]">
                {!photoBroken && visiblePhotoUrl ? (
                  <img
                    src={visiblePhotoUrl}
                    alt={name}
                    className="h-full w-full object-cover"
                    onError={onPhotoError}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(214,255,56,0.18),rgba(0,0,0,0.95))]">
                    <div className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-[#d6ff38]/40 bg-black/50 text-5xl font-black tracking-[0.18em] text-[#f4efe2]">
                      {initials(name)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid content-start gap-3">
              {isPlayer ? (
                <>
                  <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                    <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-[#d6ff38]">
                      Position
                    </div>
                    <div className="mt-2 text-[17px] font-semibold text-[#f4efe2]">{positions}</div>
                  </div>

                  <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                    <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-[#d6ff38]">
                      Skill
                    </div>
                    <div className="mt-2 text-[17px] font-semibold text-[#f4efe2]">
                      {profile?.skillLevel ?? 'MIXED'}
                    </div>
                  </div>
                </>
              ) : null}

              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-[#d6ff38]">
                  Favorite club
                </div>
                <div className="mt-2 text-[17px] font-semibold text-[#f4efe2]">
                  {profile?.favoriteClub?.name || 'No club selected'}
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 p-4">
                <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-[#d6ff38]">
                  Bio
                </div>
                <p className="mt-2 text-[17px] leading-7 text-[#d2ccbc]">
                  {profile?.bio || 'Add a short football bio to your HOOMA passport.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProfileForm({ me, clubs }: { me: ProfileMe; clubs: Club[] }) {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(me.presentation?.displayName || '');
  const [photoUrl, setPhotoUrl] = useState(me.presentation?.photoUrl || '');
  const [photoBroken, setPhotoBroken] = useState(false);
  const [skill, setSkill] = useState(me.profile?.skillLevel || 'MIXED');
  const [favoriteClubId, setFavoriteClubId] = useState(me.profile?.favoriteClubId || '');
  const [bio, setBio] = useState(me.profile?.bio || '');
  const [selectedIdentities, setSelectedIdentities] = useState<SelectedProfileIdentity[]>(
    me.profile?.selectedIdentities ?? [],
  );
  const [preferredPositions, setPreferredPositions] = useState<string[]>(
    me.profile?.preferredPositions || [],
  );
  const isPlayer = selectedIdentities.includes('PLAYER');
  const isUltraFan = me.profile?.effectiveIdentities.includes('ULTRAFAN') ?? false;

  const toggleIdentity = (identity: SelectedProfileIdentity) => {
    setSelectedIdentities((current) =>
      current.includes(identity)
        ? current.filter((value) => value !== identity)
        : [...current, identity],
    );
  };

  const togglePosition = (position: string) => {
    setPreferredPositions((current) => {
      if (current.includes(position)) return current.filter((value) => value !== position);
      if (current.length >= 5) return current;
      return [...current, position];
    });
  };

  const mutation = useMutation({
    mutationFn: () =>
      updateCurrentProfile({
        displayName: displayName.trim() || null,
        photoUrl: photoUrl.trim() || null,
        favoriteClubId: favoriteClubId || null,
        selectedIdentities,
        bio: bio || null,
        ...(isPlayer ? { skillLevel: skill, preferredPositions } : {}),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(profileQueryKeys.me(), updated);
      notify('success');
    },
    onError: () => notify('error'),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <ProfileCard
        me={me}
        displayName={displayName}
        photoUrl={photoUrl}
        selectedIdentities={selectedIdentities}
        photoBroken={photoBroken}
        onPhotoError={() => setPhotoBroken(true)}
      />

      <div className="surface-card grid gap-5 p-4">
        <div>
          <div className="section-kicker">Edit profile</div>
          <h2 className="section-title">Your HOOMA identity</h2>
          <p className="mt-2 text-[17px] leading-7 muted">
            Your Display Name and profile photo are yours to control. Your username comes from your
            HOOMA web login when you have one, otherwise from Telegram.
          </p>
        </div>

        <label className="grid gap-2 text-[17px] font-semibold text-[#f4efe2]">
          HOOMA display name
          <input
            className="hooma-input"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={me.effectiveDisplayName}
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-[0.78rem] font-black uppercase tracking-[0.24em] text-[#d6ff38]">
            Username
          </div>
          <div className="mt-2 text-[17px] font-semibold text-[#f4efe2]">
            {me.effectiveUsername ? `@${me.effectiveUsername}` : 'Not set'}
          </div>
          <p className="mt-1 text-[15px] leading-6 text-[#d2ccbc]">
            {me.telegramUserId
              ? 'Telegram stays connected without overwriting web credentials.'
              : 'This is the username used to sign in on the webapp.'}
          </p>
          {me.telegramUserId && me.telegramUsername ? (
            <p className="mt-2 text-[15px] leading-6 text-[#d2ccbc]">
              Connected Telegram: @{me.telegramUsername}
            </p>
          ) : null}
        </div>

        <label className="grid gap-2 text-[17px] font-semibold text-[#f4efe2]">
          HOOMA profile photo URL
          <input
            className="hooma-input"
            type="url"
            value={photoUrl}
            onChange={(event) => {
              setPhotoBroken(false);
              setPhotoUrl(event.target.value);
            }}
            placeholder={me.effectivePhotoUrl || 'https://example.com/profile-photo.jpg'}
          />
        </label>

        <fieldset className="grid gap-3">
          <legend className="text-[17px] font-semibold text-[#f4efe2]">I am a...</legend>
          <div className="grid gap-2">
            {IDENTITY_OPTIONS.map((option) => {
              const checked = selectedIdentities.includes(option.value);
              return (
                <label
                  key={option.value}
                  className={[
                    'grid cursor-pointer gap-1.5 rounded-2xl border p-3 transition',
                    checked
                      ? 'border-[#d6ff38]/60 bg-[#d6ff38]/10'
                      : 'border-white/10 bg-white/5 hover:border-white/20',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-2 text-[17px] font-semibold text-[#f4efe2]">
                    <input
                      type="checkbox"
                      value={option.value}
                      checked={checked}
                      onChange={() => toggleIdentity(option.value)}
                    />
                    {option.title}
                  </span>
                  <span className="text-[15px] leading-6 text-[#d2ccbc]">{option.detail}</span>
                </label>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[15px] leading-6 text-[#d2ccbc]">
            {isUltraFan ? (
              <>
                <strong className="text-[#d6ff38]">UltraFan</strong> is active from your ULTRAS
                membership. It cannot be selected manually.
              </>
            ) : (
              <>
                <strong className="text-[#f4efe2]">Ghost Rider</strong> appears automatically when
                you have no other active identity. UltraFan is earned through an active ULTRAS
                membership.
              </>
            )}
          </div>
        </fieldset>

        {isPlayer ? (
          <div className="grid gap-4 rounded-2xl border border-[#d6ff38]/20 bg-[#d6ff38]/5 p-3">
            <div>
              <div className="section-kicker">Player details</div>
              <p className="mt-1 text-[15px] leading-6 text-[#d2ccbc]">
                These fields appear because Player is selected.
              </p>
            </div>

            <label className="grid gap-2 text-[17px] font-semibold text-[#f4efe2]">
              Skill level
              <select
                className="hooma-input"
                value={skill}
                onChange={(event) => setSkill(event.target.value)}
              >
                {['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'MIXED'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>

            <fieldset className="grid gap-2">
              <legend className="text-[17px] font-semibold text-[#f4efe2]">
                Preferred positions
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {POSITION_OPTIONS.map((position) => {
                  const checked = preferredPositions.includes(position);
                  return (
                    <label
                      key={position}
                      className={[
                        'flex cursor-pointer items-center justify-between rounded-2xl border px-3 py-2 transition',
                        checked
                          ? 'border-[#d6ff38]/60 bg-[#d6ff38]/10 text-[#f4efe2]'
                          : 'border-white/10 bg-white/5 text-[#d2ccbc] hover:border-white/20',
                      ].join(' ')}
                    >
                      <span className="text-[17px] font-semibold">{position}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePosition(position)}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="text-[15px] muted">Choose up to 5 positions.</p>
            </fieldset>
          </div>
        ) : null}

        <label className="grid gap-2 text-[17px] font-semibold text-[#f4efe2]">
          Favorite club
          <select
            className="hooma-input"
            value={favoriteClubId}
            onChange={(event) => setFavoriteClubId(event.target.value)}
          >
            <option value="">No favorite club</option>
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-[17px] font-semibold text-[#f4efe2]">
          Bio
          <textarea
            className="hooma-input min-h-28"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Tell HOOMA a little about you"
          />
        </label>

        <button
          className="accent-button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Save profile
        </button>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const meQuery = useQuery({ queryKey: profileQueryKeys.me(), queryFn: getCurrentProfile });
  const clubsQuery = useQuery({
    queryKey: profileQueryKeys.favoriteClubOptions(),
    queryFn: listFavoriteClubOptions,
  });

  return (
    <div className="page-shell">
      <div className="section-kicker">Football passport</div>
      <h1 className="section-title">Your Profile</h1>
      <p className="mt-2 max-w-2xl text-[17px] leading-7 muted">
        Build one HOOMA identity that can grow with how you play, support, and experience football.
      </p>
      {meQuery.data ? (
        <ProfileForm me={meQuery.data} clubs={clubsQuery.data ?? []} />
      ) : (
        <div className="surface-card mt-5 h-56 animate-pulse" />
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  GamerGamePlatform,
  GamerPlatformIdentityProvider,
  GamerPlayStyle,
  GamerSocialProvider,
  GamerVisibility,
} from '@hooma/contracts';
import { get, post } from '../shared/api/http-client';
import type { CursorPage } from '../types/domain';

type Game = {
  id: string;
  slug: string;
  name: string;
  platforms: GamerGamePlatform[];
};

const playStyles: GamerPlayStyle[] = ['CASUAL', 'COMPETITIVE', 'RANKED'];
const visibilities: GamerVisibility[] = ['PUBLIC', 'MATCHED_ONLY', 'PRIVATE'];
const platformProviders: GamerPlatformIdentityProvider[] = [
  'EA_ID',
  'PSN',
  'XBOX',
  'NINTENDO',
  'STEAM',
  'EPIC',
  'GAME_USERNAME',
  'OTHER',
];
const socialProviders: GamerSocialProvider[] = [
  'DISCORD',
  'KIK',
  'YOUTUBE',
  'TWITCH',
  'TIKTOK',
  'OTHER',
];

export function CreateGamerCardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const requestedGameId = searchParams.get('gameId') ?? '';
  const games = useQuery({
    queryKey: ['gamers', 'games'],
    queryFn: () => get<CursorPage<Game>>('/api/v1/gamers/games?limit=50'),
  });
  const [gameId, setGameId] = useState(requestedGameId);
  const [gamerTag, setGamerTag] = useState('');
  const [bio, setBio] = useState('');
  const [playStyle, setPlayStyle] = useState<GamerPlayStyle>('CASUAL');
  const [openToChallenge, setOpenToChallenge] = useState(true);
  const [region, setRegion] = useState('');
  const [language, setLanguage] = useState('');
  const [preferredTimes, setPreferredTimes] = useState('');
  const [visibility, setVisibility] = useState<GamerVisibility>('PUBLIC');
  const [platformProvider, setPlatformProvider] =
    useState<GamerPlatformIdentityProvider>('GAME_USERNAME');
  const [platformHandle, setPlatformHandle] = useState('');
  const [platformVisibility, setPlatformVisibility] = useState<GamerVisibility>('PUBLIC');
  const [socialProvider, setSocialProvider] = useState<GamerSocialProvider>('DISCORD');
  const [socialUrl, setSocialUrl] = useState('');
  const [socialVisibility, setSocialVisibility] = useState<GamerVisibility>('PUBLIC');

  const effectiveGameId = useMemo(
    () => gameId || games.data?.items[0]?.id || '',
    [gameId, games.data],
  );

  const createProfile = useMutation({
    mutationFn: () =>
      post('/api/v1/gamers/profiles', {
        gameId: effectiveGameId,
        gamerTag,
        bio,
        playStyle,
        openToChallenge,
        region,
        language,
        preferredTimes,
        visibility,
        platformIdentities: platformHandle.trim()
          ? [
              {
                provider: platformProvider,
                handle: platformHandle,
                visibility: platformVisibility,
              },
            ]
          : [],
        socialLinks: socialUrl.trim()
          ? [{ provider: socialProvider, url: socialUrl, visibility: socialVisibility }]
          : [],
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['gamers', 'profiles', 'mine'] });
      navigate('/gamers', { replace: true });
    },
  });

  return (
    <div className="page-shell">
      <section className="surface-card p-5">
        <div className="section-kicker">Gamer identity</div>
        <h1 className="section-title mt-1">Create Gamer Card</h1>
        <p className="mt-2 text-sm muted">
          Any signed-in HOOMA user can create one Gamer Card per game. This does not create a new
          account.
        </p>
      </section>

      <form
        className="surface-card mt-4 grid gap-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (effectiveGameId && gamerTag.trim()) createProfile.mutate();
        }}
      >
        <label className="grid gap-1 text-sm font-bold">
          Game
          <select
            className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
            style={{ borderColor: 'var(--border)' }}
            value={effectiveGameId}
            onChange={(event) => setGameId(event.target.value)}
            required
          >
            {games.data?.items.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-sm font-bold">
          Gamer tag
          <input
            className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
            style={{ borderColor: 'var(--border)' }}
            value={gamerTag}
            onChange={(event) => setGamerTag(event.target.value)}
            maxLength={80}
            required
          />
        </label>

        <label className="grid gap-1 text-sm font-bold">
          Bio
          <textarea
            className="min-h-24 rounded-xl border bg-[var(--surface-2)] p-3"
            style={{ borderColor: 'var(--border)' }}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={280}
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-bold">
            Play style
            <select
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              value={playStyle}
              onChange={(event) => setPlayStyle(event.target.value as GamerPlayStyle)}
            >
              {playStyles.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Card privacy
            <select
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as GamerVisibility)}
            >
              {visibilities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
          <input
            type="checkbox"
            checked={openToChallenge}
            onChange={(event) => setOpenToChallenge(event.target.checked)}
          />
          Open to challenges
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
            style={{ borderColor: 'var(--border)' }}
            placeholder="Region"
            value={region}
            onChange={(event) => setRegion(event.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
            style={{ borderColor: 'var(--border)' }}
            placeholder="Language"
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
          />
          <input
            className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
            style={{ borderColor: 'var(--border)' }}
            placeholder="Preferred play times"
            value={preferredTimes}
            onChange={(event) => setPreferredTimes(event.target.value)}
          />
        </div>

        <fieldset className="grid gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <legend className="px-2 text-sm font-black">Gameplay ID (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              value={platformProvider}
              onChange={(event) =>
                setPlatformProvider(event.target.value as GamerPlatformIdentityProvider)
              }
            >
              {platformProviders.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <input
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              placeholder="ID / handle"
              value={platformHandle}
              onChange={(event) => setPlatformHandle(event.target.value)}
            />
            <select
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              value={platformVisibility}
              onChange={(event) => setPlatformVisibility(event.target.value as GamerVisibility)}
            >
              {visibilities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </fieldset>

        <fieldset className="grid gap-3 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
          <legend className="px-2 text-sm font-black">Social link (optional)</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              value={socialProvider}
              onChange={(event) => setSocialProvider(event.target.value as GamerSocialProvider)}
            >
              {socialProviders.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <input
              type="url"
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              placeholder="https://…"
              value={socialUrl}
              onChange={(event) => setSocialUrl(event.target.value)}
            />
            <select
              className="min-h-11 rounded-xl border bg-[var(--surface-2)] px-3"
              style={{ borderColor: 'var(--border)' }}
              value={socialVisibility}
              onChange={(event) => setSocialVisibility(event.target.value as GamerVisibility)}
            >
              {visibilities.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </div>
        </fieldset>

        {createProfile.isError ? (
          <p className="text-sm font-bold" role="alert">
            {createProfile.error instanceof Error
              ? createProfile.error.message
              : 'Gamer Card could not be created.'}
          </p>
        ) : null}

        <button
          type="submit"
          className="ghost-button min-h-11 w-full"
          disabled={!effectiveGameId || !gamerTag.trim() || createProfile.isPending}
        >
          {createProfile.isPending ? 'Creating…' : 'Create Gamer Card'}
        </button>
      </form>
    </div>
  );
}

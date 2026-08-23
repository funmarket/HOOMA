import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  GamerGamePlatform,
  GamerGameStatus,
  GamerPlayStyle,
  GamerVisibility,
} from '@hooma/contracts';
import { get } from '../shared/api/http-client';
import type { CursorPage } from '../types/domain';
import { CreateGamerCardPage } from './CreateGamerCardPage';

type GamerGameItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  publisher: string | null;
  platforms: GamerGamePlatform[];
  status: GamerGameStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

type GamerProfileItem = {
  id: string;
  userId: string;
  gameId: string;
  gamerTag: string;
  bio: string | null;
  playStyle: GamerPlayStyle;
  openToChallenge: boolean;
  region: string | null;
  language: string | null;
  preferredTimes: string | null;
  visibility: GamerVisibility;
  game: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    coverUrl: string | null;
  };
};

function platformLabel(platform: GamerGamePlatform) {
  if (platform === 'PLAYSTATION') return 'PlayStation';
  if (platform === 'XBOX') return 'Xbox';
  if (platform === 'NINTENDO') return 'Nintendo';
  if (platform === 'MOBILE') return 'Mobile';
  if (platform === 'PC') return 'PC';
  if (platform === 'EA') return 'EA';
  return 'Other';
}

function GameArtwork({ game }: { game: GamerGameItem }) {
  const [failed, setFailed] = useState(false);
  const src = game.coverUrl || game.logoUrl;

  if (!src || failed) {
    return (
      <div
        className="grid h-44 w-full place-items-center border-b px-6 text-center"
        style={{
          borderColor: 'var(--border)',
          background:
            'radial-gradient(circle at 75% 20%, rgba(170, 255, 0, 0.12), transparent 38%), linear-gradient(135deg, var(--surface-3), var(--surface))',
        }}
      >
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent)]">
            HOOMA GAMERS
          </div>
          <div className="mt-2 text-2xl font-black tracking-[-0.04em]">{game.name}</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${game.name} artwork`}
      className="h-44 w-full object-cover"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

export function GamersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedProfile, setSelectedProfile] = useState<GamerProfileItem | null>(null);
  const games = useQuery({
    queryKey: ['gamers', 'games'],
    queryFn: () => get<CursorPage<GamerGameItem>>('/api/v1/gamers/games?limit=50'),
  });
  const profiles = useQuery({
    queryKey: ['gamers', 'profiles', 'mine'],
    queryFn: () => get<GamerProfileItem[]>('/api/v1/gamers/profiles/mine'),
    retry: false,
  });
  const profileByGame = new Map(profiles.data?.map((profile) => [profile.gameId, profile]) ?? []);

  if (searchParams.get('create') === '1') return <CreateGamerCardPage />;

  return (
    <div className="page-shell">
      <section
        className="surface-card relative overflow-hidden px-5 py-7"
        aria-labelledby="gamers-title"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(circle at 88% 12%, rgba(170, 255, 0, 0.16), transparent 30%), linear-gradient(120deg, transparent 42%, rgba(184, 137, 54, 0.08) 42.5%, transparent 43%)',
          }}
        />
        <div className="relative">
          <div className="section-kicker">HOOMA Gamers</div>
          <h1
            id="gamers-title"
            className="mt-3 max-w-[12ch] text-[clamp(2.5rem,12vw,4.6rem)] font-black uppercase leading-[0.88] tracking-[-0.065em]"
          >
            Find your next opponent
          </h1>
          <p className="mt-5 max-w-xl text-base font-semibold text-[var(--cream)]">
            Challenge. Play. Prove it. Build your Squad.
          </p>
          <p className="mt-2 max-w-xl text-sm muted">
            One HOOMA account. Create a Gamer Card for each game you play and control what other
            gamers can see.
          </p>
        </div>
      </section>

      {selectedProfile ? (
        <section className="surface-card mt-4 p-5" aria-label="Selected Gamer Card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="section-kicker">{selectedProfile.game.name}</div>
              <h2 className="section-title mt-1">{selectedProfile.gamerTag}</h2>
            </div>
            <button type="button" className="ghost-button" onClick={() => setSelectedProfile(null)}>
              Close
            </button>
          </div>
          {selectedProfile.bio ? <p className="mt-3 text-sm muted">{selectedProfile.bio}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span>{selectedProfile.playStyle}</span>
            <span>•</span>
            <span>{selectedProfile.visibility}</span>
            <span>•</span>
            <span>
              {selectedProfile.openToChallenge ? 'Open to challenge' : 'Challenges paused'}
            </span>
          </div>
          {selectedProfile.region || selectedProfile.language || selectedProfile.preferredTimes ? (
            <div className="mt-3 text-sm muted">
              {[selectedProfile.region, selectedProfile.language, selectedProfile.preferredTimes]
                .filter(Boolean)
                .join(' · ')}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="my-gamer-cards-title">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="section-kicker">Your identity</div>
            <h2 id="my-gamer-cards-title" className="section-title mt-1">
              My Gamer Cards
            </h2>
          </div>
        </div>

        {profiles.isLoading ? (
          <div className="surface-card mt-3 p-5 text-sm muted" role="status">
            Loading your Gamer Cards…
          </div>
        ) : profiles.isError ? (
          <div className="surface-card mt-3 p-5">
            <p className="font-black">Sign in to create Gamer Cards.</p>
            <p className="mt-1 text-sm muted">
              Any authenticated HOOMA account can create a Gamer Card. No Player, Team, or approval
              requirement applies.
            </p>
          </div>
        ) : profiles.data?.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {profiles.data.map((profile) => (
              <button
                key={profile.id}
                type="button"
                className="surface-card min-h-28 p-4 text-left"
                onClick={() => setSelectedProfile(profile)}
              >
                <div className="section-kicker">{profile.game.name}</div>
                <div className="mt-1 text-xl font-black">{profile.gamerTag}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs muted">
                  <span>{profile.playStyle}</span>
                  <span>•</span>
                  <span>{profile.visibility}</span>
                  <span>•</span>
                  <span>{profile.openToChallenge ? 'Open to challenge' : 'Challenges paused'}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="surface-card mt-3 p-5">
            <p className="font-black">Create your first Gamer Card.</p>
            <p className="mt-1 text-sm muted">
              Choose any active game below. Your existing HOOMA account stays your canonical
              identity.
            </p>
          </div>
        )}
      </section>

      <section className="mt-7" aria-labelledby="game-catalog-title">
        <div>
          <div className="section-kicker">Choose your game</div>
          <h2 id="game-catalog-title" className="section-title mt-1">
            Game Catalog
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2" aria-live="polite">
          {games.isLoading ? (
            <div className="surface-card p-5 text-sm muted" role="status">
              Loading games…
            </div>
          ) : games.isError ? (
            <div className="surface-card p-5" role="alert">
              <p className="font-black">Games could not be loaded.</p>
              <button type="button" className="ghost-button mt-3" onClick={() => games.refetch()}>
                Try again
              </button>
            </div>
          ) : games.data?.items.length ? (
            games.data.items.map((game) => {
              const profile = profileByGame.get(game.id);
              return (
                <article key={game.id} className="surface-card overflow-hidden">
                  <GameArtwork game={game} />
                  <div className="grid gap-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {game.featured ? (
                          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--accent)]">
                            Featured
                          </div>
                        ) : null}
                        <h3 className="mt-1 text-xl font-black tracking-[-0.035em]">{game.name}</h3>
                        {game.publisher ? (
                          <p className="mt-1 text-xs muted">{game.publisher}</p>
                        ) : null}
                      </div>
                      <span
                        className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em]"
                        style={{ borderColor: 'var(--border-strong)' }}
                      >
                        Active
                      </span>
                    </div>

                    {game.description ? <p className="text-sm muted">{game.description}</p> : null}

                    <div className="flex flex-wrap gap-2" aria-label={`${game.name} platforms`}>
                      {game.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="rounded-full border px-2.5 py-1 text-xs font-bold"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          {platformLabel(platform)}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="ghost-button w-full"
                      onClick={() =>
                        profile
                          ? setSelectedProfile(profile)
                          : navigate(`/gamers?create=1&gameId=${encodeURIComponent(game.id)}`)
                      }
                    >
                      {profile ? `Open ${profile.gamerTag}` : 'Create Gamer Card'}
                    </button>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="surface-card p-5">
              <p className="font-black">No active games yet.</p>
              <p className="mt-1 text-sm muted">
                The Platform Admin has not published a game to the canonical catalog yet.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

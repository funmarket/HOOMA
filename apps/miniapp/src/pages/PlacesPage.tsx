import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { get } from '../shared/api/http-client';
import { useCommunity } from '../providers/CommunityProvider';
import type { CursorPage, Place } from '../types/domain';

type PitchListing = {
  id: string;
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  venueType?: string | null;
  city?: string | null;
  houma?: string | null;
  fullAddress?: string | null;
  hourlyRateMinor?: number | null;
  currency?: string | null;
};

type PlaceFeedItem =
  | { kind: 'WATCH'; id: string; name: string; place: Place }
  | { kind: 'PITCH'; id: string; name: string; pitch: PitchListing };

function placeStatusLabel(place: Place) {
  if (place.status === 'VERIFIED') return 'Verified venue';
  if (place.status === 'OWNER_CLAIMED') return 'Owner claim pending';
  return 'Suggested by community';
}

function pitchRateLabel(pitch: PitchListing) {
  const hasRate =
    pitch.hourlyRateMinor !== null &&
    pitch.hourlyRateMinor !== undefined &&
    Boolean(pitch.currency);
  if (!hasRate) return null;

  const amount = pitch.hourlyRateMinor! / 100;
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)} ${pitch.currency} / hour`;
}

export function PlacesPage() {
  const { active } = useCommunity();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim();

  const watchPlaces = useQuery({
    queryKey: ['places', 'watch', active?.id, normalizedSearch],
    queryFn: () =>
      get<Place[]>(
        `/api/v1/watch/places?communityId=${active?.id}${normalizedSearch ? `&q=${encodeURIComponent(normalizedSearch)}` : ''}`,
      ),
    enabled: Boolean(active),
  });

  const pitchPlaces = useQuery({
    queryKey: ['places', 'pitch', normalizedSearch],
    queryFn: () =>
      get<CursorPage<PitchListing>>(
        `/api/v1/pitch${normalizedSearch ? `?q=${encodeURIComponent(normalizedSearch)}` : ''}`,
      ),
  });

  const feed: PlaceFeedItem[] = [
    ...(watchPlaces.data ?? []).map((place): PlaceFeedItem => ({
      kind: 'WATCH',
      id: place.id,
      name: place.name,
      place,
    })),
    ...(pitchPlaces.data?.items ?? []).map((pitch): PlaceFeedItem => ({
      kind: 'PITCH',
      id: pitch.id,
      name: pitch.name,
      pitch,
    })),
  ].sort((left, right) => left.name.localeCompare(right.name));

  const isLoading = watchPlaces.isLoading || pitchPlaces.isLoading;
  const hasError = watchPlaces.isError && pitchPlaces.isError;

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-section-heading">
        <div>
          <div className="vintage-kicker">Watch + Pitch</div>
          <h1 className="section-title">Places</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className="vintage-text-button" onClick={() => navigate('/watch')}>
            Watch
          </button>
          <button type="button" className="vintage-text-button" onClick={() => navigate('/pitch')}>
            Pitch
          </button>
        </div>
      </div>
      <p className="vintage-copy mt-2">
        Discover football places from both HOOMA Watch venues and published Pitch listings.
      </p>
      <div className="mt-4">
        <input
          className="hooma-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search places, city or houma"
        />
      </div>
      <section className="mt-5 grid gap-3" aria-label="Places">
        {isLoading ? (
          <div className="vintage-empty">Loading places...</div>
        ) : hasError ? (
          <div className="vintage-empty">Places could not be loaded.</div>
        ) : feed.length ? (
          feed.map((item) => {
            if (item.kind === 'WATCH') {
              const place = item.place;
              return (
                <article key={`watch-${place.id}`} className="surface-card overflow-hidden">
                  {place.photoUrl ? (
                    <img
                      src={place.photoUrl}
                      alt={place.name}
                      className="h-44 w-full object-cover"
                    />
                  ) : null}
                  <div className="grid gap-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="vintage-kicker">Watch</div>
                        <h2 className="text-xl font-black">{place.name}</h2>
                        <p className="text-sm muted">{place.category}</p>
                      </div>
                      <span className="text-xs font-black">{placeStatusLabel(place)}</span>
                    </div>
                    <p className="text-sm">
                      {[place.city, place.houma].filter(Boolean).join(', ') || place.address}
                    </p>
                    {place.description ? (
                      <p className="text-sm muted">{place.description}</p>
                    ) : null}
                    {place.menuItems?.length ? (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {place.menuItems.map((menuItem) => (
                          <span
                            key={menuItem.id}
                            className="rounded-full border px-3 py-1 text-xs"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            {menuItem.name}
                            {menuItem.priceLabel ? ` · ${menuItem.priceLabel}` : ''}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="ghost-button mt-2"
                      onClick={() => navigate(`/watch/places/${place.id}`)}
                    >
                      View Watch Place
                    </button>
                  </div>
                </article>
              );
            }

            const pitch = item.pitch;
            const rateLabel = pitchRateLabel(pitch);
            return (
              <article key={`pitch-${pitch.id}`} className="surface-card overflow-hidden">
                {pitch.photoUrl ? (
                  <img src={pitch.photoUrl} alt={pitch.name} className="h-44 w-full object-cover" />
                ) : null}
                <div className="grid gap-2 p-4">
                  <div>
                    <div className="vintage-kicker">Pitch</div>
                    <h2 className="text-xl font-black">{pitch.name}</h2>
                    {pitch.venueType ? (
                      <p className="text-sm muted">{pitch.venueType.replaceAll('_', ' ')}</p>
                    ) : null}
                  </div>
                  <p className="text-sm">
                    {[pitch.city, pitch.houma].filter(Boolean).join(', ') ||
                      pitch.fullAddress ||
                      'Location available from Pitch'}
                  </p>
                  {pitch.description ? <p className="text-sm muted">{pitch.description}</p> : null}
                  {rateLabel ? <p className="text-sm font-black">{rateLabel}</p> : null}
                  <button
                    type="button"
                    className="ghost-button mt-2"
                    onClick={() => navigate(`/pitch?q=${encodeURIComponent(pitch.name)}`)}
                  >
                    Open in Pitch
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <div className="vintage-empty">
            <strong>No places found.</strong>
            <small>Watch venues and published Pitches will appear together here.</small>
          </div>
        )}
      </section>
    </div>
  );
}

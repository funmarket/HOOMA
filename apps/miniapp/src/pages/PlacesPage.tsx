import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { get } from '../shared/api/http-client';
import { useCommunity } from '../providers/CommunityProvider';
import type { Place } from '../types/domain';

type PitchListing = {
  id: string;
  name: string;
  description?: string | null;
  photoUrl?: string | null;
  venueType?: string | null;
  city?: string | null;
  houma?: string | null;
  fullAddress?: string | null;
  hourlyRateMinor?: string | number | null;
  currency?: string | null;
};

type PitchPage = { items: PitchListing[]; nextCursor: string | null };

function placeStatusLabel(place: Place) {
  if (place.status === 'VERIFIED') return 'Verified venue';
  if (place.status === 'OWNER_CLAIMED') return 'Owner claim pending';
  return 'Suggested by community';
}

function formatPitchRate(pitch: PitchListing) {
  if (pitch.hourlyRateMinor == null || !pitch.currency) return null;
  const amount = Number(pitch.hourlyRateMinor) / 100;
  return Number.isFinite(amount) ? `${amount.toFixed(amount % 1 ? 2 : 0)} ${pitch.currency}/hour` : null;
}

export function PlacesPage() {
  const { active } = useCommunity();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = search.trim();

  const watchPlaces = useQuery({
    queryKey: ['places', 'watch', active?.id, query],
    queryFn: () =>
      get<Place[]>(
        `/api/v1/places?communityId=${active?.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
    enabled: Boolean(active),
  });

  const pitchPlaces = useQuery({
    queryKey: ['places', 'pitch', query],
    queryFn: () => get<PitchPage>(`/api/v1/pitch${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  });

  const isLoading = watchPlaces.isLoading || pitchPlaces.isLoading;
  const isError = watchPlaces.isError || pitchPlaces.isError;
  const hasWatchPlaces = Boolean(watchPlaces.data?.length);
  const hasPitchPlaces = Boolean(pitchPlaces.data?.items.length);

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-section-heading">
        <div>
          <div className="vintage-kicker">Watch &amp; Pitch</div>
          <h1 className="section-title">Places</h1>
        </div>
      </div>
      <p className="vintage-copy">
        Discover places to watch football and published pitches to play on in one feed.
      </p>
      <div className="mt-4">
        <input
          className="hooma-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search place, pitch, city or houma"
        />
      </div>

      <section className="mt-5 grid gap-3" aria-label="Watch and Pitch places">
        {isLoading ? <div className="vintage-empty">Loading places...</div> : null}
        {isError ? <div className="vintage-empty">Some places could not be loaded.</div> : null}

        {watchPlaces.data?.map((place) => (
          <article key={`watch-${place.id}`} className="surface-card overflow-hidden">
            {place.photoUrl ? (
              <img src={place.photoUrl} alt={place.name} className="h-44 w-full object-cover" />
            ) : null}
            <div className="grid gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="vintage-kicker">Watch</span>
                  <h2 className="text-xl font-black">{place.name}</h2>
                  <p className="text-sm muted">{place.category}</p>
                </div>
                <span className="text-xs font-black">{placeStatusLabel(place)}</span>
              </div>
              <p className="text-sm">
                {[place.city, place.houma].filter(Boolean).join(', ') || place.address}
              </p>
              {place.description ? <p className="text-sm muted">{place.description}</p> : null}
              {place.menuItems?.length ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {place.menuItems.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full border px-3 py-1 text-xs"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {item.name}
                      {item.priceLabel ? ` · ${item.priceLabel}` : ''}
                    </span>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                className="ghost-button mt-2"
                onClick={() => navigate(`/places/${place.id}`)}
              >
                View Watch Place
              </button>
            </div>
          </article>
        ))}

        {pitchPlaces.data?.items.map((pitch) => {
          const rate = formatPitchRate(pitch);
          return (
            <article key={`pitch-${pitch.id}`} className="surface-card overflow-hidden">
              {pitch.photoUrl ? (
                <img src={pitch.photoUrl} alt={pitch.name} className="h-44 w-full object-cover" />
              ) : null}
              <div className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="vintage-kicker">Pitch</span>
                    <h2 className="text-xl font-black">{pitch.name}</h2>
                    {pitch.venueType ? (
                      <p className="text-sm muted">{pitch.venueType.replaceAll('_', ' ')}</p>
                    ) : null}
                  </div>
                  {rate ? <span className="text-xs font-black">{rate}</span> : null}
                </div>
                <p className="text-sm">
                  {[pitch.city, pitch.houma].filter(Boolean).join(', ') || pitch.fullAddress || 'Location available on Pitch'}
                </p>
                {pitch.description ? <p className="text-sm muted">{pitch.description}</p> : null}
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
        })}

        {!isLoading && !isError && !hasWatchPlaces && !hasPitchPlaces ? (
          <div className="vintage-empty">
            <strong>No places found.</strong>
            <small>Watch venues and published Pitch listings will appear here.</small>
          </div>
        ) : null}
      </section>
    </div>
  );
}

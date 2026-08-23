import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { get } from '../shared/api/http-client';
import { useCommunity } from '../providers/CommunityProvider';
import type { Place } from '../types/domain';

type PlaceSource = 'ALL' | 'WATCH' | 'PITCH';

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

type PitchListingPage = {
  items: PitchListing[];
  nextCursor: string | null;
};

type UnifiedPlace = {
  id: string;
  source: Exclude<PlaceSource, 'ALL'>;
  name: string;
  category: string;
  description?: string | null;
  photoUrl?: string | null;
  location: string;
  statusLabel: string;
  detailPath: string;
  menuItems?: Place['menuItems'];
};

function placeStatusLabel(place: Place) {
  if (place.status === 'VERIFIED') return 'Verified venue';
  if (place.status === 'OWNER_CLAIMED') return 'Owner claim pending';
  return 'Suggested by community';
}

function pitchPriceLabel(pitch: PitchListing) {
  if (pitch.hourlyRateMinor === null || pitch.hourlyRateMinor === undefined) return 'Pitch venue';
  const amount = Number(pitch.hourlyRateMinor) / 100;
  if (!Number.isFinite(amount)) return 'Pitch venue';
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pitch.currency ?? ''}/hr`.trim();
}

export function PlacesPage() {
  const { active } = useCommunity();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<PlaceSource>('ALL');
  const query = search.trim();

  const watchPlaces = useQuery({
    queryKey: ['places', 'watch', active?.id, query],
    queryFn: () =>
      get<Place[]>(
        `/api/v1/watch/places?communityId=${active?.id}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
    enabled: Boolean(active),
  });

  const pitchPlaces = useQuery({
    queryKey: ['places', 'pitch', query],
    queryFn: () =>
      get<PitchListingPage>(`/api/v1/pitch${query ? `?q=${encodeURIComponent(query)}` : ''}`),
  });

  const places = useMemo<UnifiedPlace[]>(() => {
    const watch: UnifiedPlace[] = (watchPlaces.data ?? []).map((place) => ({
      id: place.id,
      source: 'WATCH',
      name: place.name,
      category: place.category,
      description: place.description,
      photoUrl: place.photoUrl,
      location: [place.city, place.houma].filter(Boolean).join(', ') || place.address,
      statusLabel: placeStatusLabel(place),
      detailPath: `/watch/places/${place.id}`,
      menuItems: place.menuItems,
    }));

    const pitch: UnifiedPlace[] = (pitchPlaces.data?.items ?? []).map((place) => ({
      id: place.id,
      source: 'PITCH',
      name: place.name,
      category: place.venueType || 'Football pitch',
      description: place.description,
      photoUrl: place.photoUrl,
      location: [place.city, place.houma].filter(Boolean).join(', ') || place.fullAddress || 'Location TBA',
      statusLabel: pitchPriceLabel(place),
      detailPath: `/pitch?q=${encodeURIComponent(place.name)}`,
    }));

    const combined = [...watch, ...pitch];
    return source === 'ALL' ? combined : combined.filter((place) => place.source === source);
  }, [pitchPlaces.data?.items, source, watchPlaces.data]);

  const isLoading = pitchPlaces.isLoading || (Boolean(active) && watchPlaces.isLoading);
  const hasError = pitchPlaces.isError && (!active || watchPlaces.isError);

  return (
    <div className="page-shell vintage-page">
      <div className="vintage-section-heading">
        <div>
          <div className="vintage-kicker">Watch & play venues</div>
          <h1 className="section-title">Places</h1>
        </div>
        <button
          type="button"
          className="vintage-text-button"
          onClick={() => navigate('/watch/places/new')}
        >
          Add a Place
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          className="hooma-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search Watch or Pitch places"
        />
        <div className="flex gap-2" role="group" aria-label="Place type">
          {(['ALL', 'WATCH', 'PITCH'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="ghost-button"
              aria-pressed={source === value}
              onClick={() => setSource(value)}
            >
              {value === 'ALL' ? 'All' : value === 'WATCH' ? 'Watch' : 'Pitch'}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-5 grid gap-3" aria-label="Places">
        {isLoading ? (
          <div className="vintage-empty">Loading places...</div>
        ) : hasError ? (
          <div className="vintage-empty">Places could not be loaded.</div>
        ) : places.length ? (
          places.map((place) => (
            <article key={`${place.source}-${place.id}`} className="surface-card overflow-hidden">
              {place.photoUrl ? (
                <img src={place.photoUrl} alt={place.name} className="h-44 w-full object-cover" />
              ) : null}
              <div className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="vintage-kicker">{place.source === 'WATCH' ? 'Watch' : 'Pitch'}</div>
                    <h2 className="text-xl font-black">{place.name}</h2>
                    <p className="text-sm muted">{place.category}</p>
                  </div>
                  <span className="text-xs font-black">{place.statusLabel}</span>
                </div>
                <p className="text-sm">{place.location}</p>
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
                  onClick={() => navigate(place.detailPath)}
                >
                  View {place.source === 'WATCH' ? 'Watch Place' : 'Pitch'}
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="vintage-empty">
            <strong>No places found.</strong>
            <small>Watch venues and published pitches will appear together here.</small>
          </div>
        )}
      </section>
    </div>
  );
}

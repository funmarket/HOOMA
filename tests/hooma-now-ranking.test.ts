import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  distanceKm,
  rankHoomaNowCommunities,
} from '../apps/api/src/modules/communities/application/hooma-now-ranking.ts';

test('HOOMA NOW keeps the active HOOMA first and retains every eligible HOOMA', () => {
  const ranked = rankHoomaNowCommunities('home', [
    { id: 'far', city: 'Bizerte', latitude: 37.2746, longitude: 9.8739 },
    { id: 'home', city: 'Tunis', latitude: 36.8065, longitude: 10.1815 },
    { id: 'near', city: 'Ariana', latitude: 36.8625, longitude: 10.1956 },
  ]);

  assert.deepEqual(
    ranked.map((community) => community.id),
    ['home', 'near', 'far'],
  );
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0]?.rank, 0);
  assert.equal(ranked[0]?.distanceKm, 0);
  assert.ok((ranked[1]?.distanceKm ?? Infinity) < (ranked[2]?.distanceKm ?? 0));
});

test('HOOMA NOW uses same-city fallback when precise activity coordinates are unavailable', () => {
  const ranked = rankHoomaNowCommunities('home', [
    { id: 'other-city', city: 'Sousse', latitude: null, longitude: null },
    { id: 'same-city', city: ' tunis ', latitude: null, longitude: null },
    { id: 'home', city: 'Tunis', latitude: null, longitude: null },
  ]);

  assert.deepEqual(
    ranked.map((community) => community.id),
    ['home', 'same-city', 'other-city'],
  );
  assert.equal(
    ranked.every((community) => community.distanceKm === null),
    true,
  );
});

test('HOOMA NOW distance uses real geographic coordinates', () => {
  const tunisToAriana = distanceKm(
    { latitude: 36.8065, longitude: 10.1815 },
    { latitude: 36.8625, longitude: 10.1956 },
  );

  assert.ok(tunisToAriana !== null);
  assert.ok(tunisToAriana > 5 && tunisToAriana < 8);
  assert.equal(
    distanceKm({ latitude: null, longitude: null }, { latitude: 1, longitude: 1 }),
    null,
  );
});

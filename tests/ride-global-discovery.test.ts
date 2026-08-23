import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { rankCommunityProximity } from '../apps/api/src/modules/communities/infrastructure/community-proximity.ts';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Ride page uses global discovery instead of active-HOOMA filtering', async () => {
  const page = await read('apps/miniapp/src/pages/RidesPage.tsx');
  assert.match(page, /get<RideDiscoveryResponse>\('\/api\/v1\/rides\/discover'\)/);
  assert.doesNotMatch(page, /rides\?communityId=/);
  assert.match(page, /YOUR HOOMA/);
  assert.match(page, /distanceKm/);
});

test('Ride detail uses a direct globally visible offer endpoint', async () => {
  const page = await read('apps/miniapp/src/pages/RideDetailPage.tsx');
  assert.match(page, /\/api\/v1\/rides\/offers\/\$\{rideId\}/);
  assert.doesNotMatch(page, /rides\?communityId=/);
  assert.doesNotMatch(page, /useCommunity/);
});

test('Ride repository keeps private rides member-only but permits public nonmembers', async () => {
  const repository = await read(
    'apps/api/src/modules/rides/infrastructure/prisma-ride.repository.ts',
  );
  assert.match(repository, /community\.visibility !== 'PUBLIC'/);
  assert.match(repository, /membership\?\.status === 'BANNED'/);
  assert.match(repository, /membership\?\.status !== 'ACTIVE'/);
  assert.match(repository, /loadRideDiscovery/);
});

test('Ride controller exposes discovery before normal list behavior', async () => {
  const controller = await read('apps/api/src/modules/rides/http/ride.controller.ts');
  assert.ok(controller.indexOf("'/discover'") < controller.indexOf("'/'"));
  assert.match(controller, /'\/offers\/:offerId'/);
});

test('shared community proximity keeps active HOOMA first and ranks the rest by real distance', () => {
  const ranked = rankCommunityProximity(
    {
      activeCommunityId: 'home',
      communities: [
        { id: 'far', name: 'Far', city: 'Bizerte', visibility: 'PUBLIC' },
        { id: 'home', name: 'Home', city: 'Tunis', visibility: 'PUBLIC' },
        { id: 'near', name: 'Near', city: 'Ariana', visibility: 'PUBLIC' },
      ],
      placePoints: [
        { communityId: 'home', latitude: 36.8065, longitude: 10.1815 },
        { communityId: 'near', latitude: 36.8625, longitude: 10.1956 },
        { communityId: 'far', latitude: 37.2746, longitude: 9.8739 },
      ],
    },
    [],
  );

  assert.deepEqual(
    ranked.map((community) => community.id),
    ['home', 'near', 'far'],
  );
  assert.equal(ranked[0]?.rank, 0);
  assert.equal(ranked[0]?.distanceKm, 0);
});

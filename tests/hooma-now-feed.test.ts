import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('HOOMA NOW has a dedicated global read endpoint without changing local Home feature queries', async () => {
  const [controller, home] = await Promise.all([
    read('apps/api/src/modules/communities/http/community.controller.ts'),
    read('apps/miniapp/src/pages/HomePage.tsx'),
  ]);

  assert.ok(controller.indexOf("'/now'") < controller.indexOf("'/:communityId'"));
  assert.match(home, /get<HoomaNowResponse>\('\/api\/v1\/communities\/now'\)/);
  assert.match(home, /events\?communityId=\$\{id\}/);
  assert.match(home, /requests\?communityId=\$\{id\}/);
  assert.match(home, /rides\?communityId=\$\{id\}/);
  assert.match(home, /fundraisers\?communityId=\$\{id\}/);
  assert.match(home, /events=\{hoomaNow\.data\?\.events \?\? \[\]\}/);
});

test('HOOMA NOW read model includes public HOOMAs but does not expose unrelated private HOOMAs', async () => {
  const readModel = await read(
    'apps/api/src/modules/communities/infrastructure/hooma-now-read-model.ts',
  );

  assert.match(readModel, /visibility: 'PUBLIC'/);
  assert.match(readModel, /id: \{ in: membershipIds \}/);
  assert.match(readModel, /db\.place\.findMany/);
  assert.match(readModel, /deletedAt: null/);
  assert.doesNotMatch(readModel, /visibility: \{ in: \['PUBLIC', 'PRIVATE'\] \}/);
});

test('HOOMA NOW renders all eligible activity and orders community proximity before urgency', async () => {
  const feed = await read('apps/miniapp/src/components/home/HoomaNowFeed.tsx');

  assert.match(feed, /left\.communityRank !== right\.communityRank/);
  assert.match(feed, /return left\.communityRank - right\.communityRank/);
  assert.doesNotMatch(feed, /\.slice\(0, 5\)/);
  assert.match(feed, /for \(const event of props\.events\)/);
  assert.match(feed, /for \(const request of props\.requests\)/);
  assert.match(feed, /for \(const ride of props\.rideOffers\)/);
  assert.match(feed, /for \(const ride of props\.rideRequests\)/);
  assert.match(feed, /for \(const fund of props\.funds\)/);
  assert.match(feed, /YOUR HOOMA/);
  assert.match(feed, /nearby activity across HOOMA/);
});

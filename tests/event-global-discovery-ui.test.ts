import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Play uses canonical HOOMA NOW events instead of active-community event filtering', async () => {
  const page = await read('apps/miniapp/src/pages/PlayPage.tsx');

  assert.match(page, /\/api\/v1\/communities\/now/);
  assert.doesNotMatch(page, /events\?communityId=/);
  assert.match(page, /proximityRankedEvents/);
  assert.match(page, /'PLAY'/);
  assert.match(page, /hoomaSourceLabel/);
});

test('Watch uses canonical HOOMA NOW events and preserves search filtering after proximity ranking', async () => {
  const page = await read('apps/miniapp/src/pages/WatchPage.tsx');

  assert.match(page, /\/api\/v1\/communities\/now/);
  assert.doesNotMatch(page, /events\?communityId=/);
  assert.match(page, /proximityRankedEvents/);
  assert.match(page, /'WATCH'/);
  assert.ok(page.indexOf('proximityRankedEvents') < page.indexOf('watchEventMatchesFilters'));
  assert.match(page, /hoomaSourceLabel/);
});

test('All Events browse uses the same global ranked source', async () => {
  const page = await read('apps/miniapp/src/pages/EventsPage.tsx');

  assert.match(page, /\/api\/v1\/communities\/now/);
  assert.doesNotMatch(page, /events\?communityId=/);
  assert.match(page, /proximityRankedEvents/);
  assert.match(page, /nearby Play and Watch events across the wider HOOMA network/);
});

test('frontend event ordering consumes backend community ranks instead of calculating distance again', async () => {
  const helper = await read('apps/miniapp/src/lib/hooma-proximity-feed.ts');

  assert.match(helper, /community\.rank/);
  assert.match(helper, /rankByCommunityId/);
  assert.match(helper, /left\.communityId/);
  assert.match(helper, /right\.communityId/);
  assert.doesNotMatch(helper, /6371|haversine|Math\.sin/);
});

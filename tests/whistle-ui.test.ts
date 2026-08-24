import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Play renders Whistle Board directly below the hero without replacing global Play discovery', async () => {
  const page = await read('apps/miniapp/src/pages/PlayPage.tsx');

  assert.match(page, /<PlayHero/);
  assert.match(page, /<WhistleBoard communityId=\{active\.id\}/);
  assert.ok(page.indexOf('<PlayHero') < page.indexOf('<WhistleBoard'));
  assert.ok(page.indexOf('<WhistleBoard') < page.indexOf('players-looking-title'));
  assert.match(page, /\/api\/v1\/communities\/now/);
  assert.match(page, /proximityRankedEvents/);
});

test('Whistle Mini App API uses the shared HTTP client and canonical community routes', async () => {
  const api = await read('apps/miniapp/src/features/whistle/api.ts');

  assert.match(api, /from '\.\.\/\.\.\/shared\/api\/http-client'/);
  assert.match(api, /get<WhistleFeedResponse>/);
  assert.match(api, /post<WhistleSendResponse>/);
  assert.match(api, /\/api\/v1\/whistles\/communities\/\$\{communityId\}/);
  assert.doesNotMatch(api, /\bfetch\s*\(/);
});

test('Whistle Board keeps the shared 33-grapheme contract, quota metadata and polling states', async () => {
  const board = await read('apps/miniapp/src/components/whistle/WhistleBoard.tsx');

  assert.match(board, /WHISTLE_MAX_GRAPHEMES/);
  assert.match(board, /countWhistleGraphemes/);
  assert.match(board, /refetchInterval: POLL_INTERVAL_MS/);
  assert.match(board, /query\.data\.remaining/);
  assert.match(board, /resetLabel\(query\.data\.resetAt\)/);
  assert.match(board, /NO WHISTLES LEFT/);
  assert.match(board, /Whistle is unavailable\./);
  assert.match(board, /No signals yet\./);
  assert.match(board, /invalidateQueries/);
  assert.doesNotMatch(board, /like|comment|thread|follow/i);
});

test('Whistle styling uses the HOOMA vintage token system without forbidden stacking patches', async () => {
  const css = await read('apps/miniapp/src/components/whistle/WhistleBoard.css');

  assert.match(css, /var\(--hv-lime\)/);
  assert.match(css, /var\(--hv-gold-line\)/);
  assert.match(css, /var\(--hv-font-display\)/);
  assert.doesNotMatch(css, /!important/);
  assert.doesNotMatch(css, /z-index\s*:/);
});

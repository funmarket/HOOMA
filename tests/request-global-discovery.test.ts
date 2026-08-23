import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Requests page uses global discovery instead of active-HOOMA filtering', async () => {
  const page = await read('apps/miniapp/src/pages/RequestsPage.tsx');

  assert.match(page, /\/api\/v1\/requests\/discover/);
  assert.doesNotMatch(page, /requests\?communityId=/);
  assert.match(page, /YOUR HOOMA/);
  assert.match(page, /distanceKm/);
});

test('Requests discovery is a fixed route before request actions', async () => {
  const controller = await read('apps/api/src/modules/requests/http/request.controller.ts');

  assert.ok(controller.indexOf("'/discover'") < controller.indexOf("'/:requestId/claim'"));
  assert.match(controller, /service\.discover\(getAuth\(req\)\.user\.id\)/);
});

test('Request repository keeps private claims member-only but permits public nonmembers', async () => {
  const repository = await read(
    'apps/api/src/modules/requests/infrastructure/prisma-request.repository.ts',
  );

  assert.match(repository, /include: \{ community: \{ select: \{ visibility: true, deletedAt: true \} \} \}/);
  assert.match(repository, /membership\?\.status === 'BANNED'/);
  assert.match(repository, /request\.community\.visibility === 'PRIVATE'/);
  assert.match(repository, /membership\?\.status !== 'ACTIVE'/);
  assert.doesNotMatch(repository, /if \(!membership \|\| membership\.status !== 'ACTIVE'\)/);
});

test('Request discovery consumes the shared Community proximity source', async () => {
  const discovery = await read(
    'apps/api/src/modules/requests/infrastructure/request-discovery-read-model.ts',
  );

  assert.match(discovery, /loadCommunityProximityContext/);
  assert.match(discovery, /rankCommunityProximity/);
  assert.match(discovery, /communityId: \{ in: communityIds \}/);
  assert.match(discovery, /rankByCommunityId/);
  assert.match(discovery, /rankDelta/);
});

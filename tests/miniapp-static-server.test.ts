import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createMiniAppServer } from '../apps/miniapp/server.mjs';

test('Mini App static server never SPA-falls back missing hashed assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hooma-miniapp-'));
  const assets = join(root, 'assets');
  await mkdir(assets, { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><div id="root"></div>');
  await writeFile(join(assets, 'TeamsPage-current.js'), 'export const ok = true;');

  const server = createMiniAppServer({ root });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;

  try {
    const currentAsset = await fetch(`${base}/assets/TeamsPage-current.js`);
    assert.equal(currentAsset.status, 200);
    assert.match(currentAsset.headers.get('cache-control') ?? '', /immutable/);
    assert.match(currentAsset.headers.get('content-type') ?? '', /text\/javascript/);

    const staleAsset = await fetch(`${base}/assets/TeamsPage-stale.js`);
    assert.equal(staleAsset.status, 404);
    assert.match(staleAsset.headers.get('content-type') ?? '', /text\/plain/);
    assert.equal(await staleAsset.text(), 'Asset Not Found');

    const appRoute = await fetch(`${base}/teams`);
    assert.equal(appRoute.status, 200);
    assert.equal(appRoute.headers.get('cache-control'), 'no-store, max-age=0, must-revalidate');
    assert.match(appRoute.headers.get('content-type') ?? '', /text\/html/);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await rm(root, { recursive: true, force: true });
  }
});

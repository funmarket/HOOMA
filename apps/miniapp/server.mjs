import { createReadStream } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT || 4173);
const ROOT = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const ASSETS_ROOT = resolve(ROOT, 'assets');
const INDEX_FILE = resolve(ROOT, 'index.html');

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function contentType(filePath) {
  return MIME_TYPES.get(extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function isInside(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    'cache-control': 'no-store',
    'content-type': 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
  });
  res.end(body);
}

async function sendFile(req, res, filePath, cacheControl) {
  const info = await stat(filePath);
  if (!info.isFile()) return false;

  res.writeHead(200, {
    'cache-control': cacheControl,
    'content-length': info.size,
    'content-type': contentType(filePath),
    'x-content-type-options': 'nosniff',
  });

  if (req.method === 'HEAD') {
    res.end();
    return true;
  }

  createReadStream(filePath).pipe(res);
  return true;
}

async function serveRequest(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendText(res, 405, 'Method Not Allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  } catch {
    sendText(res, 400, 'Bad Request');
    return;
  }

  if (pathname.startsWith('/assets/')) {
    const assetPath = resolve(ROOT, `.${pathname}`);
    if (!isInside(ASSETS_ROOT, assetPath)) {
      sendText(res, 404, 'Asset Not Found');
      return;
    }

    try {
      if (await sendFile(req, res, assetPath, 'public, max-age=31536000, immutable')) return;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        sendText(res, 404, 'Asset Not Found');
        return;
      }
      throw error;
    }

    sendText(res, 404, 'Asset Not Found');
    return;
  }

  const publicPath = resolve(ROOT, `.${pathname}`);
  if (pathname !== '/' && isInside(ROOT, publicPath)) {
    try {
      if (await sendFile(req, res, publicPath, 'no-cache')) return;
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        throw error;
      }
    }
  }

  await access(INDEX_FILE);
  await sendFile(req, res, INDEX_FILE, 'no-store, max-age=0, must-revalidate');
}

const server = createServer((req, res) => {
  void serveRequest(req, res).catch((error) => {
    console.error('Mini App static server error', error);
    if (!res.headersSent) sendText(res, 500, 'Internal Server Error');
    else res.destroy();
  });
});

server.listen(PORT, HOST, () => {
  console.log(`HOOMA Mini App listening on ${HOST}:${PORT}`);
});

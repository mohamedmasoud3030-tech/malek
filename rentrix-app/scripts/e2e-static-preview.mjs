/**
 * Minimal static SPA preview server for browser verification runs.
 *
 * The Vite dev server keeps an esbuild service plus a module graph resident,
 * which pushed this 2 GB sandbox into worker SIGKILL during Playwright runs.
 * The production build under `dist/public` is the artifact the browser suite
 * should exercise anyway, so this serves those bytes with SPA history fallback
 * and nothing else. It adds no application behavior, no API, and no auth:
 * every Supabase call is still intercepted by the test's own fake backend.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'dist/public');
const port = Number(process.env.E2E_PORT ?? 5173);
const host = process.env.E2E_HOST ?? '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolveFile(pathname) {
  const decoded = decodeURIComponent(pathname.split('?')[0]);
  const candidate = resolve(join(root, normalize(decoded)));
  // Never serve outside the build output.
  if (!candidate.startsWith(root)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return null;
}

createServer((request, response) => {
  const url = request.url ?? '/';
  const file = resolveFile(url) ?? join(root, 'index.html');
  if (!existsSync(file)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  process.stdout.write(`static preview on http://${host}:${port} from ${root}\n`);
});

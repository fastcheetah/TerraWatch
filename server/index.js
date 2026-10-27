import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, sep, extname } from 'node:path';
import { demoStore } from './stores/demo.js';
import { createPostgresStore } from './stores/postgres.js';
import { parseFilters } from './params.js';

const here = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(here, '..', '.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
const mode = process.env.DATA_SOURCE || 'demo';
if (!['demo','postgres'].includes(mode)) throw new Error('DATA_SOURCE must be demo or postgres');
const store = mode === 'postgres' ? await createPostgresStore() : demoStore;
const publicRoot = resolve(here, '..', 'public');
const contentTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon'
};

const cache = new Map();
async function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 60000) return hit.value;
  const value = await fn();
  if (cache.size > 200) cache.clear();
  cache.set(key, { time: Date.now(), value });
  return value;
}
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
async function handleRequest(req, res) {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return json(res, 400, { error: 'Invalid URL' }); }
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' });
  const path = url.pathname;
  const query = Object.fromEntries(url.searchParams);
  try {
    if (path === '/api/health') return json(res, 200, { ok: true, mode });
    if (path === '/api/areas') return json(res, 200,
      { areas: await cached('areas', () => store.areas()), mode });
    if (path === '/api/dashboard') {
      const filters = parseFilters(query);
      return json(res, 200, await cached(JSON.stringify(filters), () => store.dashboard(filters)));
    }
    if (path === '/api/map-points') return json(res, 200,
      await store.mapPoints(parseFilters(query, { map: true })));
    if (path.startsWith('/api/')) return json(res, 404, { error: 'API route not found' });

    // A tiny static-file handler avoids an install step for demo mode.
    const safePath = resolve(publicRoot, `.${path === '/' ? '/index.html' : path}`);
    if (!safePath.startsWith(publicRoot + sep)) return json(res, 403, { error: 'Forbidden' });
    const bytes = await readFile(safePath);
    res.writeHead(200, { 'Content-Type': contentTypes[extname(safePath)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch(err) {
    if (err.code === 'ENOENT' || err.code === 'EISDIR') return json(res, 404, { error: 'Not found' });
    const clientError = /Invalid|Unknown|must |Date range|bbox|country|satellite/.test(err.message);
    if (!clientError) console.error(err);
    return json(res, clientError ? 400 : 500,
      { error: clientError ? err.message : 'Database or server error' });
  }
}
const port = Number(process.env.PORT || 3000);
const server = createServer(handleRequest);
server.listen(port, () => console.log(`TerraWatch: http://localhost:${port} [${mode}]`));
for (const sig of ['SIGINT','SIGTERM']) process.on(sig, async () => {
  server.close();await store.close?.();process.exit(0);
});

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { EventStore } from '../src/events/store';
import type { EventBody, StoredEvent } from '../src/events/types';
// @ts-expect-error: gewoon JavaScript-bestand (gedeeld met het bouwscript van de catalogus)
import { transformOpdb } from '../scripts/catalog-transform.mjs';
import { FilePersistence, MetaFile, writeAtomic } from './filePersistence';

export interface ServerOptions {
  /** Map met de gebouwde app (index.html, assets/, catalog/, rules/). */
  staticDir: string;
  /** Map waar de gegevens staan (events.json, meta.json, backups/, img/, catalog/). */
  dataDir: string;
  /** Mag de server zelf naar internet (afbeeldingen, catalogus, spelregels)? Uit in tests. */
  fetchImpl?: typeof fetch;
}

const OPDB_EXPORT = 'https://mp-data.sfo3.cdn.digitaloceanspaces.com/opdb-v2.json';
const MAX_BODY = 50 * 1024 * 1024;

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/** Alleen afbeeldingen van OPDB (en het Match Play-CDN) mogen via de server opgehaald worden. */
export function allowedImage(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && (/(^|\.)opdb\.org$/.test(url.hostname) || /(^|\.)digitaloceanspaces\.com$/.test(url.hostname));
  } catch {
    return false;
  }
}

/** Alleen spelregelpagina's van The Pinball Primer mogen via de server opgehaald worden. */
export function allowedPage(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === 'https:' && url.hostname === 'pinballprimer.github.io';
  } catch {
    return false;
  }
}

export interface PinballServer {
  server: Server;
  store: EventStore;
  version: () => number;
}

export async function createPinballServer(opts: ServerOptions): Promise<PinballServer> {
  const doFetch = opts.fetchImpl ?? fetch;
  const store = new EventStore(new FilePersistence(opts.dataDir));
  await store.load();
  const meta = new MetaFile(opts.dataDir);
  const imgDir = join(opts.dataDir, 'img');
  const catalogDir = join(opts.dataDir, 'catalog');

  // Versienummer: verandert bij elke wijziging; begint bij de starttijd zodat apparaten na een herstart opnieuw laden.
  let version = Date.now();
  const streams = new Set<ServerResponse>();
  store.onWritten = () => {
    version++;
    for (const res of streams) res.write(`data: ${version}\n\n`);
  };
  setInterval(() => {
    for (const res of streams) res.write(': ping\n\n');
  }, 25_000).unref();

  const json = (res: ServerResponse, status: number, data: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  async function readBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY) throw new Error('Te groot');
      chunks.push(chunk as Buffer);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
  }

  async function command(cmd: { op?: string; body?: EventBody; scope?: string; events?: StoredEvent[] }) {
    let event: StoredEvent | undefined;
    switch (cmd.op) {
      case 'dispatch':
        if (!cmd.body || typeof cmd.body !== 'object' || typeof cmd.body.type !== 'string') throw new Error('Ongeldig event');
        event = store.dispatch(cmd.body);
        break;
      case 'undo':
        event = typeof cmd.scope === 'string' ? store.undo(cmd.scope) : undefined;
        break;
      case 'redo':
        event = typeof cmd.scope === 'string' ? store.redo(cmd.scope) : undefined;
        break;
      case 'replaceAll':
        if (!Array.isArray(cmd.events)) throw new Error('Ongeldige back-up');
        await store.replaceAll(cmd.events);
        break;
      default:
        throw new Error('Onbekende opdracht');
    }
    await store.flush();
    return { version, event };
  }

  async function serveImage(u: string, res: ServerResponse) {
    if (!allowedImage(u)) return json(res, 400, { error: 'Niet toegestaan' });
    const file = join(imgDir, createHash('sha1').update(u).digest('hex') + (extname(new URL(u).pathname) || '.img'));
    if (!existsSync(file)) {
      try {
        const r = await doFetch(u);
        if (!r.ok) return json(res, 502, { error: 'Afbeelding niet gevonden' });
        mkdirSync(imgDir, { recursive: true });
        writeAtomic(file, Buffer.from(await r.arrayBuffer()));
      } catch {
        return json(res, 504, { error: 'Geen internet' });
      }
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
    createReadStream(file).pipe(res);
  }

  async function updateCatalog() {
    const r = await doFetch(OPDB_EXPORT, { headers: { 'User-Agent': 'pinball-tournament-pi' } });
    if (!r.ok) throw new Error('Downloaden mislukt.');
    const rulesFile = join(opts.staticDir, 'rules', 'index.json');
    const rulesIndex = existsSync(rulesFile) ? JSON.parse(readFileSync(rulesFile, 'utf8')) : {};
    const catalog = transformOpdb(await r.json(), { generatedAt: new Date().toISOString(), rulesIndex });
    if (catalog.e.length < 100) throw new Error('De catalogus is (nog) niet beschikbaar.');
    const text = JSON.stringify(catalog);
    const v = createHash('sha256').update(text).digest('hex').slice(0, 12);
    mkdirSync(catalogDir, { recursive: true });
    writeAtomic(join(catalogDir, 'opdb.json'), text);
    writeAtomic(join(catalogDir, 'opdb-meta.json'), JSON.stringify({ version: v, count: catalog.e.length, generatedAt: catalog.generatedAt, bytes: text.length, gzipBytes: gzipSync(text).length }));
  }

  function serveFile(path: string, res: ServerResponse, req: IncomingMessage) {
    // Catalogus: een door de Pi zelf bijgewerkte versie gaat voor de meegeleverde.
    const roots = path.startsWith('/catalog/') ? [opts.dataDir, opts.staticDir] : [opts.staticDir];
    for (const root of roots) {
      const file = normalize(join(root, decodeURIComponent(path)));
      if (!file.startsWith(normalize(root + sep))) continue;
      if (existsSync(file) && statSync(file).isFile()) {
        const immutable = path.startsWith('/assets/');
        res.writeHead(200, {
          'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
        });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(file).pipe(res);
      }
    }
    if (extname(path)) return json(res, 404, { error: 'Niet gevonden' });
    // Alle andere paden: de app zelf (de app gebruikt #/-adressen).
    res.writeHead(200, { 'Content-Type': TYPES['.html'], 'Cache-Control': 'no-cache' });
    createReadStream(join(opts.staticDir, 'index.html')).pipe(res);
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    try {
      if (path === '/api/events' && req.method === 'GET') return json(res, 200, { version, events: store.all });
      if (path === '/api/command' && req.method === 'POST') return json(res, 200, await command((await readBody(req)) as never));
      if (path === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write(`retry: 2000\ndata: ${version}\n\n`);
        streams.add(res);
        req.on('close', () => streams.delete(res));
        return;
      }
      if (path.startsWith('/api/meta/')) {
        const key = decodeURIComponent(path.slice('/api/meta/'.length));
        if (req.method === 'GET') return json(res, 200, { value: meta.get(key) ?? null });
        if (req.method === 'PUT') {
          meta.set(key, ((await readBody(req)) as { value: unknown })?.value);
          return json(res, 200, { ok: true });
        }
      }
      if (path === '/api/catalog/update' && req.method === 'POST') {
        try {
          await updateCatalog();
          return json(res, 200, { ok: true });
        } catch (e) {
          return json(res, 502, { error: (e as Error).message.includes('fetch') ? 'Geen internetverbinding.' : (e as Error).message });
        }
      }
      if (path === '/api/fetch' && req.method === 'GET') {
        const u = url.searchParams.get('u') ?? '';
        if (!allowedPage(u)) return json(res, 400, { error: 'Niet toegestaan' });
        try {
          const r = await doFetch(u);
          res.writeHead(r.status, { 'Content-Type': r.headers.get('content-type') ?? 'text/html', 'Cache-Control': 'no-store' });
          return res.end(Buffer.from(await r.arrayBuffer()));
        } catch {
          return json(res, 504, { error: 'Geen internetverbinding.' });
        }
      }
      if (path === '/img' && req.method === 'GET') return await serveImage(url.searchParams.get('u') ?? '', res);
      if (path.startsWith('/api/')) return json(res, 404, { error: 'Onbekend' });
      if (req.method === 'GET' || req.method === 'HEAD') return serveFile(path, res, req);
      json(res, 405, { error: 'Niet toegestaan' });
    } catch (e) {
      if (!res.headersSent) json(res, 400, { error: (e as Error).message });
      else res.end();
    }
  });

  return { server, store, version: () => version };
}

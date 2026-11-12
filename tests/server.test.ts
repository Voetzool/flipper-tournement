import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { allowedImage, allowedPage, compareVersions, createPinballServer } from '../server/app';
import { buildState } from '../src/events/reducer';
import type { StoredEvent } from '../src/events/types';

const servers: { close: () => void }[] = [];
afterEach(() => servers.splice(0).forEach((s) => s.close()));

function dirs() {
  const root = mkdtempSync(join(tmpdir(), 'pinball-'));
  const staticDir = join(root, 'public');
  mkdirSync(staticDir);
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>app</title>');
  return { staticDir, dataDir: join(root, 'data') };
}

async function start(d = dirs(), fetchImpl?: typeof fetch) {
  const s = await createPinballServer({ ...d, fetchImpl: fetchImpl ?? (async () => { throw new TypeError('fetch failed'); }) });
  await new Promise<void>((r) => s.server.listen(0, r));
  servers.push({ close: () => (s.server.closeAllConnections(), s.server.close()) });
  const base = `http://127.0.0.1:${(s.server.address() as AddressInfo).port}`;
  const cmd = (body: unknown) => fetch(base + '/api/command', { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());
  const events = () => fetch(base + '/api/events').then((r) => r.json() as Promise<{ version: number; events: StoredEvent[] }>);
  return { ...s, base, cmd, events, d };
}

const created = {
  type: 'TournamentCreated',
  tournamentId: 't',
  name: 'Avond',
  format: 'roundRobin',
  settings: { rounds: 2, maxGroupSize: 4, pointsTable: { 2: [7, 1] } },
  playerIds: ['a', 'b'],
  machineIds: [],
  firstRound: [{ id: 'g1', machineId: null, playerIds: ['a', 'b'] }],
};

describe('Pi-server', () => {
  it('slaat acties op, doet undo/redo per toernooi en bewaart alles na een herstart', async () => {
    const s = await start();
    await s.cmd({ op: 'dispatch', body: { type: 'PlayerAdded', playerId: 'a', name: 'Anna' } });
    await s.cmd({ op: 'dispatch', body: { type: 'PlayerAdded', playerId: 'b', name: 'Bram' } });
    await s.cmd({ op: 'dispatch', body: created });
    const r = await s.cmd({ op: 'dispatch', body: { type: 'GameResultEntered', tournamentId: 't', gameId: 'g1', order: ['b', 'a'] } });
    expect(r.event.seq).toBe(4);
    const result = () => s.events().then((e) => buildState(e.events).tournaments.get('t')!.rounds[0].games[0].result);
    expect(await result()).toEqual(['b', 'a']);
    await s.cmd({ op: 'undo', scope: 't' });
    expect(await result()).toBeUndefined();
    await s.cmd({ op: 'redo', scope: 't' });
    expect(await result()).toEqual(['b', 'a']);

    servers.splice(0).forEach((x) => x.close());
    const again = await start(s.d);
    const state = buildState((await again.events()).events);
    expect(state.players.get('a')?.name).toBe('Anna');
    expect(state.tournaments.get('t')!.rounds[0].games[0].result).toEqual(['b', 'a']);
  });

  it('meldt elke wijziging via de live-verbinding (SSE)', async () => {
    const s = await start();
    const ctrl = new AbortController();
    const res = await fetch(s.base + '/api/stream', { signal: ctrl.signal });
    const reader = res.body!.getReader();
    const read = async () => new TextDecoder().decode((await reader.read()).value);
    const first = await read();
    expect(first).toContain(`data: ${s.version()}`);
    await s.cmd({ op: 'dispatch', body: { type: 'PlayerAdded', playerId: 'a', name: 'Anna' } });
    expect(await read()).toContain(`data: ${s.version()}`);
    ctrl.abort();
  });

  it('zet een back-up terug en weigert onzin', async () => {
    const s = await start();
    await s.cmd({ op: 'dispatch', body: { type: 'PlayerAdded', playerId: 'a', name: 'Anna' } });
    const backup = [{ seq: 1, id: 'x', at: 1, reverted: false, schema: 1, body: { type: 'PlayerAdded', playerId: 'z', name: 'Zoë' } }];
    await s.cmd({ op: 'replaceAll', events: backup });
    expect(buildState((await s.events()).events).players.get('z')?.name).toBe('Zoë');
    const bad = await fetch(s.base + '/api/command', { method: 'POST', body: JSON.stringify({ op: 'dispatch', body: 5 }) });
    expect(bad.status).toBe(400);
  });

  it('bewaart gedeelde instellingen en serveert de app', async () => {
    const s = await start();
    await fetch(s.base + '/api/meta/lastBackupAt', { method: 'PUT', body: JSON.stringify({ value: 123 }) });
    expect(await fetch(s.base + '/api/meta/lastBackupAt').then((r) => r.json())).toEqual({ value: 123 });
    expect(await fetch(s.base + '/').then((r) => r.text())).toContain('<title>app</title>');
    expect((await fetch(s.base + '/../../etc/passwd')).status).not.toBe(500);
    expect((await fetch(s.base + '/assets/bestaatniet.js')).status).toBe(404);
  });

  it('haalt afbeeldingen één keer op en bewaart ze; alleen OPDB is toegestaan', async () => {
    let calls = 0;
    const fake = (async () => (calls++, new Response(new Uint8Array([1, 2, 3])))) as unknown as typeof fetch;
    const s = await start(dirs(), fake);
    const u = 'https://img.opdb.org/abc-medium.jpg';
    const a = await fetch(s.base + '/img?u=' + encodeURIComponent(u));
    expect(a.status).toBe(200);
    expect(new Uint8Array(await a.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    await fetch(s.base + '/img?u=' + encodeURIComponent(u));
    expect(calls).toBe(1);
    expect((await fetch(s.base + '/img?u=' + encodeURIComponent('http://192.168.1.1/x.jpg'))).status).toBe(400);
    expect(allowedImage('https://evil.com/opdb.org.jpg')).toBe(false);
    expect(allowedPage('https://pinballprimer.github.io/x.html')).toBe(true);
    expect(allowedPage('https://example.com/')).toBe(false);
  });
});

describe('Pi bijwerken vanuit de app', () => {
  const withLatest = (latest: string | null) =>
    (async (u: string) => {
      if (!latest) throw new TypeError('fetch failed');
      expect(String(u)).toContain('/version.json');
      return new Response(JSON.stringify({ version: latest }));
    }) as unknown as typeof fetch;

  async function startWith(latest: string | null) {
    const d = dirs();
    const s = await createPinballServer({ ...d, version: '1.0.0', updateUrl: 'https://example.test/pi', fetchImpl: withLatest(latest) });
    await new Promise<void>((r) => s.server.listen(0, r));
    servers.push({ close: () => (s.server.closeAllConnections(), s.server.close()) });
    return { base: `http://127.0.0.1:${(s.server.address() as AddressInfo).port}`, d };
  }

  it('vergelijkt versies', () => {
    expect(compareVersions('1.1.0', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.10', '1.0.9')).toBeGreaterThan(0);
    expect(compareVersions('0.9', '1.0.0')).toBeLessThan(0);
  });

  it('meldt de eigen versie en of er een nieuwere is', async () => {
    const { base } = await startWith('1.1.0');
    expect(await fetch(base + '/api/version').then((r) => r.json())).toEqual({ version: '1.0.0' });
    expect(await fetch(base + '/api/update/check').then((r) => r.json())).toEqual({ current: '1.0.0', latest: '1.1.0', available: true });
  });

  it('zegt het als de Pi geen internet heeft', async () => {
    const { base } = await startWith(null);
    expect(await fetch(base + '/api/update/check').then((r) => r.json())).toEqual({ current: '1.0.0', offline: true });
    expect((await fetch(base + '/api/update/install', { method: 'POST' })).status).toBe(503);
  });

  it('vraagt de bijwerk-taak alleen aan als er een nieuwere versie is', async () => {
    const same = await startWith('1.0.0');
    expect((await fetch(same.base + '/api/update/install', { method: 'POST' })).status).toBe(409);
    expect(existsSync(join(same.d.dataDir, 'update-requested'))).toBe(false);

    const newer = await startWith('1.2.0');
    expect(await fetch(newer.base + '/api/update/status').then((r) => r.json())).toEqual({ state: 'idle' });
    expect((await fetch(newer.base + '/api/update/install', { method: 'POST' })).status).toBe(202);
    expect(existsSync(join(newer.d.dataDir, 'update-requested'))).toBe(true);
    expect(await fetch(newer.base + '/api/update/status').then((r) => r.json())).toMatchObject({ state: 'requested', to: '1.2.0' });
  });
});

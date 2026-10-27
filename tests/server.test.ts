import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { allowedImage, allowedPage, createPinballServer } from '../server/app';
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

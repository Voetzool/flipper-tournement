import { describe, expect, it } from 'vitest';
import { EventStore, MemoryPersistence } from '../src/events/store';
import { buildState } from '../src/events/reducer';
import { makeBackup, needsBackupReminder, parseBackup } from '../src/backup/backup';

async function setup() {
  const p = new MemoryPersistence();
  const s = new EventStore(p);
  await s.load();
  return { p, s };
}

const add = (id: string, name = id) => ({ type: 'PlayerAdded' as const, playerId: id, name });

describe('EventStore undo/redo', () => {
  it('undo draait de laatste actie terug, redo zet hem terug', async () => {
    const { s } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    expect(buildState(s.all).players.size).toBe(2);
    s.undo();
    expect([...buildState(s.all).players.keys()]).toEqual(['a']);
    s.redo();
    expect(buildState(s.all).players.size).toBe(2);
  });

  it('meerdere undo’s en daarna redo in de juiste volgorde', async () => {
    const { s } = await setup();
    s.dispatch(add('a'));
    s.dispatch({ type: 'PlayerUpdated', playerId: 'a', name: 'Anna' });
    s.dispatch({ type: 'PlayerUpdated', playerId: 'a', name: 'Annie' });
    s.undo();
    s.undo();
    expect(buildState(s.all).players.get('a')!.name).toBe('a');
    s.redo();
    expect(buildState(s.all).players.get('a')!.name).toBe('Anna');
  });

  it('een nieuwe actie na undo wist de redo-stapel', async () => {
    const { s, p } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    s.undo();
    s.dispatch(add('c'));
    expect(s.redoTarget).toBeUndefined();
    expect([...buildState(s.all).players.keys()]).toEqual(['a', 'c']);
    await s.flush();
    expect(p.rows.size).toBe(2);
  });

  it('undo/redo doen niets als er niets is', async () => {
    const { s } = await setup();
    expect(s.undo()).toBeUndefined();
    expect(s.redo()).toBeUndefined();
  });

  it('bewaart alles in de opslag en laadt het opnieuw', async () => {
    const { s, p } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    s.undo();
    await s.flush();
    const s2 = new EventStore(p);
    await s2.load();
    expect(buildState(s2.all).players.size).toBe(1);
    expect(s2.redoTarget?.body).toEqual(add('b'));
  });
});

describe('uitslag corrigeren', () => {
  const created = {
    type: 'TournamentCreated' as const,
    tournamentId: 't',
    name: 'Avond',
    format: 'roundRobin' as const,
    settings: { rounds: 2, maxGroupSize: 4 as const, pointsTable: { 2: [7, 1] } },
    playerIds: ['a', 'b'],
    machineIds: [],
    firstRound: [{ id: 'g1', machineId: null, playerIds: ['a', 'b'] }],
  };

  it('ResultCorrected vervangt de uitslag en is te undo’en', async () => {
    const { s } = await setup();
    s.dispatch(created);
    s.dispatch({ type: 'GameResultEntered', tournamentId: 't', gameId: 'g1', order: ['a', 'b'] });
    s.dispatch({ type: 'ResultCorrected', tournamentId: 't', gameId: 'g1', order: ['b', 'a'] });
    let g = buildState(s.all).tournaments.get('t')!.rounds[0].games[0];
    expect(g.result).toEqual(['b', 'a']);
    expect(g.corrected).toBe(true);
    s.undo();
    g = buildState(s.all).tournaments.get('t')!.rounds[0].games[0];
    expect(g.result).toEqual(['a', 'b']);
    expect(g.corrected).toBeUndefined();
  });

  it('undo van het aanmaken verwijdert het hele toernooi', async () => {
    const { s } = await setup();
    s.dispatch(created);
    s.undo();
    expect(buildState(s.all).tournaments.size).toBe(0);
  });
});

describe('back-up', () => {
  it('export → import levert dezelfde state op', async () => {
    const { s } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    s.dispatch(add('c'));
    s.undo();
    const json = JSON.stringify(makeBackup(s.all));
    const { s: s2 } = await setup();
    await s2.replaceAll(parseBackup(json));
    expect(buildState(s2.all)).toEqual(buildState(s.all));
    expect(s2.redoTarget).toBeUndefined();
  });

  it('weigert vreemde bestanden', () => {
    expect(() => parseBackup('nope')).toThrow(/JSON/);
    expect(() => parseBackup('{"foo":1}')).toThrow(/geen back-up/);
    expect(() => parseBackup('{"app":"flipper-toernooi","version":99,"events":[]}')).toThrow(/nieuwere/);
  });

  it('herinnering na 7 dagen of na een afgerond toernooi', () => {
    const day = 24 * 3600 * 1000;
    const ev = (at: number, type = 'PlayerAdded') =>
      ({ seq: at, id: String(at), at, reverted: false, schema: 1, body: { type } }) as never;
    expect(needsBackupReminder([], undefined, 100 * day)).toBe(false);
    expect(needsBackupReminder([ev(1 * day)], undefined, 3 * day)).toBe(false);
    expect(needsBackupReminder([ev(1 * day)], undefined, 9 * day)).toBe(true);
    expect(needsBackupReminder([ev(1 * day)], 2 * day, 30 * day)).toBe(false);
    expect(needsBackupReminder([ev(3 * day, 'TournamentFinished')], 2 * day, 3 * day)).toBe(true);
  });
});

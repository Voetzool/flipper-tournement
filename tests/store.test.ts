import { describe, expect, it } from 'vitest';
import { EventStore, MemoryPersistence } from '../src/events/store';
import { buildState, machineInUse, playerInUse } from '../src/events/reducer';
import { makeBackup, needsBackupReminder, parseBackup } from '../src/backup/backup';

async function setup() {
  const p = new MemoryPersistence();
  const s = new EventStore(p);
  await s.load();
  return { p, s };
}

const add = (id: string, name = id) => ({ type: 'PlayerAdded' as const, playerId: id, name });

const created = (id: string) => ({
  type: 'TournamentCreated' as const,
  tournamentId: id,
  name: 'Avond ' + id,
  format: 'roundRobin' as const,
  settings: { rounds: 2, maxGroupSize: 4 as const, pointsTable: { 2: [7, 1] } },
  playerIds: ['a', 'b'],
  machineIds: [],
  firstRound: [
    { id: id + 'g1', machineId: null, playerIds: ['a', 'b'] },
    { id: id + 'g2', machineId: null, playerIds: ['a', 'b'] },
  ],
});
const result = (t: string, g: string, order: string[]) => ({ type: 'GameResultEntered' as const, tournamentId: t, gameId: t + g, order });
const games = (s: EventStore, t: string) => buildState(s.all).tournaments.get(t)!.rounds[0].games.map((g) => g.result?.join(''));

describe('undo/redo per toernooi', () => {
  it('undo draait de laatste uitslag terug, redo zet hem terug', async () => {
    const { s } = await setup();
    s.dispatch(created('t'));
    s.dispatch(result('t', 'g1', ['a', 'b']));
    s.dispatch(result('t', 'g2', ['b', 'a']));
    s.undo('t');
    expect(games(s, 't')).toEqual(['ab', undefined]);
    s.undo('t');
    expect(games(s, 't')).toEqual([undefined, undefined]);
    s.redo('t');
    expect(games(s, 't')).toEqual(['ab', undefined]);
  });

  it('het aanmaken van het toernooi zelf is niet te undo’en', async () => {
    const { s } = await setup();
    s.dispatch(created('t'));
    expect(s.undo('t')).toBeUndefined();
    expect(buildState(s.all).tournaments.size).toBe(1);
  });

  it('spelers en kasten wijzigen heeft geen invloed op de undo van een toernooi', async () => {
    const { s } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    s.dispatch(created('t'));
    s.dispatch(result('t', 'g1', ['a', 'b']));
    s.dispatch(add('c'));
    s.undo('t');
    expect(games(s, 't')).toEqual([undefined, undefined]);
    expect(buildState(s.all).players.size).toBe(3);
  });

  it('elk toernooi heeft zijn eigen undo-stapel', async () => {
    const { s } = await setup();
    s.dispatch(created('t1'));
    s.dispatch(created('t2'));
    s.dispatch(result('t1', 'g1', ['a', 'b']));
    s.dispatch(result('t2', 'g1', ['b', 'a']));
    s.undo('t1');
    expect(games(s, 't1')).toEqual([undefined, undefined]);
    expect(games(s, 't2')).toEqual(['ba', undefined]);
  });

  it('een nieuwe actie wist alleen de redo-stapel van hetzelfde toernooi', async () => {
    const { s, p } = await setup();
    s.dispatch(created('t1'));
    s.dispatch(created('t2'));
    s.dispatch(result('t1', 'g1', ['a', 'b']));
    s.dispatch(result('t2', 'g1', ['a', 'b']));
    s.undo('t1');
    s.undo('t2');
    s.dispatch(result('t1', 'g2', ['b', 'a']));
    expect(s.redoTarget('t1')).toBeUndefined();
    expect(s.redoTarget('t2')).toBeDefined();
    await s.flush();
    expect([...p.rows.values()].filter((e) => e.reverted)).toHaveLength(1);
  });

  it('undo/redo doen niets als er niets is', async () => {
    const { s } = await setup();
    expect(s.undo('x')).toBeUndefined();
    expect(s.redo('x')).toBeUndefined();
  });

  it('bewaart alles in de opslag en laadt het opnieuw, inclusief redo-stapel', async () => {
    const { s, p } = await setup();
    s.dispatch(created('t'));
    s.dispatch(result('t', 'g1', ['a', 'b']));
    s.undo('t');
    await s.flush();
    const s2 = new EventStore(p);
    await s2.load();
    expect(games(s2, 't')).toEqual([undefined, undefined]);
    expect(s2.redoTarget('t')?.body).toEqual(result('t', 'g1', ['a', 'b']));
  });
});

describe('uitslag corrigeren', () => {
  it('ResultCorrected vervangt de uitslag en is te undo’en', async () => {
    const { s } = await setup();
    s.dispatch(created('t'));
    s.dispatch(result('t', 'g1', ['a', 'b']));
    s.dispatch({ type: 'ResultCorrected', tournamentId: 't', gameId: 'tg1', order: ['b', 'a'] });
    let g = buildState(s.all).tournaments.get('t')!.rounds[0].games[0];
    expect(g.result).toEqual(['b', 'a']);
    expect(g.corrected).toBe(true);
    s.undo('t');
    g = buildState(s.all).tournaments.get('t')!.rounds[0].games[0];
    expect(g.result).toEqual(['a', 'b']);
    expect(g.corrected).toBeUndefined();
  });

  it('verwijderen van een toernooi is te herstellen met undo', async () => {
    const { s } = await setup();
    s.dispatch(created('t'));
    s.dispatch({ type: 'TournamentDeleted', tournamentId: 't' });
    expect(buildState(s.all).tournaments.size).toBe(0);
    s.undo('t');
    expect(buildState(s.all).tournaments.size).toBe(1);
  });
});

describe('spelers en kasten verwijderen', () => {
  it('verwijdert ongebruikte spelers en kasten, en herkent gebruikte', async () => {
    const { s } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    s.dispatch(add('z'));
    s.dispatch({ type: 'MachineAdded', machineId: 'm', name: 'M' });
    s.dispatch(created('t'));
    let st = buildState(s.all);
    expect(playerInUse(st, 'a')).toBe(true);
    expect(playerInUse(st, 'z')).toBe(false);
    expect(machineInUse(st, 'm')).toBe(false);
    s.dispatch({ type: 'PlayerDeleted', playerId: 'z' });
    s.dispatch({ type: 'MachineDeleted', machineId: 'm' });
    st = buildState(s.all);
    expect([...st.players.keys()]).toEqual(['a', 'b']);
    expect(st.machines.size).toBe(0);
  });
});

describe('back-up', () => {
  it('export → import levert dezelfde state op', async () => {
    const { s } = await setup();
    s.dispatch(add('a'));
    s.dispatch(add('b'));
    s.dispatch(created('t'));
    s.dispatch(result('t', 'g1', ['a', 'b']));
    s.undo('t');
    const json = JSON.stringify(makeBackup(s.all));
    const { s: s2 } = await setup();
    await s2.replaceAll(parseBackup(json));
    expect(buildState(s2.all)).toEqual(buildState(s.all));
    expect(s2.redoTarget('t')).toBeUndefined();
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

describe('meerdere vensters', () => {
  it('seint na elke schrijfactie en een tweede venster ziet de wijziging na reload', async () => {
    const p = new MemoryPersistence();
    const main = new EventStore(p);
    const board = new EventStore(p);
    await main.load();
    await board.load();
    let signals = 0;
    main.onWritten = () => signals++;
    main.dispatch(created('t'));
    main.dispatch(result('t', 'g1', ['b', 'a']));
    await main.flush();
    expect(signals).toBe(2);
    expect(board.all).toHaveLength(0);
    await board.reload();
    expect(games(board, 't')).toEqual(['ba', undefined]);
    main.undo('t');
    await main.flush();
    expect(signals).toBe(3);
    await board.reload();
    expect(games(board, 't')).toEqual([undefined, undefined]);
  });
});

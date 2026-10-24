import { describe, expect, it } from 'vitest';
import type { Game, Tournament } from '../src/events/types';
import { headToHead, headToHeadSettings } from '../src/formats/headToHead';
import { allRoundsComplete, canLookAhead, gameStatus, openRounds } from '../src/formats/progress';
import { roundRobin } from '../src/formats/roundRobin';
import { defaultSettings } from '../src/formats/roundRobin/scoring';

const g = (id: string, playerIds: string[], machineId: string | null, result?: string[]): Game => ({ id, machineId, playerIds, result });

function t(rounds: Game[][], totalRounds = 3): Tournament {
  return {
    id: 't',
    name: 'T',
    format: 'roundRobin',
    settings: { ...defaultSettings(), rounds: totalRounds, maxGroupSize: 2 },
    playerIds: ['a', 'b', 'c', 'd'],
    machineIds: ['x', 'y'],
    rounds: rounds.map((games, index) => ({ index, games })),
    status: 'active',
    createdAt: 0,
  };
}

describe('vooruit spelen', () => {
  it('pas vooruit als er in de huidige ronde al een potje klaar is', () => {
    expect(canLookAhead(t([[g('1', ['a', 'b'], 'x'), g('2', ['c', 'd'], 'y')]]))).toBe(false);
    expect(canLookAhead(t([[g('1', ['a', 'b'], 'x', ['a', 'b']), g('2', ['c', 'd'], 'y')]]))).toBe(true);
  });

  it('maximaal één ronde vooruit, en niet voorbij het geplande aantal rondes', () => {
    const r1 = [g('1', ['a', 'b'], 'x', ['a', 'b']), g('2', ['c', 'd'], 'y')];
    const r2 = [g('3', ['a', 'c'], 'y', ['c', 'a']), g('4', ['b', 'd'], 'x')];
    expect(canLookAhead(t([r1, r2]))).toBe(false); // al twee rondes open
    expect(canLookAhead(t([r1], 1))).toBe(false); // geen ronde meer over
  });

  it('nooit vooruit naar een tie-breaker', () => {
    const tb = t([[g('9', ['a', 'b', 'c'], 'x', ['a', 'b', 'c'])], [{ ...g('10', ['a', 'b'], 'x'), tiebreak: true }]], 1);
    expect(canLookAhead(tb)).toBe(false);
  });

  it('status: klaar om te spelen, wacht op speler, kast bezet', () => {
    const r1 = [g('1', ['a', 'b'], 'x', ['a', 'b']), g('2', ['c', 'd'], 'y')];
    const r2 = [g('3', ['a', 'b'], 'x'), g('4', ['a', 'c'], 'z'), g('5', ['a', 'b'], 'y')];
    const tt = t([r1, r2]);
    expect(gameStatus(tt, r1[0]).state).toBe('done');
    expect(gameStatus(tt, r1[1]).state).toBe('ready');
    expect(gameStatus(tt, r2[0]).state).toBe('ready'); // a en b zijn klaar, kast x is vrij
    expect(gameStatus(tt, r2[1])).toEqual({ state: 'busy', waitingFor: ['c'], machineBusy: false });
    expect(gameStatus(tt, r2[2])).toEqual({ state: 'busy', waitingFor: [], machineBusy: true });
  });

  it('openRounds en allRoundsComplete', () => {
    const done = t([[g('1', ['a', 'b'], 'x', ['a', 'b'])]]);
    expect(openRounds(done)).toHaveLength(0);
    expect(allRoundsComplete(done)).toBe(true);
    expect(allRoundsComplete(t([]))).toBe(false);
    expect(allRoundsComplete(t([[g('1', ['a', 'b'], 'x')]]))).toBe(false);
  });

  it('Round Robin: vooruit indelen geeft hetzelfde schema', () => {
    const base: Tournament = { ...t([]), format: 'headToHead', settings: headToHeadSettings(4) };
    base.rounds.push({ index: 0, games: headToHead.nextRound(base) });
    const ahead = headToHead.nextRound(base); // ronde 2 terwijl ronde 1 nog open is
    const pairs = ahead.map((x) => x.playerIds.slice().sort().join()).sort();
    const r1 = base.rounds[0].games.map((x) => x.playerIds.slice().sort().join());
    expect(pairs.some((p) => r1.includes(p))).toBe(false); // geen herhaling van ronde 1
    expect(ahead.flatMap((x) => x.playerIds).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('Groepsrondes: vooruit indelen respecteert max per kast en zet iedereen in één potje', () => {
    const base = t([]);
    base.rounds.push({ index: 0, games: roundRobin.nextRound(base) });
    const ahead = roundRobin.nextRound(base);
    expect(ahead.every((x) => x.playerIds.length <= 2)).toBe(true);
    expect(ahead.flatMap((x) => x.playerIds).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('vooruit indelen: wie klaar is kan meteen door', () => {
  it('Round Robin kiest de schema-ronde met de meeste vrije potjes en speelt alle duels precies één keer', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const base: Tournament = { ...t([]), playerIds: players, format: 'headToHead', settings: headToHeadSettings(8) };
    base.rounds.push({ index: 0, games: headToHead.nextRound(base) });
    // twee van de vier potjes klaar
    base.rounds[0].games.slice(0, 2).forEach((x) => (x.result = x.playerIds.slice()));
    const free = new Set(base.rounds[0].games.slice(0, 2).flatMap((x) => x.playerIds));
    const ahead = headToHead.nextRound(base);
    const playable = ahead.filter((x) => x.playerIds.every((p) => free.has(p))).length;
    expect(playable).toBeGreaterThanOrEqual(1);
    // daarna alles uitspelen: elk duel precies één keer
    base.rounds.push({ index: 1, games: ahead });
    while (base.rounds.length < base.settings.rounds) base.rounds.push({ index: base.rounds.length, games: headToHead.nextRound(base) });
    const keys = base.rounds.flatMap((r) => r.games.map((x) => x.playerIds.slice().sort().join()));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBe(28);
  });

  it('Groepsrondes zet vrije spelers uit verschillende potjes bij elkaar', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const base: Tournament = { ...t([]), playerIds: players, settings: { ...defaultSettings(), rounds: 5, maxGroupSize: 4 } };
    base.rounds.push({ index: 0, games: roundRobin.nextRound(base) });
    base.rounds[0].games.slice(0, 2).forEach((x) => (x.result = x.playerIds.slice()));
    const ahead = roundRobin.nextRound(base);
    const tt = { ...base, rounds: [...base.rounds, { index: 1, games: ahead }] };
    expect(ahead.filter((x) => gameStatus(tt, x).state === 'ready').length).toBeGreaterThanOrEqual(1);
  });
});

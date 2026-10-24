import { describe, expect, it } from 'vitest';
import type { Tournament } from '../src/events/types';
import { headToHead, headToHeadSettings, tiebreakPlayers, waitingPlayers } from '../src/formats/headToHead';
import { roundCount, scheduleRound } from '../src/formats/headToHead/schedule';

const ids = (n: number) => Array.from({ length: n }, (_, i) => 'p' + (i + 1));

function newTournament(n: number, machines: string[] = ['a', 'b', 'c']): Tournament {
  return {
    id: 't',
    name: 'T',
    format: 'headToHead',
    settings: headToHeadSettings(n),
    playerIds: ids(n),
    machineIds: machines,
    rounds: [],
    status: 'active',
    createdAt: 0,
  };
}

/** Speel alle gewone rondes; `winner(a, b)` bepaalt wie wint. */
function playAll(t: Tournament, winner: (a: string, b: string) => string) {
  for (let r = 0; r < t.settings.rounds; r++) {
    const games = headToHead.nextRound(t);
    t.rounds.push({
      index: t.rounds.length,
      games: games.map((g) => {
        const [a, b] = g.playerIds;
        const w = winner(a, b);
        return { ...g, result: [w, w === a ? b : a] };
      }),
    });
  }
}

describe('schema (cirkelmethode)', () => {
  it('iedereen speelt precies één keer tegen iedereen', () => {
    for (let n = 2; n <= 12; n++) {
      const seen = new Map<string, number>();
      for (let r = 0; r < roundCount(n); r++) {
        const { pairs } = scheduleRound(ids(n), r);
        const inRound = pairs.flat();
        expect(new Set(inRound).size).toBe(inRound.length); // niemand dubbel in een ronde
        for (const [a, b] of pairs) {
          const k = [a, b].sort().join('|');
          seen.set(k, (seen.get(k) ?? 0) + 1);
        }
      }
      expect(seen.size).toBe((n * (n - 1)) / 2);
      expect([...seen.values()].every((c) => c === 1)).toBe(true);
    }
  });

  it('bij een oneven aantal wacht elke ronde één speler, en iedereen precies één keer', () => {
    for (const n of [3, 5, 7, 9]) {
      const byes = Array.from({ length: roundCount(n) }, (_, r) => scheduleRound(ids(n), r).bye);
      expect(byes.every(Boolean)).toBe(true);
      expect(new Set(byes).size).toBe(n);
    }
    expect(scheduleRound(ids(4), 0).bye).toBeNull();
  });

  it('aantal rondes: n−1 (even) of n (oneven)', () => {
    expect([2, 3, 4, 5, 6].map(roundCount)).toEqual([1, 3, 3, 5, 5]);
    expect(roundCount(1)).toBe(0);
  });
});

describe('Round Robin-toernooi', () => {
  it('maakt 1-tegen-1-potjes en verdeelt de kasten (elke kast één keer per ronde)', () => {
    const t = newTournament(6, ['a', 'b', 'c']);
    const games = headToHead.nextRound(t);
    expect(games).toHaveLength(3);
    expect(games.every((g) => g.playerIds.length === 2)).toBe(true);
    expect(new Set(games.map((g) => g.machineId)).size).toBe(3);
  });

  it('te weinig kasten: overige potjes op een vrije kast', () => {
    const games = headToHead.nextRound(newTournament(6, ['a']));
    expect(games.filter((g) => g.machineId === null)).toHaveLength(2);
  });

  it('toont wie er wacht bij een oneven aantal', () => {
    const t = newTournament(5);
    const games = headToHead.nextRound(t);
    expect(waitingPlayers(t, { index: 0, games })).toHaveLength(1);
  });

  it('winst = 1 punt, verlies = 0; unieke winnaar → geen tie-breaker', () => {
    const t = newTournament(4);
    playAll(t, (a, b) => (a < b ? a : b)); // laagste nummer wint altijd
    const s = headToHead.standings(t);
    expect(s.map((r) => [r.playerId, r.points, r.rank])).toEqual([
      ['p1', 3, 1],
      ['p2', 2, 2],
      ['p3', 1, 3],
      ['p4', 0, 4],
    ]);
    expect(tiebreakPlayers(t)).toEqual([]);
    expect(headToHead.nextRound(t)).toEqual([]);
  });

  it('twee spelers gelijk bovenaan → één 1-tegen-1 tie-breaker; de winnaar wint', () => {
    const t = newTournament(3);
    // p1 en p2 winnen allebei van p3; p1–p2: p1 wint → p1 heeft 2. Maak gelijk: p2 wint van p1 én p3 wint niks.
    playAll(t, (a, b) => {
      const pair = [a, b].sort().join();
      return pair === 'p1,p2' ? 'p2' : pair === 'p1,p3' ? 'p1' : 'p3';
    }); // p1: 1, p2: 1, p3: 1 → drie gelijk
    expect(tiebreakPlayers(t).sort()).toEqual(['p1', 'p2', 'p3']);

    const t2 = newTournament(4);
    // p1 en p2 elk 2 punten: p1 wint van p3,p4; p2 wint van p1? dan p2 = 3. Daarom: p2 wint van p1 en p3, verliest van p4.
    const wins: Record<string, string> = { 'p1,p2': 'p2', 'p1,p3': 'p1', 'p1,p4': 'p1', 'p2,p3': 'p2', 'p2,p4': 'p4', 'p3,p4': 'p3' };
    playAll(t2, (a, b) => wins[[a, b].sort().join()]); // p1 2, p2 2, p3 1, p4 1
    expect(tiebreakPlayers(t2).sort()).toEqual(['p1', 'p2']);
    const [tb] = headToHead.nextRound(t2);
    expect(tb.tiebreak).toBe(true);
    expect(tb.playerIds.sort()).toEqual(['p1', 'p2']);
    expect(tb.machineId).toBe('a');
    t2.rounds.push({ index: t2.rounds.length, games: [{ ...tb, result: ['p2', 'p1'] }] });
    const s = headToHead.standings(t2);
    expect(s[0]).toMatchObject({ playerId: 'p2', rank: 1, points: 2, note: 'wint tie-breaker' });
    expect(s[1]).toMatchObject({ playerId: 'p1', rank: 2, points: 2 });
    expect(s[2].rank).toBe(3);
    expect(headToHead.nextRound(t2)).toEqual([]); // geen tweede tie-breaker
  });

  it('drie of meer gelijk → één potje met allemaal op dezelfde kast', () => {
    const t = newTournament(3, ['x', 'y']);
    playAll(t, (a, b) => {
      const pair = [a, b].sort().join();
      return pair === 'p1,p2' ? 'p2' : pair === 'p1,p3' ? 'p1' : 'p3';
    });
    const tbs = headToHead.nextRound(t);
    expect(tbs).toHaveLength(1);
    expect(tbs[0].playerIds).toHaveLength(3);
    expect(tbs[0].machineId).toBe('x');
    t.rounds.push({ index: t.rounds.length, games: [{ ...tbs[0], result: ['p3', 'p1', 'p2'] }] });
    expect(headToHead.standings(t).map((r) => [r.playerId, r.rank])).toEqual([
      ['p3', 1],
      ['p1', 2],
      ['p2', 3],
    ]);
  });
});

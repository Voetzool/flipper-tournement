import { describe, expect, it } from 'vitest';
import { DEFAULT_POINTS, pointsFor, standings } from '../src/formats/roundRobin/scoring';
import type { Tournament } from '../src/events/types';

function tournament(results: string[][]): Tournament {
  return {
    id: 't',
    name: 'T',
    format: 'roundRobin',
    settings: { rounds: 3, maxGroupSize: 4, pointsTable: DEFAULT_POINTS },
    playerIds: ['a', 'b', 'c', 'd', 'e'],
    machineIds: [],
    rounds: [{ index: 0, games: results.map((r, i) => ({ id: 'g' + i, machineId: null, playerIds: r.slice(), result: r })) }],
    status: 'active',
    createdAt: 0,
  };
}

describe('pointsFor', () => {
  it('gebruikt de tabel per groepsgrootte', () => {
    expect([0, 1, 2, 3].map((i) => pointsFor(DEFAULT_POINTS, 4, i))).toEqual([7, 5, 3, 1]);
    expect([0, 1, 2].map((i) => pointsFor(DEFAULT_POINTS, 3, i))).toEqual([7, 4, 1]);
    expect([0, 1].map((i) => pointsFor(DEFAULT_POINTS, 2, i))).toEqual([7, 1]);
  });
  it('valt terug op de dichtstbijzijnde groepsgrootte (groep van 5)', () => {
    expect(pointsFor(DEFAULT_POINTS, 5, 0)).toBe(7);
    expect(pointsFor(DEFAULT_POINTS, 5, 4)).toBe(0);
  });
});

describe('standings', () => {
  it('telt punten op en sorteert', () => {
    const s = standings(tournament([['a', 'b', 'c'], ['d', 'e'], ['b', 'a']]));
    // e en c allebei 1 punt; e heeft betere gemiddelde plek (2 vs 3)
    expect(s.map((r) => [r.playerId, r.points])).toEqual([
      ['b', 11],
      ['a', 8],
      ['d', 7],
      ['e', 1],
      ['c', 1],
    ]);
    expect(s.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5]);
  });
  it('gelijke punten → meer overwinningen wint', () => {
    const s = standings(tournament([['a', 'x', 'y'], ['b', 'c', 'd']]));
    expect(s[0].points).toBe(7);
    expect(s[0].rank).toBe(1);
    expect(s[1].rank).toBe(1); // a en b helemaal gelijk
  });
  it('spelers zonder uitslag staan met 0 punten in de lijst', () => {
    const s = standings(tournament([]));
    expect(s).toHaveLength(5);
    expect(s.every((r) => r.points === 0 && r.rank === 1)).toBe(true);
  });
});

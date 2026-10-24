import { describe, expect, it } from 'vitest';
import { buildState } from '../src/events/reducer';
import { areOpponents, placesOf, ranksOf } from '../src/events/ranks';
import type { EventBody, StoredEvent } from '../src/events/types';
import { computeRatings } from '../src/rating/ratings';
import { playerStats } from '../src/stats/playerStats';

let seq = 0;
const ev = (body: EventBody): StoredEvent => ({ seq: ++seq, id: String(seq), at: seq * 1000, reverted: false, schema: 1, body });

function singleGame(id: string, playerIds: string[], order: string[], teams?: string[][]): StoredEvent[] {
  return [
    ev({
      type: 'TournamentCreated',
      tournamentId: id,
      name: 'Losse pot',
      format: 'single',
      settings: { rounds: 1, maxGroupSize: 4, pointsTable: {} },
      playerIds,
      machineIds: [],
      firstRound: [{ id: id + 'g', machineId: null, playerIds, ...(teams ? { teams } : {}) }],
    }),
    ev({ type: 'GameResultEntered', tournamentId: id, gameId: id + 'g', order }),
  ];
}

const players = ['a', 'b', 'c', 'd'].map((p) => ev({ type: 'PlayerAdded', playerId: p, name: p }));

describe('plekken in een potje', () => {
  it('iedereen voor zich: volgorde van de uitslag', () => {
    expect([...ranksOf({ result: ['c', 'a', 'b'] })]).toEqual([['c', 0], ['a', 1], ['b', 2]]);
    expect(placesOf({ result: ['c', 'a', 'b'] })).toBe(3);
  });
  it('teams: teamgenoten delen hun plek', () => {
    const g = { result: ['c', 'd', 'a', 'b'], teams: [['a', 'b'], ['c', 'd']] };
    expect(Object.fromEntries(ranksOf(g))).toEqual({ c: 0, d: 0, a: 1, b: 1 });
    expect(areOpponents(g, 'a', 'b')).toBe(false);
    expect(areOpponents(g, 'a', 'c')).toBe(true);
    expect(placesOf(g)).toBe(2);
  });
});

describe('losse ranked pot', () => {
  it('1-tegen-1 telt mee voor de rating', () => {
    const r = computeRatings(buildState([...players, ...singleGame('t1', ['a', 'b'], ['a', 'b'])]));
    expect(r.get('a')!.rating).toBeGreaterThan(1500);
    expect(r.get('b')!.rating).toBeLessThan(1500);
  });

  it('2-tegen-2: winnaars gaan evenveel omhoog, teamgenoten spelen niet tegen elkaar', () => {
    const state = buildState([...players, ...singleGame('t2', ['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']])]);
    const r = computeRatings(state);
    expect(r.get('a')!.rating).toBeCloseTo(r.get('b')!.rating, 6);
    expect(r.get('c')!.rating).toBeCloseTo(r.get('d')!.rating, 6);
    expect(r.get('a')!.rating).toBeGreaterThan(1500);
    expect(r.get('c')!.rating).toBeLessThan(1500);
    const s = playerStats(state, 'a');
    expect(s.wins).toBe(1);
    expect(s.beatenPct).toBe(100);
    expect(s.rivals.map((x) => x.opponentId).sort()).toEqual(['c', 'd']); // b is teamgenoot
    expect(s.recent[0]).toMatchObject({ position: 1, size: 2, points: 0 });
    expect(s.tournaments).toBe(0); // een losse pot is geen toernooi
  });
});

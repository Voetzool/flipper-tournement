import { describe, expect, it } from 'vitest';
import { inflate, initialRating, update } from '../src/rating/glicko2';
import { computeRatings } from '../src/rating/ratings';
import { buildState } from '../src/events/reducer';
import type { EventBody, StoredEvent } from '../src/events/types';
import { playerStats } from '../src/stats/playerStats';

describe('Glicko-2', () => {
  it('klopt met het rekenvoorbeeld van Glickman', () => {
    const p = { rating: 1500, rd: 200, vol: 0.06 };
    const r = update(p, [
      { opponent: { rating: 1400, rd: 30, vol: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, vol: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, vol: 0.06 }, score: 0 },
    ]);
    expect(r.rating).toBeCloseTo(1464.06, 1);
    expect(r.rd).toBeCloseTo(151.52, 1);
    expect(r.vol).toBeCloseTo(0.05999, 4);
  });

  it('winnen verhoogt, verliezen verlaagt, en de onzekerheid daalt', () => {
    const a = initialRating();
    const won = update(a, [{ opponent: initialRating(), score: 1 }]);
    const lost = update(a, [{ opponent: initialRating(), score: 0 }]);
    expect(won.rating).toBeGreaterThan(1500);
    expect(lost.rating).toBeLessThan(1500);
    expect(won.rating - 1500).toBeCloseTo(1500 - lost.rating, 6);
    expect(won.rd).toBeLessThan(350);
  });

  it('inactiviteit laat de onzekerheid groeien, tot maximaal 350', () => {
    const p = { rating: 1600, rd: 60, vol: 0.06 };
    expect(inflate(p, 6).rd).toBeGreaterThan(60);
    expect(inflate(p, 0)).toEqual(p);
    expect(inflate(p, 0)).not.toBe(p);
    expect(inflate({ ...p, rd: 340 }, 1000).rd).toBe(350);
  });
});

let seq = 0;
const ev = (body: EventBody, at = ++seq * 1000): StoredEvent => ({ seq: ++seq, id: String(seq), at, reverted: false, schema: 1, body });

function tournamentEvents(results: string[][]): StoredEvent[] {
  const players = ['a', 'b', 'c', 'd'];
  return [
    ...players.map((p) => ev({ type: 'PlayerAdded', playerId: p, name: p.toUpperCase() })),
    ev({
      type: 'TournamentCreated',
      tournamentId: 't',
      name: 'T',
      format: 'roundRobin',
      settings: { rounds: 1, maxGroupSize: 4, pointsTable: { 4: [7, 5, 3, 1], 3: [7, 4, 1], 2: [7, 1] } },
      playerIds: players,
      machineIds: ['m'],
      firstRound: results.map((r, i) => ({ id: 'g' + i, machineId: 'm', playerIds: r.slice() })),
    }),
    ...results.map((r, i) => ev({ type: 'GameResultEntered', tournamentId: 't', gameId: 'g' + i, order: r })),
  ];
}

describe('ratings uit uitslagen', () => {
  it('meerspelerpotje: volgorde van rating volgt de finishvolgorde', () => {
    const r = computeRatings(buildState(tournamentEvents([['a', 'b', 'c', 'd']])));
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((id) => r.get(id)!.rating);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(1500);
    expect(c).toBeLessThan(1500);
    expect(d).toBeLessThan(c);
    expect(a + b + c + d).toBeCloseTo(6000, 6);
    expect(r.get('a')!.history).toHaveLength(1);
  });

  it('een correctie wordt meegenomen alsof hij meteen goed was ingevoerd', () => {
    const events = tournamentEvents([['a', 'b'], ['a', 'b']]);
    events.push(ev({ type: 'ResultCorrected', tournamentId: 't', gameId: 'g0', order: ['b', 'a'] }));
    const corrected = computeRatings(buildState(events));
    const direct = computeRatings(buildState(tournamentEvents([['b', 'a'], ['a', 'b']])));
    expect(corrected.get('a')!.rating).toBeCloseTo(direct.get('a')!.rating, 6);
    expect(corrected.get('a')!.history.map((h) => h.gameId)).toEqual(['g0', 'g1']);
  });

  it('spelers zonder potjes hebben geen rating', () => {
    const r = computeRatings(buildState(tournamentEvents([['a', 'b']])));
    expect(r.has('c')).toBe(false);
  });
});

describe('spelersstatistieken', () => {
  it('telt potjes, winsten, plekken, kasten en tegenstanders', () => {
    const state = buildState([
      ...tournamentEvents([['a', 'b', 'c'], ['b', 'a'], ['a', 'd']]),
      ev({ type: 'TournamentFinished', tournamentId: 't' }),
    ]);
    const s = playerStats(state, 'a');
    expect(s.games).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.avgPosition).toBeCloseTo(4 / 3, 6);
    expect(s.beatenPct).toBeCloseTo((3 / 4) * 100, 6);
    expect(s.machines).toEqual([{ machineId: 'm', played: 3, wins: 2, avgPosition: 4 / 3 }]);
    expect(s.rivals.find((r) => r.opponentId === 'b')).toEqual({ opponentId: 'b', played: 2, won: 1, lost: 1 });
    expect(s.tournaments).toBe(1);
    expect(s.tournamentWins).toBe(1);
    expect(s.recent[0].game.id).toBe('g2');
    expect(s.recent[0].points).toBe(7);
  });

  it('lege statistieken voor een nieuwe speler', () => {
    const s = playerStats(buildState(tournamentEvents([])), 'a');
    expect(s.games).toBe(0);
    expect(s.winPct).toBe(0);
  });
});

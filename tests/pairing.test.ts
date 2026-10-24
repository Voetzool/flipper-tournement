import { describe, expect, it } from 'vitest';
import { generateRound, groupSizes, type PastGame } from '../src/formats/roundRobin/pairing';
import { createRng } from '../src/lib/rng';

const ids = (n: number) => Array.from({ length: n }, (_, i) => 'p' + (i + 1));

function play(n: number, rounds: number, max: number, machines: string[], seed = 1) {
  const rng = createRng(seed);
  const history: PastGame[] = [];
  const perRound: PastGame[][] = [];
  for (let r = 0; r < rounds; r++) {
    const games = generateRound({ playerIds: ids(n), machineIds: machines, maxGroupSize: max, history, rng });
    perRound.push(games);
    history.push(...games);
  }
  return { history, perRound };
}

function meetCounts(history: PastGame[]) {
  const m = new Map<string, number>();
  for (const g of history)
    for (let i = 0; i < g.playerIds.length; i++)
      for (let j = i + 1; j < g.playerIds.length; j++) {
        const k = [g.playerIds[i], g.playerIds[j]].sort().join('|');
        m.set(k, (m.get(k) ?? 0) + 1);
      }
  return m;
}

describe('groupSizes', () => {
  it('verdeelt zo gelijk mogelijk', () => {
    expect(groupSizes(10, 4)).toEqual([4, 3, 3]);
    expect(groupSizes(8, 4)).toEqual([4, 4]);
    expect(groupSizes(9, 4)).toEqual([3, 3, 3]);
    expect(groupSizes(5, 4)).toEqual([3, 2]);
    expect(groupSizes(13, 4)).toEqual([4, 3, 3, 3]);
    expect(groupSizes(6, 2)).toEqual([2, 2, 2]);
    expect(groupSizes(2, 4)).toEqual([2]);
  });
  it('maakt nooit een groep van 1', () => {
    for (let n = 2; n <= 40; n++)
      for (const max of [2, 3, 4]) {
        const s = groupSizes(n, max);
        expect(s.reduce((a, b) => a + b, 0)).toBe(n);
        expect(Math.min(...s)).toBeGreaterThanOrEqual(2);
      }
  });
  it('geeft niets bij minder dan 2 spelers', () => {
    expect(groupSizes(1, 4)).toEqual([]);
    expect(groupSizes(0, 4)).toEqual([]);
  });
});

describe('generateRound', () => {
  it('is snel genoeg voor 32 spelers', () => {
    const t0 = performance.now();
    play(32, 6, 4, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it('zet iedere speler precies één keer in een ronde', () => {
    for (const n of [4, 7, 10, 13, 16]) {
      const { perRound } = play(n, 3, 4, ['a', 'b', 'c', 'd', 'e']);
      for (const games of perRound) {
        const all = games.flatMap((g) => g.playerIds).sort();
        expect(all).toEqual(ids(n).sort());
      }
    }
  });

  it('gebruikt elke kast hooguit één keer per ronde', () => {
    const { perRound } = play(12, 4, 4, ['a', 'b', 'c']);
    for (const games of perRound) {
      const used = games.map((g) => g.machineId).filter(Boolean);
      expect(new Set(used).size).toBe(used.length);
    }
  });

  it('geeft groepen zonder kast als er te weinig kasten zijn', () => {
    const { perRound } = play(12, 1, 4, ['a']);
    expect(perRound[0].filter((g) => g.machineId === null)).toHaveLength(2);
  });

  it('8 spelers in groepen van 4: ronde 2 heeft het minimale aantal herhalingen', () => {
    const { history } = play(8, 2, 4, ['a', 'b']);
    const repeats = [...meetCounts(history).values()].filter((c) => c > 1).length;
    // Wiskundig minimum: elke nieuwe groep bevat 2+2 spelers uit dezelfde vorige groep → 2 herhalingen per groep.
    expect(repeats).toBe(4);
  });

  it('9 spelers in groepen van 3: 4 rondes zonder iemand twee keer te treffen', () => {
    let ok = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const { history } = play(9, 4, 3, ['a', 'b', 'c'], seed);
      if (Math.max(...meetCounts(history).values()) === 1) ok++;
    }
    expect(ok).toBeGreaterThanOrEqual(3);
  });

  it('verdeelt tegenstanders eerlijk over 5 rondes (10 spelers)', () => {
    const { history } = play(10, 5, 4, ['a', 'b', 'c']);
    const counts = meetCounts(history);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it('rouleert kasten: kasten worden verspreid over de spelers', () => {
    const { history } = play(12, 3, 4, ['a', 'b', 'c', 'd', 'e', 'f']);
    const pm = new Map<string, number>();
    for (const g of history) for (const p of g.playerIds) pm.set(p + g.machineId, (pm.get(p + g.machineId) ?? 0) + 1);
    const repeats = [...pm.values()].filter((c) => c > 1).length;
    // Tegenstanders gaan voor; een paar kastherhalingen (van de 36) zijn dan onvermijdelijk.
    expect(repeats).toBeLessThanOrEqual(4);
    expect(Math.max(...pm.values())).toBeLessThanOrEqual(2);
  });

  it('rouleert kleine groepen (10 spelers → 4+3+3)', () => {
    const { history } = play(10, 5, 4, ['a', 'b', 'c']);
    const inFour = new Map<string, number>();
    for (const g of history) if (g.playerIds.length === 4) for (const p of g.playerIds) inFour.set(p, (inFour.get(p) ?? 0) + 1);
    const values = ids(10).map((p) => inFour.get(p) ?? 0);
    // Tegenstanders wegen zwaarder dan groepsgrootte (gemiddelde punten zijn bij 4 en 3 spelers gelijk: 4).
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(2);
  });
});

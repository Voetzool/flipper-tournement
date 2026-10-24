import { newId } from '../../lib/id';
import { shuffle, type Rng } from '../../lib/rng';
import type { GameDraft, Id } from '../../events/types';

/**
 * Verdeelt n spelers in groepen van maximaal `max`, zo gelijk mogelijk.
 * 10 spelers, max 4 → [4, 3, 3]. Nooit een groep van 1 (dan wordt één groep max+1).
 */
export function groupSizes(n: number, max: number): number[] {
  if (n < 2) return [];
  let k = Math.ceil(n / max);
  if (Math.floor(n / k) < 2) k = Math.floor(n / 2);
  const base = Math.floor(n / k);
  const extra = n % k;
  return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface PastGame {
  machineId: Id | null;
  playerIds: Id[];
}

export interface PairingInput {
  playerIds: Id[];
  machineIds: Id[];
  maxGroupSize: number;
  history: PastGame[];
  rng: Rng;
  attempts?: number;
}

// Gewichten van de strafscore. Samen spelen weegt het zwaarst.
const W_MEET = 100;
const W_MACHINE = 10;
const W_SIZE = 60;
const W_MACHINE_TOTAL = 1;

class History {
  meet = new Map<string, number>();
  playerMachine = new Map<string, number>();
  playerSize = new Map<string, number>();
  machineTotal = new Map<Id, number>();

  /** Laagste aantal potjes in een groep van grootte s, onder de huidige spelers. */
  minSize = new Map<number, number>();

  constructor(games: PastGame[], players: Id[]) {
    for (const g of games) {
      const ps = g.playerIds;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) inc(this.meet, pairKey(ps[i], ps[j]));
        inc(this.playerSize, ps[i] + '|' + ps.length);
        if (g.machineId) inc(this.playerMachine, ps[i] + '|' + g.machineId);
      }
      if (g.machineId) inc(this.machineTotal, g.machineId);
    }
    const sizes = new Set(games.map((g) => g.playerIds.length));
    for (const size of sizes) {
      this.minSize.set(size, Math.min(...players.map((p) => this.playerSize.get(p + '|' + size) ?? 0)));
    }
  }

  /** Hoeveel vaker deze speler al in een groep van deze grootte zat dan de speler die het minst vaak. */
  sizeExcess(p: Id, size: number) {
    return (this.playerSize.get(p + '|' + size) ?? 0) - (this.minSize.get(size) ?? 0);
  }

  met(a: Id, b: Id) {
    return this.meet.get(pairKey(a, b)) ?? 0;
  }
}

function inc(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}

function pairKey(a: Id, b: Id) {
  return a < b ? a + '|' + b : b + '|' + a;
}

function groupCost(group: Id[], h: History): number {
  let c = 0;
  for (let i = 0; i < group.length; i++) {
    for (let j = i + 1; j < group.length; j++) {
      const m = h.met(group[i], group[j]);
      c += W_MEET * m * m + W_MEET * m;
    }
    const x = h.sizeExcess(group[i], group.length);
    c += W_SIZE * x * x;
  }
  return c;
}

function machineCost(group: Id[], machineId: Id, h: History): number {
  let c = W_MACHINE_TOTAL * (h.machineTotal.get(machineId) ?? 0);
  for (const p of group) {
    const n = h.playerMachine.get(p + '|' + machineId) ?? 0;
    c += W_MACHINE * n * n + W_MACHINE * n;
  }
  return c;
}

/** Wijs kasten toe aan groepen (gretig, daarna verbeteren door te wisselen). */
function assignMachines(groups: Id[][], machineIds: Id[], h: History, rng: Rng): { machines: (Id | null)[] } {
  const pool = shuffle(machineIds, rng);
  const machines: (Id | null)[] = groups.map(() => null);
  const used = new Set<Id>();
  for (let gi = 0; gi < groups.length; gi++) {
    let best: Id | null = null;
    let bestCost = Infinity;
    for (const m of pool) {
      if (used.has(m)) continue;
      const c = machineCost(groups[gi], m, h);
      if (c < bestCost) {
        bestCost = c;
        best = m;
      }
    }
    if (best) {
      used.add(best);
      machines[gi] = best;
    }
  }
  const costOf = (gi: number, m: Id | null) => (m ? machineCost(groups[gi], m, h) : 0);
  // Verbeteren: kasten tussen groepen wisselen, of vervangen door een ongebruikte kast.
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        const before = costOf(a, machines[a]) + costOf(b, machines[b]);
        const after = costOf(a, machines[b]) + costOf(b, machines[a]);
        if (machines[a] && machines[b] && after < before) {
          [machines[a], machines[b]] = [machines[b], machines[a]];
          improved = true;
        }
      }
      for (const m of pool) {
        if (used.has(m) || !machines[a]) continue;
        if (costOf(a, m) < costOf(a, machines[a])) {
          used.delete(machines[a]!);
          used.add(m);
          machines[a] = m;
          improved = true;
        }
      }
    }
  }
  return { machines };
}

/** Lokaal verbeteren door spelers tussen groepen te wisselen tot het niet beter wordt. */
function improveGroups(groups: Id[][], machines: (Id | null)[], h: History): number {
  const cost = (g: Id[], m: Id | null) => groupCost(g, h) + (m ? machineCost(g, m, h) : 0);
  const costs = groups.map((g, i) => cost(g, machines[i]));
  let improved = true;
  while (improved) {
    improved = false;
    for (let a = 0; a < groups.length; a++) {
      for (let b = a + 1; b < groups.length; b++) {
        for (let i = 0; i < groups[a].length; i++) {
          for (let j = 0; j < groups[b].length; j++) {
            const ga = groups[a].slice();
            const gb = groups[b].slice();
            [ga[i], gb[j]] = [gb[j], ga[i]];
            const ca = cost(ga, machines[a]);
            const cb = cost(gb, machines[b]);
            if (ca + cb < costs[a] + costs[b]) {
              groups[a] = ga;
              groups[b] = gb;
              costs[a] = ca;
              costs[b] = cb;
              improved = true;
            }
          }
        }
      }
    }
  }
  return costs.reduce((s, c) => s + c, 0);
}

/**
 * Maakt de indeling voor één ronde: zo weinig mogelijk herhaalde tegenstanders,
 * kasten zo goed mogelijk verspreid, kleine groepen eerlijk rondgedeeld.
 */
export function generateRound(input: PairingInput): GameDraft[] {
  const { playerIds, machineIds, maxGroupSize, rng } = input;
  const sizes = groupSizes(playerIds.length, maxGroupSize);
  if (!sizes.length) return [];
  const h = new History(input.history, playerIds);
  // Minder pogingen bij veel spelers (elke poging is dan duurder), zodat het op een telefoon vlot blijft.
  const attempts = input.attempts ?? Math.min(80, Math.max(20, Math.round(1000 / playerIds.length)));

  let best: { groups: Id[][]; machines: (Id | null)[]; cost: number } | null = null;
  for (let t = 0; t < attempts; t++) {
    const order = shuffle(playerIds, rng);
    const groups: Id[][] = [];
    let k = 0;
    for (const s of shuffle(sizes, rng)) {
      groups.push(order.slice(k, k + s));
      k += s;
    }
    // Afwisselend kasten toewijzen en spelers wisselen, tot het niet meer beter wordt.
    let machines: (Id | null)[] = groups.map(() => null);
    let cost = Infinity;
    for (let iter = 0; iter < 6; iter++) {
      machines = assignMachines(groups, machineIds, h, rng).machines;
      const c = improveGroups(groups, machines, h);
      const improved = c < cost;
      cost = c;
      if (!improved) break;
    }
    if (!best || cost < best.cost) best = { groups: groups.map((g) => g.slice()), machines: machines.slice(), cost };
    if (cost === 0) break;
  }
  return best!.groups.map((g, i) => ({ id: newId(), machineId: best!.machines[i], playerIds: g }));
}

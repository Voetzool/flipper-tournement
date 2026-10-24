import type { Game, Id } from './types';

/**
 * Plek per speler in een gespeeld potje (0 = eerste).
 * Iedereen voor zich: de volgorde van de uitslag. Teams: de plek van het team (teamgenoten delen hun plek).
 */
export function ranksOf(game: Pick<Game, 'result' | 'teams'>): Map<Id, number> {
  const ranks = new Map<Id, number>();
  const order = game.result ?? [];
  if (!game.teams) {
    order.forEach((id, i) => ranks.set(id, i));
    return ranks;
  }
  const teamOf = new Map<Id, number>();
  game.teams.forEach((team, ti) => team.forEach((id) => teamOf.set(id, ti)));
  // Volgorde van teams = volgorde waarin hun eerste speler in de uitslag staat.
  const teamRank = new Map<number, number>();
  for (const id of order) {
    const ti = teamOf.get(id);
    if (ti !== undefined && !teamRank.has(ti)) teamRank.set(ti, teamRank.size);
  }
  for (const id of order) ranks.set(id, teamRank.get(teamOf.get(id) ?? -1) ?? 0);
  return ranks;
}

/** Zijn a en b tegenstanders in dit potje (dus niet hetzelfde team)? */
export function areOpponents(game: Pick<Game, 'teams'>, a: Id, b: Id): boolean {
  if (a === b) return false;
  if (!game.teams) return true;
  return !game.teams.some((t) => t.includes(a) && t.includes(b));
}

/** Aantal "plekken" in het potje: aantal spelers, of aantal teams. */
export function placesOf(game: Pick<Game, 'result' | 'teams'>): number {
  return game.teams ? game.teams.length : (game.result ?? []).length;
}

import type { AppState, Game, Id, Tournament } from '../events/types';
import { areOpponents, ranksOf } from '../events/ranks';
import { inflate, initialRating, update, type Glicko, type MatchResult } from './glicko2';

export interface RatingPoint {
  at: number;
  rating: number;
  rd: number;
  delta: number;
  gameId: Id;
  tournamentId: Id;
}

export interface PlayerRating extends Glicko {
  playerId: Id;
  games: number;
  lastAt: number;
  history: RatingPoint[];
}

/** Na zoveel potjes is een rating niet meer "voorlopig". */
export const PROVISIONAL_GAMES = 5;
/** Inactiviteit: de onzekerheid groeit per 30 dagen zonder potje met één Glicko-periode. */
const PERIOD_MS = 30 * 24 * 3600 * 1000;

export interface PlayedGame {
  game: Game;
  tournament: Tournament;
}

/** Alle gespeelde potjes uit alle toernooien, in volgorde van invoer. */
export function playedGames(state: AppState): PlayedGame[] {
  const list: PlayedGame[] = [];
  for (const t of state.tournaments.values())
    for (const r of t.rounds) for (const g of r.games) if (g.result && g.result.length >= 2) list.push({ game: g, tournament: t });
  return list.sort((a, b) => (a.game.resultAt ?? 0) - (b.game.resultAt ?? 0));
}

/**
 * Glicko-2 per speler, volledig afgeleid uit de uitslagen.
 * Elk potje is één ratingperiode; een potje met meerdere spelers telt als paarsgewijze uitslagen
 * (wie hoger eindigt, wint van elke speler onder zich), allemaal tegen de ratings van vóór het potje.
 */
export function computeRatings(state: AppState): Map<Id, PlayerRating> {
  const ratings = new Map<Id, PlayerRating>();
  const get = (id: Id, at: number) => {
    let r = ratings.get(id);
    if (!r) {
      r = { ...initialRating(), playerId: id, games: 0, lastAt: at, history: [] };
      ratings.set(id, r);
    }
    return r;
  };

  for (const { game, tournament } of playedGames(state)) {
    const at = game.resultAt ?? 0;
    const order = game.result!;
    // Ratings vóór het potje (incl. groei door inactiviteit)
    const before = new Map<Id, Glicko>();
    for (const id of order) {
      const r = get(id, at);
      before.set(id, inflate(r, (at - r.lastAt) / PERIOD_MS));
    }
    // Elk tweetal tegenstanders telt als een duel; wie hoger eindigt wint (teamgenoten spelen niet tegen elkaar).
    const ranks = ranksOf(game);
    for (const id of order) {
      const results: MatchResult[] = order
        .filter((opp) => areOpponents(game, id, opp) && ranks.get(opp) !== ranks.get(id))
        .map((opp) => ({ opponent: before.get(opp)!, score: ranks.get(opp)! > ranks.get(id)! ? 1 : 0 }));
      if (!results.length) continue;
      const prev = before.get(id)!;
      const next = update(prev, results);
      const r = ratings.get(id)!;
      const delta = next.rating - r.rating;
      Object.assign(r, next, { games: r.games + 1, lastAt: at });
      r.history.push({ at, rating: next.rating, rd: next.rd, delta, gameId: game.id, tournamentId: tournament.id });
    }
  }
  return ratings;
}

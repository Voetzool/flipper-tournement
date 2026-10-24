import type { Game, Id, Round, Tournament } from '../events/types';

// Vooruit spelen: de volgende ronde mag al worden ingedeeld terwijl de huidige nog loopt (de indeling hangt niet af
// van uitslagen). Wie klaar is, kan dan alvast aan zijn of haar volgende potje beginnen.

const isTiebreak = (r: Round) => r.games.some((g) => g.tiebreak);

/** Rondes met minstens één potje zonder uitslag, van oud naar nieuw. */
export function openRounds(t: Pick<Tournament, 'rounds'>): Round[] {
  return t.rounds.filter((r) => r.games.some((g) => !g.result));
}

/** Heeft elk potje van elke ronde een uitslag? */
export function allRoundsComplete(t: Pick<Tournament, 'rounds'>): boolean {
  return t.rounds.length > 0 && openRounds(t).length === 0;
}

/**
 * Mag de volgende ronde alvast worden ingedeeld? Alleen als er nog geplande rondes over zijn, er precies één ronde
 * loopt (dus maximaal één ronde vooruit) en daarin al minstens één potje klaar is. Nooit voor een tie-breaker.
 */
export function canLookAhead(t: Pick<Tournament, 'rounds' | 'settings'>): boolean {
  const regular = t.rounds.filter((r) => !isTiebreak(r)).length;
  if (regular >= t.settings.rounds) return false;
  const open = openRounds(t);
  if (open.length !== 1 || isTiebreak(open[0])) return false;
  return open[0].games.some((g) => g.result);
}

export type GameStatus = { state: 'done' } | { state: 'ready' } | { state: 'busy'; waitingFor: Id[]; machineBusy: boolean };

/**
 * Kan dit potje nu gespeeld worden? Niet als een van de spelers nog een onafgemaakt potje in een eerdere ronde heeft,
 * of als de kast nog bezet is door zo'n potje. Alleen ter info: een uitslag invoeren mag altijd.
 */
export function gameStatus(t: Pick<Tournament, 'rounds'>, game: Game): GameStatus {
  if (game.result) return { state: 'done' };
  const roundIndex = t.rounds.findIndex((r) => r.games.some((g) => g.id === game.id));
  const earlierOpen = t.rounds.slice(0, Math.max(0, roundIndex)).flatMap((r) => r.games.filter((g) => !g.result));
  const busy = new Set(earlierOpen.flatMap((g) => g.playerIds));
  const waitingFor = game.playerIds.filter((p) => busy.has(p));
  const machineBusy = !!game.machineId && earlierOpen.some((g) => g.machineId === game.machineId);
  return waitingFor.length || machineBusy ? { state: 'busy', waitingFor, machineBusy } : { state: 'ready' };
}

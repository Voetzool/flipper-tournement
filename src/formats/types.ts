import type { FormatId, GameDraft, Tournament } from '../events/types';
import type { Rng } from '../lib/rng';
import type { StandingRow } from './roundRobin/scoring';

/**
 * Een toernooivorm als plug-in. Nieuwe vormen (bijv. league, knock-out) implementeren
 * deze interface en registreren zich in formats/index.ts.
 */
export interface FormatDefinition {
  id: FormatId;
  label: string;
  /** Indeling voor de volgende ronde op basis van wat er al gespeeld is. */
  nextRound(t: Pick<Tournament, 'playerIds' | 'machineIds' | 'settings' | 'rounds'>, rng?: Rng): GameDraft[];
  standings(t: Tournament): StandingRow[];
}

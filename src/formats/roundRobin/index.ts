import type { FormatDefinition } from '../types';
import { generateRound } from './pairing';
import { standings } from './scoring';

export const roundRobin: FormatDefinition = {
  id: 'roundRobin',
  label: 'Groepsrondes',
  nextRound(t, rng = Math.random) {
    return generateRound({
      playerIds: t.playerIds,
      machineIds: t.machineIds,
      maxGroupSize: t.settings.maxGroupSize,
      history: t.rounds.flatMap((r) => r.games),
      rng,
    });
  },
  standings,
};

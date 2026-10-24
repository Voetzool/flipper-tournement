import type { FormatId } from '../events/types';
import { headToHead } from './headToHead';
import { roundRobin } from './roundRobin';
import type { FormatDefinition } from './types';

export const formats: Record<FormatId, FormatDefinition> = {
  roundRobin,
  headToHead,
};

export function formatOf(id: FormatId): FormatDefinition {
  return formats[id];
}

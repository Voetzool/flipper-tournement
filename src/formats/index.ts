import type { FormatId } from '../events/types';
import { headToHead } from './headToHead';
import { roundRobin } from './roundRobin';
import { single } from './single';
import type { FormatDefinition } from './types';

export const formats: Record<FormatId, FormatDefinition> = {
  roundRobin,
  headToHead,
  single,
};

export function formatOf(id: FormatId): FormatDefinition {
  return formats[id];
}

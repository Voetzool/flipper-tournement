import { SERVER_MODE } from '../lib/serverMode';
import Dexie, { type Table } from 'dexie';
import type { Persistence } from '../events/store';
import type { StoredEvent } from '../events/types';

interface MetaRow {
  key: string;
  value: unknown;
}

class FlipperDB extends Dexie {
  events!: Table<StoredEvent, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('flipper-toernooi');
    this.version(1).stores({
      events: 'seq',
      meta: 'key',
    });
  }
}

export const db = new FlipperDB();

export const dexiePersistence: Persistence = {
  loadAll: () => db.events.orderBy('seq').toArray(),
  put: async (e) => {
    await db.events.put(e);
  },
  setReverted: async (seq, reverted) => {
    await db.events.update(seq, { reverted });
  },
  deleteSeqs: (seqs) => db.events.bulkDelete(seqs),
  replaceAll: (events) =>
    db.transaction('rw', db.events, async () => {
      await db.events.clear();
      await db.events.bulkPut(events);
    }),
};

// In de Pi-versie staan gedeelde gegevens (zoals de datum van de laatste back-up) op de server;
// de catalogus blijft per apparaat in de browser (snel zoeken).
const SERVER_KEYS = ['lastBackupAt'];

export async function getMeta<T>(key: string): Promise<T | undefined> {
  if (SERVER_MODE && SERVER_KEYS.includes(key)) {
    const res = await fetch('/api/meta/' + encodeURIComponent(key), { cache: 'no-store' }).catch(() => null);
    return res?.ok ? (((await res.json()) as { value: T | null }).value ?? undefined) : undefined;
  }
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  if (SERVER_MODE && SERVER_KEYS.includes(key)) {
    await fetch('/api/meta/' + encodeURIComponent(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) });
    return;
  }
  await db.meta.put({ key, value });
}

/** Vraagt de browser de data niet automatisch op te ruimen. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

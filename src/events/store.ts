import { newId } from '../lib/id';
import type { EventBody, StoredEvent } from './types';

/** Opslaglaag voor events. In de app: IndexedDB (db/db.ts). In tests: geheugen. */
export interface Persistence {
  loadAll(): Promise<StoredEvent[]>;
  put(e: StoredEvent): Promise<void>;
  setReverted(seq: number, reverted: boolean): Promise<void>;
  deleteSeqs(seqs: number[]): Promise<void>;
  replaceAll(events: StoredEvent[]): Promise<void>;
}

/**
 * Eventlog met undo/redo.
 * Invariant: de log is altijd [actieve events..., ongedaan gemaakte events...].
 * - undo: laatste actieve event wordt `reverted`.
 * - redo: eerste `reverted` event wordt weer actief.
 * - nieuwe actie: alle `reverted` events worden verwijderd (redo-stapel leeg), daarna toevoegen.
 */
export class EventStore {
  private events: StoredEvent[] = [];
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<(events: readonly StoredEvent[]) => void>();

  constructor(private persistence: Persistence) {}

  async load(): Promise<void> {
    const all = await this.persistence.loadAll();
    this.events = all.sort((a, b) => a.seq - b.seq);
    this.emit();
  }

  get all(): readonly StoredEvent[] {
    return this.events;
  }

  subscribe(fn: (events: readonly StoredEvent[]) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get undoTarget(): StoredEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) if (!this.events[i].reverted) return this.events[i];
    return undefined;
  }

  get redoTarget(): StoredEvent | undefined {
    return this.events.find((e) => e.reverted);
  }

  /** Voegt een event toe. State in geheugen wordt direct bijgewerkt; opslag volgt in volgorde. */
  dispatch(body: EventBody, at = Date.now()): StoredEvent {
    const dropped = this.events.filter((e) => e.reverted).map((e) => e.seq);
    const kept = this.events.filter((e) => !e.reverted);
    const seq = (this.events.length ? this.events[this.events.length - 1].seq : 0) + 1;
    const ev: StoredEvent = { seq, id: newId(), at, reverted: false, schema: 1, body };
    this.events = [...kept, ev];
    this.enqueue(async () => {
      if (dropped.length) await this.persistence.deleteSeqs(dropped);
      await this.persistence.put(ev);
    });
    this.emit();
    return ev;
  }

  undo(): StoredEvent | undefined {
    const target = this.undoTarget;
    if (!target) return undefined;
    this.setReverted(target, true);
    return target;
  }

  redo(): StoredEvent | undefined {
    const target = this.redoTarget;
    if (!target) return undefined;
    this.setReverted(target, false);
    return target;
  }

  async replaceAll(events: StoredEvent[]): Promise<void> {
    this.events = events.slice().sort((a, b) => a.seq - b.seq);
    this.enqueue(() => this.persistence.replaceAll(this.events));
    this.emit();
    await this.flush();
  }

  /** Wacht tot alle schrijfacties klaar zijn. */
  flush(): Promise<void> {
    return this.queue;
  }

  private setReverted(target: StoredEvent, reverted: boolean) {
    const updated = { ...target, reverted };
    this.events = this.events.map((e) => (e.seq === target.seq ? updated : e));
    this.enqueue(() => this.persistence.setReverted(target.seq, reverted));
    this.emit();
  }

  private enqueue(job: () => Promise<void>) {
    this.queue = this.queue.then(job).catch((err) => {
      console.error('Opslaan mislukt', err);
    });
  }

  private emit() {
    for (const l of this.listeners) l(this.events);
  }
}

export class MemoryPersistence implements Persistence {
  rows = new Map<number, StoredEvent>();
  async loadAll() {
    return [...this.rows.values()];
  }
  async put(e: StoredEvent) {
    this.rows.set(e.seq, e);
  }
  async setReverted(seq: number, reverted: boolean) {
    const e = this.rows.get(seq);
    if (e) this.rows.set(seq, { ...e, reverted });
  }
  async deleteSeqs(seqs: number[]) {
    for (const s of seqs) this.rows.delete(s);
  }
  async replaceAll(events: StoredEvent[]) {
    this.rows = new Map(events.map((e) => [e.seq, e]));
  }
}

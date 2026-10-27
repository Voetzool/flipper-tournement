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

/** Undo-bereik van een event: het toernooi waar het bij hoort, of null (spelers/kasten: geen undo). */
export function undoScope(body: EventBody): string | null {
  return 'tournamentId' in body ? body.tournamentId : null;
}

/** Het aanmaken van een toernooi draai je niet terug met undo (verwijderen kan wel). */
function undoable(e: StoredEvent, scope: string): boolean {
  return undoScope(e.body) === scope && e.body.type !== 'TournamentCreated';
}

/**
 * Eventlog met undo/redo per toernooi.
 * Elk toernooi heeft zijn eigen undo-stapel: undo draait het laatste actieve event van dát toernooi terug,
 * ook als er daarna spelers of kasten zijn gewijzigd (die zijn onafhankelijk van toernooi-events).
 * Binnen één toernooi geldt: [actief…, ongedaan gemaakt…].
 * - undo(t): laatste actieve event van t wordt `reverted`.
 * - redo(t): eerste `reverted` event van t wordt weer actief.
 * - nieuwe actie: de `reverted` events met hetzelfde bereik worden verwijderd (redo-stapel leeg), daarna toevoegen.
 */
export class EventStore {
  private events: StoredEvent[] = [];
  private queue: Promise<void> = Promise.resolve();
  private listeners = new Set<(events: readonly StoredEvent[]) => void>();
  /** Wordt aangeroepen nadat een schrijfactie in de opslag staat (om andere vensters te seinen). */
  onWritten?: () => void;

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

  undoTarget(scope: string): StoredEvent | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (!e.reverted && undoable(e, scope)) return e;
    }
    return undefined;
  }

  redoTarget(scope: string): StoredEvent | undefined {
    return this.events.find((e) => e.reverted && undoScope(e.body) === scope);
  }

  /** Voegt een event toe. State in geheugen wordt direct bijgewerkt; opslag volgt in volgorde. */
  dispatch(body: EventBody, at = Date.now()): StoredEvent {
    const scope = undoScope(body);
    const drop = (e: StoredEvent) => e.reverted && undoScope(e.body) === scope;
    const dropped = this.events.filter(drop).map((e) => e.seq);
    const kept = this.events.filter((e) => !drop(e));
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

  undo(scope: string): StoredEvent | undefined {
    const target = this.undoTarget(scope);
    if (!target) return undefined;
    this.setReverted(target, true);
    return target;
  }

  redo(scope: string): StoredEvent | undefined {
    const target = this.redoTarget(scope);
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

  /** Opnieuw inlezen nadat een ander venster de opslag heeft gewijzigd. */
  async reload(): Promise<void> {
    await this.flush();
    await this.load();
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
    this.queue = this.queue.then(job).then(() => this.onWritten?.()).catch((err) => {
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

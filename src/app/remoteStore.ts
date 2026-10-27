import { signal } from '@preact/signals';
import { EventStore, MemoryPersistence } from '../events/store';
import type { EventBody, StoredEvent } from '../events/types';

type Command = { op: 'dispatch'; body: EventBody } | { op: 'undo' | 'redo'; scope: string };

/** false zodra de server (de Pi) niet bereikbaar is; de app probeert het dan vanzelf opnieuw. */
export const serverConnected = signal(true);

const RETRY_MS = 2000;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'HTTP ' + res.status);
  return (await res.json()) as T;
}

/**
 * Eventlog op de server (Pi-versie). Werkt met dezelfde methodes als `EventStore`.
 * Elke actie wordt meteen lokaal toegepast (het scherm reageert direct) en daarna in volgorde naar de server
 * gestuurd. De server is de baas: na het versturen, en bij elk signaal van de server, laden we zijn events opnieuw.
 */
export class RemoteStore {
  private mirror = new EventStore(new MemoryPersistence());
  private pending: Command[] = [];
  private sending: Promise<void> | null = null;
  private version = 0;
  private stream: EventSource | null = null;

  get all(): readonly StoredEvent[] {
    return this.mirror.all;
  }

  subscribe(fn: (events: readonly StoredEvent[]) => void) {
    return this.mirror.subscribe(fn);
  }

  undoTarget(scope: string) {
    return this.mirror.undoTarget(scope);
  }

  redoTarget(scope: string) {
    return this.mirror.redoTarget(scope);
  }

  /** Eerste keer laden; blijft het proberen tot de server bereikbaar is. Start daarna de live-verbinding. */
  async load(): Promise<void> {
    for (;;) {
      try {
        await this.reload();
        break;
      } catch {
        serverConnected.value = false;
        await wait(RETRY_MS);
      }
    }
    this.listen();
  }

  async reload(): Promise<void> {
    const data = await api<{ version: number; events: StoredEvent[] }>('/api/events');
    serverConnected.value = true;
    // Lokale acties die nog onderweg zijn niet overschrijven; die komen na het versturen vanzelf terug.
    if (this.pending.length) return;
    this.version = data.version;
    await this.mirror.replaceAll(data.events);
  }

  dispatch(body: EventBody): StoredEvent {
    const ev = this.mirror.dispatch(body);
    this.send({ op: 'dispatch', body });
    return ev;
  }

  undo(scope: string): StoredEvent | undefined {
    const ev = this.mirror.undo(scope);
    if (ev) this.send({ op: 'undo', scope });
    return ev;
  }

  redo(scope: string): StoredEvent | undefined {
    const ev = this.mirror.redo(scope);
    if (ev) this.send({ op: 'redo', scope });
    return ev;
  }

  async replaceAll(events: StoredEvent[]): Promise<void> {
    await this.flush();
    await api('/api/command', { method: 'POST', body: JSON.stringify({ op: 'replaceAll', events }) });
    await this.reload();
  }

  /** Wacht tot alle acties bij de server zijn aangekomen. */
  async flush(): Promise<void> {
    while (this.sending) await this.sending;
  }

  private send(cmd: Command) {
    this.pending.push(cmd);
    if (!this.sending) this.sending = this.drain().finally(() => (this.sending = null));
  }

  private async drain() {
    while (this.pending.length) {
      try {
        const r = await api<{ version: number }>('/api/command', { method: 'POST', body: JSON.stringify(this.pending[0]) });
        this.pending.shift();
        this.version = r.version;
        serverConnected.value = true;
      } catch (e) {
        if (e instanceof TypeError) {
          // Netwerkfout: later opnieuw proberen (de actie blijft in de wachtrij).
          serverConnected.value = false;
          await wait(RETRY_MS);
        } else {
          // De server weigert de actie: overslaan, de server-stand gaat voor.
          console.error(e);
          this.pending.shift();
        }
      }
    }
    await this.reload().catch(() => {});
  }

  /** Live-verbinding: de server meldt elke wijziging (ook van andere apparaten). */
  private listen() {
    if (this.stream || typeof EventSource === 'undefined') return;
    this.stream = new EventSource('/api/stream');
    this.stream.onmessage = (m) => {
      serverConnected.value = true;
      if (Number(m.data) !== this.version) this.reload().catch(() => {});
    };
    this.stream.onerror = () => {
      serverConnected.value = false;
    };
  }
}

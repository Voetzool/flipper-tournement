import { signal } from '@preact/signals';
import { reloadIfServerUpdated } from './remoteStore';

// Pi-versie: de Pi-software bijwerken vanuit de app. De server vraagt een aparte bijwerk-taak op de Pi aan
// (zie server/install.sh); wij volgen de status en herladen de app zodra de nieuwe versie draait.

export type PiUpdateState =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'latest'; current: string }
  | { step: 'available'; current: string; latest: string }
  | { step: 'offline'; current?: string }
  | { step: 'installing'; latest: string }
  | { step: 'error'; message: string };

export const piUpdate = signal<PiUpdateState>({ step: 'idle' });

export async function checkPiUpdate(): Promise<void> {
  piUpdate.value = { step: 'checking' };
  try {
    const r = (await (await fetch('/api/update/check', { cache: 'no-store' })).json()) as {
      current: string;
      latest?: string;
      available?: boolean;
      offline?: boolean;
    };
    if (r.offline || !r.latest) piUpdate.value = { step: 'offline', current: r.current };
    else if (r.available) piUpdate.value = { step: 'available', current: r.current, latest: r.latest };
    else piUpdate.value = { step: 'latest', current: r.current };
  } catch {
    piUpdate.value = { step: 'error', message: 'Server niet bereikbaar.' };
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function installPiUpdate(latest: string): Promise<void> {
  piUpdate.value = { step: 'installing', latest };
  try {
    const res = await fetch('/api/update/install', { method: 'POST' });
    if (!res.ok) {
      const msg = ((await res.json().catch(() => null)) as { error?: string } | null)?.error;
      piUpdate.value = res.status === 503 ? { step: 'offline' } : { step: 'error', message: msg ?? 'Bijwerken mislukt.' };
      return;
    }
  } catch {
    piUpdate.value = { step: 'error', message: 'Server niet bereikbaar.' };
    return;
  }
  // Volgen tot de nieuwe versie draait (max. ~15 minuten; een Pi 3B+ is wat trager).
  const start = Date.now();
  let started = false;
  while (Date.now() - start < 15 * 60 * 1000) {
    await wait(3000);
    try {
      const st = (await (await fetch('/api/update/status', { cache: 'no-store' })).json()) as { state: string; message?: string };
      if (st.state === 'running') started = true;
      if (st.state === 'error') {
        piUpdate.value = { step: 'error', message: st.message || 'Bijwerken mislukt.' };
        return;
      }
      if (st.state === 'done') await reloadIfServerUpdated();
      // Nog 'requested' na 30 s: de bijwerk-taak is (nog) niet geïnstalleerd op deze Pi.
      if (!started && st.state === 'requested' && Date.now() - start > 30000) {
        piUpdate.value = { step: 'error', message: 'De Pi reageert niet op het verzoek.' };
        return;
      }
    } catch {
      // Server herstart even tijdens het bijwerken.
    }
  }
  piUpdate.value = { step: 'error', message: 'Bijwerken duurt te lang.' };
}

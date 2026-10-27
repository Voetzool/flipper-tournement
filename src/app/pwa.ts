import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const updateAvailable = signal(false);
export const offlineReady = signal(false);

let updater: ((reload?: boolean) => Promise<void>) | undefined;
let registration: ServiceWorkerRegistration | undefined;

export function initPwa() {
  updater = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable.value = true;
    },
    onOfflineReady() {
      offlineReady.value = true;
    },
    onRegisteredSW(_url, reg) {
      registration = reg;
      // Af en toe (als er internet is) kijken of er een nieuwe versie is.
      if (reg) setInterval(() => navigator.onLine && reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}

export function applyUpdate() {
  updater?.(true);
}

/** Handmatig kijken of er een nieuwe versie is; zo ja, die meteen laden. */
export async function checkForUpdate(): Promise<'updating' | 'latest' | 'offline'> {
  if (!registration || !navigator.onLine) return 'offline';
  try {
    await registration.update();
  } catch {
    return 'offline';
  }
  // Even wachten tot een gevonden update is geïnstalleerd (onNeedRefresh zet dan updateAvailable).
  for (let i = 0; i < 40 && registration.installing; i++) await new Promise((r) => setTimeout(r, 250));
  if (updateAvailable.value || registration.waiting) {
    updateAvailable.value = true;
    applyUpdate();
    return 'updating';
  }
  return 'latest';
}

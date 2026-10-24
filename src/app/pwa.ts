import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const updateAvailable = signal(false);
export const offlineReady = signal(false);

let updater: ((reload?: boolean) => Promise<void>) | undefined;

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
      // Af en toe (als er internet is) kijken of er een nieuwe versie is.
      if (reg) setInterval(() => navigator.onLine && reg.update().catch(() => {}), 60 * 60 * 1000);
    },
  });
}

export function applyUpdate() {
  updater?.(true);
}

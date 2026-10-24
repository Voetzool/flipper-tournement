import { effect, signal } from '@preact/signals';

// Instellingen per apparaat (niet in de back-up): bewaard in localStorage.

export type ThemeChoice = 'auto' | 'light' | 'dark';

function load<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // privé-venster e.d.: dan geldt de keuze alleen voor deze sessie
  }
}

export const theme = signal<ThemeChoice>(load('theme', ['auto', 'light', 'dark'] as const, 'auto'));

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;
const systemLight = signal(media?.matches ?? false);
media?.addEventListener?.('change', (e) => (systemLight.value = e.matches));

/** Zet het thema op de pagina. Roep aan vóór de eerste render (geen flits). */
export function initSettings() {
  effect(() => {
    const resolved = theme.value === 'auto' ? (systemLight.value ? 'light' : 'dark') : theme.value;
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'light' ? '#f3f4f8' : '#0b0b12');
  });
}

export function setTheme(t: ThemeChoice) {
  theme.value = t;
  save('theme', t);
}

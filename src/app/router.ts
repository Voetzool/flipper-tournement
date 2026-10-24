import { signal } from '@preact/signals';

/** Simpele hash-router (#/pad/delen). Werkt zonder server-instellingen op GitHub Pages. */
export const route = signal<string[]>(parse());

function parse(): string[] {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

addEventListener('hashchange', () => {
  route.value = parse();
  scrollTo(0, 0);
});

export function go(path: string) {
  location.hash = '#/' + path.replace(/^\//, '');
}

export function back(fallback = '') {
  if (history.length > 1) history.back();
  else go(fallback);
}

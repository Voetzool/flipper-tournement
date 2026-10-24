import { lang } from '../app/settings';
import { en } from './en';

// Vertalen: de Nederlandse tekst is de sleutel. tr('Ronde {n}', { n: 2 }) → "Ronde 2" of "Round 2".
// Ontbreekt een Engelse vertaling, dan blijft de Nederlandse tekst staan (tests/i18n.test.ts bewaakt dit).

export function tr(nl: string, params?: Record<string, string | number>): string {
  let s = lang.value === 'en' ? (en[nl] ?? nl) : nl;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split('{' + k + '}').join(String(v));
  return s;
}

/** Locale voor datums en sorteren. */
export function locale(): string {
  return lang.value === 'en' ? 'en-GB' : 'nl-NL';
}

/** Rangtelwoord voor plekken: "1e" / "1st". */
export function ordinal(n: number): string {
  if (lang.value !== 'en') return n + 'e';
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
  return n + s;
}

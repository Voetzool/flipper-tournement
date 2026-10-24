import { afterEach, describe, expect, it } from 'vitest';
import { lang } from '../src/app/settings';
import { en } from '../src/i18n/en';
import { ordinal, tr } from '../src/i18n';

const files = import.meta.glob<string>(['../src/**/*.{ts,tsx}', '!../src/i18n/**'], { query: '?raw', import: 'default', eager: true });
const code = Object.values(files).join('\n');
const LIT = "'((?:[^'\\\\]|\\\\.)*)'";

/** Alle letterlijke sleutels in `tr('…')` en `tr(x ? '…' : '…')`. */
const used = new Set<string>();
for (const m of code.matchAll(new RegExp('\\btr\\(\\s*' + LIT, 'g'))) used.add(m[1]);
for (const m of code.matchAll(new RegExp("\\btr\\([^'()]*\\?\\s*" + LIT + '\\s*:\\s*' + LIT, 'g'))) used.add(m[1]).add(m[2]);

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('vertalingen', () => {
  afterEach(() => {
    lang.value = 'nl';
  });

  it('elke tr-sleutel heeft een Engelse vertaling', () => {
    expect(used.size).toBeGreaterThan(200);
    expect([...used].filter((k) => !(k in en))).toEqual([]);
  });

  it('geen vertalingen voor teksten die niet (meer) in de code staan', () => {
    // Ook teksten die via een variabele vertaald worden (labels, foutmeldingen) staan letterlijk in de code.
    expect(Object.keys(en).filter((k) => !code.includes(`'${k}'`))).toEqual([]);
  });

  it('placeholders zijn gelijk in NL en EN', () => {
    for (const [nl, eng] of Object.entries(en)) expect(placeholders(eng), nl).toEqual(placeholders(nl));
  });

  it('tr vertaalt, vult parameters in en valt terug op Nederlands', () => {
    expect(tr('Ronde {n} van {totaal}', { n: 2, totaal: 5 })).toBe('Ronde 2 van 5');
    lang.value = 'en';
    expect(tr('Ronde {n} van {totaal}', { n: 2, totaal: 5 })).toBe('Round 2 of 5');
    expect(tr('Iets onbekends')).toBe('Iets onbekends');
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
    lang.value = 'nl';
    expect(ordinal(3)).toBe('3e');
  });
});

import { describe, expect, it } from 'vitest';

// Oudere iPads (iOS 15.0–15.3, bijv. iPad Air 2) kennen deze functies niet; gebruik ze dus niet in de app.
const files = import.meta.glob<string>('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
const MISSING_ON_OLD_IOS = ['structuredClone(', '.at(', 'Object.hasOwn(', '.findLast(', '.toSorted(', '.toReversed(', 'Object.groupBy('];

describe('compatibiliteit met oudere iOS', () => {
  it('geen functies die iOS 15.0 mist', () => {
    const hits = Object.entries(files).flatMap(([f, code]) =>
      MISSING_ON_OLD_IOS.filter((fn) => code.replace(/^\s*(\/\/|\*).*$/gm, '').includes(fn)).map((fn) => `${f}: ${fn}`),
    );
    expect(hits).toEqual([]);
  });
});

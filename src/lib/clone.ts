/** Diepe kopie van gewone JSON-data. Bewust geen structuredClone: die bestaat pas vanaf iOS 15.4. */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

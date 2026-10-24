import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain JS-module uit scripts/
import { commonPrefix, transformOpdb } from '../scripts/catalog-transform.mjs';
import { buildIndex, normalize, searchCatalog } from '../src/catalog/search';
import type { CatalogFile } from '../src/catalog/types';
import { buildState } from '../src/events/reducer';
import type { EventBody, StoredEvent } from '../src/events/types';

// Opbouw volgens de OPDB v2-export (zie github.com/dgolja/opdb-to-psql, opdb-v2-schema.json)
function entry(o: Record<string, unknown>) {
  return {
    opdbId: 'GaaaA-Mbbbb',
    opdbGroup: 'GaaaA',
    opdbMachine: 'GaaaA-Mbbbb',
    name: 'X',
    shortName: null,
    commonName: null,
    nameSort: 'X',
    year: 1990,
    manufactureDate: '1990-01-01',
    description: null,
    type: 'ss',
    display: 'dmd',
    playerCount: 4,
    physicalMachine: true,
    manufacturerId: 1,
    ipdbId: null,
    pinballPrimerUrl: null,
    pinballRulesUrl: null,
    pinballCardsUrl: null,
    bobsGuideUrl: null,
    competitionSetupUrl: null,
    competitionNotesUrl: null,
    hasCompetitionNotes: false,
    hasCompetitionSetup: false,
    createdAt: '2020-01-01T00:00:00.000000Z',
    updatedAt: '2020-01-01T00:00:00.000000Z',
    entryType: 'machine',
    manufacturer: { manufacturerId: 1, name: 'Williams', fullName: 'Williams Electronic Games' },
    people: [],
    images: [],
    features: [],
    keywords: [],
    ...o,
  };
}

const img = (id: string, type = 'backglass', primary = false) => ({
  group: id,
  title: null,
  primary,
  type,
  urls: { small: `https://img.opdb.org/${id}-small.jpg`, medium: `https://img.opdb.org/${id}-medium.jpg`, large: `https://img.opdb.org/${id}-large.jpg` },
  sizes: { small: { width: 1, height: 1 }, medium: { width: 2, height: 2 }, large: { width: 3, height: 3 } },
});

const sample = {
  entries: [
    entry({ opdbId: 'G1-M1', name: 'Medieval Madness', shortName: 'MM', year: 1997, ipdbId: 4032, pinballRulesUrl: 'https://tiltforums.com/t/medieval-madness-rulesheet/1', images: [img('pf', 'playfield'), img('bg', 'backglass', true)] }),
    entry({ opdbId: 'G1-M2', name: 'Medieval Madness (Remake)', year: 2015, manufacturer: { manufacturerId: 2, name: 'Chicago Gaming', fullName: 'Chicago Gaming Company' } }),
    entry({ opdbId: 'G2-M1', name: 'Attack from Mars', shortName: 'AFM', year: 1995, manufacturer: { manufacturerId: 3, name: 'Bally', fullName: 'Bally' } }),
    entry({ opdbId: 'G3-M1', name: 'Godzilla (Premium)', commonName: 'Godzilla', year: 2021, entryType: 'alias', manufacturer: { manufacturerId: 4, name: 'Stern', fullName: 'Stern Pinball' } }),
    entry({ opdbId: 'G3', opdbMachine: null, name: 'Godzilla', entryType: 'machineGroup', manufacturer: null, manufacturerId: null }),
    entry({ opdbId: 'G9-M1', name: 'Virtueel Ding', physicalMachine: false }),
    entry({ opdbId: 'G4-M1', name: 'Fireball', year: 1972, type: 'em', manufacturer: { manufacturerId: 3, name: 'Bally', fullName: 'Bally' } }),
  ],
};

describe('OPDB-export omzetten', () => {
  const cat: CatalogFile = transformOpdb(sample, { generatedAt: 'x' });

  it('neemt kasten en varianten mee, maar geen groepen of virtuele tafels', () => {
    expect(cat.e.map((r) => r.i).sort()).toEqual(['G1-M1', 'G1-M2', 'G2-M1', 'G3-M1', 'G4-M1']);
  });

  it('bewaart fabrikanten één keer en kiest de primaire afbeelding', () => {
    expect(cat.mfrs).toEqual(['Williams', 'Chicago Gaming', 'Bally', 'Stern']);
    const mm = cat.e.find((r) => r.i === 'G1-M1')!;
    expect(mm).toMatchObject({ n: 'Medieval Madness', s: 'MM', m: 0, y: 1997, ip: 4032, t: 'ss' });
    expect(cat.imgBase).toBe('https://img.opdb.org/');
    expect(mm.im).toBe('bg-medium.jpg');
    expect(mm.r).toContain('tiltforums');
  });

  it('commonPrefix kapt af op een /', () => {
    expect(commonPrefix(['https://a.b/x/1.jpg', 'https://a.b/x/2.jpg'])).toBe('https://a.b/x/');
    expect(commonPrefix(['https://a.b/x1.jpg', 'https://a.b/x2.jpg'])).toBe('https://a.b/');
    expect(commonPrefix([])).toBe('');
  });

  it('slaat kapotte regels over', () => {
    expect(transformOpdb({ entries: [null, { name: 'zonder id' }, entry({ opdbId: 'G5-M1', name: 'Ok' })] }).e).toHaveLength(1);
    expect(transformOpdb(null).e).toHaveLength(0);
  });
});

describe('catalogus doorzoeken', () => {
  const index = buildIndex(transformOpdb(sample));
  const names = (q: string) => searchCatalog(index, q).map((m) => m.name);

  it('normaliseert hoofdletters, accenten en leestekens', () => {
    expect(normalize('  Attack From Mars! ')).toBe('attack from mars');
    expect(normalize('Élan')).toBe('elan');
  });

  it('vindt op (deel van) de naam, exacte naam eerst', () => {
    expect(names('medieval')).toEqual(['Medieval Madness (Remake)', 'Medieval Madness']);
    // exacte naam wint van een langere naam die ermee begint
    expect(names('medieval madness')).toEqual(['Medieval Madness', 'Medieval Madness (Remake)']);
  });

  it('vindt op korte naam, fabrikant en jaar', () => {
    expect(names('afm')[0]).toBe('Attack from Mars');
    expect(names('mm')[0]).toBe('Medieval Madness');
    expect(names('bally')).toEqual(expect.arrayContaining(['Attack from Mars', 'Fireball']));
    expect(names('bally 1972')).toEqual(['Fireball']);
  });

  it('geeft leesbare gegevens met volledige afbeeldings-URL', () => {
    const [mm] = searchCatalog(index, 'mm');
    expect(mm).toMatchObject({ opdbId: 'G1-M1', manufacturer: 'Williams', year: 1997, imageMedium: 'https://img.opdb.org/bg-medium.jpg' });
  });

  it('lege zoekopdracht geeft niets', () => {
    expect(names('  ')).toEqual([]);
  });
});

describe('kastgegevens bijwerken', () => {
  let seq = 0;
  const ev = (body: EventBody): StoredEvent => ({ seq: ++seq, id: String(seq), at: seq, reverted: false, schema: 1, body });

  it('MachineUpdated wijzigt alleen meegegeven velden; null maakt leeg', () => {
    const st = buildState([
      ev({ type: 'MachineAdded', machineId: 'm', name: 'MM', manufacturer: 'Williams', year: 1997, notes: 'Linker flipper zwak' }),
      ev({ type: 'MachineUpdated', machineId: 'm', notes: 'Magna save werkt niet' }),
      ev({ type: 'MachineUpdated', machineId: 'm', year: null }),
    ]);
    expect(st.machines.get('m')).toEqual({ id: 'm', name: 'MM', manufacturer: 'Williams', notes: 'Magna save werkt niet', active: true });
  });

  it('oude events (alleen naam) blijven werken', () => {
    const st = buildState([ev({ type: 'MachineAdded', machineId: 'x', name: 'Oud' }), ev({ type: 'MachineUpdated', machineId: 'x', name: 'Nieuw' })]);
    expect(st.machines.get('x')).toEqual({ id: 'x', name: 'Nieuw', active: true });
  });
});

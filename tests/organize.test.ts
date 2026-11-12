import { describe, expect, it } from 'vitest';
import { buildState } from '../src/events/reducer';
import type { EventBody, StoredEvent } from '../src/events/types';
import { undoScope } from '../src/events/store';
import { corePlayerIds, toggleCoreSelection } from '../src/lib/coreGroup';
import { csvField, toCsv } from '../src/lib/share';

const evs = (bodies: EventBody[]): StoredEvent[] => bodies.map((body, i) => ({ seq: i + 1, id: String(i), at: i, reverted: false, schema: 1, body }));
const created = (id: string): EventBody => ({
  type: 'TournamentCreated',
  tournamentId: id,
  name: id,
  format: 'roundRobin',
  settings: { rounds: 1, maxGroupSize: 4, pointsTable: { 2: [7, 1] } },
  playerIds: ['a', 'b'],
  machineIds: [],
  firstRound: [],
});

describe('vaste groep', () => {
  it('zet spelers in en uit de vaste groep', () => {
    const s = buildState(
      evs([
        { type: 'PlayerAdded', playerId: 'a', name: 'Anna' },
        { type: 'PlayerAdded', playerId: 'b', name: 'Bram' },
        { type: 'PlayerAdded', playerId: 'c', name: 'Cees' },
        { type: 'PlayersCoreSet', playerIds: ['a', 'c'], core: true },
        { type: 'PlayersCoreSet', playerIds: ['c'], core: false },
      ]),
    );
    expect(corePlayerIds(s)).toEqual(['a']);
  });

  it('knop selecteert de vaste groep, of haalt hem weer weg', () => {
    expect(toggleCoreSelection(['x'], ['a', 'b'])).toEqual(['x', 'a', 'b']);
    expect(toggleCoreSelection(['a', 'x'], ['a', 'b'])).toEqual(['a', 'x', 'b']);
    expect(toggleCoreSelection(['a', 'x', 'b'], ['a', 'b'])).toEqual(['x']);
    expect(toggleCoreSelection(['x'], [])).toEqual(['x']);
  });
});

describe('archief en mappen', () => {
  it('archiveert, verplaatst naar mappen en zet terug als een map verdwijnt', () => {
    const s = buildState(
      evs([
        created('t1'),
        created('t2'),
        { type: 'FolderCreated', folderId: 'f', name: 'Seizoen' },
        { type: 'FolderRenamed', folderId: 'f', name: 'Seizoen 2026' },
        { type: 'TournamentsMoved', tournamentIds: ['t1', 't2'], folderId: 'f' },
        { type: 'TournamentsArchived', tournamentIds: ['t2'], archived: true },
        { type: 'TournamentsMoved', tournamentIds: ['t1'], folderId: 'bestaat-niet' },
      ]),
    );
    expect(s.folders.get('f')?.name).toBe('Seizoen 2026');
    expect(s.tournaments.get('t1')?.folderId).toBeUndefined();
    expect(s.tournaments.get('t2')).toMatchObject({ folderId: 'f', archived: true });

    const s2 = buildState(evs([created('t1'), { type: 'FolderCreated', folderId: 'f', name: 'X' }, { type: 'TournamentsMoved', tournamentIds: ['t1'], folderId: 'f' }, { type: 'FolderDeleted', folderId: 'f' }]));
    expect(s2.folders.size).toBe(0);
    expect(s2.tournaments.get('t1')?.folderId).toBeUndefined();
  });

  it('ordenen valt buiten de undo-stapel van een toernooi', () => {
    expect(undoScope({ type: 'TournamentsArchived', tournamentIds: ['t'], archived: true })).toBeNull();
    expect(undoScope({ type: 'TournamentsMoved', tournamentIds: ['t'], folderId: null })).toBeNull();
    expect(undoScope({ type: 'PlayersCoreSet', playerIds: ['a'], core: true })).toBeNull();
  });
});

describe('CSV', () => {
  it('escapet velden en gebruikt puntkomma', () => {
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('zeg "hoi"')).toBe('"zeg ""hoi"""');
    expect(toCsv([['Plek', 'Naam'], [1, 'Zoë']])).toBe('﻿Plek;Naam\r\n1;Zoë\r\n');
  });
});

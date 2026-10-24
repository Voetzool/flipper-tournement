// Alle acties in de app zijn events. De stand wordt berekend door ze af te spelen (zie reducer.ts).
// Let op: bestaande event-vormen nooit wijzigen zonder migratie; back-ups bevatten deze events letterlijk.

export type Id = string;

export type FormatId = 'roundRobin';

export interface RoundRobinSettings {
  rounds: number;
  maxGroupSize: 2 | 3 | 4;
  /** Punten per plek, per groepsgrootte. Bijv. {4: [7,5,3,1], 3: [7,4,1], 2: [7,1]} */
  pointsTable: Record<number, number[]>;
}

export interface GameDraft {
  id: Id;
  machineId: Id | null;
  playerIds: Id[];
}

export type EventBody =
  | { type: 'PlayerAdded'; playerId: Id; name: string }
  | { type: 'PlayerUpdated'; playerId: Id; name: string }
  /** Alleen voor spelers die nog nooit aan een toernooi meededen. */
  | { type: 'PlayerDeleted'; playerId: Id }
  | { type: 'PlayerArchived'; playerId: Id }
  | { type: 'PlayerRestored'; playerId: Id }
  | { type: 'MachineAdded'; machineId: Id; name: string }
  | { type: 'MachineUpdated'; machineId: Id; name: string }
  /** Alleen voor kasten die nog nooit in een toernooi zaten. */
  | { type: 'MachineDeleted'; machineId: Id }
  | { type: 'MachineRemoved'; machineId: Id }
  | { type: 'MachineRestored'; machineId: Id }
  | {
      type: 'TournamentCreated';
      tournamentId: Id;
      name: string;
      format: FormatId;
      settings: RoundRobinSettings;
      playerIds: Id[];
      machineIds: Id[];
      /** Eerste ronde wordt meteen meegegeven, zodat één undo het hele toernooi terugdraait. */
      firstRound: GameDraft[];
    }
  | { type: 'TournamentPlayersChanged'; tournamentId: Id; playerIds: Id[] }
  | { type: 'RoundGenerated'; tournamentId: Id; games: GameDraft[] }
  /** Vervangt de laatste ronde (alleen als daar nog geen uitslagen in staan). */
  | { type: 'RoundRegenerated'; tournamentId: Id; games: GameDraft[] }
  | { type: 'GameResultEntered'; tournamentId: Id; gameId: Id; order: Id[] }
  | { type: 'ResultCorrected'; tournamentId: Id; gameId: Id; order: Id[] }
  | { type: 'GameMachineChanged'; tournamentId: Id; gameId: Id; machineId: Id | null }
  | { type: 'TournamentFinished'; tournamentId: Id }
  | { type: 'TournamentReopened'; tournamentId: Id }
  | { type: 'TournamentDeleted'; tournamentId: Id };

export type EventType = EventBody['type'];

export interface StoredEvent {
  /** Volgnummer (oplopend). */
  seq: number;
  id: Id;
  at: number;
  /** true = ongedaan gemaakt (staat op de redo-stapel). */
  reverted: boolean;
  schema: 1;
  body: EventBody;
}

// ---------- Afgeleide state ----------

export interface Player {
  id: Id;
  name: string;
  archived: boolean;
  createdAt: number;
}

export interface Machine {
  id: Id;
  name: string;
  // Fase 3: manufacturer, year, notes, rulesheetUrl, externalIds { opdb, pinballMap }
  active: boolean;
}

export interface Game extends GameDraft {
  /** Volgorde van finish, 1e eerst. undefined = nog niet gespeeld. */
  result?: Id[];
  /** Moment van de eerste invoer (niet van een correctie). */
  resultAt?: number;
  corrected?: boolean;
}

export interface Round {
  index: number;
  games: Game[];
}

export interface Tournament {
  id: Id;
  name: string;
  format: FormatId;
  settings: RoundRobinSettings;
  /** Huidige deelnemers (kan wijzigen tijdens het toernooi). */
  playerIds: Id[];
  machineIds: Id[];
  rounds: Round[];
  status: 'active' | 'finished';
  createdAt: number;
  finishedAt?: number;
}

export interface AppState {
  players: Map<Id, Player>;
  machines: Map<Id, Machine>;
  tournaments: Map<Id, Tournament>;
}

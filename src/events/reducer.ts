import type { AppState, Game, StoredEvent, Tournament } from './types';

export function emptyState(): AppState {
  return { players: new Map(), machines: new Map(), tournaments: new Map() };
}

/** Speelt alle actieve (niet ongedaan gemaakte) events af tot een nieuwe state. Puur: geen bijwerkingen. */
export function buildState(events: readonly StoredEvent[]): AppState {
  const state = emptyState();
  for (const e of events) {
    if (!e.reverted) apply(state, e);
  }
  return state;
}

function findGame(t: Tournament | undefined, gameId: string): Game | undefined {
  if (!t) return undefined;
  for (const r of t.rounds) {
    const g = r.games.find((x) => x.id === gameId);
    if (g) return g;
  }
  return undefined;
}

export function apply(state: AppState, e: StoredEvent): void {
  const b = e.body;
  switch (b.type) {
    case 'PlayerAdded':
      state.players.set(b.playerId, { id: b.playerId, name: b.name, archived: false, createdAt: e.at });
      break;
    case 'PlayerUpdated': {
      const p = state.players.get(b.playerId);
      if (p) p.name = b.name;
      break;
    }
    case 'PlayerDeleted':
      state.players.delete(b.playerId);
      break;
    case 'PlayerArchived':
    case 'PlayerRestored': {
      const p = state.players.get(b.playerId);
      if (p) p.archived = b.type === 'PlayerArchived';
      break;
    }
    case 'MachineAdded':
      state.machines.set(b.machineId, { id: b.machineId, name: b.name, active: true });
      break;
    case 'MachineUpdated': {
      const m = state.machines.get(b.machineId);
      if (m) m.name = b.name;
      break;
    }
    case 'MachineDeleted':
      state.machines.delete(b.machineId);
      break;
    case 'MachineRemoved':
    case 'MachineRestored': {
      const m = state.machines.get(b.machineId);
      if (m) m.active = b.type === 'MachineRestored';
      break;
    }
    case 'TournamentCreated':
      state.tournaments.set(b.tournamentId, {
        id: b.tournamentId,
        name: b.name,
        format: b.format,
        settings: structuredClone(b.settings),
        playerIds: b.playerIds.slice(),
        machineIds: b.machineIds.slice(),
        rounds: b.firstRound.length ? [{ index: 0, games: b.firstRound.map(cloneGame) }] : [],
        status: 'active',
        createdAt: e.at,
      });
      break;
    case 'TournamentPlayersChanged': {
      const t = state.tournaments.get(b.tournamentId);
      if (t) t.playerIds = b.playerIds.slice();
      break;
    }
    case 'RoundGenerated': {
      const t = state.tournaments.get(b.tournamentId);
      if (t) t.rounds.push({ index: t.rounds.length, games: b.games.map(cloneGame) });
      break;
    }
    case 'RoundRegenerated': {
      const t = state.tournaments.get(b.tournamentId);
      const last = t?.rounds[t.rounds.length - 1];
      if (last && last.games.every((g) => !g.result)) last.games = b.games.map(cloneGame);
      break;
    }
    case 'GameResultEntered':
    case 'ResultCorrected': {
      const g = findGame(state.tournaments.get(b.tournamentId), b.gameId);
      if (g) {
        if (b.type === 'ResultCorrected' && g.result) g.corrected = true;
        // resultAt blijft het moment van de eerste invoer, zodat de volgorde (en dus de rating) klopt na correcties.
        if (!g.result) g.resultAt = e.at;
        g.result = b.order.slice();
      }
      break;
    }
    case 'GameMachineChanged': {
      const g = findGame(state.tournaments.get(b.tournamentId), b.gameId);
      if (g) g.machineId = b.machineId;
      break;
    }
    case 'TournamentFinished': {
      const t = state.tournaments.get(b.tournamentId);
      if (t) {
        t.status = 'finished';
        t.finishedAt = e.at;
      }
      break;
    }
    case 'TournamentReopened': {
      const t = state.tournaments.get(b.tournamentId);
      if (t) {
        t.status = 'active';
        t.finishedAt = undefined;
      }
      break;
    }
    case 'TournamentDeleted':
      state.tournaments.delete(b.tournamentId);
      break;
  }
}

function cloneGame(g: { id: string; machineId: string | null; playerIds: string[] }): Game {
  return { id: g.id, machineId: g.machineId, playerIds: g.playerIds.slice() };
}

/** Komt deze speler voor in een toernooi (als deelnemer of in een potje)? */
export function playerInUse(state: AppState, playerId: string): boolean {
  for (const t of state.tournaments.values()) {
    if (t.playerIds.includes(playerId)) return true;
    if (t.rounds.some((r) => r.games.some((g) => g.playerIds.includes(playerId)))) return true;
  }
  return false;
}

/** Is deze kast ooit voor een toernooi gekozen of in een potje gebruikt? */
export function machineInUse(state: AppState, machineId: string): boolean {
  for (const t of state.tournaments.values()) {
    if (t.machineIds.includes(machineId)) return true;
    if (t.rounds.some((r) => r.games.some((g) => g.machineId === machineId))) return true;
  }
  return false;
}

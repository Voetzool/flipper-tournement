import { computed, signal } from '@preact/signals';
import { dexiePersistence, getMeta, setMeta } from '../db/db';
import { buildState } from '../events/reducer';
import { EventStore } from '../events/store';
import { computeRatings } from '../rating/ratings';
import type { AppState, EventBody, StoredEvent } from '../events/types';

export const store = new EventStore(dexiePersistence);

export const events = signal<readonly StoredEvent[]>([]);
export const loaded = signal(false);
export const state = computed<AppState>(() => buildState(events.value));
/** Glicko-2 ratings, altijd opnieuw berekend uit alle uitslagen. */
export const ratings = computed(() => computeRatings(state.value));
export const lastBackupAt = signal<number | undefined>(undefined);

store.subscribe((all) => {
  events.value = all;
});

export async function initState() {
  await store.load();
  lastBackupAt.value = await getMeta<number>('lastBackupAt');
  loaded.value = true;
}

export async function markBackedUp(at = Date.now()) {
  lastBackupAt.value = at;
  await setMeta('lastBackupAt', at);
}

// ---------- Meldingen ----------

export interface ToastAction {
  label: string;
  run: () => void;
}

export const toast = signal<{ text: string; id: number; action?: ToastAction } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** Korte melding onderin; met een actieknop blijft hij wat langer staan. */
export function showToast(text: string, action?: ToastAction) {
  toast.value = { text, id: Date.now(), action };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), action ? 5000 : 2500);
}

// ---------- Acties ----------

export function dispatch(body: EventBody) {
  return store.dispatch(body);
}

// Undo/redo werkt per toernooi (zie EventStore). `events.value` lezen maakt het reactief.
export function canUndo(tournamentId: string) {
  return events.value && !!store.undoTarget(tournamentId);
}

export function canRedo(tournamentId: string) {
  return events.value && !!store.redoTarget(tournamentId);
}

export function undo(tournamentId: string) {
  const before = state.value;
  const e = store.undo(tournamentId);
  if (e) showToast('Ongedaan: ' + describeEvent(e.body, before));
}

export function redo(tournamentId: string) {
  const e = store.redo(tournamentId);
  if (e) showToast('Opnieuw: ' + describeEvent(e.body, state.value));
}

// ---------- Leesbare omschrijving van een event ----------

export function playerName(s: AppState, id: string) {
  return s.players.get(id)?.name ?? 'Onbekend';
}

export function machineName(s: AppState, id: string | null) {
  if (!id) return 'Vrije kast';
  return s.machines.get(id)?.name ?? 'Onbekende kast';
}

export function describeEvent(b: EventBody, s: AppState): string {
  const t = 'tournamentId' in b ? s.tournaments.get(b.tournamentId)?.name ?? 'toernooi' : '';
  switch (b.type) {
    case 'PlayerAdded':
      return `speler ${b.name} toegevoegd`;
    case 'PlayerUpdated':
      return `naam gewijzigd in ${b.name}`;
    case 'PlayerDeleted':
      return `${playerName(s, b.playerId)} verwijderd`;
    case 'PlayerArchived':
      return `${playerName(s, b.playerId)} gearchiveerd`;
    case 'PlayerRestored':
      return `${playerName(s, b.playerId)} teruggezet`;
    case 'MachineAdded':
      return `kast ${b.name} toegevoegd`;
    case 'MachineUpdated':
      return `kast hernoemd naar ${b.name}`;
    case 'MachineDeleted':
      return `${machineName(s, b.machineId)} definitief verwijderd`;
    case 'MachineRemoved':
      return `${machineName(s, b.machineId)} verwijderd`;
    case 'MachineRestored':
      return `${machineName(s, b.machineId)} teruggezet`;
    case 'TournamentCreated':
      return `toernooi ${b.name} gestart`;
    case 'TournamentPlayersChanged':
      return `deelnemers ${t} gewijzigd`;
    case 'RoundGenerated':
      return `nieuwe ronde in ${t}`;
    case 'RoundRegenerated':
      return `ronde opnieuw ingedeeld in ${t}`;
    case 'GameResultEntered':
      return `uitslag (${b.order.map((id) => playerName(s, id)).join(', ')})`;
    case 'ResultCorrected':
      return `correctie (${b.order.map((id) => playerName(s, id)).join(', ')})`;
    case 'GameMachineChanged':
      return `kast gewisseld naar ${machineName(s, b.machineId)}`;
    case 'TournamentFinished':
      return `${t} afgerond`;
    case 'TournamentReopened':
      return `${t} heropend`;
    case 'TournamentDeleted':
      return `${t} verwijderd`;
  }
}

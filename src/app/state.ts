import { RemoteStore } from './remoteStore';
import { SERVER_MODE } from '../lib/serverMode';
import { tr } from '../i18n';
import { computed, signal } from '@preact/signals';
import { dexiePersistence, getMeta, setMeta } from '../db/db';
import { buildState } from '../events/reducer';
import { EventStore } from '../events/store';
import { computeRatings } from '../rating/ratings';
import type { AppState, EventBody, StoredEvent } from '../events/types';

export const store: EventStore | RemoteStore = SERVER_MODE ? new RemoteStore() : new EventStore(dexiePersistence);
export { serverConnected } from './remoteStore';

export const events = signal<readonly StoredEvent[]>([]);
export const loaded = signal(false);
export const state = computed<AppState>(() => buildState(events.value));
/** Glicko-2 ratings, altijd opnieuw berekend uit alle uitslagen. */
export const ratings = computed(() => computeRatings(state.value));
export const lastBackupAt = signal<number | undefined>(undefined);

store.subscribe((all) => {
  events.value = all;
});

// Meerdere vensters (bijv. het scorebord op een tv via een tweede venster) blijven gelijk: na elke schrijfactie
// seint dit venster via localStorage; de andere vensters krijgen een 'storage'-event en lezen de opslag opnieuw in.
const SYNC_KEY = 'flipper-sync';
if (store instanceof EventStore) store.onWritten = () => {
  try {
    localStorage.setItem(SYNC_KEY, String(Date.now()) + Math.random());
  } catch {
    // privé-venster of geen opslag: dan geen synchronisatie tussen vensters
  }
};
if (!SERVER_MODE && typeof addEventListener !== 'undefined') {
  addEventListener('storage', (e) => {
    if (e.key === SYNC_KEY) store.reload();
  });
}

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
  if (e) showToast(tr('Ongedaan: {wat}', { wat: describeEvent(e.body, before) }));
}

export function redo(tournamentId: string) {
  const e = store.redo(tournamentId);
  if (e) showToast(tr('Opnieuw: {wat}', { wat: describeEvent(e.body, state.value) }));
}

// ---------- Leesbare omschrijving van een event ----------

export function playerName(s: AppState, id: string) {
  return s.players.get(id)?.name ?? tr('Onbekend');
}

export function machineName(s: AppState, id: string | null) {
  if (!id) return tr('Vrije machine');
  return s.machines.get(id)?.name ?? tr('Onbekende machine');
}

export function describeEvent(b: EventBody, s: AppState): string {
  const t = 'tournamentId' in b ? s.tournaments.get(b.tournamentId)?.name ?? tr('toernooi') : '';
  const p = 'playerId' in b ? playerName(s, b.playerId) : '';
  const m = 'machineId' in b ? machineName(s, b.machineId) : '';
  const order = 'order' in b ? b.order.map((id) => playerName(s, id)).join(', ') : '';
  switch (b.type) {
    case 'PlayerAdded':
      return tr('speler {naam} toegevoegd', { naam: b.name });
    case 'PlayerUpdated':
      return tr('naam gewijzigd in {naam}', { naam: b.name });
    case 'PlayerDeleted':
      return tr('{naam} verwijderd', { naam: p });
    case 'PlayerArchived':
      return tr('{naam} gearchiveerd', { naam: p });
    case 'PlayerRestored':
      return tr('{naam} teruggezet', { naam: p });
    case 'MachineAdded':
      return tr('machine {naam} toegevoegd', { naam: b.name });
    case 'MachineUpdated':
      return b.name ? tr('machine hernoemd naar {naam}', { naam: b.name }) : tr('{naam} bijgewerkt', { naam: m });
    case 'MachineDeleted':
      return tr('{naam} definitief verwijderd', { naam: m });
    case 'MachineRemoved':
      return tr('{naam} verwijderd', { naam: m });
    case 'MachineRestored':
      return tr('{naam} teruggezet', { naam: m });
    case 'TournamentCreated':
      return tr('toernooi {naam} gestart', { naam: b.name });
    case 'TournamentPlayersChanged':
      return tr('deelnemers {naam} gewijzigd', { naam: t });
    case 'RoundGenerated':
      return tr('nieuwe ronde in {naam}', { naam: t });
    case 'RoundRegenerated':
      return tr('ronde opnieuw ingedeeld in {naam}', { naam: t });
    case 'GameResultEntered':
      return tr('uitslag ({spelers})', { spelers: order });
    case 'ResultCorrected':
      return tr('correctie ({spelers})', { spelers: order });
    case 'GameMachineChanged':
      return tr('machine gewisseld naar {naam}', { naam: m });
    case 'TournamentFinished':
      return tr('{naam} afgerond', { naam: t });
    case 'TournamentReopened':
      return tr('{naam} heropend', { naam: t });
    case 'TournamentDeleted':
      return tr('{naam} verwijderd', { naam: t });
  }
}

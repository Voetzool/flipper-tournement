import type { StoredEvent } from '../events/types';

export const BACKUP_APP = 'flipper-toernooi';
export const BACKUP_VERSION = 1;
export const REMINDER_DAYS = 7;

export interface BackupFile {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  events: StoredEvent[];
}

/** Alleen actieve events gaan mee; de redo-stapel niet. */
export function makeBackup(events: readonly StoredEvent[], now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    events: events.filter((e) => !e.reverted),
  };
}

export function parseBackup(text: string): StoredEvent[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Dit is geen geldig JSON-bestand.');
  }
  const d = data as Partial<BackupFile>;
  if (!d || d.app !== BACKUP_APP || !Array.isArray(d.events)) {
    throw new Error('Dit bestand is geen back-up van Flipper Toernooi.');
  }
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION) {
    throw new Error('Deze back-up komt uit een nieuwere versie van de app. Werk de app eerst bij.');
  }
  for (const e of d.events) {
    if (typeof e?.seq !== 'number' || typeof e?.body?.type !== 'string') {
      throw new Error('De back-up is beschadigd.');
    }
  }
  return d.events.map((e) => ({ ...e, reverted: false }));
}

export function backupFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `flipper-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

/**
 * Herinnering nodig? Ja als er iets is veranderd sinds de laatste back-up én
 * (de back-up ouder is dan REMINDER_DAYS dagen, of er sindsdien een toernooi is afgerond).
 */
export function needsBackupReminder(events: readonly StoredEvent[], lastBackupAt: number | undefined, now = Date.now()): boolean {
  const changed = events.filter((e) => !e.reverted && e.at > (lastBackupAt ?? 0));
  if (!changed.length) return false;
  if (changed.some((e) => e.body.type === 'TournamentFinished')) return true;
  const since = lastBackupAt ?? Math.min(...changed.map((e) => e.at));
  return now - since > REMINDER_DAYS * 24 * 3600 * 1000;
}

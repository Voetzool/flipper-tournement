import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Persistence } from '../src/events/store';
import type { StoredEvent } from '../src/events/types';

const KEEP_BACKUPS = 14;

/** Bewaart de events als één JSON-bestand op schijf (atomisch: eerst naar .tmp, dan hernoemen). */
export class FilePersistence implements Persistence {
  private rows = new Map<number, StoredEvent>();
  private file: string;
  private backupDir: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'events.json');
    this.backupDir = join(dir, 'backups');
    if (existsSync(this.file)) {
      const events = JSON.parse(readFileSync(this.file, 'utf8')) as StoredEvent[];
      this.rows = new Map(events.map((e) => [e.seq, e]));
    }
  }

  async loadAll() {
    return [...this.rows.values()];
  }
  async put(e: StoredEvent) {
    this.rows.set(e.seq, e);
    this.save();
  }
  async setReverted(seq: number, reverted: boolean) {
    const e = this.rows.get(seq);
    if (e) this.rows.set(seq, { ...e, reverted });
    this.save();
  }
  async deleteSeqs(seqs: number[]) {
    for (const s of seqs) this.rows.delete(s);
    this.save();
  }
  async replaceAll(events: StoredEvent[]) {
    this.backup(true);
    this.rows = new Map(events.map((e) => [e.seq, e]));
    this.save();
  }

  private save() {
    const events = [...this.rows.values()].sort((a, b) => a.seq - b.seq);
    writeAtomic(this.file, JSON.stringify(events));
    this.backup(false);
  }

  /** Eén kopie per dag (en altijd vóór het terugzetten van een back-up); de laatste 14 blijven bewaard. */
  private backup(force: boolean) {
    if (!existsSync(this.file)) return;
    mkdirSync(this.backupDir, { recursive: true });
    const day = new Date().toISOString().slice(0, 10);
    const name = force ? `events-${day}-voor-terugzetten-${Date.now()}.json` : `events-${day}.json`;
    const target = join(this.backupDir, name);
    if (!force && existsSync(target)) return;
    copyFileSync(this.file, target);
    const all = readdirSync(this.backupDir).filter((f) => f.startsWith('events-')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP_BACKUPS))) unlinkSync(join(this.backupDir, old));
  }
}

/** Klein sleutel/waarde-bestand voor overige gegevens (bijv. datum laatste back-up). */
export class MetaFile {
  private data: Record<string, unknown> = {};
  private file: string;

  constructor(dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'meta.json');
    if (existsSync(this.file)) this.data = JSON.parse(readFileSync(this.file, 'utf8'));
  }

  get(key: string): unknown {
    return this.data[key];
  }

  set(key: string, value: unknown) {
    this.data[key] = value;
    writeAtomic(this.file, JSON.stringify(this.data));
  }
}

export function writeAtomic(file: string, content: string | Buffer) {
  const tmp = file + '.tmp';
  writeFileSync(tmp, content);
  renameSync(tmp, file);
}

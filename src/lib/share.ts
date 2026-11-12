/**
 * Bestand delen of opslaan. Op telefoons het deelmenu (Bestanden/Drive, mail, WhatsApp), anders een gewone download.
 * Geeft 'shared', 'saved' of 'cancelled' terug.
 */
export async function shareOrDownload(file: File, title: string): Promise<'shared' | 'saved' | 'cancelled'> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'saved';
}

/** Tekst als één CSV-veld (met puntkomma als scheiding: opent goed in een Nederlandse Excel). */
export function csvField(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  // BOM zodat Excel de tekens (ë, é) goed leest.
  return '﻿' + rows.map((r) => r.map(csvField).join(';')).join('\r\n') + '\r\n';
}

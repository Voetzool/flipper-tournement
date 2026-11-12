import type { PlayerRating } from '../rating/ratings';
import { toCsv } from './share';

export interface RankingRow {
  rank: number | null; // null = voorlopig
  name: string;
  r: PlayerRating;
}

/** Ranglijst als CSV (plek, naam, rating, ±, potjes, laatste wijziging, voorlopig). */
export function rankingCsv(rows: RankingRow[], headers: string[], provisionalLabel: string): string {
  const last = (r: PlayerRating) => Math.round(r.history[r.history.length - 1]?.delta ?? 0);
  return toCsv([
    headers,
    ...rows.map((x) => [x.rank ?? '', x.name, Math.round(x.r.rating), Math.round(x.r.rd), x.r.games, last(x.r), x.rank === null ? provisionalLabel : '']),
  ]);
}

/** Ranglijst als PNG-afbeelding (getekend op een canvas, in de kleuren van het huidige thema). */
export function rankingPng(rows: RankingRow[], title: string, subtitle: string): Promise<Blob> {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const bg = v('--bg', '#0b0b12');
  const card = v('--card', '#1b1b2e');
  const text = v('--text', '#ececf4');
  const muted = v('--muted', '#a3a6bd');
  const accent = v('--yellow', '#ffd60a');
  const scale = 2;
  const w = 720;
  const rowH = 52;
  const head = 110;
  const h = head + rows.length * (rowH + 6) + 30;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const font = (size: number, weight = 600) => `${weight} ${size}px system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = text;
  ctx.font = font(30, 800);
  ctx.fillText(title, 28, 52);
  ctx.fillStyle = muted;
  ctx.font = font(16, 500);
  ctx.fillText(subtitle, 28, 80);
  rows.forEach((x, i) => {
    const top = head + i * (rowH + 6);
    ctx.fillStyle = card;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, top, w - 40, rowH, 12);
    else ctx.rect(20, top, w - 40, rowH);
    ctx.fill();
    const mid = top + rowH / 2 + 7;
    ctx.fillStyle = x.rank === null ? muted : text;
    ctx.font = font(20, 800);
    ctx.textAlign = 'center';
    ctx.fillText(x.rank === null ? '–' : String(x.rank), 52, mid);
    ctx.textAlign = 'left';
    ctx.fillStyle = text;
    ctx.font = font(20, 650);
    ctx.fillText(x.name, 90, mid);
    ctx.textAlign = 'right';
    ctx.fillStyle = accent;
    ctx.font = font(22, 900);
    ctx.fillText(String(Math.round(x.r.rating)), w - 110, mid);
    ctx.fillStyle = muted;
    ctx.font = font(15, 500);
    ctx.fillText(`±${Math.round(x.r.rd)}`, w - 40, mid);
    ctx.textAlign = 'left';
  });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG mislukt'))), 'image/png'));
}

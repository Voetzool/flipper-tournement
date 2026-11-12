import { useRef, useState } from 'preact/hooks';
import { playerName, state } from '../../app/state';
import type { PlayerRating } from '../../rating/ratings';
import { locale, tr } from '../../i18n';

function niceStep(range: number) {
  for (const s of [10, 20, 25, 50, 100, 200, 250, 500]) if (range / s <= 4) return s;
  return 1000;
}

/** Staafgrafiek: huidige rating per speler (hoog → laag), met de ±-onzekerheid als dun streepje. */
export function RatingBars({ rows }: { rows: PlayerRating[] }) {
  const s = state.value;
  const [hover, setHover] = useState<string | null>(null);
  if (!rows.length) return null;
  const lo = Math.min(...rows.map((r) => r.rating - r.rd));
  const hi = Math.max(...rows.map((r) => r.rating + r.rd));
  const step = niceStep(Math.max(hi - lo, 40));
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const pct = (v: number) => ((v - min) / (max - min)) * 100;
  return (
    <div class="bars" role="img" aria-label={tr('Staafgrafiek van de rating per speler')}>
      {rows.map((r, i) => (
        <div
          key={r.playerId}
          class={'bar-row' + (hover === r.playerId ? ' hover' : '')}
          onPointerEnter={() => setHover(r.playerId)}
          onPointerLeave={() => setHover(null)}
          title={`${playerName(s, r.playerId)}: ${Math.round(r.rating)} ±${Math.round(r.rd)}`}
        >
          <span class="bar-label">
            <span class="muted">{i + 1}.</span> {playerName(s, r.playerId)}
          </span>
          <span class="bar-track">
            <span class="bar-fill" style={{ width: `${pct(r.rating)}%` }} />
            <span class="bar-rd" style={{ left: `${pct(r.rating - r.rd)}%`, width: `${pct(r.rating + r.rd) - pct(r.rating - r.rd)}%` }} />
          </span>
          <span class="bar-value">
            {Math.round(r.rating)}
            <span class="muted small"> ±{Math.round(r.rd)}</span>
          </span>
        </div>
      ))}
      <div class="bar-axis small muted">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

const W = 640;
const H = 260;
const PAD = { l: 52, r: 14, t: 14, b: 28 };
/** Maximaal 8 lijnen: daarna zijn de kleuren niet meer goed uit elkaar te houden. */
export const MAX_SERIES = 8;

/** Ratingverloop van meerdere spelers in één grafiek: per potje (op volgorde van tijd) de rating na dat potje. */
export function RatingHistory({ rows }: { rows: PlayerRating[] }) {
  const s = state.value;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const series = rows.filter((r) => r.history.length).slice(0, MAX_SERIES);
  if (!series.length) return null;

  // Alle potjes van deze spelers op één tijdlijn.
  const times = [...new Set(series.flatMap((r) => r.history.map((h) => h.at)))].sort((a, b) => a - b);
  const index = new Map(times.map((t, i) => [t, i]));
  const all = series.flatMap((r) => r.history.map((h) => h.rating));
  const step = niceStep(Math.max(Math.max(...all) - Math.min(...all), 40));
  const yMin = Math.floor((Math.min(...all) - step / 3) / step) * step;
  const yMax = Math.ceil((Math.max(...all) + step / 3) / step) * step;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (times.length === 1 ? pw / 2 : (i / (times.length - 1)) * pw);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ph;
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) ticks.push(v);

  const onPointer = (e: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / pw) * (times.length - 1));
    setHover(Math.max(0, Math.min(times.length - 1, i)));
  };

  // Rating van een speler op moment i (laatste potje tot en met dat moment).
  const ratingAt = (r: PlayerRating, i: number) => {
    let v: number | null = null;
    for (const h of r.history) if (index.get(h.at)! <= i) v = h.rating;
    return v;
  };

  const tip =
    hover !== null
      ? series
          .map((r, k) => ({ k, name: playerName(s, r.playerId), v: ratingAt(r, hover) }))
          .filter((t) => t.v !== null)
          .sort((a, b) => b.v! - a.v!)
      : [];

  return (
    <div class="chart history">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={tr('Ratingverloop van {n} spelers', { n: series.length })}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text class="axis" x={PAD.l - 8} y={y(v) + 4} text-anchor="end">
              {v}
            </text>
          </g>
        ))}
        <text class="axis" x={PAD.l} y={H - 8}>
          {new Date(times[0]).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}
        </text>
        <text class="axis" x={W - PAD.r} y={H - 8} text-anchor="end">
          {new Date(times[times.length - 1]).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })}
        </text>
        {hover !== null && <line class="cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />}
        {series.map((r, k) => (
          <path
            key={r.playerId}
            class="series"
            style={{ stroke: `var(--s${k + 1})` }}
            d={r.history.map((h, j) => `${j ? 'L' : 'M'}${x(index.get(h.at)!).toFixed(1)},${y(h.rating).toFixed(1)}`).join('')}
          />
        ))}
        {hover !== null &&
          series.map((r, k) => {
            const h = r.history.find((p) => index.get(p.at) === hover);
            return h ? <circle key={r.playerId} class="dot" cx={x(hover)} cy={y(h.rating)} r={5} style={{ fill: `var(--s${k + 1})` }} /> : null;
          })}
      </svg>
      <ul class="legend">
        {series.map((r, k) => (
          <li key={r.playerId}>
            <span class="swatch" style={{ background: `var(--s${k + 1})` }} />
            {playerName(s, r.playerId)}
          </li>
        ))}
      </ul>
      {hover !== null && tip.length > 0 && (
        <div class="history-tip small">
          <b>{new Date(times[hover]).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}</b>
          {tip.map((t) => (
            <span key={t.k}>
              <span class="swatch" style={{ background: `var(--s${t.k + 1})` }} /> {t.name} {Math.round(t.v!)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

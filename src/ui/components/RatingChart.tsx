import { useRef, useState } from 'preact/hooks';
import type { RatingPoint } from '../../rating/ratings';
import { DEFAULT_RATING, DEFAULT_RD } from '../../rating/glicko2';

const W = 600;
const H = 220;
const PAD = { l: 58, r: 12, t: 14, b: 30 };

function niceStep(range: number) {
  for (const s of [10, 20, 25, 50, 100, 200, 250, 500]) if (range / s <= 4) return s;
  return 1000;
}

/** Ratingverloop: lijn = rating, band = ± onzekerheid (RD). Tik/beweeg voor details per potje. */
export function RatingChart({ history, label }: { history: RatingPoint[]; label: (p: RatingPoint, i: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Punt 0 = startrating, daarna één punt per potje.
  const pts = [{ rating: DEFAULT_RATING, rd: DEFAULT_RD }, ...history];
  const ratings = pts.map((p) => p.rating);
  const lo = Math.min(...ratings);
  const hi = Math.max(...ratings);
  const step = niceStep(Math.max(hi - lo, 40));
  const yMin = Math.floor((lo - step / 2) / step) * step;
  const yMax = Math.ceil((hi + step / 2) / step) * step;
  const pw = W - PAD.l - PAD.r;
  const ph = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (pts.length === 1 ? pw / 2 : (i / (pts.length - 1)) * pw);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * ph;

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rating).toFixed(1)}`).join('');
  const band =
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.rating + p.rd).toFixed(1)}`).join('') +
    pts
      .slice()
      .reverse()
      .map((p, k) => `L${x(pts.length - 1 - k).toFixed(1)},${y(p.rating - p.rd).toFixed(1)}`)
      .join('') +
    'Z';
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) ticks.push(v);

  const onPointer = (e: PointerEvent) => {
    const svg = svgRef.current;
    if (!svg || pts.length < 2) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.l) / pw) * (pts.length - 1));
    setHover(Math.max(1, Math.min(pts.length - 1, i)));
  };

  const hp = hover !== null ? history[hover - 1] : null;
  const tipLeft = hover !== null ? (x(hover) / W) * 100 : 0;

  return (
    <div class="chart">
      <div class="chart-tip" style={{ left: `clamp(70px, ${tipLeft}%, calc(100% - 70px))`, visibility: hp ? 'visible' : 'hidden' }}>
        {hp && hover !== null ? label(hp, hover - 1) : ' '}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Ratingverloop over ${history.length} potjes`}
        onPointerDown={onPointer}
        onPointerMove={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id="plot">
            <rect x={PAD.l} y={PAD.t} width={pw} height={ph} />
          </clipPath>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line class="grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text class="axis" x={PAD.l - 8} y={y(v) + 6} text-anchor="end">
              {v}
            </text>
          </g>
        ))}
        <text class="axis" x={PAD.l} y={H - 4}>
          start
        </text>
        <text class="axis" x={W - PAD.r} y={H - 4} text-anchor="end">
          potje {history.length}
        </text>
        <path class="band" d={band} clip-path="url(#plot)" />
        <path class="line" d={line} />
        {hover !== null && (
          <>
            <line class="cross" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ph} />
            <circle class="dot" cx={x(hover)} cy={y(pts[hover].rating)} r={5} />
          </>
        )}
        {hover === null && <circle class="dot" cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].rating)} r={4} />}
      </svg>
    </div>
  );
}

// Glicko-2 volgens Mark Glickman, "Example of the Glicko-2 system" (2013).
// Ratings op de gewone schaal (1500 / RD 350); intern omgerekend naar de Glicko-2-schaal.

export interface Glicko {
  rating: number;
  rd: number;
  vol: number;
}

export interface MatchResult {
  opponent: Glicko;
  /** 1 = gewonnen, 0 = verloren, 0.5 = gelijk */
  score: number;
}

export const DEFAULT_RATING = 1500;
export const DEFAULT_RD = 350;
export const DEFAULT_VOL = 0.06;
/** Systeemconstante: hoe snel de volatiliteit mag veranderen (0.3–1.2). */
export const TAU = 0.5;
const SCALE = 173.7178;
const EPS = 0.000001;

export function initialRating(): Glicko {
  return { rating: DEFAULT_RATING, rd: DEFAULT_RD, vol: DEFAULT_VOL };
}

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muj: number, phij: number) => 1 / (1 + Math.exp(-g(phij) * (mu - muj)));

/** Onzekerheid laten groeien na inactiviteit; `periods` mag een fractie zijn. */
export function inflate(p: Glicko, periods: number): Glicko {
  if (periods <= 0) return { rating: p.rating, rd: p.rd, vol: p.vol };
  const phi = p.rd / SCALE;
  const phiStar = Math.sqrt(phi * phi + p.vol * p.vol * periods);
  return { rating: p.rating, rd: Math.min(DEFAULT_RD, phiStar * SCALE), vol: p.vol };
}

/** Eén ratingperiode met een aantal uitslagen. */
export function update(p: Glicko, results: MatchResult[], tau = TAU): Glicko {
  const mu = (p.rating - DEFAULT_RATING) / SCALE;
  const phi = p.rd / SCALE;
  if (!results.length) return inflate(p, 1);

  let vInv = 0;
  let deltaSum = 0;
  for (const r of results) {
    const muj = (r.opponent.rating - DEFAULT_RATING) / SCALE;
    const phij = r.opponent.rd / SCALE;
    const e = E(mu, muj, phij);
    const gj = g(phij);
    vInv += gj * gj * e * (1 - e);
    deltaSum += gj * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * deltaSum;

  // Nieuwe volatiliteit (Illinois-algoritme)
  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => {
    const ex = Math.exp(x);
    const d = phi * phi + v + ex;
    return (ex * (delta * delta - phi * phi - v - ex)) / (2 * d * d) - (x - a) / (tau * tau);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * tau) < 0) k++;
    B = a - k * tau;
  }
  let fA = f(A);
  let fB = f(B);
  for (let i = 0; i < 100 && Math.abs(B - A) > EPS; i++) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else {
      fA /= 2;
    }
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi * phi + vol * vol);
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const muNew = mu + phiNew * phiNew * deltaSum;
  return { rating: muNew * SCALE + DEFAULT_RATING, rd: phiNew * SCALE, vol };
}

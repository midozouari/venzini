// Number formats shared by explanation sentences and messages (NFR-31, SDD 6.5).

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** 34000 → "34,000" */
export function formatNumber(n: number): string {
  return grouped.format(Math.round(n));
}

/** 34000 → "34,000 L" */
export function formatLitres(n: number): string {
  return `${formatNumber(n)} L`;
}

/** 412.35 → "$412.35" */
export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** 6.2 → "+6.2%", -1 → "-1.0%" */
export function formatSignedPct(n: number): string {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

/** Banker's rounding (half to even) to a number of decimals (ALG-05, AC-16). */
export function roundHalfEven(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const scaled = value * factor;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const EPS = 1e-9;
  let rounded: number;
  if (diff > 0.5 + EPS) rounded = floor + 1;
  else if (diff < 0.5 - EPS) rounded = floor;
  else rounded = floor % 2 === 0 ? floor : floor + 1;
  return rounded / factor;
}

/** Rounds to one decimal (half away from zero). */
export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

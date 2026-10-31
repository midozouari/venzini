// Local Tunis wall-clock time ⇄ ISO instants in UTC (SDD 6.5). Conversion uses the time zone,
// so a future change of Tunisia's offset needs no code change.
import { DISPLAY_TIME_ZONE } from '@venzini/contracts';

const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function fields(ms: number) {
  const p = Object.fromEntries(parts.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year!, m: +p.month!, d: +p.day!, h: +p.hour!, min: +p.minute! };
}

/** Minutes the Tunis wall clock is ahead of UTC at a given instant. */
function offsetMinutes(ms: number): number {
  const f = fields(ms);
  return (Date.UTC(f.y, f.m - 1, f.d, f.h, f.min) - Math.floor(ms / 60_000) * 60_000) / 60_000;
}

/** "2026-11-01" + "06:10" (Tunis) → "2026-11-01T05:10:00Z". */
export function tunisToIso(day: string, time: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const guess = Date.UTC(y!, m! - 1, d!, h!, min!);
  const ms = guess - offsetMinutes(guess) * 60_000;
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

/** "2026-11-01T05:10:00Z" → { day: "2026-11-01", time: "06:10" } in Tunis. */
export function isoToTunis(iso: string): { day: string; time: string } {
  const f = fields(Date.parse(iso));
  const pad = (n: number) => String(n).padStart(2, '0');
  return { day: `${f.y}-${pad(f.m)}-${pad(f.d)}`, time: `${pad(f.h)}:${pad(f.min)}` };
}

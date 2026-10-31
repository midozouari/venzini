// Display formats (NFR-31, SDD 6.5): litres "34,000 L", 24 h times and dates "05 Nov 2026" in
// Africa/Tunis, dollars "$412.35". The browser only formats values; it never computes them.
import { DISPLAY_TIME_ZONE } from '@venzini/contracts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export const formatNumber = (n: number) => grouped.format(n);
export const formatLitres = (n: number) => `${grouped.format(n)} L`;
export const formatUsd = (n: number) => `$${n.toFixed(2)}`;
export const formatPct = (n: number) => `${Math.round(n)}%`;

/** Signed share: 8 → "+8%", -0.7 → "−0.7%" (one decimal unless whole). */
export function formatSignedPct(n: number): string {
  const abs = Math.abs(n);
  const text = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${n < 0 ? '−' : '+'}${text}%`;
}

/** Estimated vs. actual trip duration (FR-84): "+45 min (+9.4%)". */
export function formatGap(minutes: number, pct: number | null): string {
  const sign = minutes < 0 ? '−' : '+';
  const pctText = pct === null ? '' : ` (${pct < 0 ? '−' : '+'}${Math.abs(pct).toFixed(1)}%)`;
  return `${sign}${Math.abs(minutes)} min${pctText}`;
}

/** "2026-11-03" → "03 Nov" (chart axes). */
export function formatDayShort(day: string): string {
  return `${day.slice(8, 10)} ${MONTHS[Number(day.slice(5, 7)) - 1]}`;
}

/** A delivery day "2026-11-03" → "03 Nov 2026" (no time-zone shift: it is already local). */
export function formatDay(day: string): string {
  return `${day.slice(8, 10)} ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}`;
}

/** "2026-11-03" → "Tue 03 Nov 2026" */
export function formatDayLong(day: string): string {
  const weekday = WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
  return `${weekday} ${formatDay(day)}`;
}

const tunisDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: DISPLAY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** ISO instant → "08:00, 02 Nov 2026" in Tunis time. */
export function formatInstant(iso: string): string {
  return `${formatTime(iso)}, ${formatDay(tunisDay.format(new Date(iso)))}`;
}

/** ISO instant → "14:30" in Tunis time. */
export const formatTime = (iso: string) => timeFormat.format(new Date(iso));

/** Hours to stockout: "14 h", or "More than 7 days" when the tank lasts the week. */
export function formatHours(hours: number | null): string {
  if (hours === null) return 'More than 7 days';
  return `${Math.round(hours)} h`;
}

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Tomorrow in Tunis: the default delivery day outside the MVP demo. */
export function tomorrow(now = new Date()): string {
  return addDays(tunisDay.format(now), 1);
}

export const ROLE_LABEL = {
  manager: 'Operations manager',
  dispatcher: 'Dispatcher',
  admin: 'System admin',
} as const;

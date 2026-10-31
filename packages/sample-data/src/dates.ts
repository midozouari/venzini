// Date helpers. Delivery days are local dates in Africa/Tunis (SDD 6.5). Tunisia has used
// UTC+01:00 all year since 2009 (no daylight saving), which the generator relies on.

export const TUNIS_UTC_OFFSET_MIN = 60;

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** All days from `from` to `to`, both included. */
export function dayRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: string): number {
  return (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
}

export function weekdayName(day: string): string {
  return WEEKDAYS[weekdayIndex(day)] ?? '';
}

/** 1 … 12 */
export function monthOf(day: string): number {
  return Number(day.slice(5, 7));
}

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? '';
}

/** "2026-11-05" → "05 Nov 2026" (NFR-31). */
export function displayDate(day: string): string {
  return `${day.slice(8, 10)} ${monthName(monthOf(day)).slice(0, 3)} ${day.slice(0, 4)}`;
}

/** Minutes after local midnight of a delivery day → ISO instant in UTC. */
export function localMinutesToIso(day: string, minutes: number): string {
  const ms = Date.parse(`${day}T00:00:00Z`) + (minutes - TUNIS_UTC_OFFSET_MIN) * 60_000;
  return new Date(ms).toISOString().replace('.000Z', 'Z');
}

/** "HH:MM" → minutes after midnight. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Minutes after midnight → "HH:MM". */
export function minutesToHhmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

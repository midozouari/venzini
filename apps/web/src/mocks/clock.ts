import { fixtures } from './fixtures';

// The mock clock starts at the demo time (02 Nov 2026 08:00 Tunis) and runs with real time,
// so rules such as "departure not in the future" behave as on the demo day.
const demoStart = Date.parse(fixtures.demo.now);
let realStart = Date.now();

export function nowMs(): number {
  return demoStart + (Date.now() - realStart);
}

export function nowIso(): string {
  return new Date(nowMs()).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function resetClock(): void {
  realStart = Date.now();
}

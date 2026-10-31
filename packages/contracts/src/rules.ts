// Rules fixed by the SRS (SDD 6.4). They are constants, not settings, and each names its SRS ID.
import type { RiskLevel, Severity } from './common';

/** BR-26: high when time to stockout is under 24 h. */
export const RISK_HIGH_BELOW_HOURS = 24;
/** BR-26: medium from 24 h to 72 h inclusive; low above. */
export const RISK_MEDIUM_MAX_HOURS = 72;
/** BR-27: a forecast is uncertain when its confidence is below 70%. */
export const UNCERTAIN_BELOW_PCT = 70;
/** FR-18: forecasts cover 7 days. */
export const FORECAST_DAYS = 7;
/** D-18, FR-63: lateness severity bands (minutes). */
export const LATENESS_LOW_MAX_MIN = 60;
export const LATENESS_MEDIUM_MAX_MIN = 180;
/** D-18, FR-63: distance, time and cost increase bands (%). */
export const INCREASE_LOW_BELOW_PCT = 10;
export const INCREASE_MEDIUM_MAX_PCT = 25;
/** NFR-22: session idle limit and the warning shown before it (SRS 14.3). */
export const SESSION_IDLE_MIN = 30;
export const SESSION_WARNING_MIN = 2;
/** NFR-21: lockout after 5 failures in 15 minutes, for 15 minutes. */
export const LOCKOUT_MAX_FAILURES = 5;
export const LOCKOUT_WINDOW_MIN = 15;
export const LOCKOUT_DURATION_MIN = 15;
/** Display time zone of delivery days and times (SDD 6.5). */
export const DISPLAY_TIME_ZONE = 'Africa/Tunis';

/** BR-26: risk level from hours to stockout; null means no stockout within the horizon (low). */
export function riskLevelFromHours(hours: number | null): RiskLevel {
  if (hours === null) return 'low';
  if (hours < RISK_HIGH_BELOW_HOURS) return 'high';
  if (hours <= RISK_MEDIUM_MAX_HOURS) return 'medium';
  return 'low';
}

/** BR-27: uncertain below 70%; 69% is flagged, 70% is not. */
export function isUncertain(confidencePct: number): boolean {
  return confidencePct < UNCERTAIN_BELOW_PCT;
}

/** D-18 (RISK-04): ≤ 60 min low, 61–180 medium, > 180 high. Only called for lateness > 0. */
export function latenessSeverity(minutes: number): Severity {
  if (minutes <= LATENESS_LOW_MAX_MIN) return 'low';
  if (minutes <= LATENESS_MEDIUM_MAX_MIN) return 'medium';
  return 'high';
}

/** D-18 (RISK-05 to 07): < 10% low, 10–25% medium, > 25% high. Only called for increases > 0. */
export function increaseSeverity(pct: number): Severity {
  if (pct < INCREASE_LOW_BELOW_PCT) return 'low';
  if (pct <= INCREASE_MEDIUM_MAX_PCT) return 'medium';
  return 'high';
}

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

/** The higher of two risk levels (FR-47: a station takes its highest fuel risk). */
export function highestRisk(levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((a, b) => (RISK_ORDER[b] < RISK_ORDER[a] ? b : a), 'low');
}

// 365 days of simulated daily sales per station and fuel, with weekday and seasonal patterns,
// public holidays, weather and local events, and about 2% missing days (SDD 5.11.3, SRS 8.7).
import { addDays, dayRange, monthOf, weekdayIndex } from './dates';
import {
  DEMO_WEEK_EXTERNAL,
  FUEL_IDS,
  HOLIDAYS,
  REFERENCE_DATE,
  REGIONS,
  SIZE_PROFILE,
  ST014_DIESEL_SATURDAY_CV,
  STATIONS,
} from './master';
import { rngFor } from './prng';

export type Condition = 'sunny' | 'cloudy' | 'rain';
export interface WeatherDay {
  temp_c: number;
  condition: Condition;
}
export interface LocalEvent {
  name: string;
  impact_pct: number;
}

export interface External {
  /** null = weather data missing for that region and day. */
  weather: Map<string, WeatherDay | null>;
  events: Map<string, LocalEvent[]>;
}

export const HISTORY_FROM = addDays(REFERENCE_DATE, -364);
export const FORECAST_TO = addDays(REFERENCE_DATE, 7);

const key = (region: string, day: string) => `${region}|${day}`;
export const seriesKey = (station: string, fuel: string) => `${station}|${fuel}`;

/** Average daily sales relative to the year, per month (summer peak). */
const MONTH_FACTOR = [0.93, 0.92, 0.95, 0.99, 1.03, 1.08, 1.14, 1.16, 1.02, 0.99, 0.98, 0.97];
/** Monday … Sunday. */
const WEEKDAY_FACTOR = [0.97, 0.98, 1.0, 1.02, 1.1, 1.08, 0.85];

export function holidayName(day: string): string | null {
  return HOLIDAYS[day.slice(5)] ?? null;
}

/** Weather multiplier (parameter table of ALG-01): ≥ 30 °C → 1.04, rain → 0.95. */
export function weatherFactor(w: WeatherDay | null): number {
  if (!w) return 1;
  if (w.condition === 'rain') return 0.95;
  if (w.temp_c >= 30) return 1.04;
  return 1;
}

export function eventFactor(events: LocalEvent[]): number {
  return 1 + events.reduce((sum, e) => sum + e.impact_pct, 0) / 100;
}

export function generateExternal(): External {
  const weather = new Map<string, WeatherDay | null>();
  const events = new Map<string, LocalEvent[]>();
  for (const region of REGIONS) {
    const rng = rngFor('external', region);
    for (const day of dayRange(HISTORY_FROM, FORECAST_TO)) {
      const m = monthOf(day);
      const seasonal = 19 + 10 * Math.cos(((m - 7.5) / 12) * 2 * Math.PI);
      const temp = Math.round(seasonal + rng.normal() * 3);
      const rainChance =
        [0.3, 0.28, 0.22, 0.15, 0.08, 0.03, 0.01, 0.02, 0.1, 0.18, 0.15, 0.28][m - 1] ?? 0.1;
      const condition: Condition = rng.chance(rainChance)
        ? 'rain'
        : rng.chance(0.4)
          ? 'cloudy'
          : 'sunny';
      const inDemoWeek = day > REFERENCE_DATE;
      // The demo week is fixed by DEMO_WEEK_EXTERNAL; no random rain or events there.
      weather.set(key(region, day), {
        temp_c: temp,
        condition: inDemoWeek && condition === 'rain' ? 'cloudy' : condition,
      });
      if (!inDemoWeek && rng.chance(0.05)) {
        events.set(key(region, day), [
          {
            name: rng.pick(['A local festival', 'A football match', 'A trade fair', 'A concert']),
            impact_pct: rng.int(4, 9),
          },
        ]);
      }
    }
  }
  for (const r of DEMO_WEEK_EXTERNAL.rainyDays) {
    const w = weather.get(key(r.region, r.date));
    if (w) weather.set(key(r.region, r.date), { ...w, condition: 'rain' });
  }
  for (const e of DEMO_WEEK_EXTERNAL.events)
    events.set(key(e.region, e.date), [{ name: e.name, impact_pct: e.impact_pct }]);
  for (const m of DEMO_WEEK_EXTERNAL.missingWeather) weather.set(key(m.region, m.date), null);
  return { weather, events };
}

export function weatherOn(ext: External, region: string, day: string): WeatherDay | null {
  return ext.weather.get(key(region, day)) ?? null;
}

export function eventsOn(ext: External, region: string, day: string): LocalEvent[] {
  return ext.events.get(key(region, day)) ?? [];
}

/** Daily sales; null = missing day. */
export type Series = Map<string, number | null>;

export interface SalesHistory {
  series: Map<string, Series>;
  /** Base daily sales per series (scale of the station). */
  base: Map<string, number>;
  /** Delivered ÷ sold over the last 28 days (previous orders, D-28). */
  deliveryRatio: Map<string, number>;
}

export function generateSales(ext: External): SalesHistory {
  const series = new Map<string, Series>();
  const base = new Map<string, number>();
  const deliveryRatio = new Map<string, number>();
  const days = dayRange(HISTORY_FROM, REFERENCE_DATE);

  for (const st of STATIONS) {
    for (const fuel of FUEL_IDS) {
      const rng = rngFor('sales', st.id, fuel);
      const b = SIZE_PROFILE[st.size][fuel].daily * rng.uniform(0.95, 1.05);
      const noise = st.id === 'ST014' && fuel === 'DIESEL' ? 0.03 : 0.015;
      const s: Series = new Map();
      for (const day of days) {
        const missing = day < addDays(REFERENCE_DATE, -60) && rng.chance(0.02);
        const shortGap = st.shortHistory === fuel && day <= addDays(REFERENCE_DATE, -10);
        if (missing || shortGap) {
          s.set(day, null);
          rng.next();
          continue;
        }
        const value =
          b *
          (MONTH_FACTOR[monthOf(day) - 1] ?? 1) *
          (WEEKDAY_FACTOR[weekdayIndex(day)] ?? 1) *
          (holidayName(day) ? 1.1 : 1) *
          weatherFactor(weatherOn(ext, st.region, day)) *
          eventFactor(eventsOn(ext, st.region, day)) *
          (1 + noise * rng.normal());
        s.set(day, Math.max(0, Math.round(value)));
      }
      series.set(seriesKey(st.id, fuel), s);
      base.set(seriesKey(st.id, fuel), b);
      deliveryRatio.set(seriesKey(st.id, fuel), rng.uniform(0.93, 1.07));
    }
  }

  shapeWeekdayVariation(
    series.get(seriesKey('ST014', 'DIESEL'))!,
    addDays(REFERENCE_DATE, 5),
    ST014_DIESEL_SATURDAY_CV,
  );
  return { series, base, deliveryRatio };
}

/**
 * Rescales the last 8 same-weekday values before `targetDay` around their mean so that their
 * coefficient of variation is exactly `cv` (ALG-02, Equation 8). The mean is unchanged.
 */
function shapeWeekdayVariation(s: Series, targetDay: string, cv: number): void {
  const days = Array.from({ length: 8 }, (_, k) => addDays(targetDay, -7 * (k + 1)));
  const values = days.map((d) => s.get(d) ?? null).filter((v): v is number => v !== null);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
  if (std === 0) return;
  const scale = (cv * mean) / std;
  for (const d of days) {
    const v = s.get(d);
    if (v !== null && v !== undefined) s.set(d, Math.round(mean + (v - mean) * scale));
  }
}

// ALG-01 forecasting and ALG-02 confidence (SDD 5.9.1, 5.9.2), used here only to build the
// fixtures. The v1 engine is written later in the API; this keeps the fake numbers consistent.
import { fillTemplate, formatLitres, isUncertain, type Forecast } from '@venzini/contracts';
import { addDays, displayDate, monthName, monthOf, weekdayName } from './dates';
import {
  eventFactor,
  eventsOn,
  holidayName,
  seriesKey,
  weatherFactor,
  weatherOn,
  type External,
  type SalesHistory,
  type Series,
} from './history';
import {
  FORECAST_MODEL_VERSION,
  fuelName,
  REFERENCE_DATE,
  SIZE_PROFILE,
  STATIONS,
  type FuelId,
  type StationSpec,
} from './master';
import { rngFor } from './prng';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

export interface DayResult {
  date: string;
  litres: number;
  confidence: number;
  band_low: number;
  band_high: number;
  baseline: number;
  m: { season: number; weather: number; event: number; cal: number; orders: number };
  weatherMissing: boolean;
}

export interface ForecastResult {
  station: StationSpec;
  fuel: FuelId;
  days: DayResult[];
  overall: number;
  uncertain: boolean;
  similar: boolean;
  monthIndex: number;
  orders: number;
}

/** Monthly index I(m): average daily sales in month m ÷ average daily sales over the year (Eq. 3). */
function monthIndex(s: (day: string) => number | null, days: string[], month: number): number {
  const all = days.map(s).filter((v): v is number => v !== null);
  const inMonth = days
    .filter((d) => monthOf(d) === month)
    .map(s)
    .filter((v): v is number => v !== null);
  if (all.length === 0 || inMonth.length === 0) return 1;
  return mean(inMonth) / mean(all);
}

export function forecastPair(
  station: StationSpec,
  fuel: FuelId,
  sales: SalesHistory,
  ext: External,
  refDate = REFERENCE_DATE,
): ForecastResult {
  const own = sales.series.get(seriesKey(station.id, fuel)) as Series;
  const last28 = Array.from({ length: 28 }, (_, i) => addDays(refDate, -i));
  const daysWithData = last28.filter((d) => (own.get(d) ?? null) !== null).length;
  const similar = daysWithData < 14;

  // Fallback (FR-83): same-weekday sales of stations in the same region, scaled by tank capacity.
  const capacity = SIZE_PROFILE[station.size][fuel].capacity;
  const peers = STATIONS.filter(
    (p) => p.region === station.region && p.id !== station.id && p.shortHistory !== fuel,
  );
  const value = (day: string): number | null => {
    if (!similar) return own.get(day) ?? null;
    const vals = peers
      .map((p) => {
        const v = sales.series.get(seriesKey(p.id, fuel))?.get(day) ?? null;
        return v === null ? null : (v * capacity) / SIZE_PROFILE[p.size][fuel].capacity;
      })
      .filter((v): v is number => v !== null);
    return vals.length ? mean(vals) : null;
  };

  const yearDays = Array.from({ length: 365 }, (_, i) => addDays(refDate, -i));
  const iRef = monthIndex(value, yearDays, monthOf(refDate));
  const gapShare = (28 - daysWithData) / 28;
  const orders = clamp(sales.deliveryRatio.get(seriesKey(station.id, fuel)) ?? 1, 0.95, 1.05);
  const rng = rngFor('forecast', station.id, fuel, refDate);

  const days: DayResult[] = [];
  for (let d = 1; d <= 7; d++) {
    const t = addDays(refDate, d);
    // Equation (2): mean of the same weekday over the last 4 weeks (at least 2 values).
    const same4 = [1, 2, 3, 4]
      .map((k) => value(addDays(t, -7 * k)))
      .filter((v): v is number => v !== null);
    const B =
      same4.length >= 2
        ? mean(same4)
        : mean(last28.map(value).filter((v): v is number => v !== null));

    const season = clamp(monthIndex(value, yearDays, monthOf(t)) / iRef, 0.8, 1.25); // Eq. (3)
    const w = weatherOn(ext, station.region, t);
    const weather = weatherFactor(w);
    const event = eventFactor(eventsOn(ext, station.region, t)); // Eq. (4)
    const cal = holidayName(t) ? 1.1 : 1;
    const eps = 1 + clamp(0.03 * rng.normal(), -0.06, 0.06); // Eq. (6)
    const litres = Math.max(0, Math.round(B * season * weather * event * cal * orders * eps)); // Eq. (1)

    // ALG-02: variability of the same weekday over the last 8 weeks (Eq. 8).
    const same8 = Array.from({ length: 8 }, (_, k) => value(addDays(t, -7 * (k + 1)))).filter(
      (v): v is number => v !== null,
    );
    const avg = mean(same8);
    const cv = Math.sqrt(mean(same8.map((v) => (v - avg) ** 2))) / avg;
    const missing = w === null ? 1 : 0;
    let confidence = clamp(
      Math.round(95 - 100 * cv - 2 * (d - 1) - 12 * missing - (gapShare > 0.05 ? 10 : 0)),
      0,
      100,
    ); // Eq. (9)
    if (similar) confidence = Math.min(confidence, 60);
    const sigma = cv * litres * (1 + 0.05 * (d - 1)); // Eq. (10)
    days.push({
      date: t,
      litres,
      confidence,
      band_low: Math.max(0, Math.round(litres - 1.28 * sigma)), // Eq. (11)
      band_high: Math.round(litres + 1.28 * sigma),
      baseline: B,
      m: { season, weather, event, cal, orders },
      weatherMissing: w === null,
    });
  }

  const overall = Math.min(...days.map((x) => x.confidence)); // Eq. (12)
  return {
    station,
    fuel,
    days,
    overall,
    uncertain: isUncertain(overall),
    similar,
    monthIndex: monthIndex(value, yearDays, monthOf(addDays(refDate, 1))),
    orders,
  };
}

/** Equation (7): average effect of a multiplier over the week, in %. */
const impact = (r: ForecastResult, k: keyof DayResult['m']) =>
  round1(mean(r.days.map((d) => d.m[k] - 1)) * 100);

/** Builds the API-10 forecast (DE-14), with factor sentences from the template catalogue. */
export function toForecast(
  r: ForecastResult,
  ext: External,
  sales: SalesHistory,
  stock: { level: number | null; runOutDay: string | null },
): Forecast {
  const { station, fuel } = r;
  const fuelLabel = fuelName(fuel);
  const day1 = r.days[0]!;
  const factors: Forecast['factors'] = [];

  factors.push({
    factor: 'recent_sales',
    impact_pct: 0,
    available: true,
    explanation: fillTemplate('TPL-FC-01', {
      fuel: fuelLabel,
      litres: formatLitres(day1.baseline),
      weekday: weekdayName(day1.date),
    }),
  });

  const monthPct = Math.round(Math.abs(r.monthIndex - 1) * 100);
  factors.push({
    factor: 'seasonality',
    impact_pct: impact(r, 'season'),
    available: true,
    explanation: fillTemplate('TPL-FC-02', {
      month: monthName(monthOf(day1.date)),
      pct: `${monthPct}%`,
      higher_lower: r.monthIndex >= 1 ? 'higher' : 'lower',
    }),
  });

  const missingDays = r.days.filter((d) => d.weatherMissing).length;
  const strongest = [...r.days]
    .filter((d) => !d.weatherMissing && d.m.weather !== 1)
    .sort((a, b) => Math.abs(b.m.weather - 1) - Math.abs(a.m.weather - 1))[0];
  if (strongest) {
    const w = weatherOn(ext, station.region, strongest.date)!;
    factors.push({
      factor: 'weather',
      impact_pct: impact(r, 'weather'),
      available: missingDays === 0,
      explanation: fillTemplate('TPL-FC-03', {
        condition: w.condition === 'rain' ? 'Rainy' : 'Hot',
        temp: w.temp_c,
        date: displayDate(strongest.date),
        raises_lowers: strongest.m.weather > 1 ? 'raises' : 'lowers',
        pct: `${Math.round(Math.abs(strongest.m.weather - 1) * 100)}%`,
      }),
    });
  }

  const eventDay = r.days.find((d) => eventsOn(ext, station.region, d.date).length > 0);
  if (eventDay) {
    const e = eventsOn(ext, station.region, eventDay.date)[0]!;
    factors.push({
      factor: 'local_events',
      impact_pct: impact(r, 'event'),
      available: true,
      explanation: fillTemplate('TPL-FC-04', {
        event: e.name,
        date: displayDate(eventDay.date),
        pct: `${e.impact_pct}%`,
      }),
    });
  }

  const holidayDay = r.days.find((d) => holidayName(d.date));
  if (holidayDay)
    factors.push({
      factor: 'calendar',
      impact_pct: impact(r, 'cal'),
      available: true,
      explanation: fillTemplate('TPL-FC-05', {
        holiday: holidayName(holidayDay.date)!,
        date: displayDate(holidayDay.date),
        pct: '+10%',
      }),
    });

  factors.push({
    factor: 'previous_orders',
    impact_pct: impact(r, 'orders'),
    available: true,
    explanation: fillTemplate('TPL-FC-06', {
      pct: `${Math.round(Math.abs(r.orders - 1) * 100)}%`,
      above_below: r.orders >= 1 ? 'above' : 'below',
    }),
  });

  if (stock.level !== null && stock.runOutDay)
    factors.push({
      factor: 'current_tank_level',
      impact_pct: 0,
      available: true,
      explanation: fillTemplate('TPL-FC-07', {
        litres: formatLitres(stock.level),
        date: displayDate(stock.runOutDay),
      }),
    });

  factors.sort((a, b) => Math.abs(b.impact_pct) - Math.abs(a.impact_pct));

  let uncertainReason: string | null = null;
  const baselineNote = r.similar
    ? fillTemplate('TPL-FC-09', { station: station.id, fuel: fuelLabel, pct: `${r.overall}%` })
    : null;
  if (r.uncertain) {
    if (baselineNote) uncertainReason = baselineNote;
    else if (missingDays > 0)
      uncertainReason = fillTemplate('TPL-FC-08', {
        pct: `${r.overall}%`,
        missing_input: 'weather data',
        days: missingDays,
      });
    else throw new Error(`No template explains the low confidence of ${station.id} ${fuel}`);
  }

  const recent = Array.from({ length: 7 }, (_, i) => addDays(REFERENCE_DATE, i - 6));
  const own = sales.series.get(seriesKey(station.id, fuel))!;

  return {
    forecast_id: `FC-${station.id}-${fuel}-${REFERENCE_DATE.replaceAll('-', '')}`,
    station_id: station.id,
    fuel_type_id: fuel,
    reference_date: REFERENCE_DATE,
    status: 'ok',
    model_version: FORECAST_MODEL_VERSION,
    baseline: r.similar ? 'similar_stations' : 'own',
    baseline_note: baselineNote,
    daily: r.days.map(({ date, litres, confidence, band_low, band_high }) => ({
      date,
      litres,
      confidence,
      band_low,
      band_high,
    })),
    overall_confidence: r.overall,
    uncertain: r.uncertain,
    uncertain_reason: uncertainReason,
    factors,
    recent_actuals: recent
      .map((date) => ({ date, litres: own.get(date) ?? null }))
      .filter((a): a is { date: string; litres: number } => a.litres !== null),
  };
}

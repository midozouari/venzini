// API-10 · Forecast and API-19 · Totals (SDD 5.6.4, TBL-17).
import { z } from 'zod';
import { LocalDate } from './common';

export const ForecastDay = z.object({
  date: LocalDate,
  litres: z.number().int().min(0),
  confidence: z.number().int().min(0).max(100),
  band_low: z.number().int().min(0),
  band_high: z.number().int().min(0),
});

export const FactorName = z.enum([
  'recent_sales',
  'previous_orders',
  'current_tank_level',
  'seasonality',
  'weather',
  'local_events',
  'calendar',
]);

export const Factor = z.object({
  factor: FactorName,
  /** Signed average effect over the week, % (ALG-01 Equation 7). */
  impact_pct: z.number(),
  available: z.boolean(),
  explanation: z.string(),
});

export const Forecast = z.object({
  forecast_id: z.string(),
  station_id: z.string(),
  fuel_type_id: z.string(),
  reference_date: LocalDate,
  status: z.enum(['ok', 'manual_planning']),
  model_version: z.string(),
  baseline: z.enum(['own', 'similar_stations']),
  baseline_note: z.string().nullable(),
  daily: z.array(ForecastDay).length(7),
  overall_confidence: z.number().int().min(0).max(100),
  uncertain: z.boolean(),
  uncertain_reason: z.string().nullable(),
  factors: z.array(Factor),
  recent_actuals: z.array(z.object({ date: LocalDate, litres: z.number().int().min(0) })),
});
export type Forecast = z.infer<typeof Forecast>;

export const ForecastQuery = z.object({
  station: z.string().min(1),
  fuel: z.string().min(1),
  ref_date: LocalDate.optional(),
});

export const TotalsLevel = z.enum(['network', 'warehouse']);

export const TotalsQuery = z.object({
  level: TotalsLevel,
  fuel: z.string().min(1),
  warehouse: z.string().optional(),
});

export const TotalsDay = z.object({
  date: LocalDate,
  total_l: z.number().int(),
  band_low: z.number().int(),
  band_high: z.number().int(),
  uncertain_share_pct: z.number(),
});

export const ForecastTotals = z.object({
  level: TotalsLevel,
  fuel_type_id: z.string(),
  reference_date: LocalDate,
  /** One group per warehouse; one group with warehouse_id null for the network level. */
  groups: z.array(z.object({ warehouse_id: z.string().nullable(), days: z.array(TotalsDay) })),
  /** Stations left out (manual planning), FR-85. */
  excluded: z.array(z.object({ station_id: z.string(), reason: z.string() })),
});
export type ForecastTotals = z.infer<typeof ForecastTotals>;

// API-09 · Network overview, and API-P1 · Reference data (SDD 5.6.4).
import { z } from 'zod';
import { IsoDateTime, LocalDate, RiskLevel } from './common';
import { PlanStatus } from './plans';

export const NetworkTank = z.object({
  fuel_type_id: z.string(),
  current_level_l: z.number().int().nullable(),
  capacity_l: z.number().int(),
  level_pct: z.number().int().nullable(),
  safety_stock_l: z.number().int(),
  risk_level: RiskLevel.nullable(),
  hours_to_stockout: z.number().nullable(),
});

export const NetworkStation = z.object({
  station_id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  serving_warehouse_id: z.string().nullable(),
  /** Highest fuel risk (FR-47); null when data is unavailable. */
  risk_level: RiskLevel.nullable(),
  data_available: z.boolean(),
  tanks: z.array(NetworkTank),
});

export const WarehousePoint = z.object({
  warehouse_id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
});

export const Network = z.object({
  as_of: IsoDateTime,
  delivery_day: LocalDate,
  kpis: z.object({
    high_risk_stations: z.number().int(),
    tankers_available: z.number().int(),
    tankers_total: z.number().int(),
    warehouse_stock: z.array(
      z.object({ warehouse_id: z.string(), fuel_type_id: z.string(), stock_l: z.number().int() }),
    ),
    /** Null when no plan exists yet for the day. */
    plan_status: PlanStatus.nullable(),
  }),
  stations: z.array(NetworkStation),
  warehouses: z.array(WarehousePoint),
  /** High-risk pairs only, shortest time to stockout first (FR-15). */
  alerts: z.array(
    z.object({
      station_id: z.string(),
      fuel_type_id: z.string(),
      hours_to_stockout: z.number(),
      reason: z.string(),
    }),
  ),
  data_unavailable: z.array(
    z.object({ station_id: z.string(), code: z.literal('ERR-DATA-01'), reason: z.string() }),
  ),
});
export type Network = z.infer<typeof Network>;

export const NetworkQuery = z.object({ day: LocalDate.optional() });

export const Reference = z.object({
  fuel_types: z.array(
    z.object({ fuel_type_id: z.string(), name: z.string(), display_order: z.number().int() }),
  ),
  warehouses: z.array(WarehousePoint),
  regions: z.array(z.string()),
});
export type Reference = z.infer<typeof Reference>;

export const Health = z.object({ status: z.literal('ok') });

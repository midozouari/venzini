// API-05 · Stations (SDD 5.6.3, SRS 8.1 rules).
import { z } from 'zod';
import { LocalTime, paginated, RecordStatus } from './common';

export const TankInput = z
  .strictObject({
    fuel_type_id: z.string().min(1).max(12),
    capacity_l: z.number().int().positive('must be greater than 0'),
    safety_stock_l: z.number().int().min(0),
    current_level_l: z.number().int().min(0),
  })
  .superRefine((t, ctx) => {
    if (t.safety_stock_l >= t.capacity_l)
      ctx.addIssue({ code: 'custom', path: ['safety_stock_l'], message: 'must be below capacity' });
    if (t.current_level_l > t.capacity_l)
      ctx.addIssue({
        code: 'custom',
        path: ['current_level_l'],
        message: 'must not exceed capacity',
      });
  });

/** A tank as stored; the level is null when it is unknown (ERR-DATA-01). */
export const Tank = z.object({
  fuel_type_id: z.string(),
  capacity_l: z.number().int(),
  safety_stock_l: z.number().int(),
  current_level_l: z.number().int().nullable(),
});

const stationFields = {
  name: z.string().trim().min(1).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  region: z.string().trim().min(1).max(40),
  window_open: LocalTime,
  window_close: LocalTime,
};

const windowRule = (s: { window_open?: string; window_close?: string }, ctx: z.RefinementCtx) => {
  if (s.window_open && s.window_close && s.window_open >= s.window_close)
    ctx.addIssue({
      code: 'custom',
      path: ['window_close'],
      message: 'must be after the opening time',
    });
};

const tanksRule = (tanks: { fuel_type_id: string }[], ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  tanks.forEach((t, i) => {
    if (seen.has(t.fuel_type_id))
      ctx.addIssue({
        code: 'custom',
        path: [i, 'fuel_type_id'],
        message: 'one tank per fuel type',
      });
    seen.add(t.fuel_type_id);
  });
};

export const CreateStationRequest = z
  .strictObject({
    station_id: z.string().regex(/^[A-Z0-9-]{2,12}$/, 'use capital letters and digits, e.g. ST021'),
    ...stationFields,
    tanks: z.array(TankInput).min(1).superRefine(tanksRule),
  })
  .superRefine(windowRule);
export type CreateStationRequest = z.infer<typeof CreateStationRequest>;

export const UpdateStationRequest = z
  .strictObject({
    name: stationFields.name.optional(),
    latitude: stationFields.latitude.optional(),
    longitude: stationFields.longitude.optional(),
    region: stationFields.region.optional(),
    window_open: LocalTime.optional(),
    window_close: LocalTime.optional(),
    status: RecordStatus.optional(),
    tanks: z.array(TankInput).min(1).superRefine(tanksRule).optional(),
  })
  .superRefine(windowRule)
  .refine((v) => Object.keys(v).length > 0, { message: 'at least one field must change' });
export type UpdateStationRequest = z.infer<typeof UpdateStationRequest>;

export const Station = z.object({
  station_id: z.string(),
  name: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  region: z.string(),
  window_open: LocalTime,
  window_close: LocalTime,
  /** Closest warehouse (BR-17); null until distances exist for the station. */
  serving_warehouse_id: z.string().nullable(),
  status: RecordStatus,
  tanks: z.array(Tank),
});
export type Station = z.infer<typeof Station>;

export const StationList = paginated(Station);
export type StationList = z.infer<typeof StationList>;

export const StationQuery = z.object({ status: RecordStatus.optional() });

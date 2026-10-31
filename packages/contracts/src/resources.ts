// API-06 to API-08 and API-P3: daily resources and trips (SDD 5.6.3).
import { z } from 'zod';
import { DriverRef, IsoDateTime, LocalDate, paginated, UserRef } from './common';

export const OpenTrip = z.object({ route_id: z.string(), delivery_day: LocalDate });

export const ResourceTanker = z.object({
  tanker_id: z.string(),
  capacity_l: z.number().int().positive(),
  compartments: z.array(z.number().int().positive()),
  home_warehouse_id: z.string(),
  available: z.boolean(),
  /** A trip of this tanker that has departed and not returned (WARN-RES-01). */
  open_trip: OpenTrip.nullable(),
});

export const ResourceDriver = z.object({
  driver_id: z.string(),
  full_name: z.string(),
  home_warehouse_id: z.string(),
  available: z.boolean(),
});

export const StockRow = z.object({
  warehouse_id: z.string(),
  fuel_type_id: z.string(),
  stock_l: z.number().int().min(0),
});

export const Resources = z.object({
  delivery_day: LocalDate,
  resource_version_id: z.string(),
  version_no: z.number().int().min(1),
  locked: z.boolean(),
  updated_by: UserRef,
  updated_at: IsoDateTime,
  tankers: z.array(ResourceTanker),
  drivers: z.array(ResourceDriver),
  stock: z.array(StockRow),
});
export type Resources = z.infer<typeof Resources>;

export const SaveResourcesRequest = z.strictObject({
  tankers: z.array(z.strictObject({ tanker_id: z.string().min(1), available: z.boolean() })),
  drivers: z.array(z.strictObject({ driver_id: z.string().min(1), available: z.boolean() })),
  stock: z.array(
    z.strictObject({
      warehouse_id: z.string().min(1),
      fuel_type_id: z.string().min(1),
      stock_l: z.number().int('must be a whole number').min(0, 'must be 0 or more'),
    }),
  ),
});
export type SaveResourcesRequest = z.infer<typeof SaveResourcesRequest>;

export const ResourceWarning = z.object({
  code: z.literal('WARN-RES-01'),
  tanker_id: z.string(),
  route_id: z.string(),
  message: z.string(),
});

export const SaveResourcesResponse = z.object({
  resource_version_id: z.string(),
  version_no: z.number().int(),
  warnings: z.array(ResourceWarning),
});
export type SaveResourcesResponse = z.infer<typeof SaveResourcesResponse>;

// Trips (SM-03)
export const TripStatus = z.enum(['planned', 'departed', 'returned', 'cancelled']);
export type TripStatus = z.infer<typeof TripStatus>;

export const Trip = z.object({
  route_id: z.string(),
  plan_id: z.string(),
  delivery_day: LocalDate,
  trip_no: z.number().int().min(1).max(2),
  tanker_id: z.string(),
  driver: DriverRef,
  home_warehouse_id: z.string(),
  est_departure: IsoDateTime,
  est_return: IsoDateTime,
  actual_departure: IsoDateTime.nullable(),
  actual_return: IsoDateTime.nullable(),
  trip_status: TripStatus,
  /** Actual minus estimated duration (FR-84). */
  time_gap_min: z.number().int().nullable(),
  time_gap_pct: z.number().nullable(),
  cancel_reason: z.string().nullable(),
});
export type Trip = z.infer<typeof Trip>;

export const TripList = paginated(Trip);
export type TripList = z.infer<typeof TripList>;

export const DayQuery = z.object({ day: LocalDate });

export const RecordTripTimesRequest = z
  .strictObject({ actual_departure: IsoDateTime.optional(), actual_return: IsoDateTime.optional() })
  .refine((v) => v.actual_departure !== undefined || v.actual_return !== undefined, {
    message: 'give a departure or a return time',
  });

export const CancelTripRequest = z.strictObject({
  cancel: z.literal(true),
  reason: z.string().trim().min(1).max(200),
});

export const UpdateTripRequest = z.union([CancelTripRequest, RecordTripTimesRequest]);
export type UpdateTripRequest = z.infer<typeof UpdateTripRequest>;

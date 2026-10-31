// Shapes of the fixture files (SDD 7.2). API shapes come from @venzini/contracts.
import {
  DecisionEntry,
  Forecast,
  ForecastTotals,
  IsoDateTime,
  Limits,
  LocalDate,
  Network,
  PlanView,
  Reference,
  Resources,
  Station,
  Trip,
  User,
} from '@venzini/contracts';
import { z } from 'zod';

export const DemoFixture = z.object({
  /** Mock clock start: 02 Nov 2026 08:00 Tunis time. */
  now: IsoDateTime,
  reference_date: LocalDate,
  default_delivery_day: LocalDate,
  time_zone: z.string(),
  seed: z.number().int(),
  model_versions: z.record(z.string(), z.string()),
});

export const UserFixture = User.extend({
  /** Minutes the account stays locked from the demo clock start (NFR-21), or null. */
  locked_for_min: z.number().int().nullable(),
});

export const PlanOutcome = z.object({
  view: PlanView,
  /** ALG-07 limits per "stationId|fuelId" of this plan. */
  limits: z.record(z.string(), Limits),
});
export type PlanOutcome = z.infer<typeof PlanOutcome>;

export const ScriptedEdits = z.object({
  base_plan_id: z.string(),
  /** Move a station to another route (FR-56), from the optimal plan. */
  moves: z.array(
    z.object({
      station_id: z.string(),
      to_route_id: z.string(),
      position: z.number().int(),
      outcome: PlanOutcome,
    }),
  ),
  /** Reorder a stop inside its route (FR-55), from the optimal plan. */
  reorders: z.array(
    z.object({
      station_id: z.string(),
      route_id: z.string(),
      position: z.number().int(),
      outcome: PlanOutcome,
    }),
  ),
  /** Re-plan after rejecting a station (FR-82). */
  replans: z.array(z.object({ rejected_station_id: z.string(), outcome: PlanOutcome })),
});
export type ScriptedEdits = z.infer<typeof ScriptedEdits>;

export const TotalsFixture = z.object({
  network: z.record(z.string(), ForecastTotals),
  warehouse: z.record(z.string(), ForecastTotals),
});

export const Fixtures = z.object({
  demo: DemoFixture,
  reference: Reference,
  users: z.array(UserFixture),
  stations: z.array(Station),
  network: Network,
  forecasts: z.array(Forecast),
  totals: TotalsFixture,
  /** Resources per delivery day; open trips are filled in by the mock from the trips. */
  resources: z.record(z.string(), Resources),
  optimal: PlanOutcome,
  scriptedEdits: ScriptedEdits,
  trips: z.array(Trip),
  decisions: z.array(DecisionEntry),
});
export type Fixtures = z.infer<typeof Fixtures>;

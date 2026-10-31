// API-11 to API-16 and API-P2: plans, edits, limits and decisions (SDD 5.6.4, 5.6.5).
import { z } from 'zod';
import { DriverRef, IsoDateTime, LocalDate, RiskLevel, Severity, Usd } from './common';

export const PlanKind = z.enum(['optimal', 'edited']);
export const PlanStatus = z.enum(['draft', 'edited', 'partly_decided', 'decided']);
export type PlanStatus = z.infer<typeof PlanStatus>;
export const DecisionStatus = z.enum(['pending', 'approved', 'rejected']);
export type DecisionStatus = z.infer<typeof DecisionStatus>;

/** Route line color tokens (FR-53, SDD 5.12.4). */
export const RouteColor = z.enum([
  'route-1',
  'route-2',
  'route-3',
  'route-4',
  'route-5',
  'route-6',
  'route-7',
  'route-8',
]);

export const PlanTotals = z.object({
  km: z.number(),
  minutes: z.number().int(),
  litres: z.number().int(),
  cost_usd: Usd.nullable(),
});

export const StopQuantity = z.object({
  fuel_type_id: z.string(),
  recommended_l: z.number().int().min(0),
  final_l: z.number().int().min(0),
});

export const Stop = z.object({
  stop_id: z.string(),
  station_id: z.string(),
  station_name: z.string(),
  stop_order: z.number().int().min(1),
  est_arrival: IsoDateTime,
  priority_rank: z.number().int().min(1),
  risk_level: RiskLevel,
  hours_to_stockout: z.number().nullable(),
  uncertain: z.boolean(),
  reason: z.string(),
  quantities: z.array(StopQuantity),
  decision_status: DecisionStatus,
});
export type Stop = z.infer<typeof Stop>;

export const Segment = z.object({
  from: z.string(),
  to: z.string(),
  km: z.number(),
  minutes: z.number().int(),
});

export const Compartment = z.object({
  position: z.number().int().min(1),
  size_l: z.number().int().positive(),
  fuel_type_id: z.string().nullable(),
  litres: z.number().int().min(0),
});

export const Route = z.object({
  route_id: z.string(),
  tanker_id: z.string(),
  trip_no: z.number().int().min(1).max(2),
  driver: DriverRef,
  home_warehouse_id: z.string(),
  color: RouteColor,
  est_departure: IsoDateTime,
  est_return: IsoDateTime,
  totals: PlanTotals,
  load: z.object({
    capacity_l: z.number().int(),
    assigned_l: z.number().int(),
    compartments: z.array(Compartment),
  }),
  segments: z.array(Segment),
  stops: z.array(Stop),
});
export type Route = z.infer<typeof Route>;

export const Unserved = z.object({
  station_id: z.string(),
  fuel_type_id: z.string(),
  risk_level: RiskLevel,
  hours_to_stockout: z.number().nullable(),
  reason: z.string(),
});

export const RiskType = z.enum([
  'RISK-01',
  'RISK-02',
  'RISK-03',
  'RISK-04',
  'RISK-05',
  'RISK-06',
  'RISK-07',
]);
export type RiskType = z.infer<typeof RiskType>;

export const PlanRisk = z.object({
  risk_id: z.string(),
  type: RiskType,
  severity: Severity,
  blocks_approval: z.boolean(),
  affected: z.object({
    routes: z.array(z.string()),
    stops: z.array(z.string()),
    /** Segment keys "R-02#1": route ID and segment index. */
    segments: z.array(z.string()),
  }),
  reason: z.string(),
});
export type PlanRisk = z.infer<typeof PlanRisk>;

export const Comparison = z.object({
  cost_optimal: Usd,
  cost_new: Usd,
  cost_diff: Usd,
  cost_diff_pct: z.number(),
  km_diff_pct: z.number(),
  minutes_diff_pct: z.number(),
});

/** Returned by API-11, API-12, API-13 and API-P2 (SDD 5.6.4). */
export const PlanView = z.object({
  plan: z.object({
    plan_id: z.string(),
    delivery_day: LocalDate,
    kind: PlanKind,
    parent_plan_id: z.string().nullable(),
    status: PlanStatus,
    version: z.number().int().min(1),
    resource_version_id: z.string(),
    resources_changed: z.boolean(),
    time_limited: z.boolean(),
    totals: PlanTotals,
  }),
  routes: z.array(Route),
  unserved: z.array(Unserved),
  fallback_forecast: z.array(
    z.object({ station_id: z.string(), fuel_type_id: z.string(), confidence: z.number().int() }),
  ),
  /** Null for an unedited optimal plan ("Optimal plan, no changes", FR-43). */
  comparison: Comparison.nullable(),
  risks: z.array(PlanRisk),
  approval_blocked: z.boolean(),
});
export type PlanView = z.infer<typeof PlanView>;

export const GeneratePlanRequest = z.strictObject({ delivery_day: LocalDate });
export const PlanDayQuery = z.object({ day: LocalDate });

const ExpectedVersion = z.number().int().min(1);
const Position = z.number().int().min(1);

/** API-13 edit: the kind decides the schema (SDD 5.6.4). */
export const EditRequest = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('reorder'),
    expected_version: ExpectedVersion,
    stop_id: z.string().min(1),
    position: Position,
  }),
  z.strictObject({
    kind: z.literal('move'),
    expected_version: ExpectedVersion,
    stop_id: z.string().min(1),
    to_route_id: z.string().min(1),
    position: Position,
  }),
  z.strictObject({
    kind: z.literal('quantity'),
    expected_version: ExpectedVersion,
    stop_id: z.string().min(1),
    fuel_type_id: z.string().min(1),
    litres: z.number().int('must be a whole number').min(0, 'must be 0 or more'),
    confirm_replace_route_edits: z.boolean().optional(),
  }),
  z.strictObject({ kind: z.literal('reset'), expected_version: ExpectedVersion }),
]);
export type EditRequest = z.infer<typeof EditRequest>;

export const LimitsQuery = z.object({ stop: z.string().min(1), fuel: z.string().min(1) });

export const BindingLimit = z.enum(['tanker', 'tank', 'warehouse', 'unknown']);

/** API-14 · Maximum quantity and binding limit (ALG-07, FR-75). */
export const Limits = z.object({
  max_l: z.number().int().min(0).nullable(),
  binding_limit: BindingLimit,
  limits: z.object({
    tanker: z
      .object({
        tanker_id: z.string(),
        capacity_l: z.number().int(),
        assigned_other_l: z.number().int(),
        free_l: z.number().int(),
      })
      .nullable(),
    tank: z.object({ free_storage_l: z.number().int() }).nullable(),
    warehouse: z.object({ warehouse_id: z.string(), remaining_l: z.number().int() }).nullable(),
  }),
  hint: z.string(),
});
export type Limits = z.infer<typeof Limits>;

export const StopDecisionRequest = z.strictObject({
  decision: z.enum(['approve', 'reject']),
  expected_version: ExpectedVersion,
  note: z.string().max(500).optional(),
});
export type StopDecisionRequest = z.infer<typeof StopDecisionRequest>;

const PlanRef = z.object({ plan_id: z.string(), status: PlanStatus, version: z.number().int() });

export const StopDecisionResponse = z.object({
  stop: z.object({ stop_id: z.string(), decision_status: DecisionStatus }),
  plan: PlanRef,
  /** Null for an approval; the re-plan after a rejection otherwise (FR-82). */
  replan: z
    .object({
      previous_plan_id: z.string(),
      not_dispatched: z.object({ station_id: z.string(), risk_level: RiskLevel }),
      kept_approved: z.array(z.string()),
      returned_to_pending: z.array(z.string()),
      newly_served: z.array(z.string()),
    })
    .nullable(),
  log_entry_ids: z.array(z.string()),
});
export type StopDecisionResponse = z.infer<typeof StopDecisionResponse>;

export const PlanDecisionRequest = z.strictObject({
  decision: z.enum(['approve_all', 'reject_all']),
  expected_version: ExpectedVersion,
});
export type PlanDecisionRequest = z.infer<typeof PlanDecisionRequest>;

export const PlanDecisionResponse = z.object({
  plan: PlanRef,
  decided_actions: z.number().int(),
  resources_locked: z.boolean(),
  log_entry_ids: z.array(z.string()),
});
export type PlanDecisionResponse = z.infer<typeof PlanDecisionResponse>;

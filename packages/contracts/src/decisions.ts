// API-17, API-18 · Decision history (SDD 5.6.5, TBL-24).
import { z } from 'zod';
import { IsoDateTime, LocalDate, paginated, PageQuery, Severity, UserRef, Usd } from './common';

export const PlanLabel = z.enum(['as recommended', 'modified', 'not dispatched']);
export type PlanLabel = z.infer<typeof PlanLabel>;

export const DecisionTypeFilter = z.enum(['approved', 'rejected', 'modified', 'not_dispatched']);

export const DecisionQuery = PageQuery.extend({
  from: LocalDate.optional(),
  to: LocalDate.optional(),
  type: DecisionTypeFilter.optional(),
  station: z.string().optional(),
  user: z.string().optional(),
  q: z.string().max(80).optional(),
}).refine((v) => !v.from || !v.to || v.from <= v.to, {
  path: ['to'],
  message: 'must be on or after the start date',
});

export const DecisionListItem = z.object({
  entry_id: z.string(),
  decided_at: IsoDateTime,
  manager: UserRef,
  scope: z.enum(['action', 'plan']),
  decision: z.enum(['approved', 'rejected']),
  station_id: z.string().nullable(),
  plan_label: PlanLabel,
  cost_diff_usd: Usd.nullable(),
  cost_diff_pct: z.number().nullable(),
  risk_count: z.number().int().min(0),
  max_severity: Severity.nullable(),
});
export type DecisionListItem = z.infer<typeof DecisionListItem>;

export const DecisionList = paginated(DecisionListItem);
export type DecisionList = z.infer<typeof DecisionList>;

/** A frozen copy of the action or plan at decision time (FR-72). */
export const DecisionSnapshot = z.record(z.string(), z.unknown());

export const DecisionEdit = z.object({
  edit_id: z.string(),
  kind: z.enum(['reorder', 'move', 'quantity', 'reset']),
  at: IsoDateTime,
  summary: z.string(),
});

export const DecisionRisk = z.object({
  type: z.string(),
  severity: Severity,
  reason: z.string(),
});

/** Every TBL-24 column, snapshots included. */
export const DecisionEntry = DecisionListItem.extend({
  plan_id: z.string(),
  stop_id: z.string().nullable(),
  delivery_day: LocalDate,
  original_recommendation: DecisionSnapshot,
  final_version: DecisionSnapshot,
  was_edited: z.boolean(),
  edits: z.array(DecisionEdit),
  risks_shown: z.array(DecisionRisk),
  cost_optimal: Usd.nullable(),
  cost_final: Usd.nullable(),
  note: z.string().nullable(),
  input_versions: z.record(z.string(), z.string()),
  correlation_id: z.string(),
});
export type DecisionEntry = z.infer<typeof DecisionEntry>;

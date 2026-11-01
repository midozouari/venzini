// UI-07 detail panel: one decision log entry as it was recorded (FR-72), read-only (NFR-14).
// Original recommendation vs final version, the edits, the risks shown, the cost and the note;
// the input versions are one click away.
import type { DecisionEntry, PlanLabel } from '@venzini/contracts';
import { ChevronDown, Eye, FileQuestion } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { useDecision } from '@/api/hooks';
import { RiskBadge } from '@/components/ui/risk-badge';
import { SidePanel } from '@/components/ui/side-panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { DecisionChip, useFuelName } from '@/features/planner/parts';
import { formatCostDiff, formatDay, formatInstant, formatTime, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { compareSnapshots, snapshotStationName } from './history';

export const PLAN_LABEL: Record<PlanLabel, string> = {
  'as recommended': 'As recommended',
  modified: 'Modified',
  'not dispatched': 'Not dispatched',
};

/** The "View only" label of UI-07: the log can never be changed (BR-13, NFR-14). */
export function ViewOnly() {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-cream px-3 text-caption font-semibold text-ink">
      <Eye aria-hidden className="size-3.5" />
      View only
    </span>
  );
}

export function EntryPanel({
  entryId,
  open,
  onClose,
  onCloseAutoFocus,
}: {
  entryId: string | undefined;
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: ComponentProps<typeof SidePanel>['onCloseAutoFocus'];
}) {
  const entry = useDecision(entryId);
  const e = entry.data;
  const station = e ? snapshotStationName(e.original_recommendation) : null;

  const title = e
    ? e.scope === 'plan'
      ? `Whole plan ${e.decision}`
      : `${e.decision === 'approved' ? 'Approved' : 'Rejected'}: ${e.station_id ?? ''}${station ? ` ${station}` : ''}`
    : 'Decision';

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      onCloseAutoFocus={onCloseAutoFocus}
      title={title}
      description={
        e ? (
          <>
            {e.manager.full_name} · {formatInstant(e.decided_at)} · delivery day{' '}
            {formatDay(e.delivery_day)}
          </>
        ) : undefined
      }
    >
      {entry.isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-24" />
        </div>
      ) : entry.isError ? (
        <EmptyState icon={FileQuestion} title="This entry could not be loaded">
          {entry.error.message}
        </EmptyState>
      ) : !e ? (
        <EmptyState icon={FileQuestion} title="We couldn't find this decision.">
          It may belong to an earlier session of the demo.
        </EmptyState>
      ) : (
        <EntryDetail entry={e} />
      )}
    </SidePanel>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-3 text-body font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function EntryDetail({ entry: e }: { entry: DecisionEntry }) {
  const fuelName = useFuelName();
  const rows = compareSnapshots(e.original_recommendation, e.final_version, fuelName);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <DecisionChip status={e.decision} />
        <span className="inline-flex h-6 items-center rounded-full border border-line px-2.5 text-caption font-semibold text-ink">
          {PLAN_LABEL[e.plan_label]}
        </span>
        {e.was_edited ? (
          <span className="inline-flex h-6 items-center rounded-full bg-navy-tint-strong px-2.5 text-caption font-semibold text-ink">
            Edited plan
          </span>
        ) : null}
        <span className="ml-auto">
          <ViewOnly />
        </span>
      </div>

      <Section title="Original recommendation and final version">
        {rows ? (
          <table className="w-full table-fixed text-left text-body">
            <thead>
              <tr className="text-caption text-muted">
                <th scope="col" className="w-[34%] pb-2 font-medium">
                  <span className="sr-only">Item</span>
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Original
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Final
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-line/70">
                  <th scope="row" className="py-2.5 pr-3 font-normal text-muted">
                    {r.label}
                  </th>
                  <td className="py-2.5 pr-3 tabular-nums text-ink">{r.original}</td>
                  <td className={cn('py-2.5 tabular-nums text-ink', r.changed && 'font-semibold')}>
                    {r.final}
                    {r.changed ? (
                      <span className="ml-2 inline-flex h-5 items-center rounded-full bg-navy-tint-strong px-2 text-caption font-semibold text-ink">
                        Changed
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-body text-muted">The recorded versions can't be shown.</p>
        )}
      </Section>

      <Section title="Edits">
        {e.edits.length > 0 ? (
          <ol className="flex flex-col gap-2">
            {e.edits.map((x) => (
              <li key={x.edit_id} className="flex gap-3 text-body text-ink">
                <span className="w-12 shrink-0 tabular-nums text-muted">{formatTime(x.at)}</span>
                {x.summary}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-body text-muted">No edits.</p>
        )}
      </Section>

      <Section title="Risks shown">
        {e.risks_shown.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {e.risks_shown.map((r, i) => (
              <li key={`${r.type}-${i}`} className="flex items-start gap-3">
                <RiskBadge level={r.severity} className="mt-0.5 shrink-0" />
                <span className="text-body text-ink">{r.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted">No risks were shown.</p>
        )}
      </Section>

      {e.cost_optimal !== null || e.cost_final !== null ? (
        <Section title="Cost">
          <dl className="grid grid-cols-3 gap-4">
            <Figure label="Optimal plan" value={e.cost_optimal} />
            <Figure label="Final plan" value={e.cost_final} />
            <div>
              <dt className="text-caption font-medium text-muted">Difference</dt>
              <dd className="mt-1 text-body font-semibold tabular-nums text-ink">
                {formatCostDiff(e.cost_diff_usd, e.cost_diff_pct)}
              </dd>
            </div>
          </dl>
        </Section>
      ) : null}

      <Section title="Note">
        <p className={cn('text-body', e.note ? 'text-ink' : 'text-muted')}>
          {e.note ?? 'No note.'}
        </p>
      </Section>

      <details className="group rounded-control bg-cream px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-control text-body font-medium text-ink [&::-webkit-details-marker]:hidden">
          Input versions
          <ChevronDown
            aria-hidden
            className="size-4 text-muted transition-transform duration-200 ease-vz group-open:rotate-180"
          />
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-caption">
          <dt className="text-muted">Plan</dt>
          <dd className="tabular-nums text-ink">{e.plan_id}</dd>
          {Object.entries(e.input_versions).map(([k, v]) => (
            <Version key={k} name={k} value={v} />
          ))}
          <dt className="text-muted">Reference</dt>
          <dd className="break-all tabular-nums text-ink">{e.correlation_id}</dd>
        </dl>
      </details>
    </div>
  );
}

const VERSION_LABEL: Record<string, string> = {
  resource_version: 'Resources',
  forecast: 'Forecast model',
  templates: 'Message templates',
};

function Version({ name, value }: { name: string; value: string }) {
  return (
    <>
      <dt className="text-muted">{VERSION_LABEL[name] ?? name}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </>
  );
}

function Figure({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <dt className="text-caption font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-body font-semibold tabular-nums text-ink">
        {value === null ? '–' : formatUsd(value)}
      </dd>
    </div>
  );
}

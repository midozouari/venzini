// UI-07 Decision history (UC-08; FR-72, FR-73, NFR-14). Read-only for all three roles: who decided
// what and when, newest first. One search box (station or manager), the action filter and a date
// range; the full entry opens in a side panel at /history/{entryId}. Nothing here edits or deletes.
import type { DecisionListItem } from '@venzini/contracts';
import { ChevronLeft, ChevronRight, History, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useDecisions } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { RiskBadge } from '@/components/ui/risk-badge';
import { Select } from '@/components/ui/select';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { EntryPanel, PLAN_LABEL, ViewOnly } from '@/features/history/EntryPanel';
import {
  ACTION_FILTERS,
  apiQuery,
  hasFilters,
  PAGE_SIZE,
  rangeError,
  readFilters,
  writeFilters,
  type ActionFilter,
  type HistoryFilters,
} from '@/features/history/history';
import { DecisionChip } from '@/features/planner/parts';
import { formatCostDiff, formatInstant, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const { entryId } = useParams();
  const navigate = useNavigate();
  const filters = readFilters(params);
  const invalidRange = rangeError(filters);
  const decisions = useDecisions(apiQuery(filters), !invalidRange);
  const search = params.toString();
  const listUrl = `/history${search ? `?${search}` : ''}`;

  // The panel keeps the last entry while it slides out, and focus goes back to its row.
  const [shownEntry, setShownEntry] = useState(entryId);
  if (entryId && entryId !== shownEntry) setShownEntry(entryId);

  const update = (change: Partial<HistoryFilters>) =>
    setParams(writeFilters({ ...filters, page: 1, ...change }), { replace: true });

  const data = decisions.data;
  const items = data?.items ?? [];

  return (
    <ContentArea>
      <div className="flex min-h-full flex-col gap-[var(--vz-gap)]">
        <Filters filters={filters} rangeError={invalidRange} onChange={update} />

        {decisions.isError ? (
          <Panel className="mx-auto mt-6 w-[520px]">
            <EmptyState
              icon={History}
              title="The decision history could not be loaded"
              action={<Button onClick={() => decisions.refetch()}>Try again</Button>}
            >
              {decisions.error.message}
            </EmptyState>
          </Panel>
        ) : !data ? (
          invalidRange ? null : (
            <Skeleton className="h-[460px] rounded-panel" />
          )
        ) : items.length === 0 ? (
          <Panel className="mx-auto mt-6 w-[540px] animate-in fade-in-0 duration-200">
            {hasFilters(filters) ? (
              <EmptyState
                icon={Search}
                title="No decisions match these filters."
                action={
                  <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>
                    <X aria-hidden /> Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={History} title="No decisions recorded yet.">
                Approvals and rejections appear here as soon as a manager decides.
              </EmptyState>
            )}
          </Panel>
        ) : (
          <Panel
            className={cn(
              'p-2 transition-opacity duration-150 ease-vz animate-in fade-in-0',
              decisions.isFetching && decisions.isPlaceholderData && 'opacity-70',
            )}
            role="region"
            aria-label="Decisions"
          >
            <DecisionTable items={items} search={search} />
            <Pager
              page={data.page}
              total={data.total}
              shown={items.length}
              onPage={(page) => update({ page })}
            />
          </Panel>
        )}
      </div>

      <EntryPanel
        entryId={shownEntry}
        open={!!entryId}
        onClose={() => navigate(listUrl)}
        onCloseAutoFocus={(e) => {
          const row = document.querySelector<HTMLElement>(
            `[data-entry-link="${shownEntry ?? ''}"]`,
          );
          if (row) {
            e.preventDefault();
            row.focus();
          }
        }}
      />
    </ContentArea>
  );
}

function Filters({
  filters,
  rangeError,
  onChange,
}: {
  filters: HistoryFilters;
  rangeError: string | null;
  onChange: (change: Partial<HistoryFilters>) => void;
}) {
  // The search waits for a short pause in typing before it asks the API.
  const [text, setText] = useState(filters.q);
  const [syncedQ, setSyncedQ] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  if (filters.q !== syncedQ) {
    // The address changed from elsewhere (Clear filters, Back): show its search.
    setSyncedQ(filters.q);
    if (text.trim() !== filters.q) setText(filters.q);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  const type = (value: string) => {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ q: value }), 300);
  };

  return (
    <Panel className="flex items-start gap-3 px-5 py-4" role="search">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search by station or manager</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={text}
          maxLength={80}
          placeholder="Search by station or manager"
          onChange={(e) => type(e.target.value)}
          className="h-10 w-full rounded-full border border-line-strong bg-panel pl-11 pr-4 text-body text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150 ease-vz hover:border-navy-900 focus:border-navy-900 focus:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)] focus:outline-none"
        />
      </label>
      <Select
        label="Action"
        className="w-44 shrink-0"
        value={filters.type}
        onChange={(e) => onChange({ type: e.target.value as ActionFilter })}
      >
        {ACTION_FILTERS.map((a) => (
          <option key={a.value} value={a.value}>
            {a.label}
          </option>
        ))}
      </Select>
      <div className="shrink-0">
        <div className="flex items-center gap-2">
          <DateInput label="From" value={filters.from} onChange={(from) => onChange({ from })} />
          <span aria-hidden className="text-muted">
            –
          </span>
          <DateInput
            label="To"
            value={filters.to}
            invalid={!!rangeError}
            onChange={(to) => onChange({ to })}
          />
        </div>
        {rangeError ? (
          <p
            id="history-range-error"
            role="alert"
            className="mt-1.5 text-caption font-medium text-risk-high"
          >
            {rangeError}
          </p>
        ) : null}
      </div>
      <div className="flex h-10 shrink-0 items-center">
        <ViewOnly />
      </div>
    </Panel>
  );
}

function DateInput({
  label,
  value,
  invalid,
  onChange,
}: {
  label: string;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex shrink-0 items-center gap-2 text-caption font-semibold text-ink">
      {label}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? 'history-range-error' : undefined}
        className={cn(
          'h-10 w-[150px] rounded-full border bg-panel px-3 text-body font-normal tabular-nums text-ink transition-[border-color,box-shadow] duration-150 ease-vz hover:border-navy-900 focus:border-navy-900 focus:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)] focus:outline-none',
          invalid ? 'border-risk-high' : 'border-line-strong',
        )}
      />
    </label>
  );
}

const COLUMNS = [
  'Date and time',
  'Manager',
  'Decision',
  'Station',
  'Plan',
  'Cost difference',
  'Risk warnings',
];

function DecisionTable({ items, search }: { items: DecisionListItem[]; search: string }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-0 text-left">
      <caption className="sr-only">Decisions, newest first. Open a row to see the details.</caption>
      <colgroup>
        <col className="w-[180px]" />
        <col className="w-[115px]" />
        <col className="w-[190px]" />
        <col className="w-[80px]" />
        <col className="w-[145px]" />
        <col className="w-[150px]" />
        <col />
      </colgroup>
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th
              key={c}
              scope="col"
              className="border-b border-line px-3 pb-3 pt-2 text-caption font-medium text-muted first:pl-4"
            >
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((d) => (
          <Row key={d.entry_id} item={d} search={search} />
        ))}
      </tbody>
    </table>
  );
}

function Row({ item: d, search }: { item: DecisionListItem; search: string }) {
  const cell = 'whitespace-nowrap px-3 py-3.5 align-middle text-body text-ink';
  return (
    <tr className="group relative transition-[background-color] duration-150 ease-vz hover:bg-navy-tint [&>td:first-child]:rounded-l-control [&>td:last-child]:rounded-r-control">
      <td className={cn(cell, 'pl-4')}>
        <Link
          to={`/history/${d.entry_id}${search ? `?${search}` : ''}`}
          data-entry-link={d.entry_id}
          className="font-medium tabular-nums text-ink outline-none after:absolute after:inset-0 after:rounded-control after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
        >
          <span className="sr-only">Open the decision of </span>
          {formatInstant(d.decided_at)}
        </Link>
      </td>
      <td className={cn(cell, 'truncate')}>{d.manager.full_name}</td>
      <td className={cell}>
        <span className="flex items-center gap-2">
          <DecisionChip status={d.decision} />
          {d.scope === 'plan' ? <span className="text-caption text-muted">Whole plan</span> : null}
        </span>
      </td>
      <td className={cn(cell, 'font-medium')}>{d.station_id ?? '–'}</td>
      <td className={cn(cell, d.plan_label === 'as recommended' && 'text-muted')}>
        {PLAN_LABEL[d.plan_label]}
      </td>
      <td className={cn(cell, 'tabular-nums', d.cost_diff_usd === null && 'text-muted')}>
        {formatCostDiff(d.cost_diff_usd, d.cost_diff_pct)}
      </td>
      <td className={cell}>
        {d.risk_count > 0 && d.max_severity ? (
          <RiskBadge
            level={d.max_severity}
            suffix={`${d.risk_count} ${d.risk_count === 1 ? 'warning' : 'warnings'}`}
          />
        ) : (
          <span className="text-muted">None</span>
        )}
      </td>
    </tr>
  );
}

function Pager({
  page,
  total,
  shown,
  onPage,
}: {
  page: number;
  total: number;
  shown: number;
  onPage: (page: number) => void;
}) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = first + shown - 1;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="mt-2 flex items-center justify-between border-t border-line px-4 pb-2 pt-4">
      <p className="text-caption tabular-nums text-muted" aria-live="polite">
        {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}, newest first
      </p>
      {lastPage > 1 ? (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            <ChevronLeft aria-hidden /> Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
          >
            Next <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

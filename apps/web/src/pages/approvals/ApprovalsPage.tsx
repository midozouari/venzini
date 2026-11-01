// UI-06 Review and approve (UC-07; FR-67 to FR-71, FR-77, FR-80 to FR-82). Every recommended action
// is decided knowingly: Approve (primary), Reject with ✕ (secondary, never red) and Adjust (opens
// the planner on the station). Approve all and Reject all ask for confirmation. An overload
// (RISK-01) blocks approval, and the screen says why and how to fix it.
import type { PlanView, Route, Stop, StopDecisionResponse } from '@venzini/contracts';
import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Info,
  ShieldAlert,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useId, useState } from 'react';
import { Link } from 'react-router';
import { usePlanDecision, usePlanOfDay, useStopDecision } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Panel } from '@/components/ui/panel';
import { RiskBadge } from '@/components/ui/risk-badge';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { findStop, overloads } from '@/features/planner/edit';
import { DecisionChip, LitresLine, RouteSwatch, UnservedList } from '@/features/planner/parts';
import { formatDay, formatHours, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDayStore } from '@/stores/day';

const RISK_WORD = { high: 'high', medium: 'medium', low: 'low' } as const;

type Result = { tone: 'status' | 'alert'; text: string; trips?: boolean } | null;

export function ApprovalsPage() {
  const day = useDayStore((s) => s.day);
  const plan = usePlanOfDay(day);

  return (
    <ContentArea>
      {plan.isPending ? (
        <div className="flex flex-col gap-[var(--vz-gap)]">
          <Skeleton className="h-24 rounded-panel" />
          <Skeleton className="h-[420px] rounded-panel" />
        </div>
      ) : plan.isError ? (
        <Panel className="mx-auto mt-10 w-[520px]">
          <EmptyState
            icon={ClipboardList}
            title="The plan could not be loaded"
            action={<Button onClick={() => plan.refetch()}>Try again</Button>}
          >
            {plan.error.message}
          </EmptyState>
        </Panel>
      ) : !plan.data ? (
        <Panel className="mx-auto mt-10 w-[540px] animate-in fade-in-0 duration-200">
          <EmptyState
            icon={ClipboardList}
            title={`No plan to review for ${formatDay(day)}`}
            action={
              <Button asChild>
                <Link to="/planner">
                  Open the planner <ArrowRight aria-hidden />
                </Link>
              </Button>
            }
          >
            Generate the day's plan in the planner first.
          </EmptyState>
        </Panel>
      ) : (
        <Approvals key={day} day={day} view={plan.data} />
      )}
    </ContentArea>
  );
}

function Approvals({ day, view }: { day: string; view: PlanView }) {
  const stopDecision = useStopDecision(day);
  const planDecision = usePlanDecision(day);
  const [result, setResult] = useState<Result>(null);
  const [rejecting, setRejecting] = useState<Stop | null>(null);
  const [all, setAll] = useState<'approve_all' | 'reject_all' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const stops = view.routes.flatMap((r) => r.stops);
  const pending = stops.filter((s) => s.decision_status === 'pending');
  const decided = view.plan.status === 'decided';
  const blocking = overloads(view)[0];
  const blockedStation = blocking
    ? (findStop(view, blocking.affected.stops[0] ?? '')?.stop.station_id ??
      view.routes.find((r) => r.route_id === blocking.affected.routes[0])?.stops[0]?.station_id)
    : undefined;
  const working = stopDecision.isPending || planDecision.isPending;
  const version = view.plan.version;

  const approve = (stop: Stop) => {
    setResult(null);
    setBusy(stop.stop_id);
    stopDecision.mutate(
      {
        planId: view.plan.plan_id,
        stopId: stop.stop_id,
        body: { decision: 'approve', expected_version: version },
      },
      {
        onSuccess: (r) =>
          setResult(
            r.plan.status === 'decided'
              ? { tone: 'status', text: `Plan for ${formatDay(day)} decided.`, trips: true }
              : { tone: 'status', text: `${stop.station_id} approved.` },
          ),
        onError: (e) => setResult({ tone: 'alert', text: e.message }),
        onSettled: () => setBusy(null),
      },
    );
  };

  const reject = (stop: Stop, note: string) => {
    setResult(null);
    setBusy(stop.stop_id);
    stopDecision.mutate(
      {
        planId: view.plan.plan_id,
        stopId: stop.stop_id,
        body: { decision: 'reject', expected_version: version, ...(note ? { note } : {}) },
      },
      {
        onSuccess: (r) => {
          setRejecting(null);
          setResult({ tone: 'status', text: replanSummary(r), trips: r.plan.status === 'decided' });
        },
        onError: (e) => setResult({ tone: 'alert', text: e.message }),
        onSettled: () => setBusy(null),
      },
    );
  };

  const decideAll = (decision: 'approve_all' | 'reject_all') => {
    setResult(null);
    planDecision.mutate(
      { planId: view.plan.plan_id, body: { decision, expected_version: version } },
      {
        onSuccess: (r) => {
          setAll(null);
          setResult({
            tone: 'status',
            text: `Plan for ${formatDay(day)} decided: ${r.decided_actions} actions ${decision === 'approve_all' ? 'approved' : 'rejected'}.`,
            trips: decision === 'approve_all',
          });
        },
        onError: (e) => {
          setAll(null);
          setResult({ tone: 'alert', text: e.message });
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-[var(--vz-gap)]">
      <Panel className="flex flex-wrap items-center gap-x-8 gap-y-4 px-6 py-5 animate-in fade-in-0 duration-200">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-body font-semibold text-ink">
            <Info aria-hidden className="size-4" />
            Recommendations require manager approval
          </p>
          <p className="mt-1 text-caption text-muted">
            {stops.length} recommended actions for {formatDay(day)} · {pending.length} pending ·
            version {version}
          </p>
          <p
            aria-label="Risk levels"
            className="mt-2 flex items-center gap-2 text-caption text-muted"
          >
            Risk:
            <RiskBadge level="high" />
            <RiskBadge level="medium" />
            <RiskBadge level="low" />
          </p>
        </div>
        {!decided ? (
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              disabled={pending.length === 0 || working}
              onClick={() => setAll('reject_all')}
            >
              <X aria-hidden /> Reject all
            </Button>
            <Button
              disabled={pending.length === 0 || working || !!blocking}
              aria-describedby={blocking ? 'approval-blocked' : undefined}
              onClick={() => setAll('approve_all')}
            >
              <Check aria-hidden /> Approve all
            </Button>
          </div>
        ) : null}
      </Panel>

      {blocking && !decided ? (
        <div
          id="approval-blocked"
          role="alert"
          className="flex items-start gap-3 rounded-panel border border-navy-900/30 bg-note-strong px-6 py-4 text-body text-ink shadow-float animate-in fade-in-0 slide-in-from-top-1 duration-200"
        >
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Approval is blocked. {blocking.reason}</p>
            <p className="mt-0.5 text-caption text-muted">
              Approve all and the approvals on this tanker stay off until the overload is gone: move
              a station back, move a station to another tanker, lower a quantity, or reset to the
              optimal plan.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link to={`/planner${blockedStation ? `?station=${blockedStation}` : ''}`}>
              Fix in the planner <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      ) : null}

      {decided && !result ? (
        <Callout icon={Check} tone="strong" role="status">
          Plan for {formatDay(day)} decided. The resources of the day are locked.{' '}
          <Link to="/resources/trips" className="font-semibold underline underline-offset-2">
            Go to trips
          </Link>
        </Callout>
      ) : null}
      {result ? (
        <div
          role={result.tone}
          className="flex items-start gap-3 rounded-panel border border-navy-900/30 bg-note-strong px-6 py-4 text-body text-ink shadow-float animate-in fade-in-0 duration-200"
        >
          {result.tone === 'alert' ? (
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          ) : (
            <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
          )}
          <p className="min-w-0 flex-1">
            {result.text}
            {result.trips ? (
              <>
                {' '}
                <Link to="/resources/trips" className="font-semibold underline underline-offset-2">
                  Go to trips
                </Link>
              </>
            ) : null}
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setResult(null)}
            className="rounded-control p-0.5 text-muted hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-[var(--vz-gap)]">
        <div className="flex flex-col gap-[var(--vz-gap)]">
          {view.routes
            .filter((r) => r.stops.length > 0)
            .map((route) => (
              <RouteGroup
                key={route.route_id}
                route={route}
                view={view}
                decided={decided}
                busy={busy}
                working={working}
                onApprove={approve}
                onReject={setRejecting}
              />
            ))}
        </div>
        <Panel className="sticky top-0 p-5">
          {view.unserved.length > 0 ? (
            <UnservedList view={view} />
          ) : (
            <p className="text-body text-muted">Every station that needs fuel is served.</p>
          )}
        </Panel>
      </div>

      {rejecting ? (
        <RejectDialog
          stop={rejecting}
          day={day}
          working={stopDecision.isPending}
          onClose={() => setRejecting(null)}
          onReject={(note) => reject(rejecting, note)}
        />
      ) : null}
      {all ? (
        <DecideAllDialog
          decision={all}
          count={pending.length}
          warnings={view.risks.length}
          day={day}
          working={planDecision.isPending}
          onClose={() => setAll(null)}
          onConfirm={() => decideAll(all)}
        />
      ) : null}
    </div>
  );
}

/** FR-82: what the rejection changed, from the server's re-plan answer. */
function replanSummary(r: StopDecisionResponse): string {
  if (!r.replan) return 'Rejected.';
  const { not_dispatched: nd, newly_served: served, kept_approved: kept } = r.replan;
  const back = r.replan.returned_to_pending.length;
  const servedText =
    served.length > 0
      ? `: ${served.join(', ')} ${served.length === 1 ? 'is' : 'are'} now served`
      : '';
  return `${nd.station_id} is not dispatched (${RISK_WORD[nd.risk_level]} risk). A new optimal plan was made${servedText}. ${kept.length} ${kept.length === 1 ? 'approval' : 'approvals'} kept, ${back} returned to pending.`;
}

function RouteGroup({
  route,
  view,
  decided,
  busy,
  working,
  onApprove,
  onReject,
}: {
  route: Route;
  view: PlanView;
  decided: boolean;
  busy: string | null;
  working: boolean;
  onApprove: (s: Stop) => void;
  onReject: (s: Stop) => void;
}) {
  const blocked = overloads(view, route.route_id).length > 0;
  return (
    <Panel
      role="region"
      aria-label={`Actions of ${route.tanker_id}, route ${route.route_id}`}
      className="p-2 animate-in fade-in-0 duration-200"
    >
      <div className="flex items-center gap-3 px-4 pb-1 pt-3">
        <RouteSwatch route={route} />
        <h2 className="text-body font-semibold text-ink">{route.tanker_id}</h2>
        <p className="text-caption text-muted">
          {route.route_id}
          {route.trip_no === 2 ? ' · second trip' : ''} · {route.driver.full_name} · leaves{' '}
          {formatTime(route.est_departure)} from {route.home_warehouse_id}
        </p>
        {blocked ? <RiskBadge level="high" suffix="Overloaded" className="ml-auto" /> : null}
      </div>
      <ul className="flex flex-col">
        {route.stops.map((s) => (
          <ActionRow
            key={s.stop_id}
            stop={s}
            route={route}
            view={view}
            blocked={blocked}
            decided={decided}
            busy={busy === s.stop_id}
            working={working}
            onApprove={() => onApprove(s)}
            onReject={() => onReject(s)}
          />
        ))}
      </ul>
    </Panel>
  );
}

function ActionRow({
  stop: s,
  route,
  view,
  blocked,
  decided,
  busy,
  working,
  onApprove,
  onReject,
}: {
  stop: Stop;
  route: Route;
  view: PlanView;
  blocked: boolean;
  decided: boolean;
  busy: boolean;
  working: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const fallback = view.fallback_forecast.find((f) => f.station_id === s.station_id);
  const isPending = s.decision_status === 'pending';

  return (
    <li
      aria-label={`${s.station_name} (${s.station_id})`}
      className="rounded-control transition-colors duration-150 hover:bg-navy-tint"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_92px_auto] items-center gap-4 px-4 py-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={detailsId}
            className="group flex max-w-full items-center gap-2 rounded-control text-left"
          >
            <span className="truncate text-body font-semibold text-ink">
              {s.stop_order}. {s.station_name} · {s.station_id}
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                'size-3.5 text-muted transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
            <span className="sr-only">Details</span>
          </button>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
            <RiskBadge level={s.risk_level} className="py-0" />
            <LitresLine stop={s} className="text-ink" />
            <span>Arrives {formatTime(s.est_arrival)}</span>
            {s.uncertain ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-line-strong/70 px-2 py-0.5 font-semibold text-ink">
                <CircleHelp aria-hidden className="size-3" /> Uncertain forecast
              </span>
            ) : null}
          </p>
        </div>
        <span className="justify-self-start">
          <DecisionChip status={s.decision_status} />
        </span>
        <div className="flex items-center justify-end gap-2">
          {isPending && !decided ? (
            <>
              <Button asChild variant="quiet" size="sm">
                <Link to={`/planner?station=${s.station_id}`}>
                  <SlidersHorizontal aria-hidden /> Adjust
                  <span className="sr-only"> {s.station_id}</span>
                </Link>
              </Button>
              <Button variant="secondary" size="sm" disabled={working} onClick={onReject}>
                <X aria-hidden /> Reject<span className="sr-only"> {s.station_id}</span>
              </Button>
              <Button
                size="sm"
                disabled={working || blocked}
                title={blocked ? `Blocked: ${route.tanker_id} is overloaded` : undefined}
                onClick={onApprove}
              >
                <Check aria-hidden />
                {busy ? 'Saving…' : 'Approve'}
                <span className="sr-only"> {s.station_id}</span>
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {isPending && blocked && !decided ? (
        <p className="-mt-2 px-4 pb-3 text-right text-caption font-medium text-ink">
          Approve is off: {route.tanker_id} is overloaded.
        </p>
      ) : null}
      {open ? (
        <div
          id={detailsId}
          className="mx-4 mb-3 rounded-control bg-cream px-4 py-3 text-caption text-ink animate-in fade-in-0 slide-in-from-top-1 duration-200"
        >
          <p>{s.reason}</p>
          <p className="mt-1 text-muted">
            Priority {s.priority_rank} · stockout in {formatHours(s.hours_to_stockout)}
            {fallback ? ` · forecast confidence ${fallback.confidence}%` : ''}
          </p>
        </div>
      ) : null}
    </li>
  );
}

function RejectDialog({
  stop,
  day,
  working,
  onClose,
  onReject,
}: {
  stop: Stop;
  day: string;
  working: boolean;
  onClose: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && !working && onClose()}>
      <DialogContent className="w-[500px]">
        <DialogTitle>
          Reject {stop.station_id} {stop.station_name}?
        </DialogTitle>
        <DialogDescription>
          {stop.station_id} is {RISK_WORD[stop.risk_level]} risk: rejecting it leaves it unserved on{' '}
          {formatDay(day)}. Venzini then makes a new optimal plan without it; approvals that stay
          the same are kept.
        </DialogDescription>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            onReject(note.trim());
          }}
        >
          <label htmlFor="reject-note" className="text-caption font-semibold text-ink">
            Note (optional)
          </label>
          <textarea
            id="reject-note"
            rows={3}
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1.5 w-full rounded-control border border-line-strong bg-panel px-4 py-3 text-body text-ink focus:border-navy-900 focus:outline-none"
          />
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={working}>
              Back
            </Button>
            <Button type="submit" variant="secondary" disabled={working}>
              <X aria-hidden />
              {working ? 'Rejecting…' : `Reject ${stop.station_id}`}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DecideAllDialog({
  decision,
  count,
  warnings,
  day,
  working,
  onClose,
  onConfirm,
}: {
  decision: 'approve_all' | 'reject_all';
  count: number;
  warnings: number;
  day: string;
  working: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const approve = decision === 'approve_all';
  return (
    <Dialog open onOpenChange={(o) => !o && !working && onClose()}>
      <DialogContent className="w-[500px]">
        <DialogTitle>
          {approve ? 'Approve' : 'Reject'} all {count} pending actions?
        </DialogTitle>
        <DialogDescription>
          {approve
            ? `The plan for ${formatDay(day)} is then decided: its resources lock and the trips can be recorded.${warnings > 0 ? ` The ${warnings} risk warnings are recorded with your approval.` : ''}`
            : `None of these deliveries will be dispatched on ${formatDay(day)}. This cannot be undone.`}
        </DialogDescription>
        <DialogActions>
          <Button variant="secondary" onClick={onClose} disabled={working}>
            Back
          </Button>
          {approve ? (
            <Button onClick={onConfirm} disabled={working}>
              <Check aria-hidden />
              {working ? 'Approving…' : 'Approve all'}
            </Button>
          ) : (
            <Button variant="secondary" onClick={onConfirm} disabled={working}>
              <X aria-hidden />
              {working ? 'Rejecting…' : 'Reject all'}
            </Button>
          )}
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}

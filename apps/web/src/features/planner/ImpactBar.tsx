// Impact of the manager's changes (FR-43, FR-44, FR-61, FR-63 to FR-66): the comparison with the
// optimal plan and the risks always appear together, next to the edit. A risk click highlights it
// on the map (FR-65). Reset and "Go to approvals" end the bar.
import { NO_RISK_MESSAGE, type PlanRisk, type PlanView } from '@venzini/contracts';
import { ArrowRight, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogActions,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { RiskBadge } from '@/components/ui/risk-badge';
import { formatLitres, formatSignedPct, formatUsd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { sortedRisks } from './edit';
import { formatDuration } from './RouteList';

const signedUsd = (n: number) => `${n < 0 ? '−' : '+'}${formatUsd(Math.abs(n))}`;

export function ImpactBar({
  view,
  pending,
  highlighted,
  onHighlight,
}: {
  view: PlanView;
  pending: boolean;
  highlighted: string | null;
  onHighlight: (risk: PlanRisk | null) => void;
}) {
  const risks = sortedRisks(view.risks);
  const top = risks[0];
  const cmp = view.comparison;
  const totals = view.plan.totals;
  const unedited = view.plan.kind === 'optimal' && !cmp;
  const [allOpen, setAllOpen] = useState(false);

  return (
    <Panel
      role="region"
      aria-label="Impact of your changes"
      aria-busy={pending}
      className="grid shrink-0 grid-cols-[260px_minmax(0,1fr)_auto] items-stretch gap-5 px-5 py-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
    >
      <div className={cn('min-w-0 transition-opacity duration-200', pending && 'opacity-40')}>
        <PanelLabel className="flex items-center gap-1.5">
          {pending ? (
            <>
              <Loader2 aria-hidden className="size-3.5 animate-spin" /> Recalculating…
            </>
          ) : (
            'Cost of the plan'
          )}
        </PanelLabel>
        {cmp ? (
          <>
            <p className="mt-0.5 flex items-baseline gap-2 whitespace-nowrap tabular-nums text-ink">
              <span className="text-section">{formatUsd(cmp.cost_new)}</span>
              <span className="text-body font-semibold">
                {signedUsd(cmp.cost_diff)} ({formatSignedPct(cmp.cost_diff_pct)})
              </span>
            </p>
            <p className="text-caption tabular-nums text-muted">
              Optimal {formatUsd(cmp.cost_optimal)} · distance {formatSignedPct(cmp.km_diff_pct)} ·
              time {formatSignedPct(cmp.minutes_diff_pct)}
            </p>
          </>
        ) : (
          <p className="mt-0.5 flex items-baseline gap-2 whitespace-nowrap tabular-nums text-ink">
            <span className="text-section">
              {totals.cost_usd !== null ? formatUsd(totals.cost_usd) : 'Not available'}
            </span>
            <span className="text-caption text-muted">Optimal plan, no changes</span>
          </p>
        )}
        <p className="mt-1 text-caption tabular-nums text-muted">
          {totals.km.toFixed(1)} km · {formatDuration(totals.minutes)} ·{' '}
          {formatLitres(totals.litres)}
        </p>
      </div>

      <div
        className={cn(
          'min-w-0 border-l border-line pl-5 transition-opacity duration-200',
          pending && 'opacity-40',
        )}
      >
        <PanelLabel>
          {risks.length > 0 ? `Risks of this plan (${risks.length})` : 'Risks'}
        </PanelLabel>
        {top ? (
          <>
            <RiskButton
              risk={top}
              active={highlighted === top.risk_id}
              onClick={() => onHighlight(highlighted === top.risk_id ? null : top)}
            />
            {risks.length > 1 ? (
              <button
                type="button"
                onClick={() => setAllOpen(true)}
                className="mt-1 rounded-control text-caption font-medium text-ink underline-offset-2 hover:underline"
              >
                Show all {risks.length} risks
              </button>
            ) : null}
          </>
        ) : (
          <p className="mt-1 flex items-start gap-2 text-body text-ink">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
            {unedited ? 'No risk: this is the optimal plan.' : NO_RISK_MESSAGE}
          </p>
        )}
      </div>

      <div className="flex items-center">
        <Button asChild>
          <Link to="/approvals">
            Go to approvals <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>

      <Dialog open={allOpen} onOpenChange={setAllOpen}>
        <DialogContent className="w-[600px]">
          <DialogTitle>Risks of this plan</DialogTitle>
          <DialogDescription>
            Most serious first. Choose one to see it on the map.
          </DialogDescription>
          <ul className="mt-5 flex max-h-[50vh] flex-col gap-2 overflow-auto">
            {risks.map((r) => (
              <li key={r.risk_id}>
                <RiskButton
                  risk={r}
                  active={highlighted === r.risk_id}
                  onClick={() => {
                    onHighlight(r);
                    setAllOpen(false);
                  }}
                  boxed
                />
              </li>
            ))}
          </ul>
          <DialogActions>
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function RiskButton({
  risk,
  active,
  onClick,
  boxed,
}: {
  risk: PlanRisk;
  active: boolean;
  onClick: () => void;
  boxed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'mt-1 flex w-full items-start gap-2.5 rounded-control px-2 py-1.5 text-left text-body text-ink transition-[background-color,box-shadow] duration-150 hover:bg-navy-tint',
        boxed && 'border border-line px-3 py-2.5',
        active && 'bg-navy-tint-strong ring-2 ring-navy-900',
      )}
    >
      {/* The badge sits inside the sentence so the reason can use the whole width. */}
      <span className={cn('min-w-0', !boxed && 'line-clamp-2')} title={risk.reason}>
        <RiskBadge level={risk.severity} className="mr-1.5 py-0 align-[1px]" />
        {risk.reason}
        {risk.blocks_approval ? (
          <span className={cn('font-semibold', boxed ? 'block text-caption' : 'ml-1.5')}>
            Blocks approval.
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Reset to optimal (FR-60), with a confirmation. */
export function ResetButton({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        <RotateCcw aria-hidden /> Reset to optimal
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Reset to the optimal plan?</DialogTitle>
          <DialogDescription>
            Your reorders and moves are undone and the recommended plan comes back exactly as it
            was. Decisions already made are kept.
          </DialogDescription>
          <DialogActions>
            <DialogClose asChild>
              <Button variant="secondary">
                <X aria-hidden /> Keep my changes
              </Button>
            </DialogClose>
            <Button
              onClick={() => {
                setOpen(false);
                onReset();
              }}
            >
              <RotateCcw aria-hidden /> Reset to optimal
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Planner dialogs: "Move to tanker…" (the keyboard path for moving a stop, SDD 5.12.6) and the
// quantity editor with its limit hint (FR-58, FR-59, FR-75, FR-76).
import { formatMessage, type EditRequest, type PlanView, type Stop } from '@venzini/contracts';
import { ArrowRightLeft, Info } from 'lucide-react';
import { useId, useState } from 'react';
import { useLimits } from '@/api/hooks';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/states';
import { formatLitres, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { findStop, moveTargets } from './edit';
import { RouteSwatch, useFuelName } from './parts';

const fieldClass =
  'mt-1.5 h-12 w-full rounded-control border border-line-strong bg-panel px-3 text-body tabular-nums text-ink focus:border-navy-900 focus:outline-none';

export function MoveDialog({
  view,
  stop,
  onMove,
  onClose,
}: {
  view: PlanView;
  stop: Stop;
  onMove: (edit: EditRequest) => void;
  onClose: () => void;
}) {
  const from = findStop(view, stop.stop_id)!.route;
  const targets = moveTargets(view, from.route_id);
  const [to, setTo] = useState(targets[0]?.route_id ?? '');
  const target = targets.find((t) => t.route_id === to);
  const [position, setPosition] = useState(String((target?.stops.length ?? 0) + 1));
  const legend = useId();

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-[480px]">
        <DialogTitle>Move {stop.station_id} to another tanker</DialogTitle>
        <DialogDescription>
          {stop.station_name} is stop {stop.stop_order} of {from.tanker_id}. Only tankers of{' '}
          {from.home_warehouse_id} can take it.
        </DialogDescription>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!target) return;
            onMove({
              kind: 'move',
              expected_version: view.plan.version,
              stop_id: stop.stop_id,
              to_route_id: target.route_id,
              position: Number(position),
            });
          }}
        >
          <fieldset aria-labelledby={legend}>
            <p id={legend} className="text-caption font-semibold text-ink">
              Tanker
            </p>
            <div className="mt-1.5 flex flex-col gap-2">
              {targets.map((t) => (
                <label
                  key={t.route_id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 text-body text-ink transition-colors duration-150 hover:bg-navy-tint',
                    to === t.route_id ? 'border-navy-900 bg-navy-tint' : 'border-line',
                  )}
                >
                  <input
                    type="radio"
                    name="tanker"
                    value={t.route_id}
                    checked={to === t.route_id}
                    onChange={() => {
                      setTo(t.route_id);
                      setPosition(String(t.stops.length + 1));
                    }}
                    className="accent-[var(--vz-navy-900)]"
                  />
                  <RouteSwatch route={t} />
                  <span className="font-semibold">{t.tanker_id}</span>
                  <span className="text-caption text-muted">
                    {t.route_id} · {t.stops.length} stops · {formatLitres(t.load.assigned_l)} of{' '}
                    {formatLitres(t.load.capacity_l)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {target ? (
            <label className="mt-4 block w-48 text-caption font-semibold text-ink">
              Position
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className={fieldClass}
              >
                {Array.from({ length: target.stops.length + 1 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Stop {i + 1}
                    {i === target.stops.length ? ' (last)' : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <DialogActions>
            <Button variant="secondary" onClick={onClose}>
              Back
            </Button>
            <Button type="submit" disabled={!target}>
              <ArrowRightLeft aria-hidden />
              Move to {target?.tanker_id ?? 'tanker'}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function QuantityDialog({
  view,
  stop,
  fuel,
  onSave,
  onClose,
  saving,
  error,
}: {
  view: PlanView;
  stop: Stop;
  fuel: string;
  onSave: (edit: EditRequest) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  const fuelName = useFuelName();
  const route = findStop(view, stop.stop_id)!.route;
  const limits = useLimits(view.plan.plan_id, stop.stop_id, fuel);
  const current = stop.quantities.find((q) => q.fuel_type_id === fuel)!;
  const [value, setValue] = useState(String(current.final_l));
  const [confirmed, setConfirmed] = useState(false);
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const litres = value.trim() === '' ? NaN : Number(value);
  const max = limits.data?.max_l ?? null;
  // The maximum comes from the server (ALG-07); the browser only compares the entry with it.
  const fieldError =
    value.trim() === ''
      ? 'Litres is required.'
      : !Number.isInteger(litres) || litres < 0
        ? 'Litres: must be a whole number, 0 or more.'
        : max !== null && litres > max
          ? limits.data!.binding_limit === 'tanker'
            ? formatMessage('ERR-VAL-05a', { tanker: route.tanker_id, max: formatNumber(max) })
            : limits.data!.binding_limit === 'tank'
              ? formatMessage('ERR-VAL-05b', { max: formatNumber(max) })
              : formatMessage('ERR-VAL-05c', {
                  fuel: fuelName(fuel),
                  warehouse: route.home_warehouse_id,
                  max: formatNumber(max),
                })
          : null;
  const routeEdits = view.plan.kind === 'edited';
  const unchanged = litres === current.final_l;
  const shown = fieldError ?? error;

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="w-[500px]">
        <DialogTitle>
          {fuelName(fuel)} for {stop.station_id}
        </DialogTitle>
        <DialogDescription>
          {stop.station_name}, stop {stop.stop_order} of {route.tanker_id}. Recommended:{' '}
          {formatLitres(current.recommended_l)}.
        </DialogDescription>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (fieldError || unchanged || (routeEdits && !confirmed)) return;
            onSave({
              kind: 'quantity',
              expected_version: view.plan.version,
              stop_id: stop.stop_id,
              fuel_type_id: fuel,
              litres,
              ...(routeEdits ? { confirm_replace_route_edits: true } : {}),
            });
          }}
        >
          <label htmlFor={inputId} className="block text-caption font-semibold text-ink">
            Litres
          </label>
          <input
            id={inputId}
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[\s,]/g, ''))}
            aria-invalid={shown ? true : undefined}
            aria-describedby={`${hintId}${shown ? ` ${errorId}` : ''}`}
            className={cn(fieldClass, 'w-56', shown && 'border-risk-high')}
          />
          <p id={hintId} className="mt-2 text-caption text-muted">
            {limits.isPending ? (
              <Skeleton className="h-4 w-72" />
            ) : limits.data ? (
              limits.data.hint
            ) : (
              'Max for this stop: not available.'
            )}
          </p>
          {shown ? (
            <p id={errorId} role="alert" className="mt-1.5 text-caption font-medium text-risk-high">
              {shown}
            </p>
          ) : null}
          <Callout icon={Info} className="mt-5">
            Saving makes a new optimal plan with this quantity (the other stops may change).
          </Callout>
          {routeEdits ? (
            <label className="mt-3 flex items-start gap-2.5 text-body text-ink">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 accent-[var(--vz-navy-900)]"
              />
              Replace my route changes (reorders and moves) with the new optimal plan.
            </label>
          ) : null}
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Back
            </Button>
            <Button
              type="submit"
              disabled={saving || !!fieldError || unchanged || (routeEdits && !confirmed)}
            >
              {saving ? 'Saving…' : 'Save quantity'}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

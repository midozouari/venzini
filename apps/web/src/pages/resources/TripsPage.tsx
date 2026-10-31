// UI-04 Trips (UC-10, FR-79, FR-84, SM-03): estimated vs. actual departure and return per trip.
// Dispatcher: record departure, then return (or cancel a planned trip with a reason).
// Manager: read-only, with the gap between estimated and actual duration.
import { fillTemplate, type Trip } from '@venzini/contracts';
import { CalendarClock, Route as RouteIcon, X } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useMe, useTrips, useUpdateTrip } from '@/api/hooks';
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
import { Panel, PanelLabel } from '@/components/ui/panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { formatDay, formatGap, formatTime } from '@/lib/format';
import { isoToTunis, tunisToIso } from '@/lib/time';
import { cn } from '@/lib/utils';
import { useDayStore } from '@/stores/day';
import { ResourcesTabs, toRecord } from './ResourcesTabs';

type Action = { kind: 'departure' | 'return'; trip: Trip } | { kind: 'cancel'; trip: Trip };

export function TripsPage() {
  const day = useDayStore((s) => s.day);
  const trips = useTrips(day);
  const { data: me } = useMe();
  const canRecord = me?.user.role === 'dispatcher';
  const [action, setAction] = useState<Action | null>(null);
  const items = [...(trips.data?.items ?? [])].sort((a, b) =>
    a.est_departure.localeCompare(b.est_departure),
  );
  const open = toRecord(items).length;

  return (
    <ContentArea>
      <div className="flex min-h-full flex-col gap-[var(--vz-gap)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ResourcesTabs />
        </div>

        {trips.isPending ? (
          <Skeleton className="h-[420px] rounded-panel" />
        ) : trips.isError ? (
          <Panel className="mx-auto w-[520px]">
            <EmptyState icon={RouteIcon} title="The trips could not be loaded">
              {trips.error.message}
            </EmptyState>
          </Panel>
        ) : items.length === 0 ? (
          <Panel className="mx-auto w-[540px] animate-in fade-in-0 duration-200">
            <EmptyState icon={RouteIcon} title={`No trips for ${formatDay(day)}`}>
              Trips appear here once the plan for this day is decided.
            </EmptyState>
          </Panel>
        ) : (
          <>
            {open > 0 ? (
              <Callout
                icon={CalendarClock}
                role="status"
                className="animate-in fade-in-0 duration-200"
              >
                {fillTemplate('TPL-TRIP-01', { date: formatDay(day), n: open })}
              </Callout>
            ) : null}
            <Panel className="p-2" role="region" aria-label={`Trips of ${formatDay(day)}`}>
              <ul className="flex flex-col">
                {items.map((t) => (
                  <TripRow key={t.route_id} trip={t} canRecord={canRecord} onAction={setAction} />
                ))}
              </ul>
            </Panel>
          </>
        )}
      </div>

      {action?.kind === 'cancel' ? (
        <CancelDialog trip={action.trip} day={day} onClose={() => setAction(null)} />
      ) : action ? (
        <RecordDialog
          trip={action.trip}
          kind={action.kind}
          day={day}
          onClose={() => setAction(null)}
        />
      ) : null}
    </ContentArea>
  );
}

const STATUS: Record<Trip['trip_status'], { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'border border-dashed border-line-strong/70 text-ink' },
  departed: { label: 'Departed', className: 'bg-navy-tint-strong text-ink' },
  returned: { label: 'Returned', className: 'bg-navy-900 text-panel' },
  cancelled: { label: 'Cancelled', className: 'text-muted line-through' },
};

function TripRow({
  trip: t,
  canRecord,
  onAction,
}: {
  trip: Trip;
  canRecord: boolean;
  onAction: (a: Action) => void;
}) {
  const status = STATUS[t.trip_status];
  return (
    <li className="grid grid-cols-[150px_150px_minmax(0,1fr)_110px_300px] items-center gap-4 rounded-control px-4 py-4 transition-colors duration-150 hover:bg-navy-tint">
      <div>
        <p className="text-body font-semibold text-ink">
          {t.route_id} · {t.tanker_id}
        </p>
        <p className="text-caption text-muted">{t.driver.full_name}</p>
      </div>
      <div>
        <PanelLabel>Estimated</PanelLabel>
        <p className="text-body tabular-nums text-ink">
          {formatTime(t.est_departure)} → {formatTime(t.est_return)}
        </p>
      </div>
      <div>
        <PanelLabel>Actual</PanelLabel>
        <p className="text-body tabular-nums text-ink">
          {t.actual_departure ? formatTime(t.actual_departure) : '–'} →{' '}
          {t.actual_return ? formatTime(t.actual_return) : '–'}
        </p>
        {t.time_gap_min !== null ? (
          <p className="text-caption font-medium text-ink">
            Gap {formatGap(t.time_gap_min, t.time_gap_pct)}
          </p>
        ) : null}
        {t.cancel_reason ? (
          <p className="text-caption text-muted">Reason: {t.cancel_reason}</p>
        ) : null}
      </div>
      <span
        className={cn(
          'justify-self-start rounded-full px-3 py-1 text-caption font-semibold',
          status.className,
        )}
      >
        {status.label}
      </span>
      <div className="flex justify-end gap-2">
        {canRecord && t.trip_status === 'planned' ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onAction({ kind: 'cancel', trip: t })}
            >
              <X aria-hidden /> Cancel trip
            </Button>
            <Button size="sm" onClick={() => onAction({ kind: 'departure', trip: t })}>
              Record departure
            </Button>
          </>
        ) : null}
        {canRecord && t.trip_status === 'departed' ? (
          <>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => onAction({ kind: 'departure', trip: t })}
            >
              Correct departure
            </Button>
            <Button size="sm" onClick={() => onAction({ kind: 'return', trip: t })}>
              Record return
            </Button>
          </>
        ) : null}
      </div>
    </li>
  );
}

function RecordDialog({
  trip,
  kind,
  day,
  onClose,
}: {
  trip: Trip;
  kind: 'departure' | 'return';
  day: string;
  onClose: () => void;
}) {
  const update = useUpdateTrip(day);
  const start = isoToTunis(
    kind === 'departure' ? (trip.actual_departure ?? trip.est_departure) : trip.est_return,
  );
  const [date, setDate] = useState(start.day);
  const [time, setTime] = useState(start.time);
  const field = kind === 'departure' ? 'actual_departure' : 'actual_return';
  const err = update.error instanceof ApiError ? update.error : null;
  const word = kind === 'departure' ? 'departure' : 'return';

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>
          Record the {word} of {trip.route_id}
        </DialogTitle>
        <DialogDescription>
          Tanker {trip.tanker_id} · driver {trip.driver.full_name} · estimated {word}{' '}
          {formatTime(kind === 'departure' ? trip.est_departure : trip.est_return)}. Times are in
          Tunis time.
        </DialogDescription>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { routeId: trip.route_id, body: { [field]: tunisToIso(date, time) } },
              { onSuccess: onClose },
            );
          }}
        >
          <div className="flex gap-4">
            <label className="flex-1 text-caption font-semibold text-ink">
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-control border border-line-strong bg-panel px-3 text-body tabular-nums text-ink focus:border-navy-900 focus:outline-none"
              />
            </label>
            <label className="w-40 text-caption font-semibold text-ink">
              Time
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="mt-1.5 h-12 w-full rounded-control border border-line-strong bg-panel px-3 text-body tabular-nums text-ink focus:border-navy-900 focus:outline-none"
              />
            </label>
          </div>
          {err ? (
            <p role="alert" className="mt-3 text-caption font-medium text-risk-high">
              {err.message}
            </p>
          ) : null}
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
              Back
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : `Record ${word}`}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({ trip, day, onClose }: { trip: Trip; day: string; onClose: () => void }) {
  const update = useUpdateTrip(day);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const missing = reason.trim() === '';

  return (
    <Dialog open onOpenChange={(o) => !o && !update.isPending && onClose()}>
      <DialogContent>
        <DialogTitle>Cancel trip {trip.route_id}?</DialogTitle>
        <DialogDescription>
          {trip.tanker_id} will not leave for this trip. This cannot be undone.
        </DialogDescription>
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            setTouched(true);
            if (missing) return;
            update.mutate(
              { routeId: trip.route_id, body: { cancel: true, reason: reason.trim() } },
              { onSuccess: onClose },
            );
          }}
        >
          <label className="text-caption font-semibold text-ink" htmlFor="cancel-reason">
            Reason
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={touched && missing ? true : undefined}
            className="mt-1.5 w-full rounded-control border border-line-strong bg-panel px-4 py-3 text-body text-ink focus:border-navy-900 focus:outline-none"
          />
          {touched && missing ? (
            <p role="alert" className="mt-1.5 text-caption font-medium text-risk-high">
              Reason is required.
            </p>
          ) : null}
          {update.error ? (
            <p role="alert" className="mt-3 text-caption font-medium text-risk-high">
              {update.error.message}
            </p>
          ) : null}
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
              Keep the trip
            </Button>
            <Button type="submit" variant="secondary" disabled={update.isPending}>
              <X aria-hidden />
              {update.isPending ? 'Cancelling…' : 'Cancel trip'}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

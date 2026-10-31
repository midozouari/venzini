// UI-04 Resources (UC-02, FR-07 to FR-09, FR-11, FR-13): the day's tankers, drivers and stock.
// Dispatcher: one main action, "Save resources", with a confirmation listing every change.
// Manager: the same information, read-only (FR-04). Locked once the day's plan is decided (BR-30).
import { formatMessage, type Resources, type SaveResourcesResponse } from '@venzini/contracts';
import { CircleCheck, Lock, Route as RouteIcon, TriangleAlert, Truck } from 'lucide-react';
import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useMe, useReference, useResources, useSaveResources } from '@/api/hooks';
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
import { Switch } from '@/components/ui/switch';
import {
  changesOf,
  draftOf,
  requestOf,
  stockError,
  stockKey,
  type Draft,
} from '@/features/resources/draft';
import { formatDay, formatInstant, formatLitres, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useDayStore } from '@/stores/day';
import { ResourcesTabs } from './ResourcesTabs';

export function ResourcesPage() {
  const day = useDayStore((s) => s.day);
  const resources = useResources(day);
  const { data: me } = useMe();
  const r = resources.data;
  // Kept here: the form remounts with the new version after a save.
  const [saved, setSaved] = useState<{ day: string; response: SaveResourcesResponse } | null>(null);

  return (
    <ContentArea>
      <div className="flex min-h-full flex-col gap-[var(--vz-gap)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ResourcesTabs />
          {r ? (
            <p className="rounded-full bg-panel px-4 py-2 text-caption text-ink shadow-panel">
              Last updated by <span className="font-semibold">{r.updated_by.full_name}</span>,{' '}
              {formatInstant(r.updated_at)} · version {r.version_no}
            </p>
          ) : null}
        </div>

        {resources.isPending ? (
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] gap-[var(--vz-gap)]">
            <Skeleton className="h-[420px] rounded-panel" />
            <Skeleton className="h-[420px] rounded-panel" />
          </div>
        ) : resources.isError ? (
          <Panel className="mx-auto w-[520px]">
            <EmptyState icon={Truck} title="The resources could not be loaded">
              {resources.error.message}
            </EmptyState>
          </Panel>
        ) : !r ? (
          <Panel className="mx-auto w-[520px] animate-in fade-in-0 duration-200">
            <EmptyState icon={Truck} title="No resources uploaded for this day">
              Resources for {formatDay(day)} have not been entered yet.
            </EmptyState>
          </Panel>
        ) : (
          <ResourcesForm
            key={`${day}-${r.resource_version_id}`}
            resources={r}
            editable={me?.user.role === 'dispatcher' && !r.locked}
            saved={saved?.day === day ? saved.response : null}
            onSaved={(response) => setSaved({ day, response })}
          />
        )}
      </div>
    </ContentArea>
  );
}

function ResourcesForm({
  resources: r,
  editable,
  saved,
  onSaved,
}: {
  resources: Resources;
  editable: boolean;
  saved: SaveResourcesResponse | null;
  onSaved: (response: SaveResourcesResponse) => void;
}) {
  const reference = useReference();
  const save = useSaveResources(r.delivery_day);
  const [draft, setDraft] = useState<Draft>(() => draftOf(r));
  const [confirming, setConfirming] = useState(false);
  const [serverFieldError, setServerFieldError] = useState<{ key: string; message: string } | null>(
    null,
  );

  const warehouse = (id: string) =>
    reference.data?.warehouses.find((w) => w.warehouse_id === id)?.name ?? id;
  const fuel = (id: string) =>
    reference.data?.fuel_types.find((f) => f.fuel_type_id === id)?.name ?? id;
  const fuels = [...(reference.data?.fuel_types ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const changes = changesOf(r, draft, { warehouse, fuel });
  const errors = Object.fromEntries(
    Object.entries(draft.stock)
      .map(
        ([k, v]) =>
          [
            k,
            stockError(v) ?? (serverFieldError?.key === k ? serverFieldError.message : null),
          ] as const,
      )
      .filter(([, e]) => e),
  );
  const hasErrors = Object.keys(errors).length > 0;
  const result = saved;

  const submit = () =>
    save.mutate(requestOf(r, draft), {
      onSuccess: (response) => {
        setConfirming(false);
        onSaved(response);
      },
      onError: (e) => {
        // A field named by the server (e.g. stock[2].stock_l) is shown under that field.
        const match = e instanceof ApiError ? /^stock\[(\d+)\]/.exec(e.field ?? '') : null;
        const row = match ? r.stock[Number(match[1])] : undefined;
        if (row && e instanceof ApiError) {
          setServerFieldError({
            key: stockKey(row.warehouse_id, row.fuel_type_id),
            message: e.message,
          });
          setConfirming(false);
        }
      },
    });

  const available = (map: Record<string, boolean>) => Object.values(map).filter(Boolean).length;

  return (
    <>
      {r.locked ? (
        <Callout
          icon={Lock}
          tone="strong"
          role="status"
          className="animate-in fade-in-0 duration-200"
        >
          {formatMessage('ERR-VAL-04', { day: formatDay(r.delivery_day) })}
        </Callout>
      ) : null}
      {result ? (
        <Callout
          icon={CircleCheck}
          role="status"
          title={`Saved as version ${result.version_no}.`}
          className="animate-in fade-in-0 duration-200"
        >
          {result.warnings.length > 0 ? (
            <ul className="mt-1 flex flex-col gap-1">
              {result.warnings.map((w) => (
                <li key={w.tanker_id} className="flex items-start gap-2">
                  <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {w.message}
                </li>
              ))}
            </ul>
          ) : (
            'The plan of this day will use these resources.'
          )}
        </Callout>
      ) : null}

      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-start gap-[var(--vz-gap)]">
        <Panel className="p-6" role="region" aria-label="Tankers">
          <PanelLabel>Tankers</PanelLabel>
          <h2 className="text-section text-ink">
            {available(draft.tankers)} of {r.tankers.length} available
          </h2>
          <ul className="mt-4 flex flex-col">
            {r.tankers.map((t) => {
              const on = draft.tankers[t.tanker_id] ?? t.available;
              return (
                <li key={t.tanker_id} className="border-t border-line py-3 first:border-t-0">
                  <div className="flex items-center gap-4">
                    <div className="w-14 text-body font-semibold text-ink">{t.tanker_id}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body text-ink tabular-nums">
                        {formatLitres(t.capacity_l)}
                      </p>
                      <p className="flex flex-wrap items-center gap-1 text-caption text-muted">
                        {t.compartments.map((c, i) => (
                          <span key={i} className="rounded-full bg-cream px-2 tabular-nums">
                            {formatNumber(c)}
                          </span>
                        ))}
                        <span className="ml-1">· {warehouse(t.home_warehouse_id)}</span>
                      </p>
                    </div>
                    {editable ? (
                      <Switch
                        checked={on}
                        label={`${t.tanker_id} available`}
                        onChange={(v) =>
                          setDraft((d) => ({ ...d, tankers: { ...d.tankers, [t.tanker_id]: v } }))
                        }
                      />
                    ) : (
                      <AvailabilityText on={on} />
                    )}
                  </div>
                  {t.open_trip ? (
                    <p
                      className={cn(
                        'mt-2 flex items-start gap-2 rounded-control px-3 py-2 text-caption text-ink',
                        on && !t.available ? 'bg-navy-tint-strong font-medium' : 'bg-navy-tint',
                      )}
                    >
                      <RouteIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                      {formatMessage('WARN-RES-01', {
                        tanker: t.tanker_id,
                        trip: t.open_trip.route_id,
                      })}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>

        <div className="flex flex-col gap-[var(--vz-gap)]">
          <Panel className="p-6" role="region" aria-label="Warehouse stock">
            <PanelLabel>Warehouse stock</PanelLabel>
            <table className="mt-2 w-full text-body">
              <thead>
                <tr className="text-left text-caption text-muted">
                  <th scope="col" className="pb-2 font-medium">
                    Warehouse
                  </th>
                  {fuels.map((f) => (
                    <th
                      key={f.fuel_type_id}
                      scope="col"
                      className="pb-2 pl-3 text-right font-medium"
                    >
                      {f.name} (L)
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Set(r.stock.map((s) => s.warehouse_id))].map((wh) => (
                  <tr key={wh} className="border-t border-line align-top">
                    <th scope="row" className="py-2.5 pr-2 text-left font-medium text-ink">
                      {warehouse(wh)}
                    </th>
                    {fuels.map((f) => {
                      const k = stockKey(wh, f.fuel_type_id);
                      if (!(k in draft.stock)) return <td key={k} />;
                      const err = errors[k];
                      return (
                        <td key={k} className="py-2 pl-3 text-right">
                          {editable ? (
                            <>
                              <input
                                inputMode="numeric"
                                aria-label={`Stock, ${warehouse(wh)}, ${f.name}, litres`}
                                aria-invalid={err ? true : undefined}
                                value={draft.stock[k]}
                                onChange={(e) => {
                                  setServerFieldError(null);
                                  const v = e.target.value;
                                  setDraft((d) => ({ ...d, stock: { ...d.stock, [k]: v } }));
                                }}
                                className={cn(
                                  'h-10 w-32 rounded-control border bg-panel px-3 text-right text-body tabular-nums text-ink transition-[border-color,box-shadow] duration-150 ease-vz focus:border-navy-900 focus:shadow-[0_0_0_4px_var(--vz-navy-tint-strong)] focus:outline-none',
                                  err ? 'border-risk-high' : 'border-line-strong',
                                )}
                              />
                              {err ? (
                                <p
                                  role="alert"
                                  className="mt-1 max-w-32 text-left text-caption font-medium text-risk-high"
                                >
                                  {err}
                                </p>
                              ) : null}
                            </>
                          ) : (
                            <span className="tabular-nums">
                              {formatLitres(Number(draft.stock[k]))}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
          <Panel className="p-6" role="region" aria-label="Drivers">
            <PanelLabel>Drivers</PanelLabel>
            <h2 className="text-section text-ink">
              {available(draft.drivers)} of {r.drivers.length} available
            </h2>
            <ul className="mt-3 flex flex-col">
              {r.drivers.map((d) => {
                const on = draft.drivers[d.driver_id] ?? d.available;
                return (
                  <li
                    key={d.driver_id}
                    className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-body font-medium text-ink">{d.full_name}</p>
                      <p className="text-caption text-muted">
                        {d.driver_id} · {warehouse(d.home_warehouse_id)}
                      </p>
                    </div>
                    {editable ? (
                      <Switch
                        checked={on}
                        label={`${d.full_name} available`}
                        onChange={(v) =>
                          setDraft((x) => ({ ...x, drivers: { ...x.drivers, [d.driver_id]: v } }))
                        }
                      />
                    ) : (
                      <AvailabilityText on={on} />
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      {editable ? (
        <Panel className="sticky bottom-0 z-20 flex items-center justify-between gap-4 px-6 py-4 shadow-float">
          <p className="text-body text-ink" aria-live="polite">
            {changes.length === 0
              ? 'No changes yet.'
              : `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} not saved yet.`}
          </p>
          <Button
            size="lg"
            disabled={changes.length === 0 || hasErrors}
            onClick={() => {
              save.reset();
              setConfirming(true);
            }}
          >
            Save resources
          </Button>
        </Panel>
      ) : null}

      <Dialog open={confirming} onOpenChange={(o) => !save.isPending && setConfirming(o)}>
        <DialogContent className="w-[540px]">
          <DialogTitle>Save the resources for {formatDay(r.delivery_day)}?</DialogTitle>
          <DialogDescription>
            A new version is saved; the next plan for this day will use it.
          </DialogDescription>
          <ul className="mt-5 flex flex-col divide-y divide-line rounded-control border border-line">
            {changes.map((c) => (
              <li key={c.label} className="px-4 py-3">
                <p className="flex items-center justify-between gap-4 text-body">
                  <span className="font-semibold text-ink">{c.label}</span>
                  <span className="text-muted">
                    {c.from} → <span className="font-semibold text-ink">{c.to}</span>
                  </span>
                </p>
                {c.openTrip ? (
                  <p className="mt-2 flex items-start gap-2 text-caption text-ink">
                    <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                    {c.openTrip}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {save.isError ? (
            <p
              role="alert"
              className="mt-4 rounded-control bg-navy-tint px-4 py-3 text-body text-ink"
            >
              {save.error.message}
            </p>
          ) : null}
          <DialogActions>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={save.isPending}
            >
              Keep editing
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save resources'}
            </Button>
          </DialogActions>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AvailabilityText({ on }: { on: boolean }) {
  return (
    <span className={cn('text-caption font-semibold', on ? 'text-ink' : 'text-muted')}>
      {on ? 'Available' : 'Not available'}
    </span>
  );
}

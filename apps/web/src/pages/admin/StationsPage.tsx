// UI-08 Administration, Stations tab (UC-11; FR-06, D-15): admin and operations manager create,
// edit, deactivate and reactivate stations, with tanks per fuel type and the delivery window.
// The mock API checks every rule (SRS 8.1) and names the field; this screen only shows the answer.
import type { CreateStationRequest, Station, UpdateStationRequest } from '@venzini/contracts';
import { Building2, MapPinPlus, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useCreateStation, useReference, useStations, useUpdateStation } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogActions, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SelectField, TextField } from '@/components/ui/field';
import { Panel } from '@/components/ui/panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import {
  AdminTabs,
  ConfirmDialog,
  formErrors,
  FormError,
  RecordStatusChip,
  ResultNote,
  type Result,
} from '@/features/admin/parts';
import { useFuelName } from '@/features/planner/parts';
import { cn } from '@/lib/utils';

type Action =
  | { kind: 'create' }
  | { kind: 'edit'; station: Station }
  | { kind: 'deactivate'; station: Station };

export function StationsPage() {
  const stations = useStations();
  const reference = useReference();
  const update = useUpdateStation();
  const fuelName = useFuelName();
  const [action, setAction] = useState<Action | null>(null);
  const [result, setResult] = useState<Result>(null);
  const items = [...(stations.data?.items ?? [])].sort((a, b) =>
    a.station_id.localeCompare(b.station_id),
  );
  const warehouseName = (id: string | null) =>
    reference.data?.warehouses.find((w) => w.warehouse_id === id)?.name ?? id;

  const open = (a: Action) => {
    setResult(null);
    setAction(a);
  };
  const done = (text: string) => {
    setAction(null);
    setResult({ tone: 'status', text });
  };

  const reactivate = (s: Station) => {
    setResult(null);
    update.mutate(
      { id: s.station_id, body: { status: 'active' } },
      {
        onSuccess: () =>
          setResult({ tone: 'status', text: `${s.station_id} ${s.name} is active again.` }),
        onError: (e) => setResult({ tone: 'alert', text: e.message }),
      },
    );
  };

  return (
    <ContentArea>
      <div className="flex min-h-full flex-col gap-[var(--vz-gap)]">
        <div>
          <AdminTabs />
        </div>

        <ResultNote result={result} />

        {stations.isPending ? (
          <Skeleton className="h-[460px] rounded-panel" />
        ) : stations.isError ? (
          <Panel className="mx-auto mt-6 w-[520px]">
            <EmptyState
              icon={Building2}
              title="The stations could not be loaded"
              action={<Button onClick={() => stations.refetch()}>Try again</Button>}
            >
              {stations.error.message}
            </EmptyState>
          </Panel>
        ) : (
          <Panel
            className="p-2 animate-in fade-in-0 duration-200"
            role="region"
            aria-label="Stations"
          >
            <div className="flex items-center justify-between gap-4 px-4 pb-2 pt-3">
              <p className="text-body text-muted">
                Tanks, safety stock and delivery windows of every station.
              </p>
              <Button onClick={() => open({ kind: 'create' })}>
                <MapPinPlus aria-hidden /> New station
              </Button>
            </div>
            <table className="w-full table-fixed border-separate border-spacing-0 text-left">
              <colgroup>
                <col className="w-[80px]" />
                <col className="w-[210px]" />
                <col className="w-[120px]" />
                <col className="w-[150px]" />
                <col />
                <col className="w-[100px]" />
                <col className="w-[230px]" />
              </colgroup>
              <thead>
                <tr>
                  {['ID', 'Name', 'Window', 'Warehouse', 'Tanks', 'Status', ''].map((c, i) => (
                    <th
                      key={c || i}
                      scope="col"
                      className="border-b border-line px-3 pb-3 pt-2 text-caption font-medium text-muted first:pl-4"
                    >
                      {c || <span className="sr-only">Actions</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const cell = 'px-3 py-3 align-middle text-body text-ink';
                  const label = `${s.station_id} ${s.name}`;
                  return (
                    <tr
                      key={s.station_id}
                      className={cn(
                        'transition-[background-color] duration-150 ease-vz hover:bg-navy-tint [&>td:first-child]:rounded-l-control [&>td:last-child]:rounded-r-control',
                        s.status === 'inactive' && '[&>td:not(:last-child)]:text-muted',
                      )}
                    >
                      <td className={cn(cell, 'pl-4 font-semibold')}>{s.station_id}</td>
                      <td className={cell}>
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="truncate text-caption text-muted">{s.region}</p>
                      </td>
                      <td className={cn(cell, 'tabular-nums')}>
                        {s.window_open}–{s.window_close}
                      </td>
                      <td className={cn(cell, 'truncate')}>
                        {s.serving_warehouse_id ? (
                          warehouseName(s.serving_warehouse_id)
                        ) : (
                          <span className="text-muted">None yet</span>
                        )}
                      </td>
                      <td className={cn(cell, 'truncate')}>
                        {s.tanks.map((t) => fuelName(t.fuel_type_id)).join(' · ')}
                      </td>
                      <td className={cell}>
                        <RecordStatusChip status={s.status} />
                      </td>
                      <td className={cn(cell, 'pr-4')}>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Edit ${label}`}
                            onClick={() => open({ kind: 'edit', station: s })}
                          >
                            <Pencil aria-hidden /> Edit
                          </Button>
                          {s.status === 'active' ? (
                            <Button
                              variant="quiet"
                              size="sm"
                              aria-label={`Deactivate ${label}`}
                              onClick={() => open({ kind: 'deactivate', station: s })}
                            >
                              <X aria-hidden /> Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="quiet"
                              size="sm"
                              aria-label={`Reactivate ${label}`}
                              disabled={update.isPending}
                              onClick={() => reactivate(s)}
                            >
                              <RotateCcw aria-hidden /> Reactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        )}
      </div>

      {action?.kind === 'deactivate' ? (
        <DeactivateDialog station={action.station} onClose={() => setAction(null)} onDone={done} />
      ) : action ? (
        <StationDialog
          station={action.kind === 'edit' ? action.station : null}
          onClose={() => setAction(null)}
          onDone={done}
        />
      ) : null}
    </ContentArea>
  );
}

/** A tank row as typed: text until it is sent, so an empty box stays empty. */
interface TankDraft {
  key: number;
  fuel_type_id: string;
  capacity_l: string;
  safety_stock_l: string;
  current_level_l: string;
}

const toNumber = (v: string) => (v.trim() === '' ? undefined : Number(v));
const toText = (n: number | null) => (n === null ? '' : String(n));

function StationDialog({
  station,
  onClose,
  onDone,
}: {
  station: Station | null;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const reference = useReference();
  const create = useCreateStation();
  const update = useUpdateStation();
  const mutation = station ? update : create;
  const fuels = [...(reference.data?.fuel_types ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const regions = reference.data?.regions ?? [];

  const [id, setId] = useState(station?.station_id ?? '');
  const [name, setName] = useState(station?.name ?? '');
  const [region, setRegion] = useState(station?.region ?? '');
  const [latitude, setLatitude] = useState(station ? String(station.latitude) : '');
  const [longitude, setLongitude] = useState(station ? String(station.longitude) : '');
  const [windowOpen, setWindowOpen] = useState(station?.window_open ?? '06:00');
  const [windowClose, setWindowClose] = useState(station?.window_close ?? '18:00');
  const [nextKey, setNextKey] = useState(station?.tanks.length ?? 1);
  const [tanks, setTanks] = useState<TankDraft[]>(
    station
      ? station.tanks.map((t, i) => ({
          key: i,
          fuel_type_id: t.fuel_type_id,
          capacity_l: toText(t.capacity_l),
          safety_stock_l: toText(t.safety_stock_l),
          current_level_l: toText(t.current_level_l),
        }))
      : [{ key: 0, fuel_type_id: '', capacity_l: '', safety_stock_l: '', current_level_l: '' }],
  );
  const { fields, form } = formErrors(mutation.error);
  const regionOptions = region && !regions.includes(region) ? [region, ...regions] : regions;
  const unusedFuel = fuels.find((f) => !tanks.some((t) => t.fuel_type_id === f.fuel_type_id));

  const setTank = (key: number, change: Partial<TankDraft>) =>
    setTanks((list) => list.map((t) => (t.key === key ? { ...t, ...change } : t)));

  const tankBody = () =>
    tanks.map((t) => ({
      fuel_type_id: t.fuel_type_id,
      capacity_l: toNumber(t.capacity_l),
      safety_stock_l: toNumber(t.safety_stock_l),
      current_level_l: toNumber(t.current_level_l),
    }));

  const submit = () => {
    const values = {
      name,
      region,
      latitude: toNumber(latitude),
      longitude: toNumber(longitude),
      window_open: windowOpen,
      window_close: windowClose,
    };
    if (!station) {
      // Sent as typed: the API validates and names the field (ERR-VAL-01/02/03).
      const body = { station_id: id, ...values, tanks: tankBody() };
      create.mutate(body as unknown as CreateStationRequest, {
        onSuccess: (s) =>
          onDone(
            `Station ${s.station_id} ${s.name} created.${
              s.serving_warehouse_id
                ? ''
                : ' It has no serving warehouse yet, because no road distances are known for it.'
            }`,
          ),
      });
      return;
    }
    // Only what changed is sent (PATCH accepts any subset, API-05).
    const before: Record<string, unknown> = {
      name: station.name,
      region: station.region,
      latitude: station.latitude,
      longitude: station.longitude,
      window_open: station.window_open,
      window_close: station.window_close,
    };
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(values)) if (v !== before[k]) body[k] = v;
    const original = station.tanks.map((t) => ({
      fuel_type_id: t.fuel_type_id,
      capacity_l: t.capacity_l,
      safety_stock_l: t.safety_stock_l,
      current_level_l: t.current_level_l ?? undefined,
    }));
    if (JSON.stringify(tankBody()) !== JSON.stringify(original)) body['tanks'] = tankBody();
    if (Object.keys(body).length === 0) return onClose();
    update.mutate(
      { id: station.station_id, body: body as UpdateStationRequest },
      { onSuccess: (s) => onDone(`Changes to ${s.station_id} ${s.name} saved.`) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !mutation.isPending && onClose()}>
      <DialogContent
        className="max-h-[calc(100vh-48px)] w-[760px] overflow-y-auto"
        aria-describedby={undefined}
      >
        <DialogTitle>
          {station ? `Edit ${station.station_id} ${station.name}` : 'New station'}
        </DialogTitle>
        <form
          noValidate
          className="mt-6 flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-[160px_1fr_1fr] gap-4">
            <TextField
              label="Station ID"
              name="station_id"
              value={id}
              maxLength={12}
              placeholder="ST021"
              autoComplete="off"
              disabled={!!station}
              onChange={(e) => setId(e.target.value.toUpperCase())}
              error={fields['station_id']}
            />
            <TextField
              label="Name"
              name="name"
              value={name}
              maxLength={80}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              error={fields['name']}
            />
            <SelectField
              label="Region"
              name="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              error={fields['region']}
            >
              <option value="">Choose a region</option>
              {regionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <TextField
              label="Latitude"
              name="latitude"
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              error={fields['latitude']}
            />
            <TextField
              label="Longitude"
              name="longitude"
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              error={fields['longitude']}
            />
            <TextField
              label="Window opens"
              name="window_open"
              type="time"
              value={windowOpen}
              onChange={(e) => setWindowOpen(e.target.value)}
              error={fields['window_open']}
            />
            <TextField
              label="Window closes"
              name="window_close"
              type="time"
              value={windowClose}
              onChange={(e) => setWindowClose(e.target.value)}
              error={fields['window_close']}
            />
          </div>

          <fieldset className="rounded-panel bg-cream p-4">
            <legend className="float-left mb-3 w-full text-body font-semibold text-ink">
              Tanks per fuel type
            </legend>
            <div className="clear-both flex flex-col gap-3">
              {tanks.map((t, i) => {
                const fuel = t.fuel_type_id
                  ? (fuels.find((f) => f.fuel_type_id === t.fuel_type_id)?.name ?? t.fuel_type_id)
                  : `tank ${i + 1}`;
                return (
                  <div
                    key={t.key}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr_40px] items-start gap-3"
                  >
                    <SelectField
                      label="Fuel type"
                      id={`tanks[${i}].fuel_type_id`}
                      value={t.fuel_type_id}
                      onChange={(e) => setTank(t.key, { fuel_type_id: e.target.value })}
                      error={fields[`tanks[${i}].fuel_type_id`]}
                    >
                      <option value="">Choose</option>
                      {fuels.map((f) => (
                        <option
                          key={f.fuel_type_id}
                          value={f.fuel_type_id}
                          disabled={tanks.some(
                            (x) => x.key !== t.key && x.fuel_type_id === f.fuel_type_id,
                          )}
                        >
                          {f.name}
                        </option>
                      ))}
                    </SelectField>
                    <TextField
                      label="Capacity (L)"
                      id={`tanks[${i}].capacity_l`}
                      type="number"
                      min={0}
                      step={100}
                      value={t.capacity_l}
                      onChange={(e) => setTank(t.key, { capacity_l: e.target.value })}
                      error={fields[`tanks[${i}].capacity_l`]}
                    />
                    <TextField
                      label="Safety stock (L)"
                      id={`tanks[${i}].safety_stock_l`}
                      type="number"
                      min={0}
                      step={100}
                      value={t.safety_stock_l}
                      onChange={(e) => setTank(t.key, { safety_stock_l: e.target.value })}
                      error={fields[`tanks[${i}].safety_stock_l`]}
                    />
                    <TextField
                      label="Current level (L)"
                      id={`tanks[${i}].current_level_l`}
                      type="number"
                      min={0}
                      step={100}
                      value={t.current_level_l}
                      onChange={(e) => setTank(t.key, { current_level_l: e.target.value })}
                      error={fields[`tanks[${i}].current_level_l`]}
                    />
                    <Button
                      variant="quiet"
                      size="icon"
                      className="mt-[26px]"
                      aria-label={`Remove the ${fuel} tank`}
                      disabled={tanks.length === 1}
                      onClick={() => setTanks((list) => list.filter((x) => x.key !== t.key))}
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                );
              })}
            </div>
            {fields['tanks'] ? (
              <p className="mt-2 text-caption font-medium text-risk-high">{fields['tanks']}</p>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              disabled={!unusedFuel || tanks.length >= fuels.length}
              onClick={() => {
                setTanks((list) => [
                  ...list,
                  {
                    key: nextKey,
                    fuel_type_id: unusedFuel?.fuel_type_id ?? '',
                    capacity_l: '',
                    safety_stock_l: '',
                    current_level_l: '',
                  },
                ]);
                setNextKey((k) => k + 1);
              }}
            >
              <Plus aria-hidden /> Add a tank
            </Button>
          </fieldset>

          <FormError message={form} />
          <DialogActions>
            <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>
              Back
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : station ? 'Save changes' : 'Create station'}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeactivateDialog({
  station,
  onClose,
  onDone,
}: {
  station: Station;
  onClose: () => void;
  onDone: (text: string) => void;
}) {
  const update = useUpdateStation();
  const label = `${station.station_id} ${station.name}`;
  return (
    <ConfirmDialog
      title={`Deactivate ${label}?`}
      confirm="Deactivate"
      icon={X}
      pending={update.isPending}
      error={update.error?.message}
      onClose={onClose}
      onConfirm={() =>
        update.mutate(
          { id: station.station_id, body: { status: 'inactive' } },
          { onSuccess: () => onDone(`${label} is deactivated.`) },
        )
      }
    >
      The station no longer appears on the network map. Its record and past decisions are kept, and
      you can reactivate it later.
    </ConfirmDialog>
  );
}

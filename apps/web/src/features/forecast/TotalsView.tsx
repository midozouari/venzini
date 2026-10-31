// FR-85 totals: network total, or per warehouse as small multiples sharing one scale. Totals are
// sums made by the API; the browser only draws them.
import type { ForecastTotals } from '@venzini/contracts';
import { CircleCheck, LineChart, ListX } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useReference, useTotals } from '@/api/hooks';
import { Callout } from '@/components/ui/callout';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { Segmented } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChartLegend, LineBandChart } from '@/features/charts/LineBandChart';
import { formatDayLong, formatLitres, formatNumber } from '@/lib/format';

type Level = 'network' | 'warehouse';
type Day = ForecastTotals['groups'][number]['days'][number];

const toBand = (days: Day[]) =>
  days.map((d) => ({ date: d.date, value: d.total_l, low: d.band_low, high: d.band_high }));

function TotalsTable({ days, caption }: { days: Day[]; caption: string }) {
  return (
    <div className="overflow-auto rounded-control border border-line">
      <table className="w-full text-body">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-caption text-muted">
            <th scope="col" className="px-4 py-2 font-medium">
              Day
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Total
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              80% range
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              From uncertain forecasts
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {days.map((d) => (
            <tr key={d.date} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
                {formatDayLong(d.date)}
              </th>
              <td className="px-4 py-2 text-right font-semibold">{formatLitres(d.total_l)}</td>
              <td className="px-4 py-2 text-right">
                {formatNumber(d.band_low)}–{formatNumber(d.band_high)} L
              </td>
              <td className="px-4 py-2 text-right">{d.uncertain_share_pct.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const shareOf = (days: Day[]) => (date: string) => {
  const d = days.find((x) => x.date === date);
  return d ? (
    <p className="flex justify-between gap-4 tabular-nums">
      <span className="text-muted">From uncertain forecasts</span>
      <span>{d.uncertain_share_pct.toFixed(1)}%</span>
    </p>
  ) : null;
};

export function TotalsView({ levels, header }: { levels: Level[]; header?: ReactNode }) {
  const reference = useReference();
  const fuels = [...(reference.data?.fuel_types ?? [])].sort(
    (a, b) => a.display_order - b.display_order,
  );
  const [fuel, setFuel] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>(levels[0]!);
  const [asTable, setAsTable] = useState(false);
  const fuelId = fuel ?? fuels[0]?.fuel_type_id ?? null;
  const totals = useTotals(level, fuelId);
  const fuelName = fuels.find((f) => f.fuel_type_id === fuelId)?.name ?? '';
  const warehouseName = (id: string | null) =>
    reference.data?.warehouses.find((w) => w.warehouse_id === id)?.name ?? id ?? '';

  const groups = totals.data?.groups ?? [];
  // Small multiples share one scale, so the warehouses can be compared at a glance.
  const yMax = Math.max(1, ...groups.flatMap((g) => g.days.map((d) => d.band_high)));

  return (
    <div className="flex flex-col gap-[var(--vz-gap)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {header}
        <Panel className="flex items-center gap-3 rounded-full px-2 py-2 shadow-panel">
          {fuelId ? (
            <Segmented
              label="Fuel type"
              value={fuelId}
              options={fuels.map((f) => ({ value: f.fuel_type_id, label: f.name }))}
              onChange={setFuel}
            />
          ) : null}
          {levels.length > 1 ? (
            <Segmented
              label="Level"
              value={level}
              options={[
                { value: 'network', label: 'Network' },
                { value: 'warehouse', label: 'By warehouse' },
              ]}
              onChange={setLevel}
            />
          ) : null}
          <Button
            variant="quiet"
            size="sm"
            aria-pressed={asTable}
            onClick={() => setAsTable((v) => !v)}
          >
            {asTable ? 'Show as chart' : 'Show as table'}
          </Button>
        </Panel>
      </div>

      {totals.isPending ? (
        <Skeleton className="h-[420px] rounded-panel" />
      ) : totals.isError ? (
        <Panel className="mx-auto w-[520px]">
          <EmptyState icon={LineChart} title="The totals could not be loaded">
            {totals.error.message}
          </EmptyState>
        </Panel>
      ) : (
        <>
          <div
            key={`${level}-${fuelId}-${asTable}`}
            className={
              level === 'network'
                ? 'animate-in fade-in-0 duration-200'
                : 'grid grid-cols-3 gap-[var(--vz-gap)] animate-in fade-in-0 duration-200'
            }
          >
            {groups.map((g) => {
              const name = g.warehouse_id ? warehouseName(g.warehouse_id) : 'All stations';
              const caption = `${fuelName} forecast total, ${name}`;
              return (
                <Panel
                  key={g.warehouse_id ?? 'network'}
                  className="p-5"
                  role="region"
                  aria-label={caption}
                >
                  <PanelLabel>
                    {level === 'network' ? `Network · ${fuelName}` : fuelName} · litres per day
                  </PanelLabel>
                  <h2 className="text-section text-ink">{name}</h2>
                  <p className="mt-1 text-body text-muted">
                    Tomorrow{' '}
                    <span className="font-semibold text-ink">
                      {formatLitres(g.days[0]?.total_l ?? 0)}
                    </span>
                  </p>
                  <div className="mt-4">
                    {asTable ? (
                      <TotalsTable days={g.days} caption={caption} />
                    ) : (
                      <LineBandChart
                        label={`7-day ${caption}`}
                        forecast={toBand(g.days)}
                        yMax={level === 'warehouse' ? yMax : undefined}
                        height={level === 'network' ? 300 : 220}
                        compact={level === 'warehouse'}
                        details={shareOf(g.days)}
                      />
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            {!asTable ? (
              <Panel className="rounded-full px-5 py-2.5 shadow-panel">
                <ChartLegend actuals={false} />
              </Panel>
            ) : (
              <span />
            )}
            {totals.data && totals.data.excluded.length > 0 ? (
              <Callout icon={ListX} title={`${totals.data.excluded.length} stations not included`}>
                {totals.data.excluded.map((e) => `${e.station_id}: ${e.reason}`).join(' · ')}
              </Callout>
            ) : (
              <p className="flex items-center gap-2 rounded-full bg-panel px-4 py-2 text-caption text-ink shadow-panel">
                <CircleCheck aria-hidden className="size-4" />
                All active stations are included.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

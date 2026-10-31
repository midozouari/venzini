// UI-03 Station forecast (UC-04, FR-17 to FR-23, FR-83): station and fuel selectors, the 7-day
// chart with its band and recent actuals, the factors behind it, and the special states
// (uncertain forecast, similar-stations baseline, missing input, no forecast).
import * as Collapsible from '@radix-ui/react-collapsible';
import { formatMessage, type Forecast } from '@venzini/contracts';
import { ChevronDown, CircleHelp, CloudOff, LineChart, Users } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useForecast, useReference, useStations } from '@/api/hooks';
import { ContentArea } from '@/app/Shell';
import { Callout } from '@/components/ui/callout';
import { Panel, PanelLabel } from '@/components/ui/panel';
import { Select } from '@/components/ui/select';
import { EmptyState, Skeleton } from '@/components/ui/states';
import { Segmented } from '@/components/ui/tabs';
import { ChartLegend, LineBandChart } from '@/features/charts/LineBandChart';
import {
  ChartOrTable,
  FACTOR_LABEL,
  ForecastTable,
  toBand,
  UncertainChip,
} from '@/features/forecast/parts';
import { formatDayLong, formatLitres, formatSignedPct } from '@/lib/format';
import { ForecastTabs } from './ForecastTabs';

export function ForecastPage() {
  const [params, setParams] = useSearchParams();
  const stations = useStations();
  const reference = useReference();
  const active = (stations.data?.items ?? [])
    .filter((s) => s.status === 'active')
    .sort((a, b) => a.station_id.localeCompare(b.station_id));
  const stationId = params.get('station') ?? active[0]?.station_id ?? null;
  const station = active.find((s) => s.station_id === stationId);
  // Only the fuel types the station has a tank for (FR-17).
  const fuels = (reference.data?.fuel_types ?? [])
    .filter((f) => !station || station.tanks.some((t) => t.fuel_type_id === f.fuel_type_id))
    .sort((a, b) => a.display_order - b.display_order);
  const fuelParam = params.get('fuel');
  const fuelId = fuels.some((f) => f.fuel_type_id === fuelParam)
    ? fuelParam
    : (fuels[0]?.fuel_type_id ?? null);
  const fuelName = fuels.find((f) => f.fuel_type_id === fuelId)?.name ?? '';
  const forecast = useForecast(stationId, fuelId);

  const choose = (next: { station?: string; fuel?: string }) =>
    setParams(
      (p) => {
        if (next.station) p.set('station', next.station);
        if (next.fuel) p.set('fuel', next.fuel);
        return p;
      },
      { replace: true },
    );

  const regions = [...new Set(active.map((s) => s.region))];

  return (
    <ContentArea>
      <div className="flex min-h-full flex-col gap-[var(--vz-gap)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <ForecastTabs />
          <Panel className="flex items-center gap-3 rounded-full px-2 py-2 shadow-panel">
            <Select
              label="Station"
              className="w-72"
              value={stationId ?? ''}
              onChange={(e) => choose({ station: e.target.value })}
            >
              {regions.map((region) => (
                <optgroup key={region} label={region}>
                  {active
                    .filter((s) => s.region === region)
                    .map((s) => (
                      <option key={s.station_id} value={s.station_id}>
                        {s.name} · {s.station_id}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
            {fuelId ? (
              <Segmented
                label="Fuel type"
                value={fuelId}
                options={fuels.map((f) => ({ value: f.fuel_type_id, label: f.name }))}
                onChange={(fuel) => choose({ fuel })}
              />
            ) : null}
          </Panel>
        </div>

        {forecast.isPending || stations.isPending ? (
          <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-[var(--vz-gap)]">
            <Skeleton className="h-[460px] rounded-panel" />
            <Skeleton className="h-[460px] rounded-panel" />
          </div>
        ) : forecast.isError ? (
          <Panel className="mx-auto w-[520px]">
            <EmptyState icon={LineChart} title="The forecast could not be loaded">
              {forecast.error.message}
            </EmptyState>
          </Panel>
        ) : !forecast.data || forecast.data.status === 'manual_planning' ? (
          <Panel className="mx-auto w-[560px] animate-in fade-in-0 duration-200">
            <EmptyState icon={LineChart} title="No forecast for this station yet">
              {formatMessage('ERR-AI-01', {
                station: stationId ?? '',
                fuel: fuelName,
                reason: 'there is no sales history to forecast from',
              })}
            </EmptyState>
          </Panel>
        ) : (
          <ForecastView
            key={`${stationId}-${fuelId}`}
            forecast={forecast.data}
            stationName={station?.name ?? ''}
            fuelName={fuelName}
          />
        )}
      </div>
    </ContentArea>
  );
}

function ForecastView({
  forecast,
  stationName,
  fuelName,
}: {
  forecast: Forecast;
  stationName: string;
  fuelName: string;
}) {
  const tomorrow = forecast.daily[0]!;
  const similar = forecast.baseline === 'similar_stations';
  const weather = forecast.factors.find((f) => f.factor === 'weather');
  const missingWeather = weather && !weather.available && !forecast.uncertain;
  const [main, more] = [forecast.factors.slice(0, 3), forecast.factors.slice(3)];
  const confidenceOf = (date: string) => forecast.daily.find((d) => d.date === date)?.confidence;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-[var(--vz-gap)] animate-in fade-in-0 duration-200">
      <Panel className="p-6">
        <div className="flex flex-wrap items-start gap-x-12 gap-y-4">
          <div>
            <PanelLabel>Tomorrow, {formatDayLong(tomorrow.date)}</PanelLabel>
            <p className="mt-1 text-kpi text-ink [font-variant-numeric:proportional-nums]">
              {formatLitres(tomorrow.litres)}
            </p>
          </div>
          <div>
            <PanelLabel>Overall confidence</PanelLabel>
            <p className="mt-1 flex items-center gap-3 text-kpi text-ink [font-variant-numeric:proportional-nums]">
              {forecast.overall_confidence}%{forecast.uncertain ? <UncertainChip /> : null}
            </p>
            {missingWeather ? (
              <p className="mt-1 flex items-center gap-1.5 text-caption text-muted">
                <CloudOff aria-hidden className="size-3.5" />
                Weather data is not available for part of the week.
              </p>
            ) : null}
          </div>
          <p className="ml-auto self-end text-caption text-muted">
            {stationName} · {fuelName} · from {formatDayLong(tomorrow.date)} ·{' '}
            {forecast.model_version}
          </p>
        </div>

        <div className="mt-6">
          <ChartOrTable
            label="forecast"
            chart={
              <>
                <LineBandChart
                  label={`7-day forecast, ${stationName}, ${fuelName}`}
                  forecast={toBand(forecast)}
                  actuals={forecast.recent_actuals.map((a) => ({ date: a.date, value: a.litres }))}
                  uncertain={forecast.uncertain}
                  height={290}
                  details={(date) => (
                    <p className="flex justify-between gap-4 tabular-nums">
                      <span className="text-muted">Confidence</span>
                      <span>{confidenceOf(date)}%</span>
                    </p>
                  )}
                />
                <div className="mt-3">
                  <ChartLegend uncertain={forecast.uncertain} />
                </div>
              </>
            }
            table={<ForecastTable forecast={forecast} />}
          />
        </div>
      </Panel>

      <Panel className="p-6">
        {forecast.uncertain ? (
          <Callout icon={CircleHelp} tone="dashed" title="Uncertain forecast" className="mb-5">
            {similar && forecast.baseline_note ? (
              <>
                <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-panel px-2.5 py-0.5 text-caption font-semibold text-ink">
                  <Users aria-hidden className="size-3.5" />
                  Similar-stations baseline
                </span>
                <p>{forecast.baseline_note}</p>
              </>
            ) : (
              <p>{forecast.uncertain_reason}</p>
            )}
            <p className="mt-2 text-caption text-muted">
              It is still used for planning; check it before approving.
            </p>
          </Callout>
        ) : null}

        <h2 className="text-section text-ink">What drives this forecast</h2>
        <p className="mt-1 text-caption text-muted">
          Average effect over the 7 days, largest first.
        </p>
        <FactorList factors={main} />
        {more.length > 0 ? (
          <Collapsible.Root>
            <Collapsible.Content className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200">
              <FactorList factors={more} />
            </Collapsible.Content>
            <Collapsible.Trigger className="group mt-3 inline-flex items-center gap-1 rounded-control text-caption font-medium text-ink hover:underline">
              <span className="group-data-[state=open]:hidden">
                Show all factors ({forecast.factors.length})
              </span>
              <span className="hidden group-data-[state=open]:inline">Show fewer</span>
              <ChevronDown
                aria-hidden
                className="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
              />
            </Collapsible.Trigger>
          </Collapsible.Root>
        ) : null}
      </Panel>
    </div>
  );
}

function FactorList({ factors }: { factors: Forecast['factors'] }) {
  return (
    <ul className="mt-4 flex flex-col gap-4">
      {factors.map((f) => (
        <li key={f.factor}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body font-semibold text-ink">{FACTOR_LABEL[f.factor]}</span>
            {!f.available ? (
              <span className="text-caption font-medium text-muted">Missing for some days</span>
            ) : f.impact_pct !== 0 ? (
              <span className="text-body font-semibold tabular-nums text-ink">
                {formatSignedPct(f.impact_pct)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-caption text-muted">{f.explanation}</p>
        </li>
      ))}
    </ul>
  );
}

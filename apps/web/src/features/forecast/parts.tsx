import type { Forecast } from '@venzini/contracts';
import { CircleHelp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { formatDayLong, formatLitres, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BandPoint } from '../charts/LineBandChart';

/** "? Uncertain forecast": dashed outline, icon and words (FR-23, Figure 42). Never a risk color. */
export function UncertainChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-line-strong/70 px-2.5 py-0.5 text-caption font-semibold text-ink',
        className,
      )}
    >
      <CircleHelp aria-hidden className="size-3.5" />
      Uncertain forecast
    </span>
  );
}

export const FACTOR_LABEL: Record<Forecast['factors'][number]['factor'], string> = {
  recent_sales: 'Recent sales',
  previous_orders: 'Previous orders',
  current_tank_level: 'Current tank level',
  seasonality: 'Season',
  weather: 'Weather',
  local_events: 'Local events',
  calendar: 'Holidays',
};

export const toBand = (f: Forecast): BandPoint[] =>
  f.daily.map((d) => ({ date: d.date, value: d.litres, low: d.band_low, high: d.band_high }));

/** "Show as table" toggle (SDD 5.12.6): the accessible alternative to every chart. */
export function ChartOrTable({
  chart,
  table,
  label,
}: {
  chart: ReactNode;
  table: ReactNode;
  label: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-caption text-muted">Litres per day</span>
        <Button
          variant="quiet"
          size="sm"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? 'Show as chart' : 'Show as table'}
          <span className="sr-only"> ({label})</span>
        </Button>
      </div>
      <div key={asTable ? 'table' : 'chart'} className="animate-in fade-in-0 duration-200">
        {asTable ? table : chart}
      </div>
    </div>
  );
}

/** The forecast as a table: actual sales, forecast, 80% range and confidence per day. */
export function ForecastTable({ forecast }: { forecast: Forecast }) {
  const rows = [
    ...forecast.recent_actuals.map((a) => ({ date: a.date, actual: a.litres, day: undefined })),
    ...forecast.daily.map((d) => ({ date: d.date, actual: undefined, day: d })),
  ];
  return (
    <div className="max-h-80 overflow-auto rounded-control border border-line">
      <table className="w-full text-body">
        <caption className="sr-only">Daily forecast and recent actual sales</caption>
        <thead className="sticky top-0 bg-panel">
          <tr className="border-b border-line text-left text-caption text-muted">
            <th scope="col" className="px-4 py-2 font-medium">
              Day
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Actual sales
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Forecast
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              80% range
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium">
              Confidence
            </th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((r) => (
            <tr key={r.date} className="border-b border-line last:border-0">
              <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
                {formatDayLong(r.date)}
              </th>
              <td className="px-4 py-2 text-right">
                {r.actual !== undefined ? formatLitres(r.actual) : '–'}
              </td>
              <td className="px-4 py-2 text-right font-semibold">
                {r.day ? formatLitres(r.day.litres) : '–'}
              </td>
              <td className="px-4 py-2 text-right">
                {r.day ? `${formatNumber(r.day.band_low)}–${formatNumber(r.day.band_high)} L` : '–'}
              </td>
              <td className="px-4 py-2 text-right">{r.day ? `${r.day.confidence}%` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

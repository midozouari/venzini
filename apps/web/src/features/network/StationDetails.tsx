// Station details (UC-03 step 3, FR-16): tank levels in litres and %, safety stock, risk per fuel
// and the reason. Opened from a marker or a list row; Esc goes back to the list.
import type { Network } from '@venzini/contracts';
import { ArrowLeft, ChartLine, ClipboardList, MapPinOff } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/ui/risk-badge';
import { formatHours, formatInstant, formatLitres } from '@/lib/format';

type Station = Network['stations'][number];
const FUEL: Record<string, string> = { P95: 'Petrol 95', DIESEL: 'Diesel' };

export function StationDetails({
  station,
  network,
  day,
  onClose,
}: {
  station: Station;
  network: Network;
  day: string;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [station.station_id, onClose]);

  const warehouse = network.warehouses.find((w) => w.warehouse_id === station.serving_warehouse_id);
  const unavailable = network.data_unavailable.find((d) => d.station_id === station.station_id);

  return (
    <section
      aria-labelledby="station-title"
      className="flex h-full flex-col animate-in fade-in-0 slide-in-from-right-2 duration-200"
    >
      <div className="px-6 pb-2 pt-5">
        <Button variant="quiet" size="sm" className="-ml-2 mb-3" onClick={onClose}>
          <ArrowLeft aria-hidden /> All stations
        </Button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="station-title"
              ref={heading}
              tabIndex={-1}
              className="text-section text-ink outline-none"
            >
              {station.name}
            </h2>
            <p className="text-caption text-muted">
              {station.station_id}
              {warehouse ? ` · served from ${warehouse.name}` : ''}
            </p>
          </div>
          {station.risk_level ? <RiskBadge level={station.risk_level} /> : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!station.data_available ? (
          <p className="flex items-start gap-2 rounded-control bg-navy-tint px-4 py-3 text-body text-ink">
            <MapPinOff aria-hidden className="mt-0.5 size-4 shrink-0" />
            Data unavailable for {station.station_id}
            {unavailable ? `: ${unavailable.reason.toLowerCase()}` : ''}.
          </p>
        ) : null}
        <ul className="flex flex-col gap-4">
          {station.tanks.map((t) => {
            const alert = network.alerts.find(
              (a) => a.station_id === station.station_id && a.fuel_type_id === t.fuel_type_id,
            );
            const pct = t.level_pct;
            const safetyPct = Math.round((t.safety_stock_l / t.capacity_l) * 100);
            return (
              <li
                key={t.fuel_type_id}
                className="rounded-panel border border-line bg-canvas/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-body font-semibold text-ink">
                    {FUEL[t.fuel_type_id] ?? t.fuel_type_id}
                  </h3>
                  {t.risk_level ? (
                    <RiskBadge level={t.risk_level} suffix={formatHours(t.hours_to_stockout)} />
                  ) : null}
                </div>
                {t.current_level_l !== null && pct !== null ? (
                  <>
                    <p className="mt-3 flex items-baseline gap-2">
                      <span className="text-kpi text-ink">{pct}%</span>
                      <span className="text-body text-muted">
                        {formatLitres(t.current_level_l)} of {formatLitres(t.capacity_l)}
                      </span>
                    </p>
                    <div
                      className="relative mt-3 h-2 rounded-full bg-navy-tint"
                      role="img"
                      aria-label={`Tank ${pct}% full; safety stock at ${safetyPct}%`}
                    >
                      <div
                        className="h-2 rounded-full bg-navy-900 transition-[width] duration-300 ease-vz"
                        style={{ width: `${pct}%` }}
                      />
                      <div
                        className="absolute -top-1 h-4 w-0.5 rounded-full bg-muted"
                        style={{ left: `${safetyPct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-caption text-muted">
                      Safety stock {formatLitres(t.safety_stock_l)}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-body text-muted">Tank level unknown.</p>
                )}
                {alert ? <p className="mt-3 text-caption text-ink">{alert.reason}</p> : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex gap-3 border-t border-line px-6 py-4">
        <Button variant="secondary" asChild className="flex-1">
          <Link to={`/forecast?station=${station.station_id}`}>
            <ChartLine aria-hidden /> Open forecast
          </Link>
        </Button>
        <Button variant="secondary" asChild className="flex-1">
          <Link to={`/planner?day=${day}&station=${station.station_id}`}>
            <ClipboardList aria-hidden /> Open in planner
          </Link>
        </Button>
      </div>
      <p className="px-6 pb-4 text-caption text-muted">
        Levels as of {formatInstant(network.as_of)}.
      </p>
    </section>
  );
}

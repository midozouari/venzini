// Calm forecast chart (FR-20, SDD 5.12.2): a 2 px navy line with a soft light-navy 80% band,
// recent actuals as a thin dashed warm-grey line (forecast and actuals differ by line style,
// NFR-10), solid hairline grid. Hover or arrow keys show a crosshair and a tooltip. Uncertain
// forecasts get a hatched band (Figure 42). Every value is also in the table view.
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { formatDayLong, formatDayShort, formatLitres, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { linear, niceTicks } from './scale';

export interface BandPoint {
  date: string;
  value: number;
  low: number;
  high: number;
}

export interface ChartProps {
  /** Accessible name, e.g. "7-day forecast, Harbor Road, Diesel". */
  label: string;
  forecast: BandPoint[];
  actuals?: { date: string; value: number }[];
  uncertain?: boolean;
  /** Shared top of the axis (small multiples use the same scale). */
  yMax?: number;
  height?: number;
  /** Extra lines in the tooltip for a forecast day (confidence, uncertain share…). */
  details?: (date: string) => ReactNode;
  compact?: boolean;
}

const M = { top: 16, right: 28, bottom: 30, left: 58 };

export function LineBandChart({
  label,
  forecast,
  actuals = [],
  uncertain = false,
  yMax,
  height = 280,
  details,
  compact = false,
}: ChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const hatchId = useId();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dates = useMemo(
    () => [...new Set([...actuals.map((a) => a.date), ...forecast.map((f) => f.date)])].sort(),
    [actuals, forecast],
  );
  const ticks = niceTicks(
    yMax ?? Math.max(1, ...forecast.map((f) => f.high), ...actuals.map((a) => a.value)),
    compact ? 3 : 4,
  );
  const top = ticks[ticks.length - 1]!;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const x = (date: string) =>
    linear(0, dates.length - 1, M.left, M.left + innerW)(dates.indexOf(date));
  const y = linear(0, top, M.top + innerH, M.top);

  const line = (pts: { date: string; value: number }[]) =>
    pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join('');
  const band =
    forecast.length > 0
      ? `${forecast.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.high).toFixed(1)}`).join('')}` +
        `${[...forecast]
          .reverse()
          .map((p) => `L${x(p.date).toFixed(1)},${y(p.low).toFixed(1)}`)
          .join('')}Z`
      : '';
  const lastActual = actuals.at(-1)?.date;
  const activeDate = active === null ? null : (dates[active] ?? null);
  const activeForecast = forecast.find((f) => f.date === activeDate);
  const activeActual = actuals.find((a) => a.date === activeDate);
  const step = dates.length > 1 ? innerW / (dates.length - 1) : innerW;
  // Date labels need about 56 px each: show every n-th day so they never touch.
  const labelEvery = Math.max(1, Math.ceil(dates.length / Math.max(1, Math.floor(innerW / 56))));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      setActive((a) =>
        Math.min(dates.length - 1, Math.max(0, (a ?? (delta > 0 ? -1 : dates.length)) + delta)),
      );
    } else if (e.key === 'Escape') setActive(null);
  };

  return (
    <div ref={box} className="relative w-full" style={{ height }}>
      {width > 0 ? (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${label}. Use the left and right arrow keys to read each day.`}
          tabIndex={0}
          onKeyDown={onKey}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
          className="rounded-control focus-visible:outline-2 focus-visible:outline-focus"
        >
          <defs>
            <pattern
              id={hatchId}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect width="6" height="6" fill="var(--vz-band)" />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="var(--vz-navy-900)"
                strokeOpacity="0.22"
                strokeWidth="1.5"
              />
            </pattern>
          </defs>

          {/* Grid and y-axis: solid hairlines, tabular digits. */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={M.left}
                x2={M.left + innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--vz-line)"
                strokeWidth="1"
              />
              <text
                x={M.left - 10}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted text-caption tabular-nums"
              >
                {formatNumber(t)}
              </text>
            </g>
          ))}
          {dates.map((d, i) =>
            i % labelEvery === 0 ? (
              <text
                key={d}
                x={x(d)}
                y={height - 8}
                textAnchor="middle"
                className="fill-muted text-caption tabular-nums"
              >
                {formatDayShort(d)}
              </text>
            ) : null,
          )}

          {/* "Today": the last day with actual sales. */}
          {lastActual && forecast.length > 0 ? (
            <g>
              <line
                x1={x(lastActual)}
                x2={x(lastActual)}
                y1={M.top}
                y2={M.top + innerH}
                stroke="var(--vz-line-strong)"
                strokeOpacity="0.5"
                strokeWidth="1"
              />
              <text x={x(lastActual) + 6} y={M.top + 10} className="fill-muted text-caption">
                Today
              </text>
            </g>
          ) : null}

          {band ? (
            <path
              d={band}
              fill={uncertain ? `url(#${hatchId})` : 'var(--vz-band)'}
              stroke={uncertain ? 'var(--vz-line-strong)' : 'none'}
              strokeDasharray={uncertain ? '4 3' : undefined}
              strokeOpacity={uncertain ? 0.6 : 0}
            />
          ) : null}
          {actuals.length > 0 ? (
            <path
              d={line(actuals)}
              fill="none"
              stroke="var(--vz-muted)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          ) : null}
          <path
            d={line(forecast)}
            fill="none"
            stroke="var(--vz-navy-900)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {forecast.map((p) => (
            <circle
              key={p.date}
              cx={x(p.date)}
              cy={y(p.value)}
              r={p.date === activeDate ? 5.5 : 4}
              fill="var(--vz-navy-900)"
              stroke="var(--vz-panel)"
              strokeWidth="2"
            />
          ))}

          {/* Crosshair. */}
          {activeDate ? (
            <line
              x1={x(activeDate)}
              x2={x(activeDate)}
              y1={M.top}
              y2={M.top + innerH}
              stroke="var(--vz-navy-900)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          ) : null}

          {/* Hit areas: a full column per day, bigger than the marks. */}
          {dates.map((d, i) => (
            <rect
              key={d}
              x={x(d) - step / 2}
              y={M.top}
              width={Math.max(step, 24)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setActive(i)}
            />
          ))}
        </svg>
      ) : null}

      {activeDate && width > 0 ? (
        <div
          role="status"
          className="pointer-events-none absolute top-2 z-10 min-w-44 rounded-control border border-line bg-panel px-3 py-2 text-caption text-ink shadow-float animate-in fade-in-0 duration-150"
          style={{
            left: Math.min(Math.max(x(activeDate) + 12, 0), width - 200),
          }}
        >
          <p className="font-semibold">{formatDayLong(activeDate)}</p>
          {activeForecast ? (
            <>
              <p className="mt-1 flex justify-between gap-4 tabular-nums">
                <span className="text-muted">Forecast</span>
                <span className="font-semibold">{formatLitres(activeForecast.value)}</span>
              </p>
              <p className="flex justify-between gap-4 tabular-nums">
                <span className="text-muted">80% range</span>
                <span>
                  {formatNumber(activeForecast.low)}–{formatNumber(activeForecast.high)} L
                </span>
              </p>
              {details?.(activeDate)}
            </>
          ) : null}
          {activeActual ? (
            <p className={cn('flex justify-between gap-4 tabular-nums', activeForecast && 'mt-1')}>
              <span className="text-muted">Actual sales</span>
              <span className="font-semibold">{formatLitres(activeActual.value)}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The chart's legend: words and line styles, never color alone. */
export function ChartLegend({
  actuals = true,
  uncertain = false,
}: {
  actuals?: boolean;
  uncertain?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 text-caption text-muted">
      <span className="flex items-center gap-2">
        <svg width="22" height="10" aria-hidden>
          <line
            x1="1"
            y1="5"
            x2="21"
            y2="5"
            stroke="var(--vz-navy-900)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        Forecast
      </span>
      <span className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn(
            'inline-block h-3 w-5 rounded-[3px]',
            uncertain
              ? 'border border-dashed border-line-strong bg-navy-tint'
              : 'bg-navy-tint-strong',
          )}
        />
        80% range{uncertain ? ' (uncertain)' : ''}
      </span>
      {actuals ? (
        <span className="flex items-center gap-2">
          <svg width="22" height="10" aria-hidden>
            <line
              x1="1"
              y1="5"
              x2="21"
              y2="5"
              stroke="var(--vz-muted)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          </svg>
          Actual sales
        </span>
      ) : null}
    </div>
  );
}

// Route map of the planner (UI-05; FR-45 to FR-54, FR-65). One colored, directed line per route,
// numbered stops with the station's urgency badge, warehouses, and unserved stations. The map is
// not draggable (SDD 5.12.6): edits happen in the stop list, and the map follows them live.
import type { Network, PlanView, RiskLevel, Route } from '@venzini/contracts';
import L from 'leaflet';
import { Fragment, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Tooltip } from 'react-leaflet';
import { routeClass } from './route-color';
import { FitToCard, ICON_SVG, Tiles, warehouseIcon } from '@/features/network/NetworkMap';
import type { Highlight } from './edit';

const WORD: Record<RiskLevel, string> = {
  high: 'high risk',
  medium: 'medium risk',
  low: 'low risk',
};

/** The CSS class of a route color token ("route-3" → "vz-r3"). */

const ARROW =
  '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 2.5 11 7 3 11.5Z" fill="currentColor" stroke="#FFFDF9" stroke-width="1.2" stroke-linejoin="round"/></svg>';

function stopIcon(
  route: Route,
  order: number,
  risk: RiskLevel,
  state: { selected: boolean; hl: boolean; dim: boolean },
) {
  const cls = [
    'vz-stop',
    routeClass(route),
    state.selected && 'vz-stop--selected',
    state.hl && 'vz-stop--hl',
    state.dim && 'vz-stop--dim',
  ]
    .filter(Boolean)
    .join(' ');
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<span class="${cls}">${order}<span class="vz-marker vz-stop-risk vz-marker--${risk}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON_SVG[risk]}</svg></span></span>`,
  });
}

function arrowIcon(route: Route, degrees: number, dim: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    html: `<span class="vz-arrow ${routeClass(route)}" style="transform: rotate(${degrees.toFixed(1)}deg);${dim ? ' opacity: 0.22;' : ''}">${ARROW}</span>`,
  });
}

const unservedIcon = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: '<span class="vz-unserved"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></span>',
});

type Point = [number, number];

/** Keeps the routes clear of the tanker filter (top) and the legend (bottom). */
const FIT_PADDING = { top: 72, bottom: 76 };

/** Screen direction of a leg, in degrees clockwise from east (for the arrow). */
function heading([lat1, lng1]: Point, [lat2, lng2]: Point): number {
  const dx = (lng2 - lng1) * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const dy = lat2 - lat1;
  return (-Math.atan2(dy, dx) * 180) / Math.PI;
}

export function PlanMap({
  view,
  network,
  tanker,
  highlight,
  selected,
  onSelect,
  onTilesFailed,
  onReady,
}: {
  view: PlanView;
  network: Network;
  /** Tanker filter (FR-54): null shows every route. */
  tanker: string | null;
  highlight: Highlight | null;
  selected: string | null;
  onSelect: (stationId: string) => void;
  onTilesFailed: () => void;
  onReady?: (map: L.Map) => void;
}) {
  const where = useMemo(() => {
    const m = new Map<string, { at: Point; name: string }>();
    for (const s of network.stations)
      m.set(s.station_id, { at: [s.latitude, s.longitude], name: s.name });
    for (const w of network.warehouses)
      m.set(w.warehouse_id, { at: [w.latitude, w.longitude], name: w.name });
    return m;
  }, [network]);
  const points = useMemo<Point[]>(() => [...where.values()].map((p) => p.at), [where]);

  const routes = view.routes.filter((r) => !tanker || r.tanker_id === tanker);
  const served = new Set(view.routes.flatMap((r) => r.stops.map((s) => s.station_id)));
  const unserved = [...new Set(view.unserved.map((u) => u.station_id))].filter(
    (id) => !served.has(id),
  );
  const riskOf = (id: string) =>
    view.unserved.find((u) => u.station_id === id)?.risk_level ?? 'low';

  return (
    <MapContainer
      center={[36.79, 10.22]}
      zoom={11}
      // Finer zoom steps let the routes fill their card (the map is the planner's centerpiece).
      zoomSnap={0.25}
      zoomControl={false}
      className="h-full w-full"
      attributionControl
      ref={(m) => {
        if (m) onReady?.(m);
      }}
    >
      <Tiles onTilesFailed={onTilesFailed} />
      <FitToCard points={points} padding={FIT_PADDING} />

      {routes.map((route) => {
        const dim = !!highlight && !highlight.routes.has(route.route_id);
        const hl = !!highlight && highlight.routes.has(route.route_id);
        const ids = [
          route.home_warehouse_id,
          ...route.stops.map((s) => s.station_id),
          route.home_warehouse_id,
        ];
        const legs = ids.slice(1).map((to, i) => {
          const from = ids[i]!;
          // Km and minutes come from the server; while an edit waits they are not known yet.
          const seg = route.segments.find((s, j) => j === i && s.from === from && s.to === to);
          return { from, to, index: i, seg };
        });
        const cls = routeClass(route);
        return (
          <RouteLines
            key={route.route_id}
            route={route}
            legs={legs}
            where={where}
            cls={cls}
            hl={hl}
            dim={dim}
            highlight={highlight}
          />
        );
      })}

      {network.warehouses.map((w) => (
        <Marker
          key={w.warehouse_id}
          position={[w.latitude, w.longitude]}
          icon={warehouseIcon}
          title={`${w.name} (${w.warehouse_id}), warehouse`}
          keyboard={false}
          zIndexOffset={-100}
        >
          <Tooltip direction="top" offset={[0, -14]} className="vz-tip">
            {w.name} · {w.warehouse_id}
          </Tooltip>
        </Marker>
      ))}

      {routes.flatMap((route) =>
        route.stops.map((s) => {
          const p = where.get(s.station_id);
          if (!p) return null;
          const hl = !!highlight?.stops.has(s.stop_id);
          const dim = !!highlight && !hl && !highlight.routes.has(route.route_id);
          const isSelected = s.station_id === selected;
          return (
            <Marker
              // The marker's title is set only when it is created: a new number means a new marker.
              key={`${route.route_id}-${s.stop_id}-${s.stop_order}`}
              position={p.at}
              icon={stopIcon(route, s.stop_order, s.risk_level, {
                selected: isSelected,
                hl,
                dim,
              })}
              title={`Stop ${s.stop_order} of ${route.tanker_id}: ${s.station_name} (${s.station_id}), ${WORD[s.risk_level]}`}
              keyboard={false}
              zIndexOffset={isSelected ? 1000 : hl ? 800 : 0}
              eventHandlers={{ click: () => onSelect(s.station_id) }}
            >
              <Tooltip direction="top" offset={[0, -14]} className="vz-tip" permanent={isSelected}>
                {s.station_name} · {s.station_id}
              </Tooltip>
            </Marker>
          );
        }),
      )}

      {!tanker
        ? unserved.map((id) => {
            const p = where.get(id);
            if (!p) return null;
            return (
              <Marker
                key={`uns-${id}`}
                position={p.at}
                icon={unservedIcon}
                title={`${p.name} (${id}), not served today, ${WORD[riskOf(id)]}`}
                keyboard={false}
                eventHandlers={{ click: () => onSelect(id) }}
              >
                <Tooltip direction="top" offset={[0, -14]} className="vz-tip">
                  {p.name} · {id} · not served today
                </Tooltip>
              </Marker>
            );
          })
        : null}
    </MapContainer>
  );
}

function RouteLines({
  route,
  legs,
  where,
  cls,
  hl,
  dim,
  highlight,
}: {
  route: Route;
  legs: {
    from: string;
    to: string;
    index: number;
    seg: Route['segments'][number] | undefined;
  }[];
  where: Map<string, { at: Point; name: string }>;
  cls: string;
  hl: boolean;
  dim: boolean;
  highlight: Highlight | null;
}) {
  const dash = route.trip_no === 2 ? '8 9' : undefined;
  return (
    <>
      {legs.map(({ from, to, index, seg }) => {
        const a = where.get(from)?.at;
        const b = where.get(to)?.at;
        if (!a || !b) return null;
        const legHl = hl || !!highlight?.segments.has(`${route.route_id}#${index}`);
        const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const lineClass = `vz-route ${cls}${legHl ? ' vz-route--hl' : ''}${dim && !legHl ? ' vz-route--dim' : ''}`;
        const label = `${route.tanker_id}: ${from} → ${to}${seg ? ` · ${seg.km.toFixed(1)} km · ${seg.minutes} min` : ''}`;
        return (
          <Fragment key={`${from}-${to}-${index}`}>
            {/* Leaflet sets a line's class only when it is created, so a new class means a new line. */}
            {legHl ? (
              <Polyline
                key={`halo-${cls}`}
                positions={[a, b]}
                interactive={false}
                className={`vz-halo ${cls}`}
                pathOptions={{ dashArray: dash }}
              />
            ) : null}
            <Polyline
              key={`line-${lineClass}`}
              positions={[a, b]}
              interactive={false}
              className={lineClass}
              pathOptions={{ dashArray: dash }}
            />
            {/* A wider invisible line makes the leg easy to hover for its label (FR-51). */}
            <Polyline positions={[a, b]} className="vz-hit">
              <Tooltip sticky className="vz-tip">
                {label}
              </Tooltip>
            </Polyline>
            <Marker
              position={mid}
              icon={arrowIcon(route, heading(a, b), dim && !legHl)}
              interactive={false}
              keyboard={false}
            />
          </Fragment>
        );
      })}
    </>
  );
}

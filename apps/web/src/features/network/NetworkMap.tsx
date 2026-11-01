// Network map (FR-14, FR-47, FR-48): risk markers with a dark outline, an icon and a word in the
// label, warehouse squares, and a calm, desaturated tile background (SDD 5.12.4).
import type { Network, RiskLevel } from '@venzini/contracts';
import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';

export const ICON_SVG: Record<RiskLevel, string> = {
  high: '<path d="M12 4 22 20H2Z" fill="currentColor"/><path d="M12 10v4M12 17h.01" stroke="var(--vz-risk-high)" stroke-width="2.4" stroke-linecap="round"/>',
  medium:
    '<path d="M12 6v8M12 18h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  low: '<path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
};
const WORD: Record<RiskLevel, string> = {
  high: 'high risk',
  medium: 'medium risk',
  low: 'low risk',
};

/** A station without data: a neutral grey marker with a question mark, never a risk color. */
export const NO_DATA_SVG =
  '<path d="M9.2 9a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.5M12 18h.01" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>';

function stationIcon(level: RiskLevel | 'nodata', selected: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span class="vz-marker vz-marker--${level}${selected ? ' vz-marker--selected' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${level === 'nodata' ? NO_DATA_SVG : ICON_SVG[level]}</svg></span>`,
  });
}

export const warehouseIcon = L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  html: '<span class="vz-warehouse"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10 12 4l9 6v10H3Z M8 20v-6h8v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>',
});

/**
 * Fits the stations into the map card, and keeps the map in step with the card when its size
 * changes (first layout, window, KPI row). It stops re-fitting once the user pans or zooms.
 */
export function FitToCard({
  points,
  padding = { top: 32, bottom: 72 },
}: {
  points: [number, number][];
  /** Room kept free for the card's own controls (legend, filters). */
  padding?: { top: number; bottom: number };
}) {
  const map = useMap();
  const userMoved = useRef(false);
  useEffect(() => {
    if (points.length === 0) return;
    let fitting = false;
    const fit = () => {
      const { x, y } = map.getSize();
      if (x < 100 || y < 100) return; // the card has no real size yet
      fitting = true;
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [32, padding.top],
        paddingBottomRight: [32, padding.bottom],
        animate: false,
      });
      fitting = false;
    };
    const onUserMove = () => {
      if (!fitting) userMoved.current = true;
    };
    map.on('zoomstart dragstart', onUserMove);
    const observer = new ResizeObserver(() => {
      map.invalidateSize({ pan: false });
      if (!userMoved.current) fit();
    });
    observer.observe(map.getContainer());
    fit();
    return () => {
      observer.disconnect();
      map.off('zoomstart dragstart', onUserMove);
    };
  }, [map, points, padding.top, padding.bottom]);
  return null;
}

/** The calm, desaturated tile background shared by every map card (SDD 5.12.4). */
export function Tiles({ onTilesFailed }: { onTilesFailed: () => void }) {
  // End-to-end tests may set their own tile source (offline tiles, or a failing one).
  const tileUrl =
    window.__VENZINI_TEST__?.tileUrl ||
    import.meta.env.VITE_MAP_TILE_URL ||
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  return (
    <TileLayer
      url={tileUrl}
      className="vz-tiles"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      eventHandlers={{ tileerror: onTilesFailed }}
    />
  );
}

export function NetworkMap({
  network,
  selected,
  onSelect,
  onTilesFailed,
  onReady,
}: {
  network: Network;
  selected: string | null;
  onSelect: (stationId: string) => void;
  onTilesFailed: () => void;
  onReady?: (map: L.Map) => void;
}) {
  // Stations without data get the neutral "no data" marker (FR-14, ERR-DATA-01).
  const markers = useMemo(
    () =>
      network.stations.map((s) => ({
        station: s,
        level: s.data_available && s.risk_level !== null ? s.risk_level : ('nodata' as const),
      })),
    [network.stations],
  );
  const points = useMemo<[number, number][]>(
    () => [
      ...network.stations.map((s) => [s.latitude, s.longitude] as [number, number]),
      ...network.warehouses.map((w) => [w.latitude, w.longitude] as [number, number]),
    ],
    [network],
  );

  return (
    <MapContainer
      center={[36.79, 10.22]}
      zoom={11}
      zoomControl={false}
      className="h-full w-full"
      attributionControl
      ref={(m) => {
        if (m) onReady?.(m);
      }}
    >
      <Tiles onTilesFailed={onTilesFailed} />
      <FitToCard points={points} />
      {network.warehouses.map((w) => (
        <Marker
          key={w.warehouse_id}
          position={[w.latitude, w.longitude]}
          icon={warehouseIcon}
          title={`${w.name} (${w.warehouse_id}), warehouse`}
          keyboard={false}
        >
          <Tooltip direction="top" offset={[0, -14]} className="vz-tip">
            {w.name} · {w.warehouse_id}
          </Tooltip>
        </Marker>
      ))}
      {markers.map(({ station: s, level }) => (
        <Marker
          key={s.station_id}
          position={[s.latitude, s.longitude]}
          icon={stationIcon(level, s.station_id === selected)}
          title={`${s.name} (${s.station_id}), ${level === 'nodata' ? 'no data' : WORD[level]}`}
          keyboard={false}
          zIndexOffset={s.station_id === selected ? 1000 : level === 'high' ? 500 : 0}
          eventHandlers={{ click: () => onSelect(s.station_id) }}
        >
          {/* Default label: station name and ID only (FR-49). */}
          <Tooltip
            direction="top"
            offset={[0, -14]}
            className="vz-tip"
            permanent={s.station_id === selected}
          >
            {s.name} · {s.station_id}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

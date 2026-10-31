// Master data of the fake sample network (SDD 5.11.3, FR-74): 3 warehouses, 20 stations in
// Greater Tunis over 3 regions and 3 size classes, 2 fuels, 6 tankers, 6 drivers, 7 users.
// All names and figures are invented. The scenario columns (target hours) shape the demo day
// so that the fixtures match SDD 7.2: 3 high, 5 medium, 11 low risk, 1 station without data.

export const REFERENCE_DATE = '2026-11-02';
export const DELIVERY_DAY = '2026-11-03';
export const PAST_DAY = '2026-11-01';
/** Demo clock: 02 Nov 2026 08:00 in Tunis (SDD 5.6.4 network example). */
export const DEMO_NOW = '2026-11-02T07:00:00Z';
export const FORECAST_MODEL_VERSION = 'fc-sim-1.1.0';
/** Sample parameters (TBL-26). */
export const FUEL_PRICE_USD_PER_L = 1.9;
export const UNLOADING_BASE_MIN = 15;
export const UNLOADING_MIN_PER_1000L = 3;
export const DEPOT_OPEN_MIN = 5 * 60;
export const DEPOT_CLOSE_MIN = 22 * 60;
export const RELOAD_MIN = 30;

export const FUEL_TYPES = [
  { fuel_type_id: 'P95', name: 'Petrol 95', display_order: 1 },
  { fuel_type_id: 'DIESEL', name: 'Diesel', display_order: 2 },
] as const;
export type FuelId = (typeof FUEL_TYPES)[number]['fuel_type_id'];
export const FUEL_IDS: FuelId[] = ['P95', 'DIESEL'];
export const fuelName = (f: string) => FUEL_TYPES.find((t) => t.fuel_type_id === f)?.name ?? f;

export const REGIONS = ['Tunis North', 'Tunis Centre', 'Tunis South'] as const;

export const WAREHOUSES = [
  { warehouse_id: 'WH-NOR', name: 'La Soukra Depot', latitude: 36.88, longitude: 10.215 },
  { warehouse_id: 'WH-RIV', name: 'Rives Depot', latitude: 36.79, longitude: 10.25 },
  { warehouse_id: 'WH-SUD', name: 'Mornag Depot', latitude: 36.69, longitude: 10.27 },
] as const;

export type Size = 'S' | 'M' | 'L';

/** Tank capacity, safety stock and base daily sales per size class and fuel. */
export const SIZE_PROFILE: Record<
  Size,
  Record<FuelId, { capacity: number; safety: number; daily: number }>
> = {
  S: {
    P95: { capacity: 12000, safety: 2000, daily: 420 },
    DIESEL: { capacity: 14000, safety: 2500, daily: 480 },
  },
  M: {
    P95: { capacity: 18000, safety: 3000, daily: 640 },
    DIESEL: { capacity: 20000, safety: 3500, daily: 720 },
  },
  L: {
    P95: { capacity: 24000, safety: 4000, daily: 880 },
    DIESEL: { capacity: 28000, safety: 5000, daily: 1000 },
  },
};

/**
 * Demo-day target per fuel: hours to stockout at the start of 03 Nov, or 'ok' when the tank needs
 * no delivery this week. 'none' marks the station whose tank levels are unknown (ERR-DATA-01).
 */
export type Target = number | 'ok';

export interface StationSpec {
  id: string;
  name: string;
  region: (typeof REGIONS)[number];
  lat: number;
  lon: number;
  size: Size;
  open: string;
  close: string;
  /** Warehouse the station is expected to be closest to (checked by tests). */
  warehouse: string;
  targets: Record<FuelId, Target> | 'no_level';
  /** Override of the size profile's safety stock. */
  safety?: Partial<Record<FuelId, number>>;
  /** Fuel with too little sales history: forecast from similar stations (FR-83). */
  shortHistory?: FuelId;
}

export const STATIONS: StationSpec[] = [
  // Tunis North, served from WH-NOR
  {
    id: 'ST001',
    name: 'Ariana Centre',
    region: 'Tunis North',
    lat: 36.862,
    lon: 10.193,
    size: 'M',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-NOR',
    targets: { P95: 96, DIESEL: 'ok' },
  },
  {
    id: 'ST002',
    name: 'Raoued Coast',
    region: 'Tunis North',
    lat: 36.905,
    lon: 10.245,
    size: 'S',
    open: '06:00',
    close: '18:00',
    warehouse: 'WH-NOR',
    targets: { P95: 'ok', DIESEL: 50 },
  },
  {
    id: 'ST003',
    name: 'La Marsa Corniche',
    region: 'Tunis North',
    lat: 36.888,
    lon: 10.322,
    size: 'S',
    open: '05:00',
    close: '19:00',
    warehouse: 'WH-NOR',
    targets: { P95: 110, DIESEL: 130 },
  },
  {
    id: 'ST004',
    name: 'Ennasr Avenue',
    region: 'Tunis North',
    lat: 36.858,
    lon: 10.163,
    size: 'L',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-NOR',
    targets: { P95: 80, DIESEL: 60 },
  },
  {
    id: 'ST005',
    name: 'Borj Louzir',
    region: 'Tunis North',
    lat: 36.872,
    lon: 10.208,
    size: 'M',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-NOR',
    targets: { P95: 18, DIESEL: 100 },
  },
  {
    id: 'ST007',
    name: 'Mnihla Junction',
    region: 'Tunis North',
    lat: 36.85,
    lon: 10.12,
    size: 'M',
    open: '06:00',
    close: '20:00',
    warehouse: 'WH-NOR',
    targets: { P95: 'ok', DIESEL: 140 },
  },
  // Tunis Centre, served from WH-RIV
  {
    id: 'ST006',
    name: 'Le Kram Avenue',
    region: 'Tunis Centre',
    lat: 36.835,
    lon: 10.3,
    size: 'L',
    open: '06:00',
    close: '19:00',
    warehouse: 'WH-RIV',
    targets: { P95: 110, DIESEL: 'ok' },
  },
  {
    id: 'ST008',
    name: 'Lac 1 Gateway',
    region: 'Tunis Centre',
    lat: 36.825,
    lon: 10.255,
    size: 'S',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-RIV',
    targets: { P95: 100, DIESEL: 'ok' },
  },
  {
    id: 'ST011',
    name: 'Megrine Industrial',
    region: 'Tunis Centre',
    lat: 36.765,
    lon: 10.235,
    size: 'L',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-RIV',
    targets: { P95: 60, DIESEL: 90 },
  },
  {
    id: 'ST012',
    name: 'Westside Terminal',
    region: 'Tunis Centre',
    lat: 36.795,
    lon: 10.2,
    size: 'M',
    open: '08:00',
    close: '18:00',
    warehouse: 'WH-RIV',
    targets: { P95: 40.5, DIESEL: 110 },
  },
  {
    id: 'ST013',
    name: 'Rades Port',
    region: 'Tunis Centre',
    lat: 36.775,
    lon: 10.28,
    size: 'S',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-RIV',
    targets: { P95: 'ok', DIESEL: 85 },
  },
  {
    id: 'ST014',
    name: 'Harbor Road',
    region: 'Tunis Centre',
    lat: 36.8,
    lon: 10.18,
    size: 'M',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-RIV',
    targets: { P95: 75, DIESEL: 14 },
  },
  {
    id: 'ST019',
    name: 'Bardo Road',
    region: 'Tunis Centre',
    lat: 36.81,
    lon: 10.19,
    size: 'L',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-RIV',
    targets: { P95: 'ok', DIESEL: 20 },
    safety: { DIESEL: 6000 },
  },
  // Tunis South, served from WH-SUD
  {
    id: 'ST009',
    name: 'Ben Arous Centre',
    region: 'Tunis South',
    lat: 36.715,
    lon: 10.23,
    size: 'M',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-SUD',
    targets: { P95: 30, DIESEL: 115 },
  },
  {
    id: 'ST010',
    name: 'Hammam Lif Coast',
    region: 'Tunis South',
    lat: 36.725,
    lon: 10.335,
    size: 'S',
    open: '06:00',
    close: '19:00',
    warehouse: 'WH-SUD',
    targets: { P95: 'ok', DIESEL: 95 },
  },
  {
    id: 'ST015',
    name: 'Mornag Plain',
    region: 'Tunis South',
    lat: 36.67,
    lon: 10.29,
    size: 'M',
    open: '06:00',
    close: '20:00',
    warehouse: 'WH-SUD',
    targets: { P95: 125, DIESEL: 150 },
  },
  {
    id: 'ST016',
    name: 'Fouchana Road',
    region: 'Tunis South',
    lat: 36.7,
    lon: 10.17,
    size: 'L',
    open: '05:00',
    close: '20:00',
    warehouse: 'WH-SUD',
    targets: { P95: 'ok', DIESEL: 88 },
  },
  {
    id: 'ST017',
    name: 'Mohamedia',
    region: 'Tunis South',
    lat: 36.675,
    lon: 10.155,
    size: 'S',
    open: '06:00',
    close: '19:00',
    warehouse: 'WH-SUD',
    targets: 'no_level',
  },
  {
    id: 'ST018',
    name: 'Borj Cedria',
    region: 'Tunis South',
    lat: 36.705,
    lon: 10.4,
    size: 'S',
    open: '06:00',
    close: '19:00',
    warehouse: 'WH-SUD',
    targets: { P95: 105, DIESEL: 'ok' },
  },
  {
    id: 'ST020',
    name: 'Khelidia',
    region: 'Tunis South',
    lat: 36.65,
    lon: 10.255,
    size: 'S',
    open: '06:00',
    close: '20:00',
    warehouse: 'WH-SUD',
    targets: { P95: 92, DIESEL: 'ok' },
    shortHistory: 'P95',
  },
];

export interface TankerSpec {
  id: string;
  compartments: number[];
  consumption: number;
  warehouse: string;
}

export const TANKERS: TankerSpec[] = [
  { id: 'T-01', compartments: [12000, 12000, 12000], consumption: 0.34, warehouse: 'WH-RIV' },
  { id: 'T-02', compartments: [8000, 8000, 8000, 8000], consumption: 0.36, warehouse: 'WH-RIV' },
  { id: 'T-03', compartments: [10000, 8000, 8000, 8000], consumption: 0.38, warehouse: 'WH-NOR' },
  { id: 'T-04', compartments: [10000, 10000, 10000], consumption: 0.32, warehouse: 'WH-NOR' },
  { id: 'T-05', compartments: [9000, 9000, 9000, 9000], consumption: 0.4, warehouse: 'WH-SUD' },
  { id: 'T-06', compartments: [10000, 10000, 10000], consumption: 0.3, warehouse: 'WH-SUD' },
];

export const DRIVERS = [
  { driver_id: 'D-01', full_name: 'Sami B.', home_warehouse_id: 'WH-NOR' },
  { driver_id: 'D-02', full_name: 'Hatem L.', home_warehouse_id: 'WH-NOR' },
  { driver_id: 'D-03', full_name: 'Walid M.', home_warehouse_id: 'WH-SUD' },
  { driver_id: 'D-04', full_name: 'Ali H.', home_warehouse_id: 'WH-RIV' },
  { driver_id: 'D-05', full_name: 'Marcus K.', home_warehouse_id: 'WH-RIV' },
  { driver_id: 'D-06', full_name: 'Nizar F.', home_warehouse_id: 'WH-SUD' },
] as const;

/** Demo accounts (README) plus 4 others for the admin list (SDD 7.2). Fake people. */
export const USERS = [
  {
    login: 'sara.m',
    full_name: 'Sara M.',
    role: 'manager',
    status: 'active',
    locked_min: null,
    created: '2026-09-01T08:00:00Z',
  },
  {
    login: 'karim.b',
    full_name: 'Karim B.',
    role: 'dispatcher',
    status: 'active',
    locked_min: null,
    created: '2026-09-01T08:05:00Z',
  },
  {
    login: 'nadia.a',
    full_name: 'Nadia A.',
    role: 'admin',
    status: 'active',
    locked_min: null,
    created: '2026-09-01T07:55:00Z',
  },
  {
    login: 'youssef.t',
    full_name: 'Youssef T.',
    role: 'manager',
    status: 'active',
    locked_min: null,
    created: '2026-09-08T09:30:00Z',
  },
  {
    login: 'leila.k',
    full_name: 'Leila K.',
    role: 'dispatcher',
    status: 'active',
    locked_min: null,
    created: '2026-09-15T10:00:00Z',
  },
  {
    login: 'omar.b',
    full_name: 'Omar B.',
    role: 'dispatcher',
    status: 'inactive',
    locked_min: null,
    created: '2026-09-02T11:20:00Z',
  },
  {
    login: 'rania.m',
    full_name: 'Rania M.',
    role: 'manager',
    status: 'active',
    locked_min: 12,
    created: '2026-10-05T08:45:00Z',
  },
] as const;

/** Password of every demo and sample account in the browser mock (README). */
export const DEMO_PASSWORD = 'venzini-demo';

/** Weather and events of the demo week, fixed so the factor lists stay readable. */
export const DEMO_WEEK_EXTERNAL = {
  /** Weather data missing for Tunis Centre on 06 and 07 Nov (ST014 Diesel becomes uncertain). */
  missingWeather: [
    { region: 'Tunis Centre', date: '2026-11-06' },
    { region: 'Tunis Centre', date: '2026-11-07' },
  ],
  rainyDays: [
    { region: 'Tunis North', date: '2026-11-04' },
    { region: 'Tunis Centre', date: '2026-11-05' },
    { region: 'Tunis South', date: '2026-11-08' },
  ],
  events: [
    { region: 'Tunis North', date: '2026-11-05', name: 'A football match', impact_pct: 8 },
    { region: 'Tunis South', date: '2026-11-07', name: 'The Mornag wine fair', impact_pct: 5 },
  ],
} as const;

/** ST014 Diesel: week-to-week variation of its Saturday sales (ALG-02 cv), giving 66% confidence. */
export const ST014_DIESEL_SATURDAY_CV = 0.09;

export const HOLIDAYS: Record<string, string> = {
  '01-01': "New Year's Day",
  '01-14': 'Revolution Day',
  '03-20': 'Independence Day',
  '04-09': "Martyrs' Day",
  '05-01': 'Labour Day',
  '07-25': 'Republic Day',
  '08-13': "Women's Day",
  '10-15': 'Evacuation Day',
  '12-17': 'Revolution Day',
};

// TanStack Query hooks: server data lives only in the query cache (SDD 5.2.3).
import {
  Forecast,
  ForecastTotals,
  LoginResponse,
  MeResponse,
  Network,
  PlanView,
  Reference,
  Resources,
  SaveResourcesResponse,
  StationList,
  Trip,
  TripList,
  type LoginRequest,
  type SaveResourcesRequest,
  type UpdateTripRequest,
} from '@venzini/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, markSession, request } from './client';

export const keys = {
  me: ['me'] as const,
  reference: ['reference'] as const,
  network: (day: string) => ['network', day] as const,
  plan: (day: string) => ['plan', day] as const,
  stations: ['stations'] as const,
  forecast: (station: string, fuel: string) => ['forecast', station, fuel] as const,
  totals: (level: string, fuel: string) => ['totals', level, fuel] as const,
  resources: (day: string) => ['resources', day] as const,
  trips: (day: string) => ['trips', day] as const,
};

/** Treats 404 ERR-API-01 as "nothing yet" for reads that may legitimately be empty. */
async function orNull<T>(load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      const me = await request('GET', '/me', { schema: MeResponse });
      markSession(true);
      return me;
    },
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      request('POST', '/auth/login', { body, schema: LoginResponse }),
    onSuccess: async () => {
      markSession(true);
      await qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => request('POST', '/auth/logout'),
    onSettled: () => {
      markSession(false);
      qc.clear();
    },
  });
}

/** API-P1: fuel types, warehouses and regions, cached for 10 minutes (SDD 5.6.4). */
export function useReference() {
  return useQuery({
    queryKey: keys.reference,
    queryFn: () => request('GET', '/reference', { schema: Reference }),
    staleTime: 10 * 60_000,
  });
}

export function useNetwork(day: string) {
  return useQuery({
    queryKey: keys.network(day),
    queryFn: () => request('GET', `/network?day=${day}`, { schema: Network }),
  });
}

/** API-P2: the current plan of a day, or null when none exists yet. */
export function usePlanOfDay(day: string, enabled = true) {
  return useQuery({
    queryKey: keys.plan(day),
    enabled,
    queryFn: async () => {
      try {
        return await request('GET', `/plans?day=${day}`, { schema: PlanView });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
  });
}

/** API-05: station records, for the station picker (manager, admin). */
export function useStations() {
  return useQuery({
    queryKey: keys.stations,
    queryFn: () => request('GET', '/stations?page_size=200', { schema: StationList }),
    staleTime: 5 * 60_000,
  });
}

/** API-10: the 7-day forecast of a station and fuel; null when none can be shown. */
export function useForecast(station: string | null, fuel: string | null) {
  return useQuery({
    queryKey: keys.forecast(station ?? '', fuel ?? ''),
    enabled: !!station && !!fuel,
    queryFn: () =>
      orNull(() =>
        request('GET', `/forecasts?station=${station}&fuel=${fuel}`, { schema: Forecast }),
      ),
  });
}

/** API-19: network or per-warehouse totals (D-17: dispatchers read warehouse level only). */
export function useTotals(level: 'network' | 'warehouse', fuel: string | null) {
  return useQuery({
    queryKey: keys.totals(level, fuel ?? ''),
    enabled: !!fuel,
    queryFn: () =>
      request('GET', `/forecasts/totals?level=${level}&fuel=${fuel}`, { schema: ForecastTotals }),
  });
}

/** API-06: the day's resources; null when none are uploaded (FR-13). */
export function useResources(day: string) {
  return useQuery({
    queryKey: keys.resources(day),
    queryFn: () => orNull(() => request('GET', `/resources/${day}`, { schema: Resources })),
  });
}

/** API-07: saves a new version of the day's resources. */
export function useSaveResources(day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaveResourcesRequest) =>
      request('PUT', `/resources/${day}`, { body, schema: SaveResourcesResponse }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.resources(day) }),
        qc.invalidateQueries({ queryKey: keys.network(day) }),
      ]);
    },
  });
}

/** API-P3: trips of a day. */
export function useTrips(day: string) {
  return useQuery({
    queryKey: keys.trips(day),
    queryFn: () => request('GET', `/trips?day=${day}`, { schema: TripList }),
  });
}

/** API-08: records departure or return times, or cancels a planned trip. */
export function useUpdateTrip(day: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ routeId, body }: { routeId: string; body: UpdateTripRequest }) =>
      request('PATCH', `/trips/${routeId}`, { body, schema: Trip }),
    onSuccess: async () => {
      // Open trips also change the warnings on the resources of later days.
      await Promise.all([
        qc.invalidateQueries({ queryKey: keys.trips(day) }),
        qc.invalidateQueries({ queryKey: ['resources'] }),
      ]);
    },
  });
}

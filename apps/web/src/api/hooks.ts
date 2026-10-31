// TanStack Query hooks: server data lives only in the query cache (SDD 5.2.3).
import {
  LoginResponse,
  MeResponse,
  Network,
  PlanView,
  Reference,
  type LoginRequest,
} from '@venzini/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, markSession, request } from './client';

export const keys = {
  me: ['me'] as const,
  reference: ['reference'] as const,
  network: (day: string) => ['network', day] as const,
  plan: (day: string) => ['plan', day] as const,
};

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

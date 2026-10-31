// The one place that talks to /api/v1 (SDD 5.2.3). In the MVP the mock service worker answers;
// in v1 the real API does, with no change here (SDD 7.4).
import {
  API_BASE_PATH,
  CORRELATION_HEADER,
  CSRF_HEADER,
  CSRF_VALUE,
  ErrorBody,
} from '@venzini/contracts';
import type { z } from 'zod';

/** A failed request, with the SRS 14.2 message to show next to the field or action (SDD 6.2). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly field?: string,
    readonly details?: Record<string, unknown>,
    readonly correlationId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const SESSION_EXPIRED_EVENT = 'vz:session-expired';

/** Set once the user has a session, so a later 401 means "expired", not "never logged in". */
let hadSession = false;
export const markSession = (active: boolean) => {
  hadSession = active;
};

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Shown when a request never reached the Venzini API (no answer, or an answer without our
 * correlation ID). It is not an SRS error code; the SRS messages stay for the API's own errors.
 */
export const UNREACHABLE_CODE = 'CLIENT-UNREACHABLE';
export const UNREACHABLE_MESSAGE = 'Venzini could not be reached. Please try again.';

/**
 * Optional repair step, run once when a request did not reach the API, before a single retry.
 * The MVP uses it to reconnect the browser mock API after the browser restarted its worker.
 */
let recovery: (() => Promise<void>) | null = null;
let recovering: Promise<void> | null = null;
export function setApiRecovery(fn: (() => Promise<void>) | null) {
  recovery = fn;
}
async function recover(): Promise<void> {
  if (!recovery) return;
  // Requests failing together share one repair.
  recovering ??= recovery().finally(() => {
    recovering = null;
  });
  await recovering;
}

const unreachable = (status = 0, correlationId?: string) =>
  new ApiError(status, UNREACHABLE_CODE, UNREACHABLE_MESSAGE, undefined, undefined, correlationId);

async function send(method: Method, path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(`${API_BASE_PATH}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { [CSRF_HEADER]: CSRF_VALUE } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    return null;
  }
}

/** Every answer of the Venzini API carries a correlation ID (SDD 5.6.1). */
const fromApi = (res: Response | null): boolean => !!res?.headers.get(CORRELATION_HEADER);

export async function request<S extends z.ZodType>(
  method: Method,
  path: string,
  options: { body?: unknown; schema?: S } = {},
): Promise<z.infer<S>> {
  let res = await send(method, path, options.body);
  if (!fromApi(res) && recovery) {
    await recover();
    res = await send(method, path, options.body);
  }
  if (!res || !fromApi(res)) throw unreachable(res?.status ?? 0);

  const correlationId = res.headers.get(CORRELATION_HEADER) ?? undefined;
  if (res.status === 204) return undefined as z.infer<S>;
  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ErrorBody.safeParse(data);
    const err = parsed.success
      ? new ApiError(
          res.status,
          parsed.data.error.code,
          parsed.data.error.message,
          parsed.data.error.field,
          parsed.data.error.details,
          correlationId,
        )
      : unreachable(res.status, correlationId);
    if (err.code === 'ERR-AUTH-05' && hadSession) {
      hadSession = false;
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw err;
  }
  // Responses are checked against the contract, so a drift shows up at once (SDD 7.1).
  return options.schema ? options.schema.parse(data) : (data as z.infer<S>);
}

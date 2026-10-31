// The one place that talks to /api/v1 (SDD 5.2.3). In the MVP the mock service worker answers;
// in v1 the real API does, with no change here (SDD 7.4).
import {
  API_BASE_PATH,
  CORRELATION_HEADER,
  CSRF_HEADER,
  CSRF_VALUE,
  ErrorBody,
  formatMessage,
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

export async function request<S extends z.ZodType>(
  method: Method,
  path: string,
  options: { body?: unknown; schema?: S } = {},
): Promise<z.infer<S>> {
  const write = method !== 'GET';
  let res: Response;
  try {
    res = await fetch(`${API_BASE_PATH}${path}`, {
      method,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(write ? { [CSRF_HEADER]: CSRF_VALUE } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'ERR-SYS-01', 'The server could not be reached. Please try again.');
  }

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
      : new ApiError(
          res.status,
          'ERR-SYS-01',
          formatMessage('ERR-SYS-01'),
          undefined,
          undefined,
          correlationId,
        );
    if (err.code === 'ERR-AUTH-05' && hadSession) {
      hadSession = false;
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw err;
  }
  // Responses are checked against the contract, so a drift shows up at once (SDD 7.1).
  return options.schema ? options.schema.parse(data) : (data as z.infer<S>);
}

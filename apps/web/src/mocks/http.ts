// Shared rules of every mock endpoint (SDD 5.6.1): session, role check (SDD 6.1.1), CSRF header,
// validation with the contract schemas, error body and correlation ID.
import {
  API_BASE_PATH,
  canCall,
  CORRELATION_HEADER,
  CSRF_HEADER,
  CSRF_VALUE,
  ERRORS,
  formatMessage,
  type EndpointId,
  type ErrorCode,
  type SessionUser,
} from '@venzini/contracts';
import {
  HttpResponse,
  type DefaultBodyType,
  type HttpResponseResolver,
  type PathParams,
} from 'msw';
import type { z } from 'zod';
import { store, type UserRecord } from './store';

/** Matches the API path on any origin (browser and tests). */
export const api = (path: string) => `*${API_BASE_PATH}${path}`;

const headers = () => ({ [CORRELATION_HEADER]: crypto.randomUUID() });

export function json<T extends DefaultBodyType>(body: T, status = 200) {
  return HttpResponse.json(body, { status, headers: headers() });
}

export function noContent() {
  return new HttpResponse(null, { status: 204, headers: headers() });
}

/** An error response with the SRS 14.2 message (SDD 5.6.1 error body). */
export function fail(
  code: ErrorCode,
  params: Record<string, string | number> = {},
  extra: { field?: string; details?: Record<string, unknown>; status?: number } = {},
) {
  const status = extra.status ?? ERRORS[code].status ?? 400;
  return HttpResponse.json(
    {
      error: {
        code,
        message: formatMessage(code, params),
        ...(extra.field ? { field: extra.field } : {}),
        ...(extra.details ? { details: extra.details } : {}),
      },
    },
    { status, headers: headers() },
  );
}

/** "stock_l" → "Stock", "fuel_type_id" → "Fuel type ID". */
function label(key: string): string {
  const text = key.replace(/_l$/, '').replace(/_id$/, ' ID').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "stock.2.stock_l" style path → "stock[2].stock_l" (SDD 5.6.3). */
function fieldPath(path: PropertyKey[]): string {
  return path.reduce<string>(
    (acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${String(p)}` : String(p)),
    '',
  );
}

/** Turns the first Zod issue into ERR-VAL-01 (missing) or ERR-VAL-02 (rule broken), naming the field. */
export function validationError(error: z.ZodError) {
  const issue = error.issues[0]!;
  if (issue.code === 'unrecognized_keys') {
    const key = issue.keys[0] ?? '';
    const field = fieldPath([...issue.path, key]);
    return fail('ERR-VAL-02', { field: label(key), rule: 'this field is not allowed' }, { field });
  }
  const last = [...issue.path].reverse().find((p) => typeof p === 'string');
  const name = label(typeof last === 'string' ? last : 'Request');
  const field = issue.path.length ? fieldPath(issue.path) : undefined;
  if (issue.code === 'invalid_type' && issue.message.includes('received undefined'))
    return fail('ERR-VAL-01', { field: name }, field ? { field } : {});
  return fail('ERR-VAL-02', { field: name, rule: issue.message }, field ? { field } : {});
}

export async function readBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { error: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    raw = undefined;
  }
  const parsed = schema.safeParse(raw ?? {});
  return parsed.success ? { data: parsed.data } : { error: validationError(parsed.error) };
}

export function readQuery<S extends z.ZodType>(
  request: Request,
  schema: S,
): { data: z.infer<S> } | { error: Response } {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  return parsed.success ? { data: parsed.data } : { error: validationError(parsed.error) };
}

export interface Ctx<P extends PathParams> {
  request: Request;
  params: P;
  user: UserRecord | null;
}

export const sessionUser = (u: UserRecord): SessionUser => ({
  id: u.id,
  full_name: u.full_name,
  role: u.role,
});

const WRITE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Wraps a handler with the CSRF check, the session check and the role check of its endpoint. */
export function route<P extends PathParams>(
  endpoint: EndpointId,
  handler: (ctx: Ctx<P>) => Response | Promise<Response>,
): HttpResponseResolver<P> {
  return ({ request, params }) => {
    if (WRITE.has(request.method) && request.headers.get(CSRF_HEADER) !== CSRF_VALUE)
      return fail('ERR-AUTH-06');
    const user = store.currentUser();
    if (canCall(endpoint, null)) return handler({ request, params, user });
    if (!user) return fail('ERR-AUTH-05');
    if (!canCall(endpoint, user.role)) return fail('ERR-AUTH-04'); // default deny (SDD 6.1.1)
    return handler({ request, params, user });
  };
}

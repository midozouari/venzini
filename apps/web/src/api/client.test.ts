import { formatMessage } from '@venzini/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request, setApiRecovery, UNREACHABLE_CODE, UNREACHABLE_MESSAGE } from './client';

const apiAnswer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': 'c-1' },
  });
const notFromApi = () => new Response('Not found', { status: 404 }); // e.g. the web server

afterEach(() => {
  vi.restoreAllMocks();
  setApiRecovery(null);
});

describe('API client (SDD 6.2)', () => {
  it('shows the API error message of a Venzini error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      apiAnswer(409, { error: { code: 'ERR-API-03', message: formatMessage('ERR-API-03') } }),
    );
    await expect(request('GET', '/plans/PL-1')).rejects.toMatchObject({ code: 'ERR-API-03' });
  });

  it('never uses the plan-edit wording (ERR-SYS-01) when the API was not reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notFromApi());
    const err = await request('GET', '/network').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe(UNREACHABLE_CODE);
    expect((err as ApiError).message).toBe(UNREACHABLE_MESSAGE);
    expect((err as ApiError).message).not.toBe(formatMessage('ERR-SYS-01'));
  });

  it('repairs the connection once and retries when the API was not reached', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(notFromApi())
      .mockResolvedValueOnce(apiAnswer(200, { status: 'ok' }));
    const repair = vi.fn(async () => {});
    setApiRecovery(repair);
    await expect(request('GET', '/health')).resolves.toEqual({ status: 'ok' });
    expect(repair).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('shares one repair between requests failing together', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => notFromApi());
    const repair = vi.fn(() => new Promise<void>((r) => setTimeout(r, 10)));
    setApiRecovery(repair);
    await Promise.allSettled([request('GET', '/a'), request('GET', '/b')]);
    expect(repair).toHaveBeenCalledTimes(1);
  });
});

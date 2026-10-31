// API-01 to API-03: login with lockout, logout, current user (SDD 5.6.3, SEQ-01, NFR-21).
import {
  LOCKOUT_DURATION_MIN,
  LOCKOUT_MAX_FAILURES,
  LOCKOUT_WINDOW_MIN,
  LoginRequest,
  ROLE_CAN,
  ROLE_HOME,
  ROLE_PAGES,
  SESSION_IDLE_MIN,
  type LoginResponse,
  type MeResponse,
} from '@venzini/contracts';
import { http } from 'msw';
import { nowMs } from '../clock';
import { api, fail, json, noContent, readBody, route, sessionUser } from '../http';
import { store } from '../store';

const minutesLeft = (until: number) => Math.max(1, Math.ceil((until - nowMs()) / 60_000));

export const authHandlers = [
  http.post(
    api('/auth/login'),
    route('API-01', async ({ request }) => {
      const body = await readBody(request, LoginRequest);
      if ('error' in body) return body.error;
      const { login, password } = body.data;
      const user = store.state.users.find(
        (u) => u.login.toLowerCase() === login.trim().toLowerCase(),
      );
      // Same message for an unknown login and a wrong password (SEQ-01).
      if (!user) return fail('ERR-AUTH-01');

      if (user.locked_until !== null && user.locked_until > nowMs()) {
        const n = minutesLeft(user.locked_until);
        return fail('ERR-AUTH-03', { n }, { details: { retry_after_min: n } });
      }
      if (user.password !== password) {
        const windowStart = nowMs() - LOCKOUT_WINDOW_MIN * 60_000;
        user.failures = [...user.failures.filter((t) => t > windowStart), nowMs()];
        if (user.failures.length >= LOCKOUT_MAX_FAILURES) {
          user.locked_until = nowMs() + LOCKOUT_DURATION_MIN * 60_000;
          user.failures = [];
          return fail(
            'ERR-AUTH-03',
            { n: LOCKOUT_DURATION_MIN },
            { details: { retry_after_min: LOCKOUT_DURATION_MIN } },
          );
        }
        return fail('ERR-AUTH-01');
      }
      if (user.status === 'inactive') return fail('ERR-AUTH-02');

      user.failures = [];
      user.locked_until = null;
      store.state.sessionUserId = user.id;
      const response: LoginResponse = {
        user: sessionUser(user),
        home: ROLE_HOME[user.role],
        idle_timeout_min: SESSION_IDLE_MIN,
      };
      return json(response);
    }),
  ),

  http.post(
    api('/auth/logout'),
    route('API-02', () => {
      store.state.sessionUserId = null;
      return noContent();
    }),
  ),

  http.get(
    api('/me'),
    route('API-03', ({ user }) => {
      const response: MeResponse = {
        user: sessionUser(user!),
        pages: [...ROLE_PAGES[user!.role]],
        can: { ...ROLE_CAN[user!.role] },
      };
      return json(response);
    }),
  ),
];

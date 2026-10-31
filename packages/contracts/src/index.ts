// Venzini API contracts (SDD 5.6): one Zod schema per request and response, shared by the
// web app and the mock API (and later the real API).

/** Base path of every Venzini API endpoint (SDD 5.6.1). */
export const API_BASE_PATH = '/api/v1';

export * from './common';
export * from './errors';
export * from './rules';
export * from './rbac';
export * from './format';
export * from './templates';
export * from './auth';
export * from './stations';
export * from './resources';
export * from './plans';
export * from './network';
export * from './forecasts';
export * from './decisions';

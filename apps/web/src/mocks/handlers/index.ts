import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { decisionHandlers } from './decisions';
import { networkHandlers } from './network';
import { planHandlers } from './plans';
import { resourceHandlers } from './resources';

// One MSW handler per endpoint: API-01 to API-19 and API-P1 to API-P4 (SDD 7.1).
export const handlers = [
  ...authHandlers,
  ...adminHandlers,
  ...resourceHandlers,
  ...networkHandlers,
  ...planHandlers,
  ...decisionHandlers,
];

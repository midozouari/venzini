import { devHandlers } from '../dev';
import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { decisionHandlers } from './decisions';
import { networkHandlers } from './network';
import { planHandlers } from './plans';
import { resourceHandlers } from './resources';

// One MSW handler per endpoint: API-01 to API-19 and API-P1 to API-P4 (SDD 7.1).
// The developer toolbar's forced errors come first; they answer only while switched on.
export const handlers = [
  ...devHandlers,
  ...authHandlers,
  ...adminHandlers,
  ...resourceHandlers,
  ...networkHandlers,
  ...planHandlers,
  ...decisionHandlers,
];

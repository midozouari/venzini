import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** The browser mock API of the MVP (SDD 7.1). */
export const worker = setupWorker(...handlers);

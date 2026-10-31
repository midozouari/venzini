import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** The browser mock API of the MVP (SDD 7.1). */
export const worker = setupWorker(...handlers);

const options = { onUnhandledFrame: 'bypass' as const, quiet: false };

export async function startMocks(): Promise<void> {
  await worker.start(options);
}

/**
 * Browsers stop an idle service worker (for example in a background tab). When it starts again
 * it no longer knows this page and lets API requests through to the web server. Restarting the
 * worker registers the page again; the mock data lives in the page and is kept.
 */
export async function reconnectMocks(): Promise<void> {
  worker.stop();
  await worker.start({ ...options, quiet: true });
}

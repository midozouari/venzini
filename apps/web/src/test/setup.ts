import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// Node's fetch needs absolute URLs; the app calls "/api/v1/…" like a browser does.
const nodeFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  nodeFetch(
    typeof input === 'string' && input.startsWith('/') ? new URL(input, 'http://localhost') : input,
    init,
  );

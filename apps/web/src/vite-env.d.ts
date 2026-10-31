/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" builds the MVP: Mock Service Worker answers /api/v1 in the browser (SDD 7). */
  readonly VITE_USE_MOCKS: string;
  /** First delivery day shown (YYYY-MM-DD); tomorrow when empty. */
  readonly VITE_DEFAULT_DELIVERY_DAY?: string;
  /** Map tile URL template (SDD 5.6.6). */
  readonly VITE_MAP_TILE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Test hook set by the Playwright suite before the app starts (e2e/tests/helpers.ts). */
interface Window {
  __VENZINI_TEST__?: { tileUrl?: string };
}

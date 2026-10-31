/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" builds the MVP: Mock Service Worker answers /api/v1 in the browser (SDD 7). */
  readonly VITE_USE_MOCKS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

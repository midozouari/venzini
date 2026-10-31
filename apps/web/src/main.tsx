import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { setApiRecovery } from './api/client';
import { App } from './app/App';
import './index.css';

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { startMocks, reconnectMocks } = await import('./mocks/browser');
  await startMocks();
  // If the browser restarted the mock worker, reconnect it and retry the request once.
  setApiRecovery(reconnectMocks);
}

void enableMocks().then(() => {
  const root = document.getElementById('root');
  if (!root) throw new Error('Root element #root not found');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});

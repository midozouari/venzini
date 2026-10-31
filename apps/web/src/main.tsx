import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './index.css';

async function enableMocks() {
  if (import.meta.env.VITE_USE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledFrame: 'bypass' });
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

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css'; // Always import styles BEFORE components to prevent FOUC (Flash of Unstyled Content)
import App from './App';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
  });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('FATAL: Root element not found in index.html. Initialization aborted.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);

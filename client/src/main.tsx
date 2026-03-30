import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css'; // Always import styles BEFORE components to prevent FOUC (Flash of Unstyled Content)
import App from './App';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('FATAL: Root element not found in index.html. Initialization aborted.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
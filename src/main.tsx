import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import './index.css';

// attach global error handler for debugging
window.onerror = function(message, source, lineno, colno, error) {
  console.error('Global error:', {message, source, lineno, colno, error});
};

import { ErrorBoundary } from './components/ErrorBoundary';

// Register service worker (required for PWA install prompt on Android Chrome)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed — non-fatal
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);

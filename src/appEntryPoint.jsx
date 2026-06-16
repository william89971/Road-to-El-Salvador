import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globalStyles.css'
import GameController from './GameController.jsx'
import ErrorBoundary from './screens/ErrorBoundary.jsx'

// Global error handler: log to console only, no external telemetry.
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global error:', { message, source, lineno, colno, error });
};

const root = createRoot(document.getElementById('root'))
root.render(
  <StrictMode>
    <ErrorBoundary>
      <GameController />
    </ErrorBoundary>
  </StrictMode>,
)

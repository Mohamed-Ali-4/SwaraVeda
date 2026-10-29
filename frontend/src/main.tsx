import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The preview build answers API calls in the browser (see src/preview).
if (import.meta.env.VITE_PREVIEW === '1') {
  const { install } = await import('./preview/mock')
  install()
}

// Keep the app on the device so it opens and records without internet.
if (import.meta.env.PROD && import.meta.env.VITE_PREVIEW !== '1' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

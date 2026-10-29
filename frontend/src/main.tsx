import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// The preview build answers API calls in the browser (see src/preview).
if (import.meta.env.VITE_PREVIEW === '1') {
  const { install } = await import('./preview/mock')
  install()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

import { StrictMode } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { MotionProvider } from './ui/MotionProvider'
import { initializeInstallPrompt } from './features/install/installPrompt'
import './styles/index.css'

initializeInstallPrompt()

// Reload clients when the configured auto-update worker takes control, so an
// old page cannot request lazy chunks that were removed by a new deployment.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider><RouterProvider router={router} /></MotionProvider>
  </StrictMode>,
)

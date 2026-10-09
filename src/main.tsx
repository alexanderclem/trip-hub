import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { MotionProvider } from './ui/MotionProvider'
import { initializeInstallPrompt } from './features/install/installPrompt'
import { clearPreResetTrips } from './data/reset'
import './styles/index.css'

initializeInstallPrompt()

function start() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MotionProvider><RouterProvider router={router} /></MotionProvider>
    </StrictMode>,
  )
}

// Trips from before the alpha reset are cleared before anything is shown; a failure never blocks
// the app. Reloading the same address keeps a new invite link that was just opened.
clearPreResetTrips().then((cleared) => (cleared ? location.reload() : start()), start)

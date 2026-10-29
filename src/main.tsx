import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { MotionProvider } from './ui/MotionProvider'
import { initializeInstallPrompt } from './features/install/installPrompt'
import { clearPreResetTrips } from './data/reset'
import { setWriteGuard } from './data/repo'
import { useDevice } from './data/device'
import { writeRefusal } from './data/access'
import './styles/index.css'
import './styles/journal.css'

initializeInstallPrompt()

// Saves the server would refuse for this phone's role fail at once, with a reason the form shows.
setWriteGuard((table, row, me) => {
  const tripId = (table === 'trips' ? row.id : row.trip_id) as string | undefined
  const access = tripId ? useDevice.getState().access[tripId] : undefined
  return access ? writeRefusal(access, table, row, me) : null
})

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

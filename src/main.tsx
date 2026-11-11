import { initializeAppearance } from './ui/appearance'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router, routes } from './router'
import { installIntentPreload } from './app/preload'
import { MotionProvider } from './ui/MotionProvider'
import { StowawayTheme } from './ui/StowawayTheme'
import { initializeInstallPrompt } from './features/install/installPrompt'
import { clearPreResetTrips } from './data/reset'
import { setWriteGuard } from './data/repo'
import { useDevice } from './data/device'
import { writeRefusal } from './data/access'
import { rememberSource } from './features/funnel/events'
import './styles/index.css'
import './styles/journal.css'
import './styles/travel-notebook.css'
import './styles/app-theme.css'
import './styles/group-pick.css'

initializeAppearance()
initializeInstallPrompt()
installIntentPreload(routes)
rememberSource(location.search)

// Saves the server would refuse for this phone's role fail at once, with a reason the form shows.
setWriteGuard((table, row, me) => {
  const tripId = (table === 'trips' ? row.id : row.trip_id) as string | undefined
  const access = tripId ? useDevice.getState().access[tripId] : undefined
  return access ? writeRefusal(access, table, row, me) : null
})

function start() {
  const element = document.getElementById('root')!
  const application = (
    <StrictMode>
      <StowawayTheme><MotionProvider><RouterProvider router={router!} /></MotionProvider></StowawayTheme>
    </StrictMode>
  )
  const renderedPath = element.dataset.prerender
  const standalone = matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)
  if (renderedPath === location.pathname && !standalone) {
    const hydrate = () => hydrateRoot(element, application)
    if (router!.state.initialized) hydrate()
    else {
      const unsubscribe = router!.subscribe((state) => { if (state.initialized) { unsubscribe(); hydrate() } })
    }
  } else createRoot(element).render(application)
}

// Trips from before the alpha reset are cleared before anything is shown; a failure never blocks
// the app. Reloading the same address keeps a new invite link that was just opened.
clearPreResetTrips().then((cleared) => (cleared ? location.reload() : start()), start)

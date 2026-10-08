import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { router } from './router'
import { MotionProvider } from './ui/MotionProvider'
import { initializeInstallPrompt } from './features/install/installPrompt'
import './styles/index.css'

initializeInstallPrompt()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionProvider><RouterProvider router={router} /></MotionProvider>
  </StrictMode>,
)

import { createBrowserRouter, Navigate } from 'react-router'
import { RootLayout } from './app/layouts/RootLayout'
import { TripLayout } from './app/layouts/TripLayout'
import { HomeScreen } from './features/trips/HomeScreen'
import { Placeholder } from './app/Placeholder'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      {
        path: '/t/:tripId',
        element: <TripLayout />,
        children: [
          { index: true, element: <Navigate to="map" replace /> },
          { path: 'map', element: <Placeholder title="Map" phase={2} /> },
          { path: 'plan', element: <Placeholder title="Plan" phase={5} /> },
          { path: 'tickets', element: <Placeholder title="Tickets" phase={7} /> },
          { path: 'money', element: <Placeholder title="Money" phase={6} /> },
          { path: 'more', element: <Placeholder title="More" phase={4} /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

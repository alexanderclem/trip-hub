import { createBrowserRouter, Navigate } from 'react-router'
import { RootLayout } from './app/layouts/RootLayout'
import { TripLayout } from './app/layouts/TripLayout'
import { Placeholder } from './app/Placeholder'
import { PlaceDetailScreen } from './features/places/PlaceDetailScreen'
import { PlaceFormScreen } from './features/places/PlaceFormScreen'
import { PlacesScreen } from './features/places/PlacesScreen'
import { CreateTripScreen } from './features/trips/CreateTripScreen'
import { HomeScreen } from './features/trips/HomeScreen'
import { JoinScreen } from './features/trips/JoinScreen'
import { MoreScreen } from './features/trips/MoreScreen'
import { SettingsScreen } from './features/trips/SettingsScreen'
import { WhoScreen } from './features/trips/WhoScreen'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/new', element: <CreateTripScreen /> },
      { path: '/join', element: <JoinScreen /> },
      { path: '/t/:tripId/who', element: <WhoScreen /> },
      {
        path: '/t/:tripId',
        element: <TripLayout />,
        children: [
          { index: true, element: <Navigate to="map" replace /> },
          { path: 'map', lazy: () => import('./features/map/MapScreen').then((m) => ({ Component: m.default })) },
          { path: 'plan', element: <Placeholder title="Plan" phase={5} /> },
          { path: 'tickets', element: <Placeholder title="Tickets" phase={7} /> },
          { path: 'money', element: <Placeholder title="Money" phase={6} /> },
          { path: 'more', element: <MoreScreen /> },
          { path: 'more/places', element: <PlacesScreen /> },
          { path: 'more/places/new', element: <PlaceFormScreen /> },
          { path: 'more/places/:placeId', element: <PlaceDetailScreen /> },
          { path: 'more/places/:placeId/edit', element: <PlaceFormScreen /> },
          { path: 'more/settings', element: <SettingsScreen /> },
          { path: 'more/vote', element: <Placeholder title="Votes" phase={4} /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

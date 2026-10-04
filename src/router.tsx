import { createBrowserRouter, Navigate } from 'react-router'
import { RouteError } from './app/RouteError'
import { AuthCallbackScreen } from './features/account/AuthCallbackScreen'
import { ConnectorConsentScreen } from './features/account/ConnectorConsentScreen'
import { ConnectedAppsScreen } from './features/account/ConnectedAppsScreen'
import { RootLayout } from './app/layouts/RootLayout'
import { TripLayout } from './app/layouts/TripLayout'
import { PlaceDetailScreen } from './features/places/PlaceDetailScreen'
import { PlaceFormScreen } from './features/places/PlaceFormScreen'
import { PlacesScreen } from './features/places/PlacesScreen'
import { PollScreen } from './features/polls/PollScreen'
import { ItemDetailScreen } from './features/itinerary/ItemDetailScreen'
import { ItemFormScreen } from './features/itinerary/ItemFormScreen'
import { PlanScreen } from './features/itinerary/PlanScreen'
import { PollsScreen } from './features/polls/PollsScreen'
import { ExpenseFormScreen } from './features/money/ExpenseFormScreen'
import { MoneyScreen } from './features/money/MoneyScreen'
import { TicketFormScreen } from './features/tickets/TicketFormScreen'
import { TicketsScreen } from './features/tickets/TicketsScreen'
import { TicketViewerScreen } from './features/tickets/TicketViewerScreen'
import { CreateTripScreen } from './features/trips/CreateTripScreen'
import { QuizScreen } from './features/onboarding/QuizScreen'
import { StartScreen } from './features/onboarding/WelcomeScreen'
import { JoinScreen } from './features/trips/JoinScreen'
import { MoreScreen } from './features/trips/MoreScreen'
import { SettingsScreen } from './features/trips/SettingsScreen'
import { WhoScreen } from './features/trips/WhoScreen'
import { TasksScreen } from './features/tasks/TasksScreen'
import { TaskFormScreen } from './features/tasks/TaskFormScreen'
import { PackingScreen } from './features/packing/PackingScreen'
import { PackingFormScreen } from './features/packing/PackingFormScreen'
import { DriverScreen, EmergencyScreen, MedicalScreen } from './features/emergency/EmergencyScreen'
import { EmergencyEditScreen, EmergencyNumbersScreen } from './features/emergency/EmergencyEditScreen'
import { WrappedScreen } from './features/wrapped/WrappedScreen'
import { DiscoveryScreen } from './features/discovery/DiscoveryScreen'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <StartScreen /> },
      { path: '/quiz', element: <QuizScreen /> },
      { path: '/new', element: <CreateTripScreen /> },
      { path: '/inspire', element: <DiscoveryScreen /> },
      { path: '/join', element: <JoinScreen /> },
      { path: '/auth/callback', element: <AuthCallbackScreen /> },
      { path: '/oauth/consent', element: <ConnectorConsentScreen /> },
      { path: '/connections', element: <ConnectedAppsScreen /> },
      { path: '/t/:tripId/who', element: <WhoScreen /> },
      {
        path: '/t/:tripId',
        element: <TripLayout />,
        children: [
          { index: true, element: <Navigate to="map" replace /> },
          { path: 'map', lazy: () => import('./features/map/MapScreen').then((m) => ({ Component: m.default })) },
          { path: 'plan', element: <PlanScreen /> },
          { path: 'plan/new', element: <ItemFormScreen /> },
          { path: 'plan/:itemId', element: <ItemDetailScreen /> },
          { path: 'plan/:itemId/edit', element: <ItemFormScreen /> },
          { path: 'tickets', element: <TicketsScreen /> },
          { path: 'tickets/new', element: <TicketFormScreen /> },
          { path: 'tickets/:attachmentId', element: <TicketViewerScreen /> },
          { path: 'money', element: <MoneyScreen /> },
          { path: 'money/new', element: <ExpenseFormScreen /> },
          { path: 'money/:expenseId', element: <ExpenseFormScreen /> },
          { path: 'more', element: <MoreScreen /> },
          { path: 'more/ideas', element: <DiscoveryScreen /> },
          { path: 'more/tasks', element: <TasksScreen /> },
          { path: 'more/tasks/new', element: <TaskFormScreen /> },
          { path: 'more/tasks/:taskId', element: <TaskFormScreen /> },
          { path: 'more/packing', element: <PackingScreen /> },
          { path: 'more/packing/new', element: <PackingFormScreen /> },
          { path: 'more/packing/:itemId', element: <PackingFormScreen /> },
          { path: 'more/emergency', element: <EmergencyScreen /> },
          { path: 'more/emergency/edit', element: <EmergencyEditScreen /> },
          { path: 'more/emergency/numbers', element: <EmergencyNumbersScreen /> },
          { path: 'more/emergency/driver', element: <DriverScreen /> },
          { path: 'more/emergency/me', element: <MedicalScreen /> },
          { path: 'wrapped', element: <WrappedScreen /> },
          { path: 'more/places', element: <PlacesScreen /> },
          { path: 'more/places/new', element: <PlaceFormScreen /> },
          { path: 'more/places/:placeId', element: <PlaceDetailScreen /> },
          { path: 'more/places/:placeId/edit', element: <PlaceFormScreen /> },
          { path: 'more/settings', element: <SettingsScreen /> },
          { path: 'more/vote', element: <PollsScreen /> },
          { path: 'more/vote/:pollId', element: <PollScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

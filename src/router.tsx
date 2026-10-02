import { createBrowserRouter, Navigate } from 'react-router'
import { RouteError } from './app/RouteError'
import { AuthCallbackScreen } from './features/account/AuthCallbackScreen'
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
import { HomeScreen } from './features/trips/HomeScreen'
import { JoinScreen } from './features/trips/JoinScreen'
import { MoreScreen } from './features/trips/MoreScreen'
import { SettingsScreen } from './features/trips/SettingsScreen'
import { WhoScreen } from './features/trips/WhoScreen'
import { TasksScreen } from './features/tasks/TasksScreen'
import { TaskFormScreen } from './features/tasks/TaskFormScreen'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <HomeScreen /> },
      { path: '/new', element: <CreateTripScreen /> },
      { path: '/join', element: <JoinScreen /> },
      { path: '/auth/callback', element: <AuthCallbackScreen /> },
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
          { path: 'more/tasks', element: <TasksScreen /> },
          { path: 'more/tasks/new', element: <TaskFormScreen /> },
          { path: 'more/tasks/:taskId', element: <TaskFormScreen /> },
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

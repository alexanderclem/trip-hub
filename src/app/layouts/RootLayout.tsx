import { Outlet } from 'react-router'
import { useOnline } from '@/lib/useOnline'

export function RootLayout() {
  const online = useOnline()
  return (
    <div className="flex h-full flex-col">
      {!online && (
        <div className="pt-safe bg-amber-100 px-4 py-1.5 text-center text-sm text-amber-900">
          Offline: changes will sync when you're back online
        </div>
      )}
      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}

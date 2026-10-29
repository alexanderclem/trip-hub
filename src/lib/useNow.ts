import { useEffect, useState } from 'react'

/** Refresh calendar labels after midnight and when returning to a sleeping tab. */
export function useNow(interval = 60_000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    const timer = window.setInterval(refresh, interval)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [interval])
  return now
}

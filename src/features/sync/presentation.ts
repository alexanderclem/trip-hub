export function syncLabel(online: boolean, phase: string, pending: number, rejected: number) {
  if (!online || phase === 'offline') return 'Offline'
  if (phase === 'error' || rejected) return 'Needs attention'
  if (phase === 'syncing' && pending) return 'Uploading changes…'
  if (phase === 'syncing' || phase === 'refreshing') return 'Checking for updates…'
  if (pending) return `${pending} waiting to sync`
  return 'Up to date'
}

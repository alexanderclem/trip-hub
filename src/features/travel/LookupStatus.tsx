export function LookupStatus({ loading, error, fetchedAt }: { loading?: boolean; error?: string; fetchedAt?: string }) {
  return <div className="text-sm text-muted" role="status">{loading && <p>Refreshing…</p>}{error && <p>{error}</p>}{fetchedAt && <p>Saved on this phone · Updated {new Date(fetchedAt).toLocaleString()}</p>}</div>
}

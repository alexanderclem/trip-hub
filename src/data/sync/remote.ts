import { supabase } from '@/lib/supabase'
import type { TableName } from '../types'

/** HTTP-ish status of a failed write: 0 means the network never answered. */
export interface RemoteError {
  status: number
  message: string
}

/** The server as the sync engine sees it. Abstracted so the engine can be tested offline. */
export interface Remote {
  write(table: TableName, rows: Record<string, unknown>[]): Promise<RemoteError | null>
  /** Rows of `table` for `tripId` with updated_at > since, ordered by updated_at. */
  pull(
    table: TableName,
    tripId: string,
    since: string,
    offset: number,
    limit: number,
  ): Promise<{ rows: Record<string, unknown>[] } | { error: RemoteError }>
}

function toRemoteError(status: number, message: string): RemoteError {
  return { status, message }
}

export const supabaseRemote: Remote = {
  async write(table, rows) {
    try {
      if (table === 'trips') {
        // Trips are created by the create_trip RPC; clients only ever update them.
        for (const row of rows) {
          const { id, share_token: _token, ...rest } = row
          const { error, status } = await supabase.from('trips').update(rest).eq('id', id as string)
          if (error) return toRemoteError(status, error.message)
        }
        return null
      }
      const { error, status } = await supabase.from(table).upsert(rows, { onConflict: 'id' })
      return error ? toRemoteError(status, error.message) : null
    } catch (e) {
      return toRemoteError(0, e instanceof Error ? e.message : String(e))
    }
  },

  async pull(table, tripId, since, offset, limit) {
    try {
      const { data, error, status } = await supabase
        .from(table)
        .select('*')
        .eq(table === 'trips' ? 'id' : 'trip_id', tripId)
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + limit - 1)
      if (error) return { error: toRemoteError(status, error.message) }
      return { rows: data ?? [] }
    } catch (e) {
      return { error: toRemoteError(0, e instanceof Error ? e.message : String(e)) }
    }
  },
}

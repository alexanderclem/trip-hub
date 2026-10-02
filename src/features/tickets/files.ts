// Ticket files: prepared on the phone, kept on the phone, uploaded to the private Storage bucket
// when there's signal, and downloaded onto every other phone in the group.
import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/data/db'
import { save, softDelete } from '@/data/repo'
import type { Attachment, AttachmentKind } from '@/data/types'
import { newId } from '@/lib/ids'
import { supabase } from '@/lib/supabase'

const BUCKET = 'attachments'
const MAX_BYTES = 15 * 1024 * 1024
const MAX_EDGE = 2400 // px; keeps boarding-pass barcodes scannable
const fileKey = (id: string) => `att:${id}`
const alive = <T extends { deleted_at?: string | null }>(r: T) => !r.deleted_at

export async function sha256(blob: Blob): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Big photos are scaled down (JPEG); PDFs and small images are kept exactly as they are. */
export async function prepareFile(file: File): Promise<{ blob: Blob; mime: string; filename: string }> {
  const big = file.size > 1.5 * 1024 * 1024
  if (file.type.startsWith('image/') && file.type !== 'image/gif' && big) {
    try {
      const bmp = await createImageBitmap(file)
      const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bmp.width * scale)
      canvas.height = Math.round(bmp.height * scale)
      canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
      if (blob && blob.size < file.size) return { blob, mime: 'image/jpeg', filename: file.name.replace(/\.\w+$/, '') + '.jpg' }
    } catch {
      // Browser can't decode it (e.g. HEIC outside Safari): keep the original.
    }
  }
  return { blob: file, mime: file.type || 'application/octet-stream', filename: file.name }
}

const safeName = (name: string) => name.normalize('NFKD').replace(/[^\w.-]+/g, '_').slice(-80) || 'file'

export interface NewAttachment {
  tripId: string
  file: File
  title: string
  kind: AttachmentKind
  itemId: string | null
  confirmationCode: string | null
}

/** Saves the file on this phone and queues it; uploading happens in the background. */
export async function addAttachment(a: NewAttachment, memberId: string | null): Promise<string> {
  const { blob, mime, filename } = await prepareFile(a.file)
  if (blob.size > MAX_BYTES) throw new Error('That file is over 15 MB. Try a screenshot or a smaller PDF.')
  const id = newId()
  const name = safeName(filename)
  await db.files.put({ name: fileKey(id), blob })
  const row: Attachment = {
    id,
    trip_id: a.tripId,
    item_id: a.itemId,
    place_id: null,
    expense_id: null,
    kind: a.kind,
    title: a.title.trim() || filename,
    confirmation_code: a.confirmationCode?.trim() || null,
    storage_path: `${a.tripId}/${id}/${name}`,
    filename: name,
    mime,
    bytes: blob.size,
    sha256: await sha256(blob),
    uploaded_at: null,
  }
  await save('attachments', row, memberId)
  return id
}

export const removeAttachment = (id: string, memberId: string | null) => softDelete('attachments', id, memberId)

/** The file from this phone, or null. */
export async function localBlob(att: Attachment): Promise<Blob | null> {
  const row = await db.files.get(fileKey(att.id))
  return row?.blob ?? null
}

/** The file from this phone, downloading it first if needed (throws when offline and missing). */
export async function getBlob(att: Attachment): Promise<Blob> {
  const local = await localBlob(att)
  if (local) return local
  if (!att.uploaded_at) throw new Error("This file hasn't been uploaded from the phone that added it yet.")
  const { data, error } = await supabase.storage.from(BUCKET).download(att.storage_path)
  if (error || !data) throw new Error(navigator.onLine ? `Couldn't download: ${error?.message ?? 'unknown error'}` : "You're offline and this file isn't on your phone yet.")
  await db.files.put({ name: fileKey(att.id), blob: data })
  return data
}

/** Uploads files this phone has that haven't reached Storage. */
export async function uploadPending(tripId: string, memberId: string | null): Promise<number> {
  if (!navigator.onLine) return 0
  const pending = await db.attachments.where('trip_id').equals(tripId).filter((a) => alive(a) && !a.uploaded_at).toArray()
  let done = 0
  for (const att of pending) {
    const blob = await localBlob(att)
    if (!blob) continue // added on another phone
    const { error } = await supabase.storage.from(BUCKET).upload(att.storage_path, blob, { contentType: att.mime, upsert: true })
    if (error) {
      console.warn('upload failed', att.id, error.message)
      continue
    }
    await save('attachments', { ...att, uploaded_at: new Date().toISOString() }, memberId)
    done++
  }
  return done
}

/** Downloads every uploaded file this phone doesn't have yet. */
export async function downloadMissing(tripId: string, onProgress?: (done: number, total: number) => void): Promise<{ done: number; failed: number }> {
  const atts = await db.attachments.where('trip_id').equals(tripId).filter((a) => alive(a) && !!a.uploaded_at).toArray()
  const have = new Set((await db.files.bulkGet(atts.map((a) => fileKey(a.id)))).filter(Boolean).map((f) => f!.name))
  const missing = atts.filter((a) => !have.has(fileKey(a.id)))
  let done = 0
  let failed = 0
  onProgress?.(0, missing.length)
  for (const att of missing) {
    try {
      await getBlob(att)
      done++
    } catch {
      failed++
    }
    onProgress?.(done + failed, missing.length)
  }
  return { done, failed }
}

/** Live: attachments plus whether each one's file is on this phone. */
export function useAttachments(tripId: string) {
  return useLiveQuery(async () => {
    const atts = await db.attachments.where('trip_id').equals(tripId).filter(alive).toArray()
    const files = await db.files.bulkGet(atts.map((a) => fileKey(a.id)))
    return atts.map((a, i) => ({ att: a, onPhone: !!files[i] }))
  }, [tripId])
}

/** Keeps files moving: upload ours, fetch everyone else's, whenever there's signal. */
export function useAttachmentSync(tripId: string, memberId: string | null) {
  const signature = useLiveQuery(
    async () =>
      (await db.attachments.where('trip_id').equals(tripId).toArray())
        .map((a) => `${a.id}:${a.uploaded_at ? 1 : 0}:${a.deleted_at ? 1 : 0}`)
        .join('|'),
    [tripId],
  )
  useEffect(() => {
    if (signature === undefined) return
    let cancelled = false
    const run = async () => {
      if (cancelled || !navigator.onLine) return
      await uploadPending(tripId, memberId).catch(() => {})
      if (!cancelled) await downloadMissing(tripId).catch(() => {})
    }
    void run()
    window.addEventListener('online', run)
    const timer = setInterval(run, 60_000)
    return () => {
      cancelled = true
      window.removeEventListener('online', run)
      clearInterval(timer)
    }
  }, [tripId, memberId, signature])
}

// Stores offline map files on the device. Uses the Origin Private File System (fast, meant for
// big files) and falls back to a Blob in IndexedDB on browsers without writable OPFS files
// (older iOS). Each file is verified against its expected size after download.
import { db } from '@/data/db'

export interface PackFile {
  name: string // also the pmtiles:// key, e.g. "guatemala-2027-detail.pmtiles"
  url: string
  bytes: number
}

async function opfsRoot(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await navigator.storage?.getDirectory?.()) ?? null
  } catch {
    return null
  }
}

/** The stored file, or null if it's missing or incomplete. */
export async function getStoredFile(f: PackFile): Promise<File | null> {
  const root = await opfsRoot()
  if (root) {
    try {
      const file = await (await root.getFileHandle(f.name)).getFile()
      if (file.size === f.bytes) return file
    } catch {
      // not in OPFS
    }
  }
  const row = await db.files.get(f.name)
  if (row && row.blob.size === f.bytes) return new File([row.blob], f.name)
  return null
}

export async function removeStoredFile(name: string): Promise<void> {
  const root = await opfsRoot()
  try {
    await root?.removeEntry(name)
  } catch {
    // wasn't there
  }
  await db.files.delete(name)
}

/** Downloads `f` onto the device, reporting bytes received. Throws if the result is incomplete. */
export async function downloadFile(f: PackFile, onProgress: (received: number) => void): Promise<void> {
  const res = await fetch(f.url, { cache: 'no-store' })
  if (!res.ok || !res.body) throw new Error(`Download failed (HTTP ${res.status})`)
  const reader = res.body.getReader()

  const root = await opfsRoot()
  const handle = root ? await root.getFileHandle(f.name, { create: true }).catch(() => null) : null
  const writable = handle && 'createWritable' in handle ? await handle.createWritable().catch(() => null) : null

  let received = 0
  const chunks: Uint8Array[] = []
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (writable) await writable.write(value)
      else chunks.push(value)
      onProgress(received)
    }
    if (writable) await writable.close()
    else await db.files.put({ name: f.name, blob: new Blob(chunks as BlobPart[]) })
  } catch (e) {
    await writable?.abort().catch(() => {})
    await removeStoredFile(f.name)
    throw e
  }
  if (received !== f.bytes) {
    await removeStoredFile(f.name)
    throw new Error(`Download incomplete (${received} of ${f.bytes} bytes). Try again on better Wi-Fi.`)
  }
}

export interface StorageStatus {
  persisted: boolean | null
  usage: number | null
  quota: number | null
}

export async function storageStatus(): Promise<StorageStatus> {
  const s = navigator.storage
  const [persisted, est] = await Promise.all([
    s?.persisted?.().catch(() => null) ?? null,
    s?.estimate?.().catch(() => null) ?? null,
  ])
  return { persisted, usage: est?.usage ?? null, quota: est?.quota ?? null }
}

/** Asks the browser not to evict our data under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}

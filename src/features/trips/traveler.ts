import { imagePhoto, type PhotoCrop } from './imagePhoto'

/** First and last initials, including names with middle names. */
export function travelerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0]![0]}${parts.at(-1)![0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase()
}

export function normalizeVenmo(input: string): string | null {
  let value = input.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) {
    const url = new URL(value)
    if (!['venmo.com', 'www.venmo.com'].includes(url.hostname) || url.search || url.hash) throw new Error('Use your Venmo username or a venmo.com profile link.')
    value = url.pathname.replace(/^\/u\//, '').replace(/^\//, '').replace(/\/$/, '')
  }
  value = value.replace(/^@/, '')
  if (!/^[a-zA-Z0-9_-]{5,30}$/.test(value)) throw new Error('Use a Venmo username of 5–30 letters, numbers, underscores, or hyphens.')
  return value
}

/** Keep profile photos small enough to save and sync offline with the member. */
export function profilePhoto(file: File, crop?: PhotoCrop): Promise<string> {
  return imagePhoto(file, 'profile', crop)
}

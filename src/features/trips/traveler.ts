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
export async function profilePhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.')
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read this photo. Try another image.')
    const side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally { bitmap.close() }
}

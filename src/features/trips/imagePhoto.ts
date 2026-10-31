export interface PhotoCrop { x: number; y: number; zoom: number }
export const CENTER_CROP: PhotoCrop = { x: 50, y: 50, zoom: 1 }

/** Source rectangle for an aspect-fill crop. Position is a percentage of available travel. */
export function cropRect(width: number, height: number, aspect: number, crop: PhotoCrop) {
  const zoom = Math.max(1, Math.min(3, crop.zoom))
  const w = Math.min(width, height * aspect) / zoom
  const h = w / aspect
  return { x: (width - w) * Math.max(0, Math.min(100, crop.x)) / 100,
    y: (height - h) * Math.max(0, Math.min(100, crop.y)) / 100, width: w, height: h }
}

/** Small JPEGs travel through the existing offline row/outbox, with no external image host. */
export async function imagePhoto(file: File, kind: 'profile' | 'cover', crop = CENTER_CROP): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.')
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.')
  let bitmap: ImageBitmap
  try { bitmap = await createImageBitmap(file) } catch { throw new Error('Could not read this photo. Try another JPG, PNG, or WebP image.') }
  try {
    const width = kind === 'profile' ? 256 : 1200
    const height = kind === 'profile' ? 256 : 480
    const canvas = document.createElement('canvas')
    canvas.width = width; canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read this photo. Try another image.')
    const rect = cropRect(bitmap.width, bitmap.height, width / height, crop)
    ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)
    const limit = kind === 'profile' ? 200000 : 400000
    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const photo = canvas.toDataURL('image/jpeg', quality)
      if (photo.startsWith('data:image/jpeg;base64,') && photo.length <= limit) return photo
    }
    throw new Error('This photo has too much detail to save. Try another image or a closer crop.')
  } finally { bitmap.close() }
}

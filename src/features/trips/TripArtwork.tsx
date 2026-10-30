import { useState } from 'react'
import type { TripCover } from './covers'

/** A shared flat illustration collection, served locally and precached for offline trips. */
export function TripArtwork({ cover, photo, thumbnail = false, className = '' }: {
  cover: TripCover; photo?: string; thumbnail?: boolean; className?: string
}) {
  const [failedPhoto, setFailedPhoto] = useState<string>()
  if (cover === 'none') return null
  const custom = cover === 'custom' && photo && failedPhoto !== photo
  const scene = cover === 'custom' ? 'coast' : cover
  const base = `/images/trip-covers/flat-v2/${scene}`
  return <img
    src={custom ? photo : `${base}${thumbnail ? '-small' : ''}.jpg`}
    srcSet={custom || thumbnail ? undefined : `${base}-small.jpg 480w, ${base}.jpg 1600w`}
    sizes={custom || thumbnail ? undefined : '(min-width: 1280px) 1000px, 100vw'}
    width={1600} height={640} alt="" decoding="async"
    className={`trip-artwork trip-cover-photo ${className}`}
    onError={custom ? () => setFailedPhoto(photo) : undefined}
  />
}

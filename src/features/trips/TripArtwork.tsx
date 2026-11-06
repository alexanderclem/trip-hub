import { useState } from 'react'
import type { TripCover } from './covers'
import { photoCredit, type DestinationPhoto } from './destinationPhotos'
import { ProgressiveImage } from '@/ui/ProgressiveImage'

/** A shared flat illustration collection, served locally and precached for offline trips.
 *  With `destination`, a photo of the place instead (the illustration stays as the fallback),
 *  credited in its corner as its licence asks; the credit hides when the frame is too small to read. */
export function TripArtwork({ cover, photo, destination, thumbnail = false, className = '' }: {
  cover: TripCover; photo?: string; destination?: DestinationPhoto; thumbnail?: boolean; className?: string
}) {
  const [failedPhoto, setFailedPhoto] = useState<string>()
  if (cover === 'none') return null
  if (destination && failedPhoto !== destination.id) {
    const base = `/images/destinations/${destination.id}`
    const image = <ProgressiveImage
      placeholder={`${base}-placeholder.jpg`}
      src={`${base}${thumbnail ? '-small' : ''}.jpg`}
      srcSet={thumbnail ? undefined : `${base}-small.jpg 500w, ${base}.jpg 1280w`}
      sizes={thumbnail ? undefined : '(min-width: 1280px) 1000px, 100vw'}
      width={destination.width} height={destination.height} alt="" decoding="async"
      title={photoCredit(destination)}
      className={`trip-artwork-frame ${thumbnail ? className : ''}`}
      imageClassName="trip-artwork trip-cover-photo"
      onError={() => setFailedPhoto(destination.id)}
    />
    return thumbnail ? image : <span className={`trip-photo ${className}`}>{image}<span className="trip-photo-credit">{photoCredit(destination)}</span></span>
  }
  const custom = cover === 'custom' && photo && failedPhoto !== photo
  const scene = cover === 'custom' ? 'coast' : cover
  const base = `/images/trip-covers/flat-v2/${scene}`
  return <ProgressiveImage
    placeholder={custom ? undefined : `${base}-placeholder.jpg`}
    src={custom ? photo : `${base}${thumbnail ? '-small' : ''}.jpg`}
    srcSet={custom || thumbnail ? undefined : `${base}-small.jpg 480w, ${base}.jpg 1600w`}
    sizes={custom || thumbnail ? undefined : '(min-width: 1280px) 1000px, 100vw'}
    width={1600} height={640} alt="" decoding="async"
    className={`trip-artwork-frame ${className}`}
    imageClassName="trip-artwork trip-cover-photo"
    onError={custom ? () => setFailedPhoto(photo) : undefined}
  />
}

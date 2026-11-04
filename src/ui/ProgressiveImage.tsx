import { useEffect, useRef, useState, type ComponentProps } from 'react'

/** A tiny local preview reserves the image's space while its full source decodes. */
export function ProgressiveImage({ placeholder, className = '', imageClassName = '', style, onLoad, onError, ...props }: ComponentProps<'img'> & { placeholder?: string; imageClassName?: string }) {
  const [loadedSource, setLoadedSource] = useState<string>()
  const [failedSource, setFailedSource] = useState<string>()
  const image = useRef<HTMLImageElement>(null)
  useEffect(() => {
    // A pre-rendered or cached image can finish before React attaches its load handler.
    if (image.current?.complete) {
      if (image.current.naturalWidth) setLoadedSource(props.src)
      else setFailedSource(props.src)
    }
  }, [props.src])
  const ready = loadedSource === props.src || failedSource === props.src
  return <span className={`progressive-image ${className}`} data-ready={ready || !placeholder} style={style}>
    {placeholder && !ready && <span className="progressive-image-placeholder" aria-hidden="true" style={{ backgroundImage: `url("${placeholder}")` }} />}
    <img {...props} ref={image} className={`progressive-image-full ${imageClassName}`} onLoad={(event) => { setLoadedSource(props.src); onLoad?.(event) }} onError={(event) => { setFailedSource(props.src); onError?.(event) }} />
  </span>
}

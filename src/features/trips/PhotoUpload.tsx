import { useEffect, useId, useRef, useState } from 'react'
import { ErrorNote, Field, Input } from '@/ui'
import { CENTER_CROP, imagePhoto, type PhotoCrop } from './imagePhoto'

/** The parent displays the exact compressed crop that will be saved. Originals stay in memory. */
export function PhotoUpload({ label, kind, disabled, onChange, onBusy }: {
  label: string; kind: 'profile' | 'cover'; disabled: boolean
  onChange: (photo: string) => void; onBusy: (busy: boolean) => void
}) {
  const hintId = useId()
  const [file, setFile] = useState<File | null>(null)
  const [crop, setCrop] = useState(CENTER_CROP)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])

  async function process(nextFile: File, nextCrop: PhotoCrop) {
    const id = ++request.current
    setProcessing(true); onBusy(true); setError(null)
    try {
      const photo = await imagePhoto(nextFile, kind, nextCrop)
      if (id !== request.current) return
      setFile(nextFile); setCrop(nextCrop); onChange(photo)
    } catch (e) {
      if (id === request.current) setError(e instanceof Error ? e.message : 'Could not read this photo. Try another image.')
    } finally {
      if (id === request.current) { setProcessing(false); onBusy(false) }
    }
  }

  return <fieldset disabled={disabled || processing} className="min-w-0 space-y-3">
    <legend className="sr-only">{label} upload and crop</legend>
    <Field label={label}><Input aria-describedby={hintId} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
      const selected = e.currentTarget.files?.[0]
      e.currentTarget.value = ''
      if (selected) void process(selected, CENTER_CROP)
    }} /></Field>
    <p id={hintId} className="text-sm text-muted">JPG, PNG or WebP, up to 10 MB.</p>
    {file && <div className="photo-crop-controls">
      <p className="text-sm text-muted">Adjust the crop in the preview. The original stays on your device.</p>
      {([{ key: 'x', label: 'Horizontal position', min: 0, max: 100, step: 1 },
        { key: 'y', label: 'Vertical position', min: 0, max: 100, step: 1 },
        { key: 'zoom', label: 'Zoom', min: 1, max: 3, step: 0.1 }] as const).map(({ key, label: control, min, max, step }) =>
        <label key={key} className="photo-crop-control"><span>{control}</span><input aria-label={`${label} ${control.toLowerCase()}`} type="range" min={min} max={max} step={step} value={crop[key]} onChange={(e) => void process(file, { ...crop, [key]: Number(e.currentTarget.value) })} /><output>{key === 'zoom' ? `${crop[key].toFixed(1)}×` : `${crop[key]}%`}</output></label>)}
    </div>}
    <p role="status" className="text-sm text-muted">{processing ? 'Preparing photo…' : ''}</p>
    <ErrorNote error={error} />
  </fieldset>
}

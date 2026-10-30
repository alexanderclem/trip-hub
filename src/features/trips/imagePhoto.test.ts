import { describe, expect, it } from 'vitest'
import { CENTER_CROP, cropRect, imagePhoto } from './imagePhoto'

describe('photo framing', () => {
  it('center crops a landscape portrait and a portrait banner to their saved aspect ratios', () => {
    expect(cropRect(1000, 600, 1, CENTER_CROP)).toEqual({ x: 200, y: 0, width: 600, height: 600 })
    expect(cropRect(600, 1000, 2.5, CENTER_CROP)).toEqual({ x: 0, y: 380, width: 600, height: 240 })
  })
  it('moves to each source edge and zooms without sampling beyond the image', () => {
    expect(cropRect(1000, 600, 1, { x: 100, y: 0, zoom: 2 })).toEqual({ x: 700, y: 0, width: 300, height: 300 })
    expect(cropRect(1000, 600, 1, { x: -20, y: 200, zoom: 0 })).toEqual({ x: 0, y: 0, width: 600, height: 600 })
  })
  it('rejects unsupported types and oversized photos before trying to decode them', async () => {
    await expect(imagePhoto(new File(['x'], 'image.svg', { type: 'image/svg+xml' }), 'cover')).rejects.toThrow('JPG, PNG, or WebP')
    await expect(imagePhoto(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }), 'profile')).rejects.toThrow('10 MB')
  })
})

// Draws a recap slide as a 1080×1920 picture (story size) and shares it, or downloads it where
// the browser can't share files. Plain canvas, no extra library.

import type { Slide } from './WrappedScreen'

const W = 1080
const H = 1920
const PAD = 96

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export async function slideImage(slide: Slide, [from, to]: [string, string], tripName: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H)
  g.addColorStop(0, from)
  g.addColorStop(1, to)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'top'
  const font = (weight: number, size: number) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`

  let y = 520
  ctx.font = font(700, 48)
  ctx.globalAlpha = 0.8
  ctx.fillText(slide.kicker.toUpperCase(), PAD, y)
  ctx.globalAlpha = 1
  y += 100

  // The headline: as big as fits, at most three lines.
  let size = 170
  let big = [slide.big]
  for (; size >= 72; size -= 8) {
    ctx.font = font(900, size)
    big = wrap(ctx, slide.big, W - PAD * 2)
    if (big.length <= 3 && big.every((l) => ctx.measureText(l).width <= W - PAD * 2)) break
  }
  for (const l of big) { ctx.fillText(l, PAD, y); y += size * 1.05 }
  y += 60

  ctx.font = font(600, 50)
  for (const line of slide.lines.slice(0, 6)) {
    for (const l of wrap(ctx, line, W - PAD * 2)) { ctx.fillText(l, PAD, y); y += 66 }
    y += 18
    if (y > H - 260) break
  }

  ctx.font = font(700, 40)
  ctx.globalAlpha = 0.85
  ctx.fillText(`Stowaway · ${tripName}`, PAD, H - 160)
  ctx.globalAlpha = 1
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the picture'))), 'image/png'))
}

export async function shareSlide(slide: Slide, colors: [string, string], tripName: string): Promise<'shared' | 'downloaded'> {
  const blob = await slideImage(slide, colors, tripName)
  const file = new File([blob], `${tripName.replace(/[^\w-]+/g, '-').toLowerCase()}-${slide.key}.png`, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: `${tripName}: ${slide.kicker}` })
    return 'shared'
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}

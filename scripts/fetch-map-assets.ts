// Downloads the fonts and icon sprites the offline (Protomaps) map style needs, into
// public/map-assets/, so labels still render with no network. Run once; files are committed.
//   npm run fetch:map-assets
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const BASE = 'https://protomaps.github.io/basemaps-assets'
const OUT = 'public/map-assets'

// Fonts used by @protomaps/basemaps layers (see its text-font values).
const FONTS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic']
// Unicode ranges: Latin + Latin-1 (Spanish accents, ñ), Latin Extended, general punctuation.
const RANGES = ['0-255', '256-511', '8192-8447']
const SPRITES = ['light.json', 'light.png', 'light@2x.json', 'light@2x.png']

async function get(url: string, dest: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  await mkdir(dirname(dest), { recursive: true })
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(dest, buf)
  console.log(`${String(buf.length).padStart(8)}  ${dest}`)
}

for (const font of FONTS) {
  for (const range of RANGES) {
    await get(`${BASE}/fonts/${encodeURIComponent(font)}/${range}.pbf`, join(OUT, 'fonts', font, `${range}.pbf`))
  }
}
for (const s of SPRITES) await get(`${BASE}/sprites/v4/${s}`, join(OUT, 'sprites', 'v4', s))

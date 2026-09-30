import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import type { Map as MlMap } from 'maplibre-gl'
import { PLACE_CATEGORIES } from '@/data/types'
import { CATEGORY_STYLE } from '@/features/places/categories'

const SIZE = 36 // CSS pixels; drawn at 2x for sharp pins on phones

/** Renders a lucide icon to an SVG string (reusing React, which we already ship). */
function iconMarkup(Icon: (typeof CATEGORY_STYLE)[keyof typeof CATEGORY_STYLE]['Icon']): string {
  const div = document.createElement('div')
  const root = createRoot(div)
  flushSync(() => root.render(createElement(Icon, { size: 18, color: 'white', strokeWidth: 2.5, x: 9, y: 9 })))
  const html = div.innerHTML
  root.unmount()
  return html
}

function pinSvg(color: string, icon: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE * 2}" height="${SIZE * 2}" viewBox="0 0 ${SIZE} ${SIZE}">
  <circle cx="18" cy="18" r="15.5" fill="${color}" stroke="white" stroke-width="2.5"/>${icon}</svg>`
}

async function loadImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image(SIZE * 2, SIZE * 2)
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  await img.decode()
  return img
}

/**
 * Adds one pin image per category ("pin-food", …). Drawn locally rather than fetched,
 * so pins render with no network (important once offline maps land).
 */
export async function addPinImages(map: MlMap): Promise<void> {
  await Promise.all(
    PLACE_CATEGORIES.map(async (c) => {
      const name = `pin-${c}`
      if (map.hasImage(name)) return
      const { color, Icon } = CATEGORY_STYLE[c]
      const img = await loadImage(pinSvg(color, iconMarkup(Icon)))
      if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: 2 })
    }),
  )
}

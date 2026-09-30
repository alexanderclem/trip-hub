import { useCallback, useEffect, useState } from 'react'
import { addProtocol, type StyleSpecification } from 'maplibre-gl'
import { FileSource, PMTiles, Protocol } from 'pmtiles'
import { layers, namedFlavor } from '@protomaps/basemaps'
import type { Trip } from '@/data/types'
import { getStoredFile, type PackFile } from './packStore'

/** Offline map for a trip: a country overview plus street-level detail for the trip's towns. */
export interface OfflinePack {
  id: string
  label: string
  version: string // Protomaps build date the pack was cut from
  overview: PackFile
  detail: PackFile
}

export function tripPack(trip: Trip | undefined): OfflinePack | null {
  const p = trip?.offline_pack as OfflinePack | null | undefined
  return p?.overview && p?.detail ? p : null
}

let protocol: Protocol | null = null
function pmtilesProtocol(): Protocol {
  if (!protocol) {
    protocol = new Protocol()
    // pmtiles' handler predates MapLibre 6's stricter typing; the runtime contract ({ data }) is the same.
    addProtocol('pmtiles', protocol.tilev4 as Parameters<typeof addProtocol>[1])
  }
  return protocol
}

const ATTRIBUTION = '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'

/**
 * A MapLibre style that reads only from files on the device (plus fonts/sprites precached with
 * the app). Overview layers sit underneath; detail layers draw on top where they exist.
 */
export function offlineStyle(overview: File, detail: File): StyleSpecification {
  const p = pmtilesProtocol()
  p.add(new PMTiles(new FileSource(overview)))
  p.add(new PMTiles(new FileSource(detail)))
  const flavor = namedFlavor('light')
  const base = layers('overview', flavor, { lang: 'es' }).map((l) => ({
    ...l,
    id: `ov-${l.id}`,
    // Beyond the overview's zoom its labels would duplicate the detail pack's.
    ...(l.type === 'symbol' ? { maxzoom: 11 } : {}),
  }))
  const top = layers('detail', flavor, { lang: 'es' }).filter((l) => l.type !== 'background')
  const origin = location.origin
  return {
    version: 8,
    glyphs: `${origin}/map-assets/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/map-assets/sprites/v4/light`,
    sources: {
      overview: { type: 'vector', url: `pmtiles://${overview.name}`, attribution: ATTRIBUTION },
      detail: { type: 'vector', url: `pmtiles://${detail.name}`, attribution: ATTRIBUTION },
    },
    layers: [...base, ...top] as StyleSpecification['layers'],
  }
}

export type PackState =
  | { status: 'none' } // trip has no offline pack
  | { status: 'missing'; pack: OfflinePack } // not downloaded on this device
  | { status: 'ready'; pack: OfflinePack; overview: File; detail: File }

/** Whether this trip's offline map is on this device. `refresh` re-checks after a download. */
export function useOfflinePack(trip: Trip | undefined): [PackState, () => void] {
  const pack = tripPack(trip)
  const [state, setState] = useState<PackState>({ status: 'none' })
  const [tick, setTick] = useState(0)
  const key = pack ? `${pack.overview.name}:${pack.overview.bytes}:${pack.detail.name}:${pack.detail.bytes}` : ''

  useEffect(() => {
    let cancelled = false
    if (!pack) {
      setState({ status: 'none' })
      return
    }
    Promise.all([getStoredFile(pack.overview), getStoredFile(pack.detail)]).then(([overview, detail]) => {
      if (cancelled) return
      setState(overview && detail ? { status: 'ready', pack, overview, detail } : { status: 'missing', pack })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick])

  return [state, useCallback(() => setTick((t) => t + 1), [])]
}

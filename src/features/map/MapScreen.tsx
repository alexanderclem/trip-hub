import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { GeolocateControl, LngLatBounds, Map as MlMap, setWorkerUrl, type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, Point } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { List, MapPinPlus } from 'lucide-react'
import { usePlaces } from '@/data/hooks'
import { PLACE_CATEGORIES, type Place, type PlaceCategory } from '@/data/types'
import type { LatLng } from '@/lib/geo'
import { Button } from '@/ui'
import { CATEGORY_STYLE } from '@/features/places/categories'
import { addPinImages } from './pinImages'
import { PlaceSheet, Sheet } from './PlaceSheet'

// MapLibre 6 renders tiles in a module worker; point it at our bundled copy.
setWorkerUrl(mapWorkerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_VIEW = { center: [-90.95, 14.65] as [number, number], zoom: 8.6 } // Antigua ↔ Atitlán
const LONG_PRESS_MS = 550
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

type Fc = FeatureCollection<Point, { id: string; category: PlaceCategory; name: string }>

function toFeatures(places: Place[]): Fc {
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng!, p.lat!] },
        properties: { id: p.id, category: p.category, name: p.name },
      })),
  }
}

const viewKey = (tripId: string) => `trip-hub:map-view:${tripId}`

export default function MapScreen() {
  const { tripId } = useParams() as { tripId: string }
  const navigate = useNavigate()
  const places = usePlaces(tripId)
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('place')

  const [hidden, setHidden] = useState<Set<PlaceCategory>>(new Set())
  const [showPool, setShowPool] = useState(false)
  const [me, setMe] = useState<LatLng | null>(null)
  const [pending, setPending] = useState<LatLng | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)

  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [ready, setReady] = useState(false)
  const fitted = useRef(false)

  // Handlers registered once on the map read the latest values through this ref.
  const actions = useRef({ select: (_id: string | null) => {}, longPress: (_at: LatLng) => {} })
  actions.current.select = (id) => {
    setPending(null)
    setParams(id ? { place: id } : {}, { replace: true })
  }
  actions.current.longPress = (at) => {
    setParams({}, { replace: true })
    setPending(at)
  }

  const visible = useMemo(() => (places ?? []).filter((p) => !hidden.has(p.category)), [places, hidden])
  const picks = useMemo(() => visible.filter((p) => p.status !== 'catalog' && p.status !== 'rejected'), [visible])
  const pool = useMemo(() => visible.filter((p) => p.status === 'catalog'), [visible])
  const poolTotal = useMemo(() => (places ?? []).filter((p) => p.status === 'catalog').length, [places])
  const selected = places?.find((p) => p.id === selectedId)

  // ── Create the map once ────────────────────────────────────────────────────
  useEffect(() => {
    let saved: { center: [number, number]; zoom: number } | null = null
    try {
      saved = JSON.parse(sessionStorage.getItem(viewKey(tripId)) ?? 'null')
    } catch {
      // ignore
    }
    if (saved) fitted.current = true

    const map = new MlMap({
      container: container.current!,
      style: STYLE_URL,
      ...(saved ?? DEFAULT_VIEW),
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.touchZoomRotate.disableRotation()
    mapRef.current = map

    const geolocate = new GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: true,
    })
    map.addControl(geolocate, 'top-right')
    geolocate.on('geolocate', (e) => setMe({ lat: e.coords.latitude, lng: e.coords.longitude }))

    map.on('error', (e) => {
      if (!navigator.onLine) setMapError("You're offline, so only map areas you've already viewed will show.")
      else console.warn('map error', e.error)
    })

    map.on('load', async () => {
      // If location was allowed before, show "you are here" (and distances) without a tap.
      navigator.permissions
        ?.query({ name: 'geolocation' })
        .then((p) => p.state === 'granted' && geolocate.trigger())
        .catch(() => {})

      await addPinImages(map)

      // Idea pool: small, clustered, underneath.
      map.addSource('pool', { type: 'geojson', data: EMPTY, cluster: true, clusterMaxZoom: 16, clusterRadius: 40 })
      map.addLayer({
        id: 'pool-clusters',
        type: 'circle',
        source: 'pool',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#a8a29e',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
          'circle-radius': ['step', ['get', 'point_count'], 14, 20, 18, 100, 24],
        },
      })
      map.addLayer({
        id: 'pool-cluster-count',
        type: 'symbol',
        source: 'pool',
        filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Noto Sans Bold'], 'text-size': 12 },
        paint: { 'text-color': '#fff' },
      })
      map.addLayer({
        id: 'pool-pins',
        type: 'symbol',
        source: 'pool',
        filter: ['!', ['has', 'point_count']],
        layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']],
          'icon-size': 0.6,
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 17, ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'icon-opacity': 0.75, 'text-color': '#57534e', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      })

      // The group's picks: always visible, never clustered, on top.
      map.addSource('picks', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'selected-halo',
        type: 'circle',
        source: 'picks',
        filter: ['==', ['get', 'id'], ''],
        paint: { 'circle-radius': 26, 'circle-color': '#14b8a6', 'circle-opacity': 0.25 },
      })
      map.addLayer({
        id: 'picks',
        type: 'symbol',
        source: 'picks',
        layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 13, ['get', 'name']],
          'text-font': ['Noto Sans Bold'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#1c1917', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      })
      setReady(true)
    })

    // One click handler: pins first, then clusters, else clear the selection.
    map.on('click', async (e) => {
      const hit = (layers: string[]): MapGeoJSONFeature | undefined =>
        map.queryRenderedFeatures(e.point, { layers: layers.filter((l) => map.getLayer(l)) })[0]
      const pin = hit(['picks', 'pool-pins'])
      if (pin) return actions.current.select(pin.properties.id as string)
      const cluster = hit(['pool-clusters'])
      if (cluster) {
        const src = map.getSource('pool') as GeoJSONSource
        const zoom = await src.getClusterExpansionZoom(cluster.properties.cluster_id as number)
        map.easeTo({ center: (cluster.geometry as Point).coordinates as [number, number], zoom })
        return
      }
      actions.current.select(null)
    })

    // Long-press (touch) or right-click (desktop) to add a place at that spot.
    let timer: ReturnType<typeof setTimeout> | undefined
    const cancel = () => clearTimeout(timer)
    map.on('touchstart', (e) => {
      if (e.originalEvent.touches.length !== 1) return cancel()
      const at = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      timer = setTimeout(() => actions.current.longPress(at), LONG_PRESS_MS)
    })
    map.on('touchend', cancel)
    map.on('touchcancel', cancel)
    map.on('movestart', cancel)
    map.on('contextmenu', (e) => actions.current.longPress({ lat: e.lngLat.lat, lng: e.lngLat.lng }))

    map.on('moveend', () => {
      const c = map.getCenter()
      try {
        sessionStorage.setItem(viewKey(tripId), JSON.stringify({ center: [c.lng, c.lat], zoom: map.getZoom() }))
      } catch {
        // storage unavailable (private mode); not important
      }
    })

    return () => {
      cancel()
      map.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [tripId])

  // ── Keep map data in sync with IndexedDB + filters ──────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    ;(map.getSource('picks') as GeoJSONSource).setData(toFeatures(picks))
    ;(map.getSource('pool') as GeoJSONSource).setData(showPool ? toFeatures(pool) : EMPTY)
  }, [ready, picks, pool, showPool])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.setFilter('selected-halo', ['==', ['get', 'id'], selectedId ?? ''])
  }, [ready, selectedId])

  // Frame the group's places the first time we have them.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || fitted.current || !places) return
    const pts = (picks.length ? picks : places).filter((p) => p.lat != null && p.lng != null)
    fitted.current = true
    if (pts.length === 0) return
    if (pts.length === 1) return void map.jumpTo({ center: [pts[0]!.lng!, pts[0]!.lat!], zoom: 15 })
    const b = new LngLatBounds()
    for (const p of pts) b.extend([p.lng!, p.lat!])
    map.fitBounds(b, { padding: { top: 110, bottom: 40, left: 40, right: 60 }, maxZoom: 15, duration: 0 })
  }, [ready, places, picks])

  // Opening a place from elsewhere (?place=…) centres it.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !selected || selected.lat == null || selected.lng == null) return
    const px = map.project([selected.lng, selected.lat])
    const { clientHeight: h, clientWidth: w } = map.getContainer()
    if (px.x < 40 || px.x > w - 40 || px.y < 100 || px.y > h - 220) {
      map.easeTo({ center: [selected.lng, selected.lat], offset: [0, -80] })
    }
  }, [ready, selected])

  const toggle = (c: PlaceCategory) =>
    setHidden((h) => {
      const next = new Set(h)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0">
        <div ref={container} className="h-full w-full" />
      </div>

      {/* Filters */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10">
        <div className="pointer-events-auto flex gap-2 overflow-x-auto px-3 pt-3 pr-14 pb-2">
          {PLACE_CATEGORIES.map((c) => {
            const { label, color, Icon } = CATEGORY_STYLE[c]
            const on = !hidden.has(c)
            return (
              <button
                key={c}
                onClick={() => toggle(c)}
                className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm shadow-sm ${on ? 'text-white' : 'bg-white/90 text-stone-500 line-through'}`}
                style={on ? { background: color } : undefined}
              >
                <Icon className="size-4" /> {label}
              </button>
            )
          })}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 px-3">
          {poolTotal > 0 && (
            <button
              onClick={() => setShowPool((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-sm shadow-sm ${showPool ? 'bg-stone-800 text-white' : 'bg-white/90 text-stone-700'}`}
            >
              {showPool ? 'Hide' : 'Show'} idea pool ({poolTotal})
            </button>
          )}
          <Link to="../more/places" className="flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-sm text-stone-700 shadow-sm">
            <List className="size-4" /> List
          </Link>
        </div>
        {mapError && <p className="mx-3 mt-2 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">{mapError}</p>}
      </div>

      {places && picks.length === 0 && !selected && !pending && (
        <div className="absolute inset-x-0 bottom-6 z-10 p-3">
          <div className="mx-auto max-w-md rounded-3xl bg-white/95 p-4 text-sm text-stone-600 shadow-lg">
            {poolTotal > 0
              ? 'No shortlisted places yet. Turn on the idea pool and tap a pin to shortlist it, or long-press the map to add your own.'
              : 'Long-press anywhere on the map to add a place, or import starter places in Trip settings.'}
          </div>
        </div>
      )}

      {selected && <PlaceSheet place={selected} me={me} onClose={() => actions.current.select(null)} />}

      {pending && (
        <Sheet onClose={() => setPending(null)}>
          <h2 className="font-semibold">Add a place here?</h2>
          <p className="text-sm text-stone-500">
            {pending.lat.toFixed(5)}, {pending.lng.toFixed(5)}
          </p>
          <Button
            className="mt-3 flex w-full items-center justify-center gap-2"
            onClick={() => navigate(`../more/places/new?lat=${pending.lat.toFixed(6)}&lng=${pending.lng.toFixed(6)}`)}
          >
            <MapPinPlus className="size-5" /> Add place
          </Button>
        </Sheet>
      )}
    </div>
  )
}

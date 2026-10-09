import { use, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { GeolocateControl, LngLatBounds, Map as MlMap, setWorkerUrl, type GeoJSONSource, type MapGeoJSONFeature } from 'maplibre-gl'
import mapWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, LineString, Point } from 'geojson'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CalendarDays, List, MapPinPlus, Ruler, SlidersHorizontal, X } from 'lucide-react'
import { useDevice } from '@/data/device'
import { useLegContext, usePlaces, useTrip } from '@/data/hooks'
import { useOnline } from '@/lib/useOnline'
import { offlineStyle, useOfflinePack } from './offline/packs'
import { STYLE_URL, union, useSavedMap } from './offline/savedArea'
import { tripAreas } from '@/features/destinations/destinations'
import { useDisplayZone, useItems } from '@/features/itinerary/data'
import { onDay } from '@/features/itinerary/layout'
import { DateTime } from 'luxon'
import { PLACE_CATEGORIES, type Place, type PlaceCategory } from '@/data/types'
import type { LatLng } from '@/lib/geo'
import { Button, Chip, HeaderTools } from '@/ui'
import { CATEGORY_STYLE } from '@/features/places/categories'
import { addPinImages } from './pinImages'
import { ME_ID, PlaceSheet, Sheet, type OriginChoice } from './PlaceSheet'

// MapLibre 6 renders tiles in a module worker; point it at our bundled copy.
setWorkerUrl(mapWorkerUrl)

// Shown only until the trip's own places or destinations are known.
const DEFAULT_VIEW = { center: [-73.98, 40.75] as [number, number], zoom: 11 } // New York City
const LONG_PRESS_MS = 550
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

type Fc = FeatureCollection<Point, { id: string; category: PlaceCategory; name: string; n?: string }>

/** `stopNumbers`: when showing one day, each place's position(s) in that day's order ("2" or "1, 4"). */
function toFeatures(places: Place[], stopNumbers?: Map<string, string>): Fc {
  return {
    type: 'FeatureCollection',
    features: places
      .filter((p) => p.lat != null && p.lng != null)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng!, p.lat!] },
        properties: { id: p.id, category: p.category, name: p.name, ...(stopNumbers?.has(p.id) ? { n: stopNumbers.get(p.id)! } : {}) },
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
  const day = params.get('day') // show one day of the plan: numbered stops + route
  const setQuery = (next: { place?: string | null; day?: string | null }) => {
    const q = new URLSearchParams()
    const p = next.place === undefined ? selectedId : next.place
    const d = next.day === undefined ? day : next.day
    if (p) q.set('place', p)
    if (d) q.set('day', d)
    setParams(q, { replace: true })
  }

  const [hidden, setHidden] = useState<Set<PlaceCategory>>(new Set())
  const [showPool, setShowPool] = useState(false)
  const [me, setMe] = useState<LatLng | null>(null)
  const [pending, setPending] = useState<LatLng | null>(null)
  const [mapError, setMapError] = useState<string | null>(null)
  const [originId, setOriginId] = useState<string | null>(null) // null = pick a sensible default
  const [measuring, setMeasuring] = useState<Place | null>(null)
  const legCtx = useLegContext(tripId)
  const trip = useTrip(tripId)
  const [pack] = useOfflinePack(trip)
  const basemap = useDevice((s) => s.basemap)
  const online = useOnline()
  const wantOffline = pack.status === 'ready' && (basemap === 'offline' || (basemap === 'auto' && !online))
  // Trips without a ready-made pack can have the map around their destinations saved instead.
  const [savedMap] = useSavedMap(tripId)
  const wantSaved = !wantOffline && !online && !!savedMap

  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const [ready, setReady] = useState(0) // bumps each time pins are (re)added after a style load
  // False from the moment a new style is requested until its pins and lines are back; effects
  // that touch those layers wait for it, or they'd hit sources that no longer exist.
  const layersLive = useRef(false)
  const styleMode = useRef<'online' | 'offline' | 'saved'>('online')
  const fitted = useRef(false)

  // Handlers registered once on the map read the latest values through this ref.
  const actions = useRef({ select: (_id: string | null) => {}, longPress: (_at: LatLng) => {} })
  actions.current.select = (id) => {
    setPending(null)
    if (measuring && id && id !== measuring.id) {
      setOriginId(measuring.id)
      setMeasuring(null)
    }
    setQuery({ place: id })
  }
  actions.current.longPress = (at) => {
    setQuery({ place: null })
    setPending(at)
  }

  const items = useItems(tripId)
  const { zone } = useDisplayZone(trip)
  /** The day's places in visiting order (consecutive repeats collapsed). */
  const dayStops = useMemo(() => {
    if (!day || !items || !places) return null
    const ids: string[] = []
    for (const i of items.filter((x) => !x.all_day && x.kind !== 'lodging' && x.status !== 'cancelled' && onDay(x, day, zone))) {
      for (const id of [i.place_id, i.to_place_id]) if (id && ids.at(-1) !== id) ids.push(id)
    }
    return ids.map((id) => places.find((p) => p.id === id)).filter((p): p is Place => !!p && p.lat != null && p.lng != null)
  }, [day, items, places, zone])
  const stopNumbers = useMemo(() => {
    const m = new Map<string, string>()
    dayStops?.forEach((p, i) => m.set(p.id, m.has(p.id) ? `${m.get(p.id)}, ${i + 1}` : String(i + 1)))
    return m
  }, [dayStops])

  const visible = useMemo(() => (places ?? []).filter((p) => !hidden.has(p.category)), [places, hidden])
  const allPicks = useMemo(() => visible.filter((p) => p.status !== 'catalog' && p.status !== 'rejected'), [visible])
  const picks = useMemo(() => (dayStops ? [...new Map(dayStops.map((p) => [p.id, p])).values()] : allPicks), [dayStops, allPicks])
  const pool = useMemo(() => visible.filter((p) => p.status === 'catalog'), [visible])
  const poolTotal = useMemo(() => (places ?? []).filter((p) => p.status === 'catalog').length, [places])
  const selected = places?.find((p) => p.id === selectedId)

  const origins = useMemo<OriginChoice[]>(() => {
    const out: OriginChoice[] = []
    if (me) {
      out.push({
        label: 'you',
        place: { id: ME_ID, trip_id: tripId, name: 'You', category: 'other', tags: [], lat: me.lat, lng: me.lng, address: null, area: null,
          status: 'shortlist', notes: null, phone: null, website: null, opening_hours: null, external_ids: {}, source: 'manual' },
      })
    }
    const rank = { booked: 0, planned: 1, visited: 2, shortlist: 3 } as Record<string, number>
    const stays = (places ?? [])
      .filter((p) => p.category === 'lodging' && p.lat != null && p.status in rank)
      .sort((a, b) => rank[a.status]! - rank[b.status]!)
      .slice(0, 3)
    for (const p of stays) out.push({ label: p.name.length > 18 ? p.name.slice(0, 17) + '…' : p.name, place: p })
    return out
  }, [me, places, tripId])

  const origin = useMemo(() => {
    const explicit = originId === ME_ID ? origins.find((o) => o.place.id === ME_ID)?.place : places?.find((p) => p.id === originId)
    if (explicit) return explicit
    // Default: you if we know where you are, else the group's main lodging.
    return origins.find((o) => o.place.id !== selectedId)?.place ?? null
  }, [originId, origins, places, selectedId])

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
      if (!navigator.onLine && styleMode.current === 'online') {
        setMapError("You're offline, so only map areas you've already viewed will show. Download the offline map in Trip settings.")
      }
      else console.warn('map error', e.error)
    })

    // Pins, clusters and the measure line sit on top of whichever basemap is showing, so they're
    // re-added whenever the style changes (online ↔ offline map).
    map.on('style.load', async () => {
      // The offline font set has Medium rather than Bold.
      const bold = styleMode.current === 'offline' ? 'Noto Sans Medium' : 'Noto Sans Bold'
      await addPinImages(map)
      if (map.getSource('picks')) return

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
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': [bold], 'text-size': 12 },
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

      // Straight dashed line from the travel origin to the selected place.
      map.addSource('measure', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'measure-line',
        type: 'line',
        source: 'measure',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#0f766e', 'line-width': 3, 'line-dasharray': [1.5, 1.5], 'line-opacity': 0.8 },
      })

      // "You are here", fed by a quiet location watch (see below), so the camera never jumps.
      map.addSource('me', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'me-dot',
        type: 'circle',
        source: 'me',
        paint: { 'circle-radius': 7, 'circle-color': '#2563eb', 'circle-stroke-color': '#fff', 'circle-stroke-width': 3 },
      })

      // One day of the plan: stops joined in visiting order.
      map.addSource('day-route', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'day-route',
        type: 'line',
        source: 'day-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0f766e', 'line-width': 4, 'line-opacity': 0.6 },
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
          // Day view: "2. Café Sky" at every zoom; otherwise names from zoom 13. (MapLibre only
          // allows ['zoom'] as the input of a top-level step, so the case goes inside it.)
          'text-field': [
            'step', ['zoom'],
            ['case', ['has', 'n'], ['concat', ['get', 'n'], '. ', ['get', 'name']], ''],
            13, ['case', ['has', 'n'], ['concat', ['get', 'n'], '. ', ['get', 'name']], ['get', 'name']],
          ],
          'text-font': [bold],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#1c1917', 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
      })
      layersLive.current = true
      setReady((n) => n + 1)
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
      styleMode.current = 'online'
      layersLive.current = false
      setReady(0)
    }
  }, [tripId])

  // ── Online map ↔ offline map (files on this device) ─────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const mode = wantOffline ? 'offline' : wantSaved ? 'saved' : 'online'
    if (mode === styleMode.current) return
    styleMode.current = mode
    setMapError(null)
    layersLive.current = false
    map.setStyle(
      mode === 'offline' && pack.status === 'ready' ? offlineStyle(pack.overview, pack.detail) : mode === 'saved' && savedMap ? savedMap.style : STYLE_URL,
      { diff: false },
    )
  }, [wantOffline, wantSaved, savedMap, pack])

  // ── Where you are ──────────────────────────────────────────────────────────
  // If location was allowed before, follow it without moving the map (distances and "From you"
  // work immediately). Tapping the locate button still centres the map on you.
  useEffect(() => {
    let watch: number | null = null
    let cancelled = false
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((p) => {
        if (cancelled || p.state !== 'granted') return
        watch = navigator.geolocation.watchPosition(
          (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, maximumAge: 30_000 },
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
      if (watch != null) navigator.geolocation.clearWatch(watch)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !layersLive.current) return
    ;(map.getSource('me') as GeoJSONSource).setData(
      me ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [me.lng, me.lat] } }] } : EMPTY,
    )
  }, [ready, me])

  // ── Keep map data in sync with IndexedDB + filters ──────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !layersLive.current) return
    ;(map.getSource('picks') as GeoJSONSource).setData(toFeatures(picks, stopNumbers))
    ;(map.getSource('pool') as GeoJSONSource).setData(showPool && !dayStops ? toFeatures(pool) : EMPTY)
    ;(map.getSource('day-route') as GeoJSONSource).setData(
      dayStops && dayStops.length > 1
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: dayStops.map((p) => [p.lng!, p.lat!]) } }] }
        : EMPTY,
    )
  }, [ready, picks, pool, showPool, dayStops, stopNumbers])

  // Frame the day's stops whenever a day is opened.
  const dayKeyFitted = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !day || !dayStops?.length || dayKeyFitted.current === day) return
    dayKeyFitted.current = day
    fitted.current = true
    if (dayStops.length === 1) return void map.jumpTo({ center: [dayStops[0]!.lng!, dayStops[0]!.lat!], zoom: 15 })
    const b = new LngLatBounds()
    for (const p of dayStops) b.extend([p.lng!, p.lat!])
    map.fitBounds(b, { padding: { top: 170, bottom: 140, left: 60, right: 70 }, maxZoom: 15, duration: 0 })
  }, [ready, day, dayStops])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !layersLive.current) return
    map.setFilter('selected-halo', ['==', ['get', 'id'], selectedId ?? ''])
  }, [ready, selectedId])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || !layersLive.current) return
    const line: FeatureCollection<LineString> | FeatureCollection =
      selected?.lat != null && selected.lng != null && origin?.lat != null && origin.lng != null && origin.id !== selected.id
        ? {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[origin.lng, origin.lat], [selected.lng, selected.lat]] } }],
          }
        : EMPTY
    ;(map.getSource('measure') as GeoJSONSource).setData(line)
  }, [ready, selected, origin])

  // Frame the group's places the first time we have them.
  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map || fitted.current || !places || !trip) return
    const pts = (picks.length ? picks : places).filter((p) => p.lat != null && p.lng != null)
    fitted.current = true
    if (pts.length === 0) {
      // Nothing pinned yet: show the trip's destinations.
      const areas = tripAreas(trip)
      if (!areas.length) return
      const [south, west, north, east] = union(areas)
      return void map.fitBounds([[west, south], [east, north]], { padding: { top: 110, bottom: 40, left: 40, right: 60 }, maxZoom: 13, duration: 0 })
    }
    if (pts.length === 1) return void map.jumpTo({ center: [pts[0]!.lng!, pts[0]!.lat!], zoom: 15 })
    const b = new LngLatBounds()
    for (const p of pts) b.extend([p.lng!, p.lat!])
    map.fitBounds(b, { padding: { top: 110, bottom: 40, left: 40, right: 60 }, maxZoom: 15, duration: 0 })
  }, [ready, places, picks, trip])

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

  const tools = use(HeaderTools)
  const [filtering, setFiltering] = useState(false)
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

      {/* One row of controls over the map; the category filters open beneath it only when asked for. */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10">
        <div className="flex items-start gap-2 px-3 pt-3">
          <div className="pointer-events-auto flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
            <Chip aria-expanded={filtering} aria-controls="map-filters" pressed={filtering || hidden.size > 0} onClick={() => setFiltering((v) => !v)} className="shadow-sm">
              <SlidersHorizontal aria-hidden="true" className="size-4" /> Filters{hidden.size > 0 && <span className="sr-only">,</span>}{hidden.size > 0 && ` · ${PLACE_CATEGORIES.length - hidden.size} of ${PLACE_CATEGORIES.length}`}
            </Chip>
            {poolTotal > 0 && !day && (
              <Chip pressed={showPool} onClick={() => setShowPool((v) => !v)} className="shadow-sm">
                {showPool ? 'Hide' : 'Show'} idea pool ({poolTotal})
              </Chip>
            )}
            <Link to="../more/places" className="ui-chip shadow-sm">
              <List aria-hidden="true" className="size-4" /> List
            </Link>
            {day && (
              <span className="ui-chip shadow-sm" aria-current="true">
                <CalendarDays aria-hidden="true" className="size-4" />
                {DateTime.fromISO(day).toFormat('ccc d LLL')} · {dayStops?.length ?? 0} stops
                <button type="button" onClick={() => setQuery({ day: null })} aria-label="Show all places" className="-mr-2.5 flex size-9 items-center justify-center rounded-full hover:bg-white/20">
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            )}
            {wantOffline && <span className="ui-chip shadow-sm">Offline map</span>}
          </div>
          <div className="pointer-events-auto flex shrink-0 rounded-full border border-stone-200 bg-surface shadow-sm">{tools}</div>
        </div>
        {filtering && (
          <div id="map-filters" role="group" aria-label="Show these kinds of place" className="pointer-events-auto mx-3 mt-1 flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-surface p-3 shadow-md">
            {PLACE_CATEGORIES.map((c) => {
              const { label, color, Icon } = CATEGORY_STYLE[c]
              return (
                <Chip key={c} pressed={!hidden.has(c)} onClick={() => toggle(c)}>
                  <Icon aria-hidden="true" className="size-4" style={hidden.has(c) ? { color } : undefined} /> {label}
                </Chip>
              )
            })}
          </div>
        )}
        {mapError && <p className="pointer-events-auto mx-3 mt-2 rounded-xl bg-amber-100 px-3 py-2 text-sm text-amber-900">{mapError}</p>}
      </div>

      {places && picks.length === 0 && !selected && !pending && !measuring && (
        <div className="absolute inset-x-0 bottom-6 z-10 p-3">
          <div className="mx-auto max-w-md rounded-2xl bg-surface p-4 text-sm text-stone-600 shadow-lg">
            {poolTotal > 0
              ? 'No shortlisted places yet. Turn on the idea pool and tap a pin to shortlist it, or long-press the map to add your own.'
              : 'Long-press anywhere on the map to add a place, or import starter places in Trip settings.'}
          </div>
        </div>
      )}

      {measuring && (
        <div className="absolute inset-x-0 bottom-6 z-20 p-3">
          <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-brand-900 p-4 text-white shadow-lg">
            <Ruler className="size-5 shrink-0" />
            <p className="flex-1 text-sm">Tap another place to see travel times from <b>{measuring.name}</b></p>
            <button onClick={() => setMeasuring(null)} aria-label="Cancel measuring" className="rounded-full p-1 active:bg-white/10">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}

      {selected && !measuring && (
        <PlaceSheet
          key={selected.id}
          place={selected}
          origins={origins}
          origin={origin}
          onOrigin={setOriginId}
          onMeasure={() => {
            setMeasuring(selected)
            setQuery({ place: null })
          }}
          legCtx={legCtx}
          onClose={() => actions.current.select(null)}
        />
      )}

      {pending && (
        <Sheet onClose={() => setPending(null)}>
          <h2 className="ui-section-title">Add a place here?</h2>
          <p className="text-sm text-stone-600">
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

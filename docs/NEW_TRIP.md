# Setting up a new destination

## In the app (no scripts)

Anyone can set up a trip for any destination from their phone:

1. **New trip → Where are you going?** Search for up to six towns. The first one fills in the
   time zone and local currency. More can be added later in Trip settings → Destinations.
2. **Trip settings → Destinations → Load places** fills the idea pool from OpenStreetMap for
   each town (same sorting rules as the script below, `src/features/places/osm.ts`).
3. **Trip settings → Offline map → Save map for offline** keeps the online map's tiles for the
   towns at street level plus the wider region (`src/features/map/offline/savedArea.ts`). The
   "Ready for offline" button does this too. Each phone saves its own copy.

It uses free, keyless services: Photon (search), public Overpass servers
(places) and OpenFreeMap (tiles). The time zone is looked up on the phone
(`@photostructure/tz-lookup`), with no service involved. What this path doesn't give you is typical boat or shuttle
times (the group can report those) and the smaller, sharper pack files below.

## A pack shipped with the app (scripts)

Stowaway works for any trip without this. These steps add the extras the Guatemala trip has: a
starter pack of places, typical town-to-town travel times, and a ready-made offline map file.

## 1. Places from OpenStreetMap

1. Make `seed/<trip>/areas.json` with the towns you care about. Bounding boxes are
   `[south, west, north, east]`. Copy `seed/guatemala-2027/areas.json` as a template.
2. Optional: add `area_routes` for trips that routing can't compute well (boats, tourist
   shuttles, flights), in minutes: `{ "a": "Town A", "b": "Town B", "mode": "boat", "min_min": 25, "max_min": 45, "note": "…" }`.
3. Run `npm run seed:places -- seed/<trip>`. It writes `seed/<trip>/places.json`.

## 2. Offline map

1. Make `seed/<trip>/region.geojson` with polygons for the areas that need street-level detail.
2. Run `.\scripts\basemap-extract.ps1 -Trip <trip> -Bbox "<west>,<south>,<east>,<north>"` with the
   whole country's bounding box. It writes two files to `public/packs/`. Each must be under 25 MiB.

## 3. Register the pack

Add an entry to `STARTER_PACKS` in `src/features/places/starterPacks.ts`, importing the new
`places.json` and filling in the offline map's file names, byte sizes and build date (the script
prints them). Deploy.

In the app: Trip settings → **Load …** adds the places (to the idea pool), the typical travel
times, and makes the offline map available for download.

## Checking it offline

See the offline check in `tests/e2e/offline.spec.ts`, then try it on a real phone: install to
the Home Screen, download the offline map, switch on airplane mode, force-quit and reopen.

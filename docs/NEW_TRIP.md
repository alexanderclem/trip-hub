# Setting up a new destination

Trip Hub works for any trip without this: create a trip, add places by hand or by long-pressing
the map. These steps add the extras the Guatemala trip has: a starter pack of places, typical
town-to-town travel times, and an offline map.

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

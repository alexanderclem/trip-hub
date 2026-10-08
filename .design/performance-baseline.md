# Production baseline — 2026-10-08

Build: `npm run build` passed (existing map chunk-size warnings); 171 precache entries, 5802.12 KiB. The pre-change build is preserved at `/tmp/stowaway-polish-baseline/dist`.

Method: `node scripts/measure-polish.mjs baseline`, Chromium 153.0.8010.12, local Vite production preview on port 4176, 390×844 viewport, 4× CPU slowdown, 150ms latency, 200,000 bytes/s download. Three fresh contexts, then one warm visit. Vite responses are uncompressed. Page CDP throttling is not OS-wide worker throttling. These are lab measurements, not field INP or a production-host assessment.

| Run | LCP | CLS | Requests | Worker requests |
|---|---:|---:|---:|---:|
| Cold 1 | 1652ms | 0 | 181 | 170 |
| Cold 2 | 1432ms | 0 | 181 | 170 |
| Cold 3 | 1332ms | 0 | 181 | 170 |
| Cold median | 1432ms | 0 | 181 | 170 |
| Warm | 104ms | 0 | 11 | 0 |

FAQ keyboard interaction events: 16–32ms. No page exceptions. Raw resource timings and request URLs: `baseline-metrics.json`. Screenshots: `screenshots/polish/baseline-{390,768,1440}.png`.

Confirmed opportunity: initial public-page registration precaches the full app, including map and PDF resources. These are background downloads, not eagerly executed page imports. Keep the offline manifest intact but begin registration on entry to an app route. This reduces downloads for visitors who are only exploring the website. Do not attribute an LCP improvement to it without final measurements.

Existing strengths: lazy app routes; system fonts; SVG illustrations; no layout shift in the baseline; consistent brand. Shared app buttons already have hover/press motion. Invite copying has success/error feedback but no pending guard; option voting has no pending/error handling. Itinerary save already has pending state, input retention and error display but needs a synchronous duplicate-submit guard.

Rendered baseline reviewed at desktop; mobile/tablet screenshots captured for final comparison. Navigation, FAQ, install and offline behavior will be exercised by the existing production browser tests, alongside focused tests for the new behavior.

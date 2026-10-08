# Stowaway polish checkup

Scope: static review of the marketing landing page and shared motion/startup infrastructure, 2026-10-08. No product files changed. No rendered UI or load-time measurements performed.

The site already has a coherent travel identity, Motion, reduced-motion support, shared timings, and lazy application routes. More animation dependencies are unnecessary.

| ID | Severity | Area | Location / evidence | Current behavior | Proposed correction | User impact |
|---|---|---|---|---|---|---|
| P01 | LOW | Control feedback | src/features/website/website.css, .website-button hover/active rules | Background changes immediately; press moves 1px | Add brief color and transform transitions; preserve reduced-motion handling | More deliberate tactile feedback |
| P02 | LOW, optional design direction | Product demonstration | src/features/website/LandingScreen.tsx, TripPreview | Static illustrative map and itinerary | Add an accessible day selector that updates stops and map highlights with a short transition | Lets visitors understand the product through interaction |

## Recommended order

1. Measure cold landing load and navigation on a throttled mobile profile; examine startup dependencies and service-worker requests before optimizing.
2. Complete control feedback, then build one useful interactive trip preview.
3. Add restrained one-time choreography to the preview, preserving immediate headline and CTA visibility.

## Verification gaps

- Existing dist entry JavaScript is approximately 268 KiB uncompressed and entry CSS approximately 64 KiB. This is an existing artifact, not a new build; it does not establish slow loading or current production transfer size.
- src/main.tsx registers the service worker immediately. vite.config.ts broadly precaches JS, CSS, PNG, map fonts and sprites. Measure background download activity before changing offline behavior.
- MotionProvider uses synchronous domAnimation with LazyMotion. Asynchronous feature loading is a candidate only after bundle and runtime profiling.
- Runtime typography, responsive composition, keyboard flows, FAQ behavior and Core Web Vitals remain unverified.

Rejected: adding a second animation library; Motion already serves this role. Rejected: calling loading slow based solely on source or artifact sizes.

Verdict pending verification: this is a code-informed improvement plan, not a runtime design or performance certification.

---
type: impact-analysis
context: User-approved flow, messaging, and design audit
---

# Stowaway flow and design update

## Target
Public landing/preview, app entry, trip creation, post-entry routing, Home priorities, agenda, installation and sync presentation. No schema, sync engine, access policy, or navigation-tab changes.

## Dependents
- `src/features/website/LandingScreen.tsx` / `TripPreview.tsx`: public entry and local-only example.
- `src/features/onboarding/WelcomeScreen.tsx` / `src/features/trips/HomeScreen.tsx`: first and returning visits.
- `src/features/trips/CreateTripScreen.tsx`: manual and AI-draft creation; preserve draft dates and retry recovery.
- `src/features/trips/SettingsScreen.tsx` / `src/features/trips/TripDetailsForm.tsx`: later edits to name, dates, and time zone through the existing save/outbox contract. Keep base currency unchanged.
- `src/features/onboarding/profile.ts`: CreateTripScreen, JoinScreen, WhoScreen; preserve target links and profile adoption, offer quiz rather than block entry.
- `src/features/install/InstallAppDialog.tsx`: RootLayout; replace automatic interruption with explicit install action.
- `src/features/trips/TripOverviewScreen.tsx`: local live queries; prioritize near departure and during travel using trip-zone dates.
- `src/features/itinerary/PlanScreen.tsx`: use existing day layout, overlaps, local/device time, all-day and stay logic in both views.
- `src/features/sync/SyncStatus.tsx`: quiet offline presentation only; keep error visibility and accessible details.

## Affected stories
No release index exists. Scope is the user-approved design audit, not a new feature release or backend migration.

## Test Coverage
- Existing website, install, first-run and screenshot Playwright specs.
- Existing profile unit tests and itinerary layout/time tests.
- Add trip-phase boundaries/time-zone tests and local-only agenda/Home interaction tests.
- Update assertions for intentional entry and installation changes.
- Run typecheck, unit suite, build, network-stubbed browser flows and inspect screenshots at mobile/desktop sizes.

## Risk: Medium
Shared entry paths and itinerary presentation have multiple consumers; retain underlying write paths and cover changed behavior before shipping. Do not run legacy live-backend specs or touch real trips.

## Implementation sequence
1. Shorter product-led landing and safe interactive example.
2. Compact join/create entry, progressive form details, optional quiz, explicit installation.
3. Compact agenda plus timeline switch; context-aware Home, quieter sync.
4. Verify and document results; no automatic production push.

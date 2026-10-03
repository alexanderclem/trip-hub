import { defineConfig, devices } from '@playwright/test'

// End-to-end tests run against a production build served locally (or the deployed site if
// BASE_URL is set), talking to the real Supabase project. They create trips named "E2E TEST …" (see tests/e2e/cleanup.sql).
const remote = process.env.BASE_URL
const baseURL = remote ?? 'http://localhost:4173'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    // Every phone starts with the opening quiz already skipped; onboarding.spec.ts opts back in.
    storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'trip-hub-device', value: JSON.stringify({ state: { quizSeen: true }, version: 1 }) }] }] },
    ...devices['iPhone 13'],
    browserName: 'chromium',
    permissions: ['geolocation', 'clipboard-read', 'clipboard-write'],
    geolocation: { latitude: 14.5572, longitude: -90.7334 }, // Parque Central, Antigua
    trace: 'retain-on-failure',
  },
  webServer: remote ? undefined : {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})

# Destination APIs

More → Explore your destination accepts a city, ISO two-letter country code and dates. The country/city are saved with trip settings so the Plan view can show public holidays. Lookup results are cached on the phone with timestamps; saved results remain visible when refresh fails offline. Results are not bookings.

## Server configuration

The Cloudflare Worker handles `GET /api/travel-info`. It verifies the Supabase session and trip membership, validates lookup parameters and uses the `TRAVEL_RATE_LIMITER` binding (30 lookups/user/minute). No keys belong in `VITE_` variables.

Set these secrets in the Cloudflare dashboard or using `npx wrangler secret put NAME`:

- `TICKETMASTER_API_KEY`: Ticketmaster Discovery API, for event searches.
- `RESTCOUNTRIES_API_KEY`: REST Countries v5 bearer token, for country essentials.
- `AVIATIONSTACK_API_KEY`: Aviationstack `/v1/flights`, for requested flight/date lookups. Verify that your subscription allows HTTPS and date filtering; historical/future coverage varies by plan.

Nager.Holidays v4 currently requires no API key. Current contracts: https://nagerholidays.com/api, https://restcountries.com/docs/countries, https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/, https://aviationstack.com/faq.

Missing credentials return a setup message. Provider failures never become fake data. The client retains older results and displays the last successful refresh time. Flight updates are manual, not push notifications. API calls include the chosen city/country/dates or flight number/date, never passenger names, booking codes, tickets, or medical data.

Events can be compared in a new group vote (select at least two), or saved as a place and opened in the itinerary form with local date/time and event timezone. Review the form before saving. Repeated imports reuse the Ticketmaster event ID. Holiday notices distinguish regional scope and do not assert businesses are closed.

Country essentials cache for 30 days, holidays for one day, events for one hour, flights for five minutes. Explicit refresh bypasses these client cache intervals. The saved destination currently represents one country/city at a time; multi-country trips can change it to explore each stop.

`npm run dev` serves the frontend only. Use a Cloudflare Worker preview (`npm run build`, then `npx wrangler dev`) with these secrets in a gitignored `.dev.vars` file to exercise real providers locally. Never use demo keys in production.

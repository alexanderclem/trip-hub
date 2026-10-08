# Traffic-aware driving

Place detail → Travel times → Check driving traffic fetches a fresh Google Routes
ETA for departure now, from this place's pin to the destination's pin. This is
separate from buffered, offline planning times; no correction multiplier is
applied to Google's duration. Results disappear after five minutes or when the
browser goes offline. They are never saved in IndexedDB or Supabase.

## Activation

1. In a billing-enabled Google Cloud project, enable **Routes API**.
2. Create a server API key restricted to **Routes API**. Do not put this key in
   any `VITE_` variable, source file, or browser setting.
3. Add `GOOGLE_ROUTES_API_KEY` to the linked Supabase project's Edge Function
   secrets using the Supabase dashboard. Do not paste the key into chat.
4. Deploy `supabase/functions/traffic-route` with the Supabase CLI:
   `supabase functions deploy traffic-route --project-ref croqjdvzbpcscdcshnet`
5. Build and publish the frontend through the existing Cloudflare workflow.
6. Set an appropriate Google Routes request quota and billing alerts in Google
   Cloud before enabling usage. Billing alerts do not cap spend. Only explicit
   button clicks request a route; there are no background or all-pairs requests.

The endpoint validates the caller's Supabase session and loads both places
through row-level security. Both places must be accessible to that caller,
undeleted, in the same trip, and have valid pins. Google failures and missing
configuration return a readable error while existing planning times remain.

No schema migration is needed. The original route-legs endpoint is unchanged.
Do not feed Google results into the MapLibre map or the offline route cache.
Google results are presented only as attributed text on the place detail screen.
Before public activation, provide publicly accessible application Terms of Use
and Privacy Policy that reference Google's terms and privacy policy and disclose
that a traffic check sends the two stored place coordinates to Google.

References:
- https://developers.google.com/maps/documentation/routes/compute_route_directions
- https://developers.google.com/maps/documentation/routes/policies

## Verification

Run `npm run typecheck`, `npm test -- supabase/functions/traffic-route/routing.test.ts
src/features/routing/legs.test.ts`, and `npm run build`.
After activation, check a place pair in both directions, refresh, try offline,
and verify that a failed check leaves the existing planning estimate available.
Live Google accuracy and credential configuration cannot be verified without
an enabled server secret.

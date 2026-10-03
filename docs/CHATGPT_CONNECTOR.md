# Stowaway ChatGPT connector

The first version provides two authenticated, read-only MCP tools:

- `list_trips`: list joined, non-deleted trips with dates, timezone and currencies.
- `get_itinerary`: read a joined trip's itinerary, optionally filtering by local start date.

Both paginate and return only server-synced data. The connector does not expose invitation tokens, tickets, booking codes, expenses, notes or booking details. Offline changes appear after normal app sync. It does not run a model or require an OpenAI API key.

## What's implemented

`worker/connector.ts` uses the official MCP SDK's Web Standard Streamable HTTP transport in stateless mode. Each request verifies its JWT signature against Supabase's JWKS, issuer, audience, expiration, client, scope and dedicated database role. All queries forward the caller's token and use database RLS; no service-role key is used. OAuth discovery is served at `/.well-known/oauth-protected-resource/mcp` and the root protected-resource URL.

`/oauth/consent` handles account sign-in, consent and denial. Google sign-in returns to the pending connection. Only supported ChatGPT callback URLs are accepted. `/connections`, linked from the home page, lists grants and allows revocation.

The migration creates a dedicated `stowaway_connector` role with column-level SELECT grants on two tables and RLS for joined, live trips. OAuth tokens cannot use the app's normal write privileges or membership RPCs. The access-token hook assigns the MCP audience and caps token lifetime at five minutes. Revoking a grant prevents refresh; a previously issued JWT may remain usable until expiry. Browser and anonymous app sessions keep their existing claims.

## Activate account linking

The Worker and consent screens have been deployed to `https://trip-hub.alexanderclem12.workers.dev` (Cloudflare version `b9b59464-d258-464b-9c51-6e079cb7146f`). The live protected-resource discovery endpoint responds with HTTP 200, and the consent page renders without browser errors. Supabase's JWKS already publishes an ES256 signing key.

Account linking is still pending: the live `/mcp` endpoint returns HTTP 503 because `MCP_CLIENT_ID` has not been configured, and Supabase's OAuth authorization-server discovery endpoint returns HTTP 404. The connector migration **has been applied to the live project**; OAuth dashboard settings and client registration remain pending.

The authenticated `stowaway-supabase` MCP connection successfully applied the migration. Live permission checks confirm the connector can read trip names, but cannot update trips, read invitation tokens or tickets, or execute the link-code RPC. No credentials were added to the application repository.

This connection cannot configure Authentication: the Management API returns HTTP 403 for `/config/auth`, reporting missing `auth_config_read`. Supabase MCP client registration also rejects the `auth:read` and `auth:write` scopes, so repeating that login cannot grant the missing access. Complete OAuth settings in the [project dashboard](https://supabase.com/dashboard/project/croqjdvzbpcscdcshnet/auth/oauth-server), or use a separately authorized Management API connection with Authentication configuration permissions.

1. The live project already has `supabase/migrations/20261008000001_chatgpt_connector.sql` applied. For a separate project, apply it after the existing app migrations and test on a development project first.
2. In Authentication, enable Supabase's **OAuth 2.1 Server**. Set the authorization path to `/oauth/consent` and the Site URL to the deployed Stowaway origin. Leave dynamic client registration disabled for this initial version.
3. Ensure Google sign-in works for your Stowaway account, including the existing `/auth/callback` redirect and guest-account linking migration. Use the same account that has joined your trips.
4. In ChatGPT developer mode, begin creating an OAuth connection for your MCP server. Copy the **exact redirect URI shown for that connection**. Supported callback formats are `https://chatgpt.com/connector_platform_oauth_redirect` and `https://chatgpt.com/aip/<callback-id>/oauth/callback`; do not guess the callback ID.
5. In Supabase **Authentication → OAuth Apps**, pre-register a confidential ChatGPT client with that exact redirect URI. Use `client_secret_basic` token authentication. Save its client ID and secret; the secret belongs in ChatGPT's OAuth connection settings, not in browser code or this repository.
6. Configure the hook's private row with that client ID and the exact production MCP URL:

   ```sql
   insert into private.connector_oauth_config (client_id, resource_url)
   values ('<CHATGPT_CLIENT_UUID>', 'https://trip-hub.alexanderclem12.workers.dev/mcp')
   on conflict (singleton) do update
   set client_id = excluded.client_id, resource_url = excluded.resource_url;
   ```

7. In Authentication → Hooks, enable `public.connector_access_token_hook` as the **Custom Access Token Hook**. If another hook is enabled, merge this logic into it instead of replacing it. This initial hook rejects other third-party OAuth clients; first-party sign-ins continue unchanged. Use an asymmetric JWT signing key (ES256 or RS256) published through Supabase JWKS.
8. Add the registered client UUID as `MCP_CLIENT_ID` in the Worker's `vars` in `wrangler.jsonc`. Keep `MCP_RESOURCE_URL`, the private config's `resource_url`, and ChatGPT's server URL identical. The resource URL is currently the existing Workers deployment's `/mcp` endpoint. If moving to a custom domain, change all three together and reconnect.
9. Build and deploy the Worker:

   ```text
   npm run typecheck
   npm test
   npm run build
   npx wrangler deploy --dry-run
   npx wrangler deploy
   ```

10. Complete ChatGPT's connection with the pre-registered client ID and secret. Request `openid` scope and authorize from the Stowaway consent screen. Supabase's OAuth issuer is `https://croqjdvzbpcscdcshnet.supabase.co/auth/v1`; discovery is `https://croqjdvzbpcscdcshnet.supabase.co/.well-known/oauth-authorization-server/auth/v1`. Use the authorization and token endpoints returned by discovery if the connection form asks for them.

Dashboard labels and connection availability can vary by account. The final live flow must be tested after configuration; mocked browser tests cannot establish that Supabase and ChatGPT exchange real tokens correctly.

## Verify the live connection

Use MCP Inspector and the ChatGPT connection to verify discovery, authorization-code exchange with PKCE, token refresh, and the resource-specific JWT audience.

Try these prompts with an account that has synced trips:

- “List my Stowaway trips.”
- “Show the itinerary for [one of those trips].”
- “What is planned between March 14 and March 16?”

Also verify an account without trip membership cannot read that trip, deleted trips disappear, and attempting to change a plan exposes no write tool. Disconnect in `/connections`, wait at most five minutes for existing access to expire, and check that reconnecting is required. Confirm Google sign-in still restores guest trips normally.

Do not enable public client registration or publish this plugin until the live OAuth flow passes. Public distribution additionally requires OpenAI submission and review; this implementation prepares a personal connector and does not submit it.

## Local verification

```text
npm test -- worker/connector.test.ts worker/connector-permissions.test.ts src/features/account/connector.test.ts
npx playwright test tests/e2e/connector.spec.ts
```

Protocol tests verify signatures, stateless HTTP initialization and discovery, metadata, tool schemas, caller-token forwarding, pagination, date validation and unavailable-trip behavior. PGlite runs the actual connector migration against PostgreSQL role/RLS fixtures to test read boundaries, column grants, denied writes/RPCs and hook behavior. Browser tests stub all account/data endpoints and cover consent, denial, sign-in return, invalid redirects, errors and revocation without creating real accounts or trips.

## References

- [OpenAI MCP server guide](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI OAuth requirements](https://developers.openai.com/plugins/build/auth)
- [Connect a personal ChatGPT plugin](https://developers.openai.com/plugins/quickstart)
- [Supabase OAuth setup and consent UI](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
- [Supabase MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication)
- [Supabase OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security)

# Agent API: what exists (29 Oct 2026)

A REST agent API was specified (trip-scoped bearer tokens, trips, travelers, votes, day plans,
expenses, tickets, invite rotation, webhooks, plus an MCP server) but **never built**. No branch of
this repository contains it, and the only Worker on the Cloudflare account (`trip-hub`) serves none
of it. It is the fallback direction in `docs/PLAN_THE_SWITCH.md` if operator validation fails.

## What is live

| Path | What it does | Status |
|---|---|---|
| `/mcp` | Read-only MCP connector: `list_trips`, `get_itinerary` (`worker/connector.ts`) | Returns 503 until Supabase's OAuth 2.1 server is enabled and `MCP_CLIENT_ID` is set (`docs/CHATGPT_CONNECTOR.md`) |
| `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp` | OAuth discovery for the connector | Live |
| `/api/travel-ai` | Stowie and trip ideas (Workers AI), for the app only (same-origin, signed-in) | Live |
| `/api/scan` | Ticket and receipt detail extraction, for the app only | Live |
| `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml` | Not published. These now return a real 404 instead of the app page with a 200 (`assetOrNotFound` in `worker/index.ts`) | 404 by design |

There are no write tools, no API tokens, and no webhooks.

## Rules until the API exists

- Publish no `llms.txt` or agent documentation that claims capabilities we don't have.
- If the connector is meant to stay, finish its OAuth setup (about 2 hours of dashboard work, steps
  in `docs/CHATGPT_CONNECTOR.md`). Otherwise leave it at 503.
- Whether the agent API becomes a public story for free planning or a Pro feature for operators is
  decided after Phase 0 (`docs/PLAN_THE_SWITCH.md`, section 11).

## Re-checking

```bash
for p in /llms.txt /mcp /.well-known/oauth-protected-resource /api/v1/trips; do
  printf '%s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' "https://joinstowaway.app$p"
done
```

Expected after the next deploy: `404`, `503`, `200`, `404` (JSON).

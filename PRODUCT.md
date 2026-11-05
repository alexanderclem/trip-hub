# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary: a group of friends planning a trip together.** Usually one person starts it (the
organized friend) and shares a link; the rest join from their phones, often from inside a group
chat, and add ideas, vote and check the plan. Trips are eight or more people, several days, often
somewhere with patchy signal. The first real trip is a spring-break 2027 trip to Guatemala
(Antigua and Lake Atitlán).

**Secondary: people who run group trips for others** (retreats, club and student trips, small
operators). They plan with their travelers and, in a beta, collect deposits and balances through
their own Stripe account. On the public site they have their own path (`/operators`, `/pricing`)
and are never the homepage's lead.

## Product Purpose

Stowaway is the shared trip planner for trips with friends: one place where the group saves
places, votes on favorites, builds a day-by-day itinerary, keeps tickets and confirmations, and
tracks shared expenses. It replaces the group chat, the spreadsheet only one person updates,
screenshots of tickets and a separate expense app. Success is a group that arrives knowing the
plan, with everything on every phone, including where there is no signal.

## Positioning

Four things, all true and all to be shown rather than claimed:

- **Works offline.** The plan, tickets and saved maps keep working with no signal once a phone has
  been prepared while online (rural roads, airports, boats).
- **No accounts to join.** Friends join with the trip link and "Who are you?". No password, no
  app-store download; an account is optional and only brings trips back on another phone.
- **The group decides.** Save places, everyone votes, the favorites go into the plan: one loop from
  "we should go" to "see you there". Votes are preferences; people decide what enters the plan.
- **Replaces the chaos.** Places, votes, plan, tickets and expenses live together instead of across
  five apps.

## Operating Context

- Installed to the iPhone Home Screen from Safari is the primary way people use the app; most
  visitors arrive on a phone, frequently from a link shared in a group chat.
- Live at `https://joinstowaway.app` (Cloudflare). Public pages are prerendered for search and
  link previews; the app itself is offline-first and reads only from the phone's local database.
- Public routes: `/` (home), `/how-it-works`, `/pricing`, `/operators`, `/help`, `/privacy`,
  `/terms`; entry to the app at `/app`, `/new`, `/join`.

## Capabilities and Constraints

- Free forever for groups: creating trips, inviting, voting, planning, expenses, tickets and
  offline use are never paywalled. Paid features are organizer tools only, offered when someone
  needs them, never as banners.
- Payment collection for organizers is **coming soon / early access**: US and USD only at launch,
  a proposed flat 1% plus Stripe's fee, money goes to the organizer's own Stripe account and
  Stowaway never holds it. Pro organizer tools are free during the beta.
- Stowaway does not book travel, does not move money between friends (expenses track shares and
  balances), and does not show third-party star ratings.
- Offline needs preparation while online; maps are downloaded separately.
- $0 budget: no paid services, fonts, images or APIs without explicit approval. Self-hosted open
  licensed assets are fine.
- Stack: React 19, Vite, Tailwind 4, React Router; the website shares the app's codebase.

## Brand Commitments

- Name **Stowaway**; domain `joinstowaway.app`. Repository and storage identifiers stay `trip-hub`.
- Public headline: **"Plan a trip with friends."** Use feature names and literal actions in the
  interface. Saved places, votes, itineraries, tickets and expenses demonstrate the product;
  avoid slogans, encouragement and helper paragraphs that repeat the controls.
- Voice: the organized friend; warm, direct, specific, short sentences, literal action labels
  ("Create a trip", "Join trip"). Rules and examples in `docs/BRAND.md`.
- The Carry-on mark (suitcase with two eyes; ocean bag, coral handle) and the drawn lowercase
  wordmark are masters in `public/brand/`: never retyped, redrawn, recolored or distorted.
- Stowie, the suitcase character: helpful and curious, used sparingly (welcome, offline
  preparation, empty states).

## Evidence on Hand

- **Public example:** Paris in spring 2027, with a day in Versailles. Places are real; travelers,
  votes, schedules, tickets and expenses are illustrative and labelled as an example trip.
- **Our real trip:** the founder's spring-break 2027 Guatemala trip has seed data in
  `seed/guatemala-2027/`. Keep it available for that trip. It is no longer the public brand example;
  traveler names and personal details need the founder's approval before publishing.
- **Founder story:** may be told; the words must come from the founder (not yet written).
- Product itself: the live app can demonstrate every claim above.
- Assets: logo masters and `packed-for-anywhere.svg` in `public/brand/`; `public/images/lakeside-escape.jpg`
  (Unsplash license); Antonio font (OFL) archived in `public/fonts/`. Provenance in `docs/DESIGN_ASSETS.md`.
- **None yet:** customers, testimonials, reviews, usage numbers, press. Never invent them. Any
  demonstration that isn't the real trip is labelled as an example.

## Product Principles

1. Show, don't claim: every strength is demonstrated by the product or the real trip.
2. Honest about what it is: never imply booking, payments that aren't live, or proof that doesn't exist.
3. Phone first: the first visit is usually a tap from a group chat on an iPhone.
4. Free for the group, always; the business is organizer tools.
5. One friend organizes, everyone takes part: joining must feel effortless.

## Accessibility & Inclusion

WCAG 2.1 AA. Touch targets at least 44px, input text at least 16px on phones, visible keyboard
focus, reduced-motion respected everywhere, readable at enlarged text sizes.

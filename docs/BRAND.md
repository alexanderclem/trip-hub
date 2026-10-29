# Stowaway brand

Stowaway is **the shared trip planner** for trips with friends.
Address: `joinstowaway.app`.

## Message hierarchy

1. **Promise:** Your group trip. All in one place.
2. **Explanation:** Save places, vote on favorites, and build an itinerary together.
   Keep tickets and shared expenses with the plan.
3. **Supporting signature:** The whole trip, tucked away.

Use the promise and the explanation together when introducing the product. The
signature is an occasional brand detail, not the product explanation. The same
message appears on the homepage, social preview, and browser metadata.

## Voice

Sound like the organized friend: warm, direct, and specific. Lead with the thing
people can do or find. Short sentences and familiar words carry the personality.
Use “your group,” “your trip,” and “together” when they clarify who is involved.

| Instead of | Write |
| --- | --- |
| Give the idea a place to land | Create a trip and share the invite link |
| Find the group’s kind of good | Save places and vote on favorites |
| Less signal. Still sorted. | Saved plans and downloaded tickets work offline |
| Work out the good stuff together | Build an itinerary with your group |
| Everything you need, anywhere | Save your itinerary and download tickets before you leave |

Action labels stay literal: Create a trip, Join trip, Open trip, Add to plan,
Save ticket. “Start planning” is appropriate for a closing invitation that opens
the create flow. Keep navigation names aligned with the actual screens.

Say what the app does accurately. Votes express preferences; the group decides
what enters the plan. Expenses track shares and balances; they do not transfer
money. Stowaway organizes tickets and confirmations; it does not book travel.
Offline use requires preparation while online, with maps downloaded separately.
Never invent reservations, customers, ratings, or claims of universal availability.

Invitations introduce the actual trip name, destinations, dates, and travelers.
Do not fabricate missing details. Product demonstrations must be labeled examples.

## Visual identity

The design is a shared travel journal: cream paper, ocean ink, sea-glass mist,
and a small coral accent. Georgia provides the editorial voice; system sans-serif
keeps trip details and actions clear. Use sentence case. The exact palette,
typography, layout, and component states are in [DESIGN.md](../DESIGN.md).

### Logo and character

The Carry-on mark is a suitcase with two eyes looking out. The bag is ocean ink;
the handle is coral. The slot and eye highlights are transparent cut-outs.

- `public/brand/stowaway-mark.svg`: master on a 96-unit grid.
- `public/brand/stowaway-mark-small.svg`: small-size cut; use below about 32px.
- `public/brand/stowaway-type.svg`: drawn lowercase wordmark. Never retype it.
- `public/brand/stowaway-wordmark.svg`: full horizontal logo.
- `src/ui/Brand.tsx`: shared application and website lockups.
- `public/brand/packed-for-anywhere.svg`: travel illustration.

Keep clear space of one handle width. Do not recolor the bag, distort or rotate a
lockup, or add eyes. Stowie, the suitcase character, is helpful and curious. Use
him sparingly in welcome moments, offline preparation, and empty states. Give one
useful next step; never imply a booking or decision happened before it did.

Run `node scripts/build-brand-assets.mjs` to regenerate icons, the full logo, and
the 1200×630 social preview from the masters. Image and font provenance is in
[DESIGN_ASSETS.md](DESIGN_ASSETS.md).

## Compatibility

Keep `trip-hub` database, local-storage, infrastructure, and repository identifiers.
Share links use the current origin. Moving domains does not transfer browser
storage; travelers can rejoin with their trip link. The social image URL assumes
production is served at `https://joinstowaway.app`.

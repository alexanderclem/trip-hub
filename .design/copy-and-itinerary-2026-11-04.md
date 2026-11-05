# Copy and itinerary improvements — November 4, 2026

## Copy

Removed all six explanatory paragraphs from the homepage examples, the tie-breaking instruction, action subtitles, repeated join/setup explanations and several app encouragement lines. Changed the headline to “Plan a trip with friends.” Sections now use names such as Saved places, Itinerary, Offline access and Tickets and expenses. Updated the footer, public secondary-page headings, overview, settings, app entry, welcome feedback and metadata. Necessary errors, access restrictions, form labels, privacy facts and offline preparation instructions remain.

## Itinerary editing

Items now have Reschedule and Duplicate actions. Reschedule previews the original and proposed dates/times, optionally shifts later timed activities from the same trip-local day, and reports overlapping items. It preserves elapsed duration and end time zones. All-day ranges retain calendar-day lengths across daylight-saving changes. Lodging and cancelled entries are excluded from the later-activity shift.

Batch writes and undo use local transactions including the sync outbox. Both re-read their affected rows and refuse to overwrite a subsequent edit. Undo tolerates equivalent server timestamp formats. A duplicate opens for review with its own ID, retains notes/attendees and calendar span, starts tentative, and clears the original booking code. Its creation can also be undone if it has not changed since.

## Meaningful changes

New itinerary edits record before/after time information, renames, status, location, attendance, note updates and removals. They appear in Changes and in a short unread summary on the overview. A later edit does not retime earlier records. The existing details JSON field carries up to 40 records per item through the normal sync path; this is bounded per-item change history, not a separate immutable audit service. Older edits cannot be reconstructed, and concurrent edits follow the existing row-level sync conflict behavior.

## Tickets to itinerary

Saved tickets/reservations offer Add to itinerary. Uploads also offer Save and add to itinerary. Both open a review form with the source document, extracted name, reference, type, dates, times and time zones. Unknown times stay empty. The date/time review precedes the optional type/location controls. The original document remains available if review is cancelled or saving fails.

Saving the reviewed item and linking the ticket happen in one transaction; a failed attachment update rolls the item back. A ticket already linked to a live item cannot create a second one. Hosted travelers without planning permission cannot use the new planning actions; existing write guards remain authoritative at save/undo time.

The existing scan schema/prompt now supports optional travel-specific dates, times, zones and booking type. Older extraction responses remain compatible. The Worker change must ship with the rest of the app to enable those additional extraction fields in production.

## Verification

- Production build, TypeScript checks and `git diff --check`: passed.
- Full unit suite: 88 files / 629 tests passed before the final duplicate-range test; the final affected five-file run passed 35 tests, including the added range test.
- Browser coverage across runs: 74 distinct cases passed. This includes the 61-case appearance/design-flow/journal/organizer/polish/website/new-feature set, six access-role checks, five first-run checks and two additional upload/permission cases. Copy-dependent selectors were updated; their initial failures were rerun successfully.
- New browser cases cover previewing a batch shift, undo after navigation, duplicate identity/status/reference handling, atomic ticket-link failure and retry, duplicate-import prevention, unread change summaries, new-file upload into review, and hosted-traveler restrictions.
- Extra visual checks passed for the reschedule dialog and ticket review at 320px light, 390px dark, 1440px light and 640px dark with 200% text. No horizontal content overflow or page exceptions. Inspected the dialog, review form and revised full homepage.
- React review: hooks remain unconditional, source records are scoped to their trip, saving actions have duplicate-submission guards, lists use stable IDs, and the existing dialog/keyboard/reduced-motion primitives remain.

All browser records are synthetic local fixtures or mocked requests. No live trip writes, database migrations, deployment or model calls were performed. Live multi-device synchronization, live extraction quality, physical iPhone Safari and screen readers were not checked in this pass.

Local captures and logs: ignored `test-results-product-pass/`.

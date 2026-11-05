# Paris example — November 4, 2026

Changed the public brand example to Paris in spring 2027, preserving the luggage-tag design.
The homepage route is CDG → PAR → VRS, with Paris arrival, a museum day and a day in Versailles.
Saved places use recognizable Paris landmarks. Neighborhood voting fills the open afternoon
on day 2; offline and ticket examples follow the Versailles train on day 3. Shared costs use EUR.

Updated organizer previews to Paris and a city illustration, retaining USD for the US payment
launch. Updated app form placeholders and the product/design/brand documentation. The original
Guatemala seed, offline map packs, real trips and supported currencies/timezones remain intact.

Verification: production build, both TypeScript configs and git diff whitespace check passed.
All 19 relevant Chromium browser cases passed, covering the interactive example, create/join,
offline navigation, keyboard behavior, 320–1920px reflow, 200% text, contrast, organizer previews
and pricing. Inspected settled phone screenshots in light/dark mode and desktop rendering;
the hero route fits its container and no page exceptions occurred. Earlier captures taken
during the print animation were replaced for visual review with reduced-motion captures.

React review: existing hooks, keys, semantics and interaction states are preserved. No new
dependencies, network/data behavior or backend changes. Local preview only; not deployed.

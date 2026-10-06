<!-- Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4 -->
# Stowaway — Hallmark refinement

Reviewed 2026-10-06 using [Hallmark 1.1.0](https://github.com/Nutlope/hallmark/blob/main/skills/hallmark/SKILL.md).
The user chose a product-led website with map, itinerary, and clear copy, then
requested the official assets in `public/brand`. This pass refines the existing
public homepage inside its routes and brand system.

## Delivered

- Header and footer load `public/brand/stowaway-wordmark.svg` directly. It contains
  the official suitcase mark and drawn wordmark; neither is retyped. Accessible
  home-link labels and explicit intrinsic image dimensions remain.
- Existing `packed-for-anywhere.svg`, social preview, and generated icon assets
  continue through their existing paths. Concurrent updates to brand master files
  and the shared app Brand component were preserved.
- Itinerary titles increased to 16px and secondary text to 14px. Website prose is
  consistently 16px. Display tracking follows the locked Georgia treatment.
- Named website tokens centralize illustration colors, fonts, spacing, and type.
  They avoid overwriting Tailwind's text/spacing/font token names on app screens.
- Mobile-first, minimum-zero grid tracks; wrapping-safe display headings; single
  line navigation/CTA labels; darker outlined action boundary (3.94:1 on cream).
- Removed the map overlay that obscured a stop on a 320px screen. The figure is
  explicitly labeled an illustrative map and example itinerary.
- Hero padding and scale keep headline, introduction, primary action, and map
  focal point visible at 1280×800. Focus/disclosure feedback stays immediate;
  reduced motion removes the one-pixel press shift.

## Hallmark preview / final decisions

- **Macrostructure:** Split Studio, following the locked public layout; H2 diptych.
- **Theme:** locked Stowaway, cream paper and ocean ink; Georgia + system sans.
- **Enrichment:** existing hand-built map and supplied suitcase SVG; no fake chrome.
- **Sections:** introduction and itinerary · essentials · shared planning · offline
  preparation · FAQ · final action · inline footer.
- **Motion:** immediate state changes; no entrance or scroll animations.
- **Navigation/footer:** N1a for two in-page destinations and app entry; Ft2 inline.
  First Hallmark run; no previous Hallmark archetype to rotate against. The locked
  project system takes precedence over catalog/theme rotation.
- **Slop test:** all 58 checks reviewed; applicable checks pass with the locked
  brand exceptions below. Forms, tooltips, tabs, stateful mutations, media playback,
  statistical proof, and sticky overlap checks are not applicable to this homepage.

## Gate sweep

| Checks | Outcome / evidence |
| --- | --- |
| 1, 7, 22 | Existing brand is locked: Georgia/system sans retained; exact sRGB brand values kept. White is action text, never page ground. |
| 2–6, 9, 21, 23 | No gradients, equal icon cards, nested card groups, side stripes, centered viewport hero, decorative section labels, or accent-filled sections. Varied section rhythm and one tinted offline band. |
| 8, 20, 32, 42–43 | First Hallmark pass; CSS stamp and memory created. Existing simple nav and inline footer fit the actual destinations. |
| 10–19, 27 | No generic transitions, hover scaling, bounce, layout animation, delayed focus, celebratory toast, or auto-rotating content. Reduced motion verified. |
| 24–25 | Named 4px spacing increments, 45ch intro/50ch offline measure. Narrow viewports naturally shorten lines. |
| 26, 39 | Native navigation links and disclosures provide their applicable hover/focus/press/open states. No disabled/loading/error form states are invented for links. The app's invite validation remains covered by a browser test. |
| 28–31, 33, 45–47 | No fabricated proof, autoplay, generic decoration, re-drawn browser/phone chrome, new animation runtime, or mixed icon libraries. Static map hidden from assistive tech; figure has an accessible caption. |
| 34–36, 49–56 | No overflow at 320/375/390/414/768/1280/1920px, even without clipping. Nav/CTA labels never wrap; image grids use minmax. Long-word wrapping, single-column mobile sections, keyboard access, and visible focus pass. FAQ questions may wrap to preserve full text. |
| 37–38a | Two font roles, roman headings, no emphasis-word styling. The supplied vector logo retains its original drawing. |
| 40–41 | Rendered text contrast tested against effective backgrounds; every text pair exceeds 4.5:1. Main text 10.54:1, muted copy 5.62:1 on cream / 5.29:1 on offline band, action text 8.39:1. |
| 44 | 48px hero top / 72px bottom. Essential hero content and map fit the 1280×800 laptop test. |
| 48 | CSS and map artwork consume named color/font tokens; brand asset files remain the supplied masters. |
| 57 | No study DNA was requested or discarded; the GitHub URL supplied the skill. |

The earlier avoid-ai-design scanner still reports zero P0/P1 findings. Its one P2
is Hallmark's required metadata comment using middle dots; this is source-only
metadata and is never rendered as website chrome. No detector suppression added.

## Verification

- `npm run build` passes; existing app map chunks still produce the size warning.
- `npm run typecheck` passes.
- `BASE_URL=http://127.0.0.1:4174 SHOTS_DIR=/tmp/stowaway-hallmark-shots npx playwright test tests/e2e/website.spec.ts tests/e2e/account.spec.ts`: **14 passed**.
- Checks include official logo asset loading, public/app/create navigation, invite
  focus and validation, native FAQ, keyboard skip link, returning traveler entry,
  200% text scaling, standalone shortcut entry, offline reload, reduced motion,
  long headings, one-line CTAs, laptop fold fit, and rendered contrast.
- Required 320/375/414/768px screenshots visually inspected; wide and laptop-fold
  screenshots saved in `.design/screenshots/hallmark/`.
- Machine-readable token export in DESIGN.md parses as JSON. Scoped whitespace
  checks pass. Unrelated concurrent brand-file whitespace was left intact.

Browser tests use Chromium with phone emulation and stub authentication settings;
they do not create remote trips. Full physical iPhone/screen-reader and live
trip-sync behavior were not newly tested in this presentation pass. Work remains
local on `polish/website-entry`; no commit, push, or deployment was performed.

# Stowaway on Astryx: incremental production migration

Base: `a5f9be4`, clean `codex/pro-redesign` worktree. Implementation branch: `codex/astryx-migration`. Date: November 11, 2026. This work implements shared foundations and selected consumer journeys; it does not claim every feature has been redesigned.

## Packages and canonical references

| Package | Exact installed version | License / compatibility |
| --- | --- | --- |
| `@astryxdesign/core` | 0.7.13 | MIT; React/React DOM >=19; StyleX ^0.19.0 |
| `@astryxdesign/theme-neutral` | 0.7.13 | MIT; Core exactly 0.7.13; React >=19 |
| `@astryxdesign/cli` (development) | 0.7.13 | MIT; Node >=22.13.0 |
| `@stylexjs/stylex` | 0.19.0 | MIT; required runtime peer |

All four versions are exact in package.json and npm's existing lockfile. The other declared dependency ranges and product stack are retained. The original node_modules junction pointed into the main worktree; only the junction was removed, then dependencies were installed locally. Main's installation was not changed. Package postinstall scripts were not approved or run.

Read upstream [README](https://github.com/meta/astryx/blob/main/README.md), [Core](https://github.com/meta/astryx/blob/main/packages/core/README.md), [CLI](https://github.com/meta/astryx/blob/main/packages/cli/README.md), and [Neutral](https://github.com/meta/astryx/blob/main/packages/themes/neutral/README.md). Neutral's README still mentions `XDSTheme`; the installed CLI and public declarations correctly specify `Theme`. The beta packages are pinned; upgrades require a separate CLI/API, theme-output, browser and bundle review.

Canonical commands executed through **the scoped CLI**: `--help`, `component --list`, `docs theme`, `docs tokens`, `docs styling-libraries/tailwind`, `template --list`, and component reads for Button, Dialog, DialogHeader, SegmentedControl, Card, TextInput, Field, AppShell, MobileNav, BottomSheet and Link. `Accordion`/`Disclosure` discovery led to the supported `Collapsible`. Also read `use-a-theme`, `author-a-theme`, full Tailwind guidance, and `theme build --help`. Captured output is under ignored `output/astryx-reference/`. No unscoped npx package or source-internal imports were used. `init` was unnecessary; CLAUDE.md and existing instructions were preserved. The user's explicit Astryx request supersedes older local guidance prohibiting another component library.

## CSS and brand ownership

The first declaration in **both index.html and src/styles/index.css** is:

```css
@layer reset, theme, base, astryx-base, astryx-theme, components, utilities, stageshow;
```

Tailwind remains the existing entry. Astryx reset and compiled component CSS follow it; the **one compiled Stowaway theme** follows those. Neutral CSS/fonts are not imported separately. Existing locally hosted Barlow, Barlow Condensed and Antonio assets remain unchanged. No StyleX compiler/plugin or new font request is needed.

The official Tailwind bridge is intentionally omitted: it would redefine `bg-surface`, status colors, radii and shadows. Stowaway's own Tailwind aliases now use `@theme inline`, so `bg-warning` and `bg-success` continue resolving to Stowaway's pale status surfaces even though Astryx defines same-named variables for other roles. Application CSS continues using the prefixed `--stowaway-*` owners. Actual Home color/contrast and appearance tests cover the cascade; compilation alone was insufficient.

| Astryx role | Stowaway owner |
| --- | --- |
| body / surface / card / muted | canvas / surface / surface / mist |
| primary / secondary text | ink / muted |
| accent / on accent | coral / on-primary |
| text accent / icon accent | ink (coral remains reserved for the primary action) |
| border / emphasized border | border / control-border |
| status text | danger-ink / warning-ink / success-ink |
| focus | ink; existing coral + ink focus treatment in app controls |
| element / container radius | existing control / surface roles |
| body / heading / numeric text | Barlow; custom travel metadata/code compositions retain their existing fonts |

`src/themes/stowaway/stowawayTheme.ts` extends Neutral's **built** public export through `defineTheme`, then compiles to local CSS, JS and declarations. Production imports the compiled object, not the source theme. `npm run theme:build` regenerates; `npm run theme:check` verifies drift. The inherited theme is flattened by the supported compiler. The TextInput's public control class has one explicit native-input height rule because the border box alone did not provide a 44px editable target.

## Appearance, first paint and portals

All Stowaway/DaisyUI/marketing selectors now use `data-theme='light'|'dark'`. The existing `stowaway-appearance` storage key and `system|light|dark` preference values are unchanged. The theme-controller class was removed from the native appearance radios so CSS cannot independently change theme ownership.

`public/appearance.js` writes the resolved mode **before CSS paints**. At runtime `StowawayTheme` is the single root Theme owner of HTML mode and `data-astryx-theme`. The existing appearance store resolves OS preference and notifies React on picker, OS and cross-tab storage changes; it updates browser chrome color without competing HTML attribute writes. Blocked storage still permits session choices.

Client and public prerender share the same provider tree. Its server snapshot is `system`, avoiding a light-mode attribute baked into dark-preferring public HTML. The direct root Theme wrapper inherits HTML's pre-paint color scheme until hydration reads the saved choice. Public prerender/metadata and offline app-shell generation remain in the existing build. Root attributes reach portals; native dialogs continue inheriting prefixed Stowaway variables.

## Links, data and exceptions

`LinkProvider` uses `RouterAnchor`, forwarding href to React Router's to prop and preserving ref, anchor handlers, state, fragments and modifier behavior. TravelerLink uses the actual Astryx Link. Its avatar is decorative and the name remains readable. Roster-origin navigation is stored as router state so the visible Back link returns to the roster; existing unrelated traveler entry points keep their original Home return.

The shared Button adapter maps variants and disabled/loading explicitly, retains native disabled and form submit semantics, derives an accessible label from visible children, and preserves native attributes/ref. It no longer applies Daisy button classes. LinkButton remains a Router/Motion anchor to preserve its router-specific API. TextField composes actual Astryx TextInput/Field in create, expense, itinerary, task and booking forms. Existing Field also recognizes one controlled text Input without custom size/styles and delegates to TextField, preserving native events, name/ref, required/disabled, hint IDs and keyboard traits. Composite, uncontrolled, native number/date/file/select/textarea and tightly sized controls remain explicit compatibility exceptions.

**Native Dialog retained:** the first Astryx confirmation integration failed Escape dismissal in this application's browser matrix. It was removed, not left as a broken production provider or swizzled. Subsequent repeated normal-motion checks also exposed an interrupted exit in the existing native modal. Its bounded dismissal fallback closes only while the controlled state still requests close, and cancels on reopen/unmount. This is not proof of a standalone upstream Dialog defect. Focus, Escape, reduced motion and existing sheet gestures are verified on the retained implementation; Astryx Collapsible supplies the migrated disclosure foundation. AppShell/MobileNav are not adopted: existing shell scrolling, map, rail and five phone destinations remain coherent.

No Astryx primitive fetches or persists data. Ordinary product reads remain IndexedDB; writes continue through existing repositories. The completion pass corrects cold offline map startup, adds a middle-zoom tile border and annotation fonts to map preparation, and calibrates its estimate from the measured public Paris download. No schema/RLS, SQL, currency arithmetic, vote scores, route estimates, ticket storage, account gate, payment activation, production configuration or live trip records changed. The user separately authorized pushing the completed branch to main, which triggers the existing Cloudflare deployment.

## Risks

Full prebuilt Astryx CSS and runtime add a substantial cold footprint; see BUNDLE_SIZES and PERFORMANCE. The production build now enforces complete static-graph budgets. The separate repeatable gzip/CPU/network lab profile measures actual form use; it is not physical-device or field Web Vitals evidence. MapLibre, PMTiles/saved-area and PDF remain dynamic. Cold Chromium documents, cached tickets, a real public Paris map and two independent browser databases with a stubbed sync server are verified. Windows WebKit UI runs omit the synthetic Blob file because its ephemeral context rejects IndexedDB Blob storage; they do not certify Safari file persistence. Physical iPhone/PWA, VoiceOver and live hosted cross-device reconciliation remain explicitly unverified. The user instructed us to retain physical-device checks as unverified. npm reported existing dependency vulnerabilities; no unrelated automatic dependency fixes were applied.

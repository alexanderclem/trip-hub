# Review boundary and remaining release work

**Implemented incremental Astryx migration; not a complete product redesign or release approval.** The real product uses a Stowaway-specific compiled theme and upstream Button, Card, TextInput/Field, SegmentedControl, Link and Collapsible. Existing native dialogs and specialized travel controls remain deliberate exceptions.

| Area | Practical result | Remaining limit |
| --- | --- | --- |
| Hierarchy | Home priority readable; personal Money actions/history precede group details | DecisionHandoff still presents optional forms together. |
| Navigation | Existing five phone tabs preserved; working roster/detail/Back; preparation anchor; day/deep links retained | Full map-sheet/lifecycle combinations still need physical-device review. |
| Readability | Local brand fonts; 13px caption floor; measured Home text contrast; 44px migrated targets | 200% checks are CSS/root-text emulation, not browser-toolbar zoom. |
| Theming | One runtime mode owner, compiled Stowaway theme, inline Tailwind aliases, appearance persistence/system/cross-tab coverage | Beta upgrades and Safari CSS scope/light-dark support need release review. |
| Interaction | Real create/join/vote/manual schedule/expense/payment/demo paths; retained focus and sheet behavior; viewer Money has no recording controls and uses read-only expense details | Astryx Dialog is not approved for migration here. |
| Accessibility | Names, native validation, radio keyboard behavior, focus, reduced motion, target sizes and contrast checked | No VoiceOver/screen-reader certification or existing axe integration. |
| Data resilience | Synthetic IndexedDB fixtures; existing repositories and financial/voting algorithms preserved | No live cross-device sync, successful full map download or cold PWA airplane launch claimed. |
| Visual cohesion | Ocean ink/coral/cool stock, existing master assets and Barlow roles preserved; illustration and real demo distinguished | Native field/overlay migrations remain incremental. |

## Release blockers / remaining issues

- **HIGH: performance validation.** Cold static code grows substantially. Profile a constrained phone and review budgets before shipping; do not hide shared chunks when reporting route sizes.
- **HIGH: device/offline release verification.** Physical iPhone Safari/PWA, VoiceOver, cold offline launch, successful map preparation and real reconnect need separate authorized verification. Synthetic local tests are not evidence of these outcomes.
- **MEDIUM: incomplete feature migration.** Native dates/selects/files, most text fields, sheets/popovers/toasts, empty/loading states and custom navigation are not all Astryx. No automatic mass substitution is proposed.
- **LOW: UX-07.** Refine optional decision-link/booking forms in the next slice, keeping consequential state visible.
- **LOW: static design scanner remains nonzero.** The unchanged three vendored Stage-kit font findings also occur in the baseline; five extra advisories record the existing app radii reproduced in the theme. This check is explicitly not reported as passing.

Final product source: `aa10ccc`, following `e89f075`, on `codex/astryx-migration`. **795 unit tests and 100 selected browser tests pass**, as do strict typecheck, production build and compiled-theme verification. The static design scan remains nonzero as explained above. No push, deployment or production writes occurred.

Measured entry graph growth is approximately **152 KiB gzip JavaScript**, plus **47 KiB gzip global CSS**. Cold route graphs and method are in [BUNDLE_SIZES.json](BUNDLE_SIZES.json) and IMPLEMENTATION_LOG. These are code-footprint measurements, not network latency or Core Web Vitals.

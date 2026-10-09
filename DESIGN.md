---
version: alpha
name: Stowaway
description: A shared trip planner that keeps a group's plans and travel essentials together.
colors:
  ground: "#f8f5ee"
  ink: "#183e4b"
  muted: "#586467"
  signal: "#295361"
  mist: "#d6e4e5"
  coral: "#ef9477"
typography:
  display:
    fontFamily: Georgia, 'Times New Roman', serif
    fontWeight: 400
    letterSpacing: -0.045em
  body:
    fontFamily: system-ui, sans-serif
    fontSize: 16px
    lineHeight: 1.8
rounded:
  button: 12px
  surface: 16px
spacing:
  sm: 8px
  md: 16px
  lg: 32px
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "#ffffff"
    rounded: "{rounded.button}"
    padding: 12px 20px
---

## Overview

Stowaway serves groups planning and taking a trip together. The existing brand
guide in `docs/BRAND.md` is the visual contract, including its shared logo component,
ocean ink, cream ground, and Georgia display type. This work introduces a public
website, not a new brand. The user chose a product-led direction: map, itinerary,
and clear copy. The map route paired with a day's itinerary is its signature detail.

## Colors

Reuse the brand tokens in `src/styles/index.css`. Ink has 10.54:1 contrast on
cream; website secondary text has 5.62:1; white on the action blue has 8.39:1.
Coral stays within existing logo and illustration artwork; it is not small text.
Local map greens describe an illustrative map, not new interface states.

## Typography

Georgia for major website headings. Use `public/brand/stowaway-wordmark.svg`
for the public website's full logo without retyping it. System sans-serif
for copy, navigation, controls, and itinerary details. No external fonts. The
whole headline has one treatment: no isolated italic or colored phrase. Section
headings carry the hierarchy without a repeated all-caps opener.

## Layout

The public homepage is `/`, with a 1160px maximum content width. At wide widths,
the introduction and example itinerary share the first section. At 700px and
below, they stack with the introduction and actions first. Public navigation
links to anchored explanation and FAQ sections and offers a distinct Open app
action. `/app` retains the existing welcome/workspace behavior, account access,
and invite form; trip deep links continue directly into the app.

The website supports discovery; app screens support working with trip data.
Their density differs intentionally, while brand, typography, action color,
12px button radius, and 16px surface radius stay consistent.

## Elevation & Depth

Only the example itinerary uses a contained surface. Explanation and FAQ
content remains unboxed. Borders separate content; they do not decorate every row.

## Shapes

Use the app's existing button and surface radii. Use the shared logo masters without redrawing them.

## Components

Use `public/brand/stowaway-wordmark.svg` for the website header and footer;
the app retains its shared `src/ui/Brand.tsx` lockup. Use native links for navigation and
native details/summary for the FAQ. Website links use shared website button
classes; app forms retain the existing `src/ui` primitives. Do not add a component
library. The example is a labelled, local three-day itinerary preview. Day selection updates the illustrative map and stops without loading app data.

## Do's and Don'ts

- Keep the existing branding and public illustration assets.
- Show real product capabilities, with prerequisites for offline access stated.
- Keep shared links, quiz continuation, restored trips, and return navigation functional.
- Retain 44px or larger key controls, focus indicators, and reduced-motion support.
- Do not use repeated arrow icons, decorative step numbers, partial headline emphasis,
  all-caps section labels, fake people, statistics, or operational status badges.
- Do not add destination imagery as filler or replace this brand with a new palette.
- Use the map/itinerary as evidence; label examples honestly and do not imply a booking.
- App features load at their routes. Entering an app route starts precaching all generated app chunks for offline use; public marketing visits do not start the offline download.

## Hallmark refinement

The public page uses a mobile-first layout and five text roles: 14px secondary
labels, 16px body/itinerary titles, 20px preview title, fluid section headings,
and fluid display type. Brand lockups retain their established sizes. Body
line-height stays at the locked 1.8. All clickable navigation and CTA labels
remain on one line; FAQ questions may wrap to stay fully readable. Focus and
disclosure feedback are immediate. Motion follows the shared behavior below.

## App screens

Trip screens follow the same surface and type rules as the website: bordered
`bg-surface` cards without shadows, sentence-case labels, one page title per
screen, and shared `Button`/`LinkButton` actions. Each screen has one header, at
most one filled button, and nothing floating over its content except a single
add button; Stowie and sync status sit in the header. The tabs are Home, Plan,
Map, Vote and More on every width. The roles and the rules for keeping screens
uncluttered are listed in `docs/UI_COMPONENTS.md`. Unknown addresses show the
website-styled not-found page.
The "How it works" section pairs its steps with three labelled, local examples
(an invite, a vote, a ticket and a shared cost); they name no people.

## Motion

Use `motion/react` through the shared `MotionProvider` with the lightweight
`m` components. `src/ui/motion.ts` owns entrance, fade, and spring feedback timing.
Homepage copy and the example itinerary settle into place over 280ms. Route
changes fade over 180ms without remounting forms, maps, or sync subscriptions.
Shared buttons lift 1px on hover and compress slightly on press; native dialogs
animate their contents on opening while retaining immediate focus and dismissal.

Loading screens use the original suitcase mark in `LoadingLogo`: a small hop,
a soft squash on landing, and a synchronized ground shadow. The compact version
also accompanies pending route navigation. Loading never adds an artificial delay.
Honor reduced motion globally and explicitly in repeating animations and gestures:
the suitcase and shadow become static, page and dialog updates are immediate,
and buttons retain their normal color and focus feedback without moving.

Website tokens use a `website` namespace so they cannot change Tailwind text,
spacing, or font utilities on trip screens. The original hex brand values remain
exact under the locked system; Hallmark's generic OKLCH palette selection does
not replace them. The map's local colors are named illustration tokens.

## Exports

These exports document the existing system; no new UI library or font service
is installed. `tokens.css` is imported by the public page's stylesheet. The
Tailwind and shadcn blocks are optional migration references, not additional
runtime themes. The shadcn export provides only roles this page uses.

### CSS — source of truth

```css
/* Hallmark · locked system: Stowaway · portable website tokens */
:root {
  /* Existing brand values are kept exact; the app owns the same Tailwind names. */
  --color-brand-100: #d6e4e5;
  --color-brand-600: #396673;
  --color-brand-700: #295361;
  --color-brand-900: #183e4b;
  --color-canvas: #f8f5ee;
  --color-website-muted: #586467;
  --color-website-border: #dcded5;
  --color-website-control-border: #687e83;
  --color-website-surface: #fffdf8;
  --color-website-on-action: #ffffff;
  --color-website-preview-border: #d0d8d1;
  --color-website-preview-rule: #e8e8df;
  --color-website-offline: #eaf0ea;
  --color-website-offline-border: #dce4dc;
  --color-website-map-ground: #e7ede4;
  --color-website-map-blocks: #d4dfcf;
  --color-website-map-streets: #faf8f1;
  --color-website-map-park: #c7d9bb;
  --color-website-map-label: #52644f;
  --font-website-display: Georgia, 'Times New Roman', serif;
  --font-website-body: system-ui, sans-serif;
  --space-website-2xs: .25rem;
  --space-website-xs: .5rem;
  --space-website-sm: .75rem;
  --space-website-md: 1rem;
  --space-website-gutter: 1.25rem;
  --space-website-lg: 1.5rem;
  --space-website-xl: 2rem;
  --space-website-2xl: 2.5rem;
  --space-website-3xl: 3rem;
  --space-website-4xl: 3.5rem;
  --space-website-5xl: 4.5rem;
  --space-website-6xl: 5.5rem;
  --text-website-small: .875rem;
  --text-website-body: 1rem;
  --text-website-title: 1.25rem;
  --text-website-section: clamp(2rem, 3.4vw, 2.8rem);
  --text-website-display: clamp(2.75rem, 5.3vw, 4.8rem);
  --rule-website-fine: 1px;
  --rule-website-focus: 2px;
  --radius-website-button: 12px;
  --radius-website-surface: 16px;
  --ease-website-out: cubic-bezier(.16, 1, .3, 1);
  --ease-website-in: cubic-bezier(.7, 0, .84, 0);
  --ease-website-in-out: cubic-bezier(.65, 0, .35, 1);
  --dur-website-instant: 0s;
}
```

### Tailwind v4

Keep the project's Tailwind import and existing brand theme. For future website
utilities, merge the namespaced declarations below into its `@theme` block.

```css
@theme {
  --color-brand-100: #d6e4e5;
  --color-brand-600: #396673;
  --color-brand-700: #295361;
  --color-brand-900: #183e4b;
  --color-canvas: #f8f5ee;
  --color-website-muted: #586467;
  --color-website-border: #dcded5;
  --color-website-control-border: #687e83;
  --color-website-surface: #fffdf8;
  --color-website-on-action: #ffffff;
  --color-website-preview-border: #d0d8d1;
  --color-website-preview-rule: #e8e8df;
  --color-website-offline: #eaf0ea;
  --color-website-offline-border: #dce4dc;
  --color-website-map-ground: #e7ede4;
  --color-website-map-blocks: #d4dfcf;
  --color-website-map-streets: #faf8f1;
  --color-website-map-park: #c7d9bb;
  --color-website-map-label: #52644f;
  --font-website-display: Georgia, 'Times New Roman', serif;
  --font-website-body: system-ui, sans-serif;
  --spacing-website-2xs: .25rem;
  --spacing-website-xs: .5rem;
  --spacing-website-sm: .75rem;
  --spacing-website-md: 1rem;
  --spacing-website-gutter: 1.25rem;
  --spacing-website-lg: 1.5rem;
  --spacing-website-xl: 2rem;
  --spacing-website-2xl: 2.5rem;
  --spacing-website-3xl: 3rem;
  --spacing-website-4xl: 3.5rem;
  --spacing-website-5xl: 4.5rem;
  --spacing-website-6xl: 5.5rem;
  --text-website-small: .875rem;
  --text-website-body: 1rem;
  --text-website-title: 1.25rem;
  --text-website-section: clamp(2rem, 3.4vw, 2.8rem);
  --text-website-display: clamp(2.75rem, 5.3vw, 4.8rem);
  --radius-website-button: 12px;
  --radius-website-surface: 16px;
  --ease-website-out: cubic-bezier(.16, 1, .3, 1);
  --ease-website-in: cubic-bezier(.7, 0, .84, 0);
  --ease-website-in-out: cubic-bezier(.65, 0, .35, 1);
}
```

### DTCG tokens.json

Display dimensions use their fixed maxima; responsive clamps remain in CSS.

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "brand-100": {
      "$type": "color",
      "$value": "#d6e4e5"
    },
    "brand-600": {
      "$type": "color",
      "$value": "#396673"
    },
    "brand-700": {
      "$type": "color",
      "$value": "#295361"
    },
    "brand-900": {
      "$type": "color",
      "$value": "#183e4b"
    },
    "canvas": {
      "$type": "color",
      "$value": "#f8f5ee"
    },
    "website-muted": {
      "$type": "color",
      "$value": "#586467"
    },
    "website-border": {
      "$type": "color",
      "$value": "#dcded5"
    },
    "website-control-border": {
      "$type": "color",
      "$value": "#687e83"
    },
    "website-surface": {
      "$type": "color",
      "$value": "#fffdf8"
    },
    "website-on-action": {
      "$type": "color",
      "$value": "#ffffff"
    },
    "website-preview-border": {
      "$type": "color",
      "$value": "#d0d8d1"
    },
    "website-preview-rule": {
      "$type": "color",
      "$value": "#e8e8df"
    },
    "website-offline": {
      "$type": "color",
      "$value": "#eaf0ea"
    },
    "website-offline-border": {
      "$type": "color",
      "$value": "#dce4dc"
    },
    "website-map-ground": {
      "$type": "color",
      "$value": "#e7ede4"
    },
    "website-map-blocks": {
      "$type": "color",
      "$value": "#d4dfcf"
    },
    "website-map-streets": {
      "$type": "color",
      "$value": "#faf8f1"
    },
    "website-map-park": {
      "$type": "color",
      "$value": "#c7d9bb"
    },
    "website-map-label": {
      "$type": "color",
      "$value": "#52644f"
    }
  },
  "font": {
    "website-display": {
      "$type": "fontFamily",
      "$value": "Georgia, 'Times New Roman', serif"
    },
    "website-body": {
      "$type": "fontFamily",
      "$value": "system-ui, sans-serif"
    }
  },
  "space": {
    "website-2xs": {
      "$type": "dimension",
      "$value": ".25rem"
    },
    "website-xs": {
      "$type": "dimension",
      "$value": ".5rem"
    },
    "website-sm": {
      "$type": "dimension",
      "$value": ".75rem"
    },
    "website-md": {
      "$type": "dimension",
      "$value": "1rem"
    },
    "website-gutter": {
      "$type": "dimension",
      "$value": "1.25rem"
    },
    "website-lg": {
      "$type": "dimension",
      "$value": "1.5rem"
    },
    "website-xl": {
      "$type": "dimension",
      "$value": "2rem"
    },
    "website-2xl": {
      "$type": "dimension",
      "$value": "2.5rem"
    },
    "website-3xl": {
      "$type": "dimension",
      "$value": "3rem"
    },
    "website-4xl": {
      "$type": "dimension",
      "$value": "3.5rem"
    },
    "website-5xl": {
      "$type": "dimension",
      "$value": "4.5rem"
    },
    "website-6xl": {
      "$type": "dimension",
      "$value": "5.5rem"
    }
  },
  "text": {
    "website-small": {
      "$type": "dimension",
      "$value": ".875rem"
    },
    "website-body": {
      "$type": "dimension",
      "$value": "1rem"
    },
    "website-title": {
      "$type": "dimension",
      "$value": "1.25rem"
    },
    "website-section": {
      "$type": "dimension",
      "$value": "2.8rem"
    },
    "website-display": {
      "$type": "dimension",
      "$value": "4.8rem"
    }
  },
  "rule": {
    "website-fine": {
      "$type": "dimension",
      "$value": "1px"
    },
    "website-focus": {
      "$type": "dimension",
      "$value": "2px"
    }
  },
  "radius": {
    "website-button": {
      "$type": "dimension",
      "$value": "12px"
    },
    "website-surface": {
      "$type": "dimension",
      "$value": "16px"
    }
  },
  "ease": {
    "website-out": {
      "$type": "cubicBezier",
      "$value": [
        0.16,
        1.0,
        0.3,
        1.0
      ]
    },
    "website-in": {
      "$type": "cubicBezier",
      "$value": [
        0.7,
        0.0,
        0.84,
        0.0
      ]
    },
    "website-in-out": {
      "$type": "cubicBezier",
      "$value": [
        0.65,
        0.0,
        0.35,
        1.0
      ]
    }
  },
  "dur": {
    "website-instant": {
      "$type": "duration",
      "$value": "0s"
    }
  }
}
```

### shadcn/ui role mapping

For a consumer composing colors with `oklch(var(--background))`; these triples
are conversions of the exact sRGB source values, rounded to six decimal places.

```css
:root {
  --background: 97.053263% 0.009815 87.470755;
  --foreground: 34.255264% 0.048346 223.465349;
  --card: 99.419801% 0.006926 88.641145;
  --card-foreground: 34.255264% 0.048346 223.465349;
  --popover: 99.419801% 0.006926 88.641145;
  --popover-foreground: 34.255264% 0.048346 223.465349;
  --primary: 41.803024% 0.052220 222.052520;
  --primary-foreground: 99.999999% 0.000000 89.875563;
  --secondary: 90.863879% 0.015051 202.042086;
  --secondary-foreground: 34.255264% 0.048346 223.465349;
  --muted: 94.892039% 0.010191 145.494579;
  --muted-foreground: 49.404488% 0.015527 214.448423;
  --accent: 90.863879% 0.015051 202.042086;
  --accent-foreground: 34.255264% 0.048346 223.465349;
  --border: 89.653795% 0.012290 116.828482;
  --input: 57.731472% 0.026727 213.016315;
  --ring: 41.803024% 0.052220 222.052520;
  --radius: 16px;
}
```

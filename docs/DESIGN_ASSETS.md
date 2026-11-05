# October 2026 redesign assets

- Design reference: [Fullstack Empire / GSAP Awwwards Website](https://github.com/Fullstack-Empire/GSAP-Awwwards-Website), inspected at `8a76a362ffa296de70f5988b4204ffd0c88a977e`.
  Composition and animation techniques were adapted; its imagery and source code were not copied.
- `public/images/lakeside-escape.jpg`: [source photograph from Unsplash](https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1800&q=85), served locally.
  Usage is governed by the [Unsplash license](https://unsplash.com/license). The image illustrates the travel category and does not imply an offered itinerary or booking.
- `public/fonts/Antonio-Variable.ttf`: [Antonio from Google Fonts](https://github.com/google/fonts/tree/main/ofl/antonio), bundled under the SIL Open Font License. The license is included at `public/fonts/Antonio-OFL.txt`.
- Existing Stowaway logo and illustration masters remain in `public/brand`.

There are no runtime image or font requests to these external asset sources.

## October 29 system update

The current website uses Georgia and system sans-serif without font requests.
Antonio and its license remain in the asset archive, but are no longer used or
preloaded. The lake photo and suitcase artwork are retained. The social preview
is regenerated from the existing logo masters with the current headline, palette,
and typography. No new external imagery, fonts, or dependencies were added.

## November 4, 2026 website redesign (Luggage Tag)

The public website now self-hosts two open-licensed families, subset to Latin and served as WOFF2
from `public/fonts/` (no runtime font requests):

- Barlow and Barlow Condensed ([Google Fonts](https://github.com/google/fonts/tree/main/ofl/barlow)),
  SIL Open Font License, license at `public/fonts/Barlow-OFL.txt`. Text, labels and controls.
- Antonio (already archived here), now subset to `Antonio-Variable.woff2`, for route codes and
  display numerals. License at `public/fonts/Antonio-OFL.txt`.

No new images were added. The homepage's places and routes come from `seed/guatemala-2027/`
(OpenStreetMap data); traveler names, votes, times, tickets and amounts are labelled examples.

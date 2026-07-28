# Design QA — BALI Tropical Temple Reskin

## Evidence

- Source visual truth: `C:\Users\kolya\Desktop\2db39681-f615-46e3-936c-061e8f519aa8 (1).png`
- Source dimensions: 1122 × 1402 px
- Browser-rendered implementation: `site/qa/user-home-mobile.png`
- Implementation screenshot dimensions: 393 × 852 px
- CSS viewport: 394 × 852 px
- Density normalization: source board and implementation were proportionally resampled to a shared 1000 px comparison height. The focused source phone crop (205 × 490 px before normalization) and implementation were resampled to 980 px height.
- Full-view comparison: `site/qa/design-comparison-full.webp`
- Focused comparison: `site/qa/design-comparison-focused.webp`
- Additional implementation evidence:
  - `site/qa/user-match3-mobile.png`
  - `site/qa/admin-dashboard.png` (browser viewport reported 1280 × 720)
  - `site/qa/admin-settings-mobile.png`
  - `site/qa/admin-reviews-mobile.png`
- State: user home with active-event status; Match-3 game; admin dashboard, settings, and reviews.

The source is a multi-screen art-direction board rather than a pixel-identical specification for the existing application. Comparison therefore evaluates palette, material language, image treatment, hierarchy, component styling, icon language, density, and mobile behavior while preserving the current routes and content.

## Required Fidelity Surfaces

- Fonts and typography: existing project font families, weights, sizes, line heights, letter spacing, hierarchy, wrapping, and capitalization were preserved. No typography tokens were changed. Headings and compact UI copy remain readable at the tested mobile viewport.
- Spacing and layout rhythm: existing page geometry and screen hierarchy were retained. The reskin uses the reference’s compact dark-card rhythm, thin warm borders, restrained radii, and stronger separation between primary surfaces. No horizontal overflow was found at 394 × 852.
- Colors and tokens: black/graphite and deep jungle green dominate; bronze and muted gold provide hierarchy; lava orange is limited to selected/today states. Acid-lime and pink/purple theme accents were removed from the new theme layer. Semantic states remain distinct.
- Image quality and asset fidelity: three purpose-made WebP assets reproduce the stone face, bronze temple guardians, and gold collectible bear. Assets are correctly cropped for their target slots and total 229 KB. Six navigation icons come from the Lucide library and are stored as local SVG assets.
- Copy and content: existing application copy, data, routes, menu, events, users, rewards, Match-3 configuration, and admin content were preserved.

## Full-view Comparison

The final application reproduces the reference’s dominant dark volcanic stone, jungle foliage, warm bronze/gold, and restrained ember palette. The hero uses the same recognizable cracked stone-face motif and keeps a dark copy-safe region. Cards, navigation, VIP surfaces, status blocks, and admin panels follow the reference’s thin bronze-border and low-key lighting language without introducing bright white surfaces or neon theme accents.

## Focused Comparison

The focused phone comparison confirms:

- recognizable cracked-stone BALI hero imagery;
- warm gold hierarchy on dark stone;
- compact outlined controls;
- a six-item bottom navigation with a unified icon set;
- consistent black/green/bronze surface treatment;
- legible white and secondary copy;
- no stretched or low-resolution generated imagery.

The implementation intentionally keeps the existing app’s real active-event block and current six-route navigation rather than adding the reference board’s absent shop/VIP routes.

## Comparison History

### Iteration 1

Evidence: `site/qa/user-home-iteration-1.png`

- [P1] Header brand button inherited browser-default grey button chrome.
  - Impact: immediately broke the premium reference style and made the header look unfinished.
  - Fix: explicitly reset the existing brand button to transparent background, no border, and zero padding while retaining the original logo/text.
- [P2] Active-event card and badge retained the previous acid-lime surface.
  - Impact: conflicted with the specified restrained bronze/green/lava palette.
  - Fix: added higher-specificity theme rules for the dynamically injected check-in card, badge, semantic dot, active-until block, and leave action.

### Iteration 2

Evidence: `site/qa/user-home-mobile.png`, `site/qa/design-comparison-full.webp`, and `site/qa/design-comparison-focused.webp`

- Header chrome is removed.
- Active-event styling uses bronze, deep green, and muted red.
- No remaining actionable P0/P1/P2 visual differences were found.

## Functional and Browser QA

- User routes tested: home, events, menu, BALI PEOPLE, Match-3 game, profile.
- Exactly one visible user page and one active navigation item were confirmed after each route change.
- Match-3 rendered 49 cells and retained all eight default items and TOP-10 rewards.
- Admin routes tested: dashboard, events, Match-3, bookings, customers, bonuses, menu, hall, reviews, settings.
- All ten admin routes rendered without route-error panels after fixing the existing missing reviews-router registration.
- Navigation icon editor rendered six configurable icon cards with custom upload, URL, per-icon reset, and full reset behavior.
- Hall-plan SVG, hall layout data, user layout-map logic/CSS, and admin hall patch are byte-for-byte unchanged.
- Browser console errors/warnings: none in the final user and admin passes.
- Horizontal overflow: 0 px in tested mobile user and admin states.

## Accessibility and Performance

- Focus-visible outlines are provided for buttons, links, inputs, selects, and textareas.
- `prefers-reduced-motion` and `prefers-contrast: more` are supported.
- Contrast ratios on the primary surface:
  - primary text: 15.98:1;
  - secondary text: 7.68:1;
  - gold accent: 9.02:1;
  - success text: 9.22:1;
  - error text: 9.12:1.
- New theme payload:
  - CSS: 27,751 bytes;
  - visual assets: 232,207 bytes.
- Local HTTP smoke test:
  - page: 200;
  - theme stylesheet: 200, 17,806 bytes;
  - hero asset: 200, 115,508 bytes.

## Findings

No actionable P0/P1/P2 visual findings remain.

## Open Questions

- No shift-management feature exists in the current repository, so there was no shift UI to reskin or regression-test.
- The reference contains a shop/VIP screen that is not a route in the existing application. No new route was added because this task explicitly preserves the current feature set.

## Implementation Checklist

- [x] User theme applied.
- [x] Admin theme applied.
- [x] Brand assets optimized.
- [x] Six default navigation icons installed.
- [x] Icon editor and reset behavior verified.
- [x] Match-3, rewards, rankings, and hall states verified.
- [x] Mobile/desktop screenshots reviewed.
- [x] Browser console checked.
- [x] Final visual comparison passed.

## Follow-up Polish

- P3: a future art-only pass could replace demo event poster placeholders with the same photographic tropical-temple art direction. This is optional and was not required to pass the current build.

final result: passed

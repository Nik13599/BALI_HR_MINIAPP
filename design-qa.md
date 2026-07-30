# Design QA — BALI home hero

- Source visual truth: `C:\Users\kolya\Desktop\photo_2026-07-30_04-23-22.jpg`
- Browser-rendered implementation: `C:\Users\kolya\.codex\visualizations\2026\07\28\019fa8c9-118b-7d22-9509-9e91a0e5faf7\bali-hero-qa-stable27\design-qa-implementation-full-v3.png`
- Implementation hero crop: `C:\Users\kolya\.codex\visualizations\2026\07\28\019fa8c9-118b-7d22-9509-9e91a0e5faf7\bali-hero-qa-stable27\design-qa-implementation-hero-v3.png`
- Side-by-side comparison: `C:\Users\kolya\.codex\visualizations\2026\07\28\019fa8c9-118b-7d22-9509-9e91a0e5faf7\bali-hero-qa-stable27\design-qa-comparison-v3.png`
- Browser viewport: 1280 × 720 CSS px
- Source pixels: 942 × 265
- Implementation hero pixels: 943 × 265
- Density normalization: 1 CSS px = 1 screenshot px; no resampling was used
- State: stable27 home screen, dark theme, default BALI hero content

## Full-view comparison evidence

The complete source component and the complete implementation component were compared together at 1:1 scale. The final implementation matches the reference's 265 px height, centered wide composition, stone-face crop, left text column, two-line paragraph, three metadata pills, border radius, and dark gold palette.

## Focused-region comparison evidence

A separate focused crop was not needed because the source is already a single 942 × 265 component and all typography, pills, border treatment, and image detail remain readable in the 1:1 side-by-side comparison.

## Required fidelity surfaces

- Fonts and typography: Unbounded and Manrope preserve the existing BALI display/body pairing. Final title size, eyebrow tracking, paragraph wrapping, weight, line height, and antialiasing match the source closely.
- Spacing and layout rhythm: title, paragraph, and pill rows align to the same vertical positions as the reference. Desktop width is 943 px and height is 265 px; the mobile breakpoint uses the full safe viewport width without horizontal overflow.
- Colors and visual tokens: near-black background, warm white copy, muted gold eyebrow/border, and translucent pill surfaces match the source palette.
- Image quality and asset fidelity: the existing original `hero-stone-face.webp` brand asset is used directly with cover cropping; no placeholder, CSS drawing, or recreated illustration is present.
- Copy and content: eyebrow, BALI title, community description, address, schedule, and metro-distance labels match the supplied reference.

## Comparison history

1. Initial state: the existing banner was approximately 760 × 310, too narrow and too tall. This was a P2 proportion mismatch. It was changed to a centered 943 × 265 desktop frame with a responsive mobile width.
2. First implementation pass: the content started about 17 px too low and the metadata pills were too compact. This was a P2 vertical-rhythm mismatch. Type size, gaps, and pill padding were adjusted.
3. Second implementation pass: the eyebrow tracking and upper copy were still 4–6 px away from the source. This was a P2 typography/alignment mismatch. Tracking, title size, and the final pill-row gap were corrected.
4. Final pass: the source and implementation share the same key vertical anchors and image crop. No actionable P0, P1, or P2 issues remain.

## Findings

- No actionable P0, P1, or P2 differences remain.
- P3: tiny pill-width and rasterization differences may vary by operating-system font rendering and are acceptable.

## Primary interactions and runtime checks

- Home screen loads with the expected title, paragraph, and all three metadata pills.
- The existing page navigation and the next home section remain visible and usable.
- The responsive CSS keeps the hero within the mobile viewport and allows its content height to grow when labels wrap.

final result: passed

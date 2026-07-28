# BALI Tropical Temple — Customization Report

## Outcome

The existing BALI Nightclub user application and admin panel have been reskinned to the supplied tropical-temple reference while retaining the existing data model, routes, roles, booking flow, profile, rewards, rating, Match-3 game, and hall geometry.

## Visual System

The implementation adds the requested semantic tokens:

- backgrounds: `background-primary`, `background-secondary`;
- surfaces: `surface`, `surface-elevated`, `surface-hover`, `surface-active`;
- borders and text: `border`, `border-active`, `text-primary`, `text-secondary`;
- brand accents: `accent-green`, `accent-gold`, `accent-bronze`, `accent-lava`;
- semantic states: `success`, `warning`, `error`, `available`, `occupied`, `reserved`, `selected`, `vip`, `disabled`;
- elevation and layout: `shadow-sm`, `shadow-md`, `shadow-lg`, `radius-sm`, `radius-md`, `radius-lg`, `spacing-xs`, `spacing-sm`, `spacing-md`, `spacing-lg`.

The palette follows the brief:

- dominant black/graphite and deep jungle green;
- aged bronze and warm muted gold for hierarchy;
- restrained lava-orange for today/selected states;
- no white page backgrounds and no pink/purple theme accents.

Typography was not changed.

## New Files

- `site/bali-temple-theme-beta4.css`
- `site/admin-bali-temple-theme-beta4.css`
- `site/assets/bali-temple/hero-stone-face.webp`
- `site/assets/bali-temple/bronze-statues.webp`
- `site/assets/bali-temple/gold-bear.webp`
- `site/assets/bali-temple/nav-home.svg`
- `site/assets/bali-temple/nav-events.svg`
- `site/assets/bali-temple/nav-menu.svg`
- `site/assets/bali-temple/nav-people.svg`
- `site/assets/bali-temple/nav-game.svg`
- `site/assets/bali-temple/nav-profile.svg`
- `site/assets/bali-temple/LUCIDE-LICENSE.txt`
- `design-qa-bali-temple.md`
- `bali-temple-customization-report.md`

## Updated Wiring

- `site/beta4-square-loader.js`: loads the user theme last; cache version raised to `bali-full-demo-8-stable16`.
- `site/admin-beta4.html`: loads the admin theme last; updated cache references.
- `site/nav-icons-core-beta4.js`: only the six visual defaults now point to the new local icon set. Custom upload, URL, save, per-icon reset, and full reset behavior are unchanged.
- `site/admin-mobile-runtime.js`: cache version updated; the already-existing reviews module is registered with the mobile router so its navigation button no longer falls back to dashboard.
- `index.html`, `404.html`, `site/index.html`, `site/admin.html`, `site/browser-demo.html`, `site/browser-admin.html`: cache-busting references updated.
- `.github/workflows/deploy-pages.yml`: validates the new themes/assets, the reviews route, and the new icon defaults/reset behavior.

## Generated and Licensed Assets

Generated WebP assets:

- `hero-stone-face.webp`: 115,508 bytes;
- `bronze-statues.webp`: 64,654 bytes;
- `gold-bear.webp`: 49,122 bytes.

Navigation icons are local Lucide SVGs with the included ISC license. No emoji or CSS-drawn navigation icons are used as the default set.

## Preserved Functional Files

No changes were made to:

- `site/store.js`;
- `site/beta4-app.js`;
- `site/admin.js`;
- booking manager/edit business logic;
- Match-3 core or UI logic;
- points, rewards, VIP, ranking, and user data logic;
- SQL schema;
- event, menu, customer, or booking records.

Hall geometry is unchanged:

- `site/hall-plan.svg`: `C5D20A9185ABA82845FF5E3410E1E7E1A161E4BB2AF06A667F4C9DABF37EEA69`
- `site/hall-layout-data.js`: `76231BEFEF27483597CEB9F56691D6C05DF8F2E1240C2A78B60D1F4D71C890E9`
- `site/beta4-layout-map.js`: `133B1C27709C0785A945A97422CE0017694A2FEED32031A301AABA2CD48C9134`
- `site/beta4-layout-map.css`: `86EADE69C519633FC82818C77BD6FFCB7CB72F15ACF33E32465BE22056C41D62`
- `site/admin-hall-patch.js`: `677513613EBEBE5620996E15F376355D4C36AD2121FD87C34593D257B1B0B89E`

## QA Summary

- JavaScript syntax: 178 files passed.
- Git diff check: passed.
- Cache-version and required-theme-file validation: passed.
- User navigation: all 6 routes passed.
- Admin navigation: all 10 routes passed.
- Navigation icons: defaults, custom save, per-icon reset, and full reset passed.
- Duplicate cleanup: event and people newest-record selection passed.
- Match-3: 8 default items, 49-cell board, TOP-10 rewards, unique ranking, and score submission passed.
- Final user/admin browser console: no errors or warnings.
- Mobile horizontal overflow: 0 px.
- Theme payload: 259,958 bytes total CSS + visual assets.
- Detailed evidence and comparison history: `design-qa-bali-temple.md`.

## Scope Notes

- The repository contains no shift-management implementation or UI, so there was no shift code to change.
- The supplied reference includes shop/VIP concepts that do not exist as current routes. No new route or feature was introduced.

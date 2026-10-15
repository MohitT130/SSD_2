# Style Guide

**Owner:** Nisarg Bhojani. The design system is plain CSS built on design tokens:

- **`web/src/theme.css`** holds every token as a CSS custom property, and is the single source of truth.
- **`web/src/theme.js`** mirrors the colour values for Recharts and Leaflet, which cannot read CSS variables.
- **`web/src/styles.css`** (shell, shared components, Analytics/Map/Reviews) and **`web/src/screens.css`** (Browse, Place order, Wallet) use only the tokens.

Mantine was planned at first and dropped: plain CSS kept the bundle small and needed no component rewrite. The UI upgrade spec is [2026-10-15-ui-upgrade-design.md](2026-10-15-ui-upgrade-design.md).

## Colours

The palette follows Mantine's colour scale. Three values were adjusted so text passes WCAG AA (4.5:1).

| Token | Hex | Used for |
|---|---|---|
| `--brand` | `#E8590C` | Accent fills: active nav marker, chart series, map origin and radius, focus ring |
| `--brand-strong` | `#C2410C` | Primary buttons and orange text (5.2:1 on white; `#E8590C` is only 3.6:1) |
| `--brand-soft` | `#FFF4E6` | Active nav item, selected table row, avatar |
| `--success` / `-strong` / `-soft` | `#2F9E44` / `#1F7A35` / `#EBFBEE` | CREDIT, DELIVERED, successful checkout, dietary tags |
| `--danger` / `-strong` / `-soft` | `#E03131` / `#C92A2A` / `#FFF5F5` | DEBIT, errors, insufficient balance, spice level |
| `--warning` / `-strong` / `-soft` | `#F08C00` / `#A35200` / `#FFF9DB` | PREPARING, "already has an active order", star ratings |
| `--info` / `-strong` / `-soft` | `#1971C2` / `#1864AB` / `#E7F5FF` | DELIVERING, drivers on the map |
| `--text` | `#212529` | Body text |
| `--text-muted` | `#6C757D` | Secondary text (4.7:1; the first draft's `#868E96` is 3.3:1 and failed) |
| `--text-faint` | `#868E96` | Icons and decoration only, never text |
| `--surface` / `--page` | `#FFFFFF` / `#F8F9FA` | Cards / page background |
| `--border` | `#E9ECEF` | Card, table and input borders |

**Status pairs:** each status uses its `-strong` colour for text on its `-soft` background, so every badge passes 4.5:1.

- PREPARING = warning
- DELIVERING = info
- DELIVERED = success
- DEBIT = danger
- CREDIT = success

## Typography

- **Font:** Inter (Google Fonts, free), fallback `system-ui, sans-serif`.
- **Scale:**
  - page title 24/600
  - section title 18/600
  - card title 16/600
  - body 14/400
  - table 13/400
  - caption 12/500
  - nothing smaller than 12 px
- **Stat values:** 28/700 (22 on phones).
- **Money:** `tabular-nums`, right-aligned in tables, formatted `₹1,234.50` (Indian digit grouping via `en-IN`).

## Spacing and shape

- **Spacing:** 8 px grid (`--space-1` to `--space-4` = 8/16/24/32).
- **Radius:** `--radius` 8 px (inputs, buttons, badges) and `--radius-lg` 12 px (cards).
- **Borders and shadows:** 1 px `--border`, almost no shadow. Only menus and drawers float, with `--shadow-pop`.
- **Content width:** max 1440 px. Form controls are 40 px tall. Every focusable element shows an orange focus ring.

## Identity

- **Logo:** a solid orange square holding a utensils icon, plus the "BiteStream" wordmark in Inter 600 with the tagline "Food delivery console".
- **Charts:** orange bars and lines on light grey gridlines.
- **Map:** an orange origin pin with an orange dashed 5 km circle; drivers are blue dots.
- **Stat cards:** a small monochrome icon instead of coloured tiles.

## Responsive

| Width | Layout |
|---|---|
| ≥ 1200 px | Sidebar (248 px) + content; 4 stat cards per row; split layouts side by side |
| 1024–1199 px | 2 stat cards per row; chart and table stack |
| 768–1023 px | Sidebar becomes a 76 px icon rail; the map list moves below the map |
| < 768 px | Sidebar hidden. A top bar has a burger button that opens the navigation as a drawer (Esc or a backdrop click closes it). Cards stack, tables scroll sideways, segmented tabs fill the width. No horizontal page scroll at 390 px. |

## Reusable components

| Component | File | Purpose |
|---|---|---|
| App shell, `Sidebar` | `App.jsx`, `components/Sidebar.jsx` | Navigation, brand, API status, phone drawer |
| `ActorPicker` | `components/ActorPicker.jsx` | "Acting as" customer with wallet balance and active-order flag |
| `RestaurantPicker` | `components/RestaurantPicker.jsx` | Searchable restaurant select used on Place order, Analytics, Map and Reviews |
| `Panel`, `StatCard` | `components/Panel.jsx`, `components/StatCard.jsx` | Card with heading; big number + label |
| `StatusBadge`, `ActionBadge` | `components/ui.jsx` | Order status and DEBIT/CREDIT pills |
| `Pagination`, `SkeletonRows`, `Drawer`, `DetailList` | `components/ui.jsx` | Server-side paging, loading rows, record detail |
| `EmptyState`, `ErrorBanner` | `components/ui.jsx` | Never a blank page; friendly error with Retry |
| Segmented control | `.tabs` / `.tab` | Browse entity tabs, Reviews scope |
| Menu accordion | `.menu-accordion` (Reviews) | Category → items → add-ons; optional fields only when present |

# Style Guide

Built on **Mantine** components with a custom theme so every screen looks the same.

## Colours

| Token | Hex | Used for |
|---|---|---|
| `primary` | `#E8590C` (orange 8) | Primary buttons, active nav item, chart main series |
| `primary-light` | `#FFF4E6` | Selected rows, highlighted cards |
| `success` | `#2F9E44` | Successful checkout, CREDIT, DELIVERED badge |
| `danger` | `#E03131` | Errors, DEBIT, insufficient balance |
| `warning` | `#F08C00` | PREPARING badge, "already has active order" |
| `info` | `#1971C2` | DELIVERING badge, map origin marker |
| `text` | `#212529` | Body text |
| `muted` | `#868E96` | Secondary text, table captions |
| `surface` | `#FFFFFF` / `#F8F9FA` | Cards / page background |

Order status badges: PREPARING = warning, DELIVERING = info, DELIVERED = success.

## Typography

- Font: **Inter** (Google Fonts, free), fallback `system-ui, sans-serif`.
- Sizes: page title 24/600, section title 18/600, body 14/400, caption 12/400.
- Money is always right-aligned, tabular figures, formatted `₹1,234.50`.

## Spacing and shape

- 8 px spacing grid (8 / 16 / 24 / 32).
- Card radius 8 px, light border `#E9ECEF`, no heavy shadows.
- Max content width 1200 px; on phones (< 768 px) the sidebar collapses into a burger menu and tables scroll horizontally.

## Reusable components

| Component | Purpose |
|---|---|
| `AppShell` (header + sidebar) | Navigation, role switch, actor picker, API health dot |
| `ActorPicker` | Searchable select of users; shows wallet balance and an "active order" badge |
| `DataTable` | Server-side paginated table with search box, column filters, row click → detail drawer |
| `DetailDrawer` | Right-side panel showing one record |
| `StatCard` | Big number + label (+ optional delta) |
| `StatusBadge` | Coloured order status |
| `MoneyText` | Formatted currency, green/red for credit/debit |
| `LoadingState` | Skeleton rows/cards (never a blank page) |
| `EmptyState` | Icon + message + optional action ("No orders match these filters") |
| `ErrorState` | Message + "Try again" button; friendly text from API `error.message` |
| `ChartCard` | Card wrapper with title, subtitle and loading/empty/error handling for charts |

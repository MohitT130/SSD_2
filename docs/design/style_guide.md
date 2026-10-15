# Style Guide: "Kitchen Ticket"

**Owner:** Nisarg Bhojani · Spec: [2026-10-15-kitchen-ticket-design.md](2026-10-15-kitchen-ticket-design.md)

## Concept

**Every screen is a piece of restaurant paper.**

| Screen | Paper it becomes |
|---|---|
| An order | A kitchen order ticket (KOT): notched, perforated, stamped PAID or VOID |
| Wallet history | A bank passbook: ruled ledger, printed amounts, a red margin rule |
| Analytics | The day's board: big printed figures and medals |
| Driver map | Dispatch slips |
| Menu | A printed menu card with dotted leaders |

Every visual choice follows from the metaphor:
- serif figures, because bills are printed
- mono codes, because tickets come from a thermal printer
- stamps, because the kitchen stamps orders
- perforations, because tickets tear off

## Files

| File | Role |
|---|---|
| `web/src/theme.css` | Design tokens: the single source of truth |
| `web/src/theme.js` | The same colours for Recharts and Leaflet (which can't read CSS variables) |
| `web/src/styles.css`, `web/src/screens.css` | Layout and components |
| `web/src/kitchen.css` | The concept layer: type roles, paper, motifs, motion, one signature moment per screen |
| `web/scripts/check-contrast.mjs` | `npm run check:contrast`: fails if any text/background token pair is below 4.5:1 |

## Colour

| Token | Hex | Role |
|---|---|---|
| `--page` | `#F6EFE3` | Warm paper (page), with a 2 % grain |
| `--surface` | `#FFFDF8` | Ticket stock (cards) |
| `--hover` / `--border` / `--border-strong` | `#F1E8D9` / `#E4D7C3` / `#D3C2A8` | Tracks, rules, perforations |
| `--text` | `#221C17` | Ink (14.7:1 on paper) |
| `--text-muted` | `#6B5E52` | Secondary text (5.5:1 on paper) |
| `--brand` / `--brand-strong` / `--brand-soft` | `#E8590C` / `#C2410C` / `#FDEFE3` | Saffron: accent, buttons and orange text, selected states |
| `--success*` | `#2E7D32` / `#25672A` / `#E7F2E3` | Curry leaf: CREDIT, DELIVERED, PAID |
| `--danger*` | `#B23A12` / `#9A3110` / `#FBE9E2` | Chili: DEBIT, errors, VOID |
| `--warning*` | `#B7791F` / `#8A5A12` / `#FBF0D9` | Turmeric: PREPARING, star ratings |
| `--info*` | `#2B4C7E` / `#22406B` / `#E5ECF5` | Indigo ink: DELIVERING, drivers |
| `--gold` / `--silver` / `--bronze` | `#E6C25A` / `#CBD2D9` / `#D9A273` | Medal ranks 1–3 |

Every `-strong` colour is used for text on its `-soft` fill. All pairs pass WCAG AA (checked by the script).

## Type: three voices, each with a job

| Voice | Font | Used for |
|---|---|---|
| Printed | **Fraunces** (variable serif, optical sizes) | Page titles, every big number and money on tickets, rating score, menu dishes |
| Ticket printer | **JetBrains Mono** | Eyebrows, table headers, order codes, times, stamps, captions, date stamp |
| Interface | **Inter** | Labels, body text, buttons, inputs |

**Scale:**
- page title 30 / 600 serif
- board figures 40 (phone: up to 28)
- stat figures 32
- section 18–19
- body 14, table 13
- caption 12
- nothing below 12 px

## Motifs

- **Perforation:** dashed rules under card headings, inside stat cards and between ticket sections.
- **Ticket notches:** half-circle cut-outs on both edges (CSS mask). Used on the order result, the dispatch slips and the brand mark.
- **Rubber stamp:** mono caps in an outlined box. Order statuses and DEBIT/CREDIT in tables; large rotated PAID / VOID on the order result.
- **Passbook rule:** a red double margin line before the amount columns in Wallet history.
- **Dotted leaders:** run from each dish to its price on the menu card.
- **Tear-off pad:** the sidebar and top bar edges are perforated.

## Motion

| Moment | Behaviour |
|---|---|
| Page enter | Sections rise 10 px and fade, staggered 40 ms |
| Stat figures | Count up (`CountUp`, ease-out, 0.7 s); later changes count from the previous value |
| Order result | The ticket prints out of a slot; the stamp lands 0.45 s later with a slight overshoot |
| Map origin | Saffron pulse, 2 s loop |
| Rows and slips | 1–2 px lift on hover |

Under `prefers-reduced-motion: reduce` every animation lands on its final frame, and count-ups show the final value immediately.

## Responsive

| Width | Layout |
|---|---|
| ≥ 1200 px | Sidebar plus content; 4 stat cards per row; the Analytics chart stays beside the ranking (sticky) |
| 1024–1199 px | 2 stat cards per row; chart and table stack |
| 768–1023 px | Icon-rail sidebar; map list below the map |
| < 768 px | Burger drawer; board figures scale down; the top bar keeps one line for the title and one for the actor (active order shown as a dot); no horizontal scroll at 390 px |

## Components

| Component | Purpose |
|---|---|
| `StatCard` | A small receipt. Optional `countTo` and `format` count the figure up |
| `CountUp` | Animated number that respects reduced motion |
| `StatusBadge`, `ActionBadge` | Rendered as stamps |
| `Panel` | Ticket-stock card with a perforated heading |
| `RestaurantPicker`, `ActorPicker` | Searchable selects |
| `Pagination`, `SkeletonRows`, `Drawer`, `DetailList`, `EmptyState`, `ErrorBanner` | Shared states; never a blank page |

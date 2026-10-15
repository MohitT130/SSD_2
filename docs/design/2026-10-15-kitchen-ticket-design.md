# "Kitchen Ticket" Visual Redesign — Design Spec (15 Oct 2026)

**Owner:** Nisarg Bhojani (design) · **Branch:** `nisarg/ui-upgrade` (PR #1) · **Builds on:** [2026-10-15-ui-upgrade-design.md](2026-10-15-ui-upgrade-design.md)

## 1. Intent

**What Nisarg asked for:** take the UI from "basic and generic" to the level of an experienced designer, so that a viewer feels a lot of thought went into every screen. Nothing may break.

**Assumptions (unchallenged):**
- Submission is tonight, so layouts, data, API and behaviour stay as they are.
- The work doubles as a portfolio piece.
- Everything ships in PR #1.

**Success looks like:**
- One unmistakable concept carried through all six screens.
- One crafted "signature moment" per screen.
- WCAG AA text contrast.
- No regressions: 23 tests, build, phone layout, behaviour.

## 2. Concept

**Every screen is a piece of restaurant paper.**

| Screen | Paper it becomes |
|---|---|
| An order | A kitchen order ticket (KOT) |
| The wallet | A bank passbook |
| Analytics | The day's board |
| The menu | A printed menu card |

The metaphor gives every visual decision a reason:
- serif numbers, because bills are printed
- mono codes, because tickets come from a thermal printer
- rubber stamps for statuses, because the kitchen stamps them
- perforations, because tickets tear off

It also fits the database story: each ticket is a row the database wrote.

## 3. Visual language (replaces the token values in `theme.css`; names stay the same)

### Colour

| Token | Value | Role |
|---|---|---|
| `--page` | `#F6EFE3` | Warm paper (page) |
| `--surface` | `#FFFDF8` | Ticket stock (cards) |
| `--hover` | `#F1E8D9` | Hover / track |
| `--border` / `--border-strong` | `#E4D7C3` / `#D3C2A8` | Rules |
| `--text` | `#221C17` | Ink |
| `--text-muted` | `#6B5E52` | Secondary text (≥ 4.5:1 on page and card) |
| `--text-faint` | `#9A8B7A` | Icons and decoration only |
| `--brand` / `--brand-strong` / `--brand-soft` | `#E8590C` / `#C2410C` / `#FCE8D6` | Saffron |
| `--danger*` | `#B23A12` / `#9A3110` / `#FBE9E2` | Chili: debit, error, VOID |
| `--success*` | `#2E7D32` / `#25672A` / `#E7F2E3` | Curry leaf: credit, delivered |
| `--warning*` | `#B7791F` / `#8A5A12` / `#FBF0D9` | Turmeric: preparing, ratings |
| `--info*` | `#2B4C7E` / `#22406B` / `#E5ECF5` | Indigo ink: delivering, drivers |

**Contrast rule:** every `-strong` colour on its `-soft` background, and `--text-muted` on `--page` and `--surface`, must be ≥ 4.5:1. This is verified by a script.

### Type

| Font | Used for |
|---|---|
| **Fraunces** (variable serif, Google Fonts) | Page titles, stat values, money on tickets, rating score, menu dish names |
| **Inter** | UI text, labels, buttons |
| **JetBrains Mono** | Order IDs, timestamps, table headers, eyebrows, SQL identifiers, date stamp |

New tokens: `--serif`, `--mono` (exists), plus `--fs-display` (40 px) for the Analytics headline figures. Nothing below 12 px.

### Motifs (CSS only, each used where it means something)

- **Perforation:** `border-top: 1px dashed var(--border-strong)` between ticket sections.
- **Ticket notches:** half-circle cut-outs on the left and right edges of ticket cards (radial-gradient mask). Used on the Place order result and the driver slips.
- **Rubber stamp:**
  - small rotated outlined label in mono caps, at 70 % opacity of the status colour
  - order statuses in Browse (rotation 0 in dense tables, for legibility)
  - PAID / VOID on the Place order result (rotated −8°)
- **Dotted leaders:** between dish and price in the menu.
- **Paper grain:** a 2 % SVG noise texture on `body`, inline data URI, under 1 KB.
- **Brand mark:** a small saffron ticket with a notch, drawn in CSS, plus the wordmark "BiteStream" in Fraunces 600.

### Motion (all disabled under `prefers-reduced-motion: reduce`)

| Moment | Spec |
|---|---|
| Page enter | Cards rise 8 px and fade, staggered 40 ms, 280 ms ease-out |
| Stat values | Count up from 0 in 700 ms (`CountUp` component, `requestAnimationFrame`); formatted like the static value |
| Order success | The ticket prints: `clip-path` reveal top → bottom, 520 ms. Then the PAID stamp lands: scale 1.6 → 1, opacity 0 → 1, 220 ms, 400 ms delay |
| Order refused | The VOID stamp lands the same way |
| Map origin | Saffron pulse ring, 2 s loop |
| Row hover | 1 px lift and a soft shadow on clickable rows and slips |

## 4. Screens

| Screen | Signature moment | Files |
|---|---|---|
| Shell | Paper sidebar; Fraunces wordmark with the ticket mark; mono section captions; top bar date stamp `THU · 15 OCT` in mono | `App.jsx`, `Sidebar.jsx`, `styles.css` |
| Browse | Mono order codes; statuses as stamps; clickable rows lift | `screens.css` (CSS only) |
| Place order | The result panel is a KOT: notched edges, perforated sections, money in Fraunces, PAID / VOID stamp; prints in on arrival | `screens.css`; `PlaceOrder.jsx`: add `data-stamp` attributes only |
| Wallet history | Passbook: ruled ledger lines, mono dates, serif amounts, a faint margin rule left of the running-balance column | `screens.css`; `WalletHistory.jsx`: add `ledger` class to the table |
| Analytics | Stat values in Fraunces 34 px with count-up; chart in saffron ink; ranks 1–3 as gold, silver and bronze medal discs | `Analytics.jsx`, `StatCard.jsx`, `styles.css` |
| Driver map | Map tiles warmed with a CSS filter (`sepia(.25) saturate(.85)`); pulsing saffron origin; driver rows as numbered dispatch slips; indigo driver dots | `styles.css`, small `DriverMap.jsx` class hooks |
| Reviews & menus | Big Fraunces rating score with stars; the menu as a printed menu card: centred category headings with rules, Fraunces dish names, dotted leaders to the price, spice / diet marks as small glyph tags | `Reviews.jsx`, `styles.css` |

`StatCard` gains count-up for numeric values: it accepts `value` as now, plus an optional `countTo` and `format`. Existing call sites keep working unchanged.

## 5. Not changing

- API, database, routes, data flow, breakpoints and the phone drawer.
- Every loading, empty and error state.
- Component names and props, apart from the optional `StatCard` additions.

## 6. Verification

1. `npm test` in `api/`: 22/23 (the one known pre-existing failure only).
2. `npm run build` in `web/` passes.
3. A contrast script computes the ratio for every text/background token pair in §3; all ≥ 4.5:1.
4. A phone script on all 6 screens at 390 px: `scrollWidth === innerWidth`, the drawer opens and closes.
5. Click-through: place order → refused (active order) → advance ×2 → reorder → insufficient balance, in the browser, with the console clean.
6. Headless screenshots at 1440 and 390 px replace `docs/screenshots/*`; reduced-motion renders the final states.
7. `style_guide.md` updated to the new tokens and motifs.

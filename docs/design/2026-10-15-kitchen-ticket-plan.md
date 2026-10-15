# Kitchen Ticket Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the six BiteStream screens into one crafted "kitchen ticket" product (paper, ink, serif money, stamps, tickets) without changing behaviour.

**Architecture:**
- The token values in `web/src/theme.css` change; the token names stay, so existing CSS follows automatically.
- Motifs, motion and per-screen signature moments are added in `styles.css` and `screens.css`.
- JSX changes are additive class hooks plus a `CountUp` component used by `StatCard`.
- A contrast script guards accessibility.

**Tech Stack:** React 18 + Vite, plain CSS, Recharts, react-leaflet, Google Fonts (Fraunces, Inter, JetBrains Mono).

**Spec:** [2026-10-15-kitchen-ticket-design.md](2026-10-15-kitchen-ticket-design.md)

## Global Constraints

- Colour values are exactly as in spec §3. Every `-strong`/`-soft` pair, plus `--text-muted` on `--page` and on `--surface`, is ≥ 4.5:1.
- Nothing is below 12 px. No new npm dependencies.
- All motion is switched off under `@media (prefers-reduced-motion: reduce)`.
- No API, route, data or prop removals. `StatCard`'s existing props keep working.

## Review Focus

1. **Reduced motion.** Count-up must show the final value immediately, and tickets and stamps must render in their end state. Check by emulating `prefers-reduced-motion` in the headless screenshot run (Task 5).
2. **Non-numeric stat values** (`'—'`, `'★ 4.24'`, `'tasty'`). `CountUp` must render them unchanged. Covered by passing `countTo` only where the value is numeric (Tasks 3–4).
3. **Repeated success or failure on Place order.** The print and stamp animation must replay on every new result, not only the first. Handled by keying the panel on the order id or error (Task 2).
4. **Long names in the dispatch slips and menu leaders** (e.g. "Hyderabadi Chicken Biryani" at 390 px) must wrap, not overflow. Checked by the phone overflow script (Task 5).
5. **Dark text on new soft backgrounds.** Covered by `check-contrast.mjs` (Task 1).

---

### Task 1: Tokens, fonts, motifs, shell

**Files:**
- Create: `web/scripts/check-contrast.mjs`
- Modify: `web/package.json` (script `check:contrast`), `web/src/theme.css`, `web/src/theme.js`, `web/src/styles.css`, `web/src/App.jsx` (date stamp), `web/src/components/Sidebar.jsx` (brand mark)

**Interfaces:**
- **Produces:**
  - Tokens `--serif`, `--fs-display`, the colour tokens from spec §3, `--grain`.
  - Utility classes:
    - `.stamp` with modifiers `.stamp.paid`, `.stamp.void`, `.stamp.ok`, `.stamp.warn`, `.stamp.info`
    - `.ticket` (notched card)
    - `.perf` (dashed rule)
    - `.rise` (enter animation)
    - `.serif`, `.mono-label`
  - `theme.js` exports `colors` with keys `brand, brandStrong, brandSoft, brandLine, success, danger, warning, info, text, muted, border, grid, paper`.

- [ ] **Step 1:** Write `check-contrast.mjs`. It parses `--name: #hex` pairs from `theme.css` and checks these pairs:
  - `text`/`page`, `text`/`surface`, `text-muted`/`page`, `text-muted`/`surface`
  - `brand-strong`/`surface`, `brand-strong`/`brand-soft`
  - `{success,danger,warning,info}-strong`/`{…}-soft`
  - white/`brand-strong`

  Each must be ≥ 4.5:1; otherwise it exits 1 with the failing pairs.
- [ ] **Step 2:** Run it against the new token values, written into `theme.css` before anything else. Expected: all pairs pass. If any fail, darken the `-strong` value and record a ruling.
- [ ] **Step 3:** In `styles.css`:
  - Paper grain on `body`.
  - Fraunces for `h1`, `.stat-value` and `.brand strong`.
  - Mono for `.eyebrow`, `th`, `.nav-caption`.
  - Motif and stamp classes.
  - `.rise` keyframes with a stagger via `:nth-child`.
  - A reduced-motion block.
- [ ] **Step 4:** Shell: a CSS ticket brand mark (saffron with a notch). Top bar date stamp `<span className="date-stamp">` using `toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })` in upper case.
- [ ] **Step 5:** `npm run build --prefix web` passes, then commit.

### Task 2: Browse, Place order (KOT), Wallet (passbook)

**Files:** `web/src/screens.css`; `web/src/pages/PlaceOrder.jsx` (stamp elements and `key` for replay); `web/src/pages/WalletHistory.jsx` (`ledger` class)

**Interfaces:**
- **Consumes:** `.stamp`, `.ticket`, `.perf` from Task 1.

- [ ] **Step 1:** Status badges render as stamps: mono caps with a 1.5 px outline in the status colour, no fill. Clickable rows lift on hover.
- [ ] **Step 2:** `SuccessPanel`: add `ticket print` classes to the `Panel`, plus `<span className="stamp paid big">PAID</span>` placed in the panel corner. `FailurePanel`: `<span className="stamp void big">VOID</span>`.
- [ ] **Step 3:** At the `PlaceOrder` render site, add `key={result.data.order?.id}` or `key={result.error.code + attempt}` so the animation replays on every result. Increment an `attempt` counter on each submit.
- [ ] **Step 4:** Wallet passbook: `.ledger` table with ruled lines, mono time column, Fraunces amounts, and a dashed margin rule before the running-balance column.
- [ ] **Step 5:** Build passes. Browser check: success → refused (VOID) → success both animate. Commit.

### Task 3: Analytics board and CountUp

**Files:**
- Create: `web/src/components/CountUp.jsx`
- Modify: `web/src/components/StatCard.jsx`, `web/src/pages/Analytics.jsx`, `web/src/styles.css`

**Interfaces:**
- **Produces:**
  - `CountUp({ to: number, format: (n) => string, duration = 700 })` renders the formatted text. It jumps straight to the end under reduced motion.
  - `StatCard({ ..., countTo?: number, format?: fn })`: when `countTo` is a finite number, it renders `<CountUp to={countTo} format={format} />` instead of `value`.

- [ ] **Step 1:** Write `CountUp` with a `requestAnimationFrame` ease-out, checking `matchMedia('(prefers-reduced-motion: reduce)')`.
- [ ] **Step 2:** `StatCard` gets the optional props. In Analytics, pass `countTo` and `format` for the four summary cards.
- [ ] **Step 3:** Ranks 1–3 become `.rank-number.medal-1/2/3` (gold `#C9A227`, silver `#9AA3AD`, bronze `#B07A4F` discs with ink text that passes contrast). The chart gets a saffron gradient fill under the line; it uses `colors.brand*`.
- [ ] **Step 4:** Build passes and the browser shows the count-up. Commit.

### Task 4: Driver map dispatch and printed menu

**Files:** `web/src/pages/DriverMap.jsx`, `web/src/pages/Reviews.jsx`, `web/src/styles.css`

- [ ] **Step 1:** Map:
  - Warm the tiles with a `.leaflet-tile-pane` filter.
  - Pulsing ring around the origin marker (`.origin-marker::after`).
  - Driver rows as dispatch slips: notched `.ticket` style, mono driver number, Fraunces distance.
- [ ] **Step 2:** Reviews:
  - A big score block (Fraunces 48 px with stars) replaces the rating pill in the header.
  - Menu as a printed card: centred mono category heading between rules; Fraunces dish names; `.leader` dotted flex filler to the price; spice and diet as small glyph tags.
  - The accordion keeps `<details>`.
- [ ] **Step 3:** Pass `countTo` to the numeric `StatCard`s on Reviews (review count).
- [ ] **Step 4:** Build passes; browser check of both screens. Commit.

### Task 5: Verify, screenshots, docs, push

- [ ] **Step 1:** `npm test --prefix api` (expect 22/23, the known pre-existing failure only), `npm run build --prefix web`, `node web/scripts/check-contrast.mjs`.
- [ ] **Step 2:** Phone script over 6 routes at 390 px: no overflow; the drawer opens and closes.
- [ ] **Step 3:** Click-through of the order flow in the browser with the console clean.
- [ ] **Step 4:** Re-shoot screenshots with `prefers-reduced-motion` emulated, so final states are captured.
- [ ] **Step 5:** Update `style_guide.md` (palette, type roles, motifs, motion), commit and push to PR #1.

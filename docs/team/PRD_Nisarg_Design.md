# PRD — Design (Figma) · Owner: Nisarg Bhojani

**Team repo:** https://github.com/MohitT130/SSD_2 (branch `main`; contains the full `team10_a1` commit history, as the PDF requires) · Team overview: [docs/team/README.md](README.md)

## 1. Goal

Give BiteStream one consistent, clean look across all six screens, and produce the design evidence the rubric grades: "Clear idea of who the users are; wireframes; consistent, clean look across screens" (**Design, 15 marks**).

Mohit and Sai build directly from your Figma file, so **speed and consistency matter more than polish**.

## 2. Inputs you already have

| File | What's in it |
|---|---|
| [docs/design/users.md](../design/users.md) | The 3 user types (Customer, Restaurant manager, Operations) and what each wants |
| [docs/design/style_guide.md](../design/style_guide.md) | Proposed colours, fonts, spacing and component list. Change anything you like, then keep this file in sync |
| [docs/design/wireframes.md](../design/wireframes.md) | Text wireframes for all 6 screens. Redraw these in Figma; don't start from zero |
| [docs/api_endpoints.md](../api_endpoints.md) | The exact data each screen receives. Design with realistic field names and values |

**Tool:** Figma free plan (or the free Education plan with your college email). No paid plugins.

## 3. Figma file structure

Create one file named **"BiteStream — Team 26"** and share it with Mohit and Sai (edit access).

| Page | Contents |
|---|---|
| `00 Cover` | Project name, team, links to repo |
| `01 Users & flows` | The 3 user types (from `users.md`) plus one simple flow per workflow, e.g. *Customer: pick restaurant → enter amount → place order → see wallet change* |
| `02 Design system` | Colour styles, text styles, spacing scale, and components (§4) |
| `03 Wireframes` | Low-fi grey boxes, all 6 screens, desktop **and** phone |
| `04 Hi-fi — Desktop` | Final screens at 1440 px wide, using only components from page 02 |
| `05 Hi-fi — Mobile` | Same screens at 390 px wide (sidebar becomes a burger menu, tables scroll sideways) |
| `06 States` | Loading, empty, error, success and failure variants (§5.3) |
| `07 Prototype` | Click-through of the demo path (§6), used to rehearse the video |

## 4. Design system (page `02`)

Build these as **Figma components with variants**. Each one maps to a code component Mohit or Sai will use. Keep the names identical in Figma and code.

| Figma component | Variants | Used on |
|---|---|---|
| `Button` | primary / secondary / danger · default / hover / disabled / loading | everywhere |
| `Input`, `Select`, `SearchSelect`, `DateRange` | default / focus / error / disabled | forms, filters |
| `AppShell` | desktop sidebar / mobile burger | every screen |
| `ActorPicker` | closed / open · user with / without active order | header |
| `DataTable` | loading (skeleton rows) / filled / empty, plus pagination bar | Browse, Audit, Analytics ranking |
| `DetailDrawer` | user / restaurant / order | Browse |
| `StatusBadge` | PREPARING / DELIVERING / DELIVERED | Browse, Transaction |
| `MoneyText` | neutral / debit (red, −) / credit (green, +) | Transaction, Audit |
| `StatCard` | default / loading | Analytics, Reviews, Audit summary |
| `ChartCard` | loading / filled / empty / error | Analytics, Reviews |
| `ResultPanel` | success / insufficient balance / active order exists / generic error | Transaction |
| `EmptyState`, `ErrorState`, `LoadingState` | – | every screen |
| `MapPanel` + `DriverListItem` | – | Map |
| `MenuAccordion` | category open / closed, item with add-ons | Reviews + Menus |

**Tokens** (export to code as `web/src/theme.js`): colours (primary, success, danger, warning, info, text, muted, surface), font family (Inter), font sizes (24/18/14/12), spacing (8/16/24/32), radius (8).

## 5. Screens to design

The screen order and owners follow the PDF's Project mapping.

### 5.1 Screens

| # | Screen | Built by | Must show (straight from the PDF) |
|---|---|---|---|
| 1 | **Browse** (tabs: Users / Restaurants / Orders) | Mohit | Paginated table, search box, filters (order status, "has active order"), detail drawer per record, "Advance status" button on an order |
| 2 | **Place Order** (Transaction) | Mohit | Customer + restaurant + amount form; **balance before and after**; friendly failure message (insufficient balance / already has an active order); after success, the **new `wallet_audit_logs` row** |
| 3 | **Wallet History** (Audit) | Mohit | Read-only table for one user, **date filter**, **running balance** column, opening/closing summary |
| 4 | **Analytics** | Sai | **7-day moving average** line chart per restaurant (restaurant selector); **ranking table (`DENSE_RANK`)**; summary cards from the materialized view with **"Last refreshed"** time and a **Refresh** button |
| 5 | **Driver Map** | Sai | Map with origin marker (choose restaurant or click the map), **5 km circle**, driver markers, **list sorted by distance**, "auto-refreshing" indicator |
| 6 | **Reviews & Menu** | Sai | **Rating distribution** chart, **top tags** chart, **overall average rating**; one **menu** shown readably (categories → items → add-ons) |

Global: header with **role switch + actor picker** (demo user switching, no login), API health dot.

### 5.2 Responsive

Every hi-fi screen at **1440 px** and **390 px**. On phones: the sidebar becomes a burger menu, cards stack, tables scroll sideways, and the map list sits below the map.

### 5.3 States (page `06`)

The PDF says every screen must handle loading, empty and error with "no blank pages". For each screen, draw:

- **Loading:** skeleton rows or cards
- **Empty:** e.g. "No orders match these filters", "No active drivers within 5 km", "This restaurant has no menu yet"
- **Error:** message plus a "Try again" button

Place Order also needs: **success**, **insufficient balance**, **active order exists** (with an "Advance that order" link), and **invalid amount**.

## 6. Demo video (you own it)

The PDF requires a video of **5 minutes or less**, walking through the screens on the seeded data, linked in the README. Use OBS Studio (free), upload to YouTube as **Unlisted**.

Script (about 40 s per screen):

1. Browse: search a user, open an order, show pagination over 50,000 orders.
2. Place Order: success (balance drops, new audit row) → place again (blocked by the active-order rule) → advance the order to DELIVERED → place again (works) → too-large amount (insufficient balance).
3. Wallet History: date filter and running balance.
4. Analytics: moving-average chart, ranking table, refresh the materialized view.
5. Map: pick a restaurant, nearest drivers list, new pings appearing without a reload.
6. Reviews & Menu: the three charts and a menu.
7. Ten seconds on a phone-width window.

## 7. Code you contribute

The PDF says every member must contribute to **both design and code**, and marks can be scaled for unequal contribution. Your code is the part that comes straight from Figma:

- `web/src/theme.js`: Mantine theme built from your tokens (by **H1**)
- `web/src/components/`: `StatusBadge`, `MoneyText`, `StatCard`, `EmptyState`, `ErrorState`, `LoadingState`, `ChartCard` (by **H5**). Mohit can pair with you on the first one.
- Visual QA: go through the running app against Figma and file a list of fixes for Mohit and Sai

## 8. Deliverables and deadlines

| By | Deliverable | Where |
|---|---|---|
| H1 | Figma file shared; tokens in `web/src/theme.js` | Figma, repo |
| H3 | Wireframes for all 6 screens (desktop + phone) exported as PNG | `docs/design/wireframes/01_browse.png` … `06_reviews.png` |
| H5 | Hi-fi desktop + mobile + states; shared components in code | Figma, `docs/design/hifi/*.png`, `web/src/components/` |
| H6 | Visual QA list sent to Mohit and Sai | team chat |
| H8 | README sections: **Design** (users, link to Figma, screenshots of each screen), **Contribution table** | `README.md` |
| H9 | Demo video uploaded; link in README | YouTube (unlisted) |

Also update `docs/design/style_guide.md` and `users.md` if you change anything in Figma, and add the **public view link to the Figma file** in `docs/design/README.md`.

## 9. Done when

- [ ] All 6 screens have wireframes **and** hi-fi in desktop and phone sizes, plus loading/empty/error states
- [ ] Every screen uses only design-system components (the rubric checks for a consistent look)
- [ ] PNG exports committed under `docs/design/` (the ZIP must stay under 20 MB, so export PNGs at 1x)
- [ ] `theme.js` and the shared components are merged and used by both developers
- [ ] Demo video is 5 minutes or less and linked in the README
- [ ] You can explain at the viva who the users are and why each screen looks the way it does, plus the database basics in `docs/team/README.md`

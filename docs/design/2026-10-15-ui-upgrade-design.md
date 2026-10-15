# UI Upgrade — Design Spec (15 Oct 2026)

**Owner:** Nisarg Bhojani (design) · **Branch:** `nisarg/ui-upgrade` → PR into `main`
**Goal:** Make all six screens look like one product that matches [style_guide.md](style_guide.md), and remove the data bugs that make Analytics, Map and Reviews look broken in the demo. Must ship tonight (submission 15 Oct), so the existing layouts and components stay; only their styling, content and data change.

## 1. Why

A walkthrough of the running app on the seeded data found:

- The shipped UI (blue `#4d73e6`, DM Sans + Manrope) contradicts the documented style guide (orange `#E8590C`, Inter). The Design rubric grades a "consistent, clean look", and the docs and the app disagree.
- Body text is 9–11 px and secondary grey (`#a0a8b7`) is about 2.4:1 on white, which fails WCAG AA.
- On phones the sidebar stays as a fixed icon rail; the PRD promised a burger menu.
- Analytics: the "7-day trend" chart plots a single point (the endpoint averages every restaurant's *latest day*). The ranking shows UUIDs and has no "last refreshed" time.
- Map: origins are four hard-coded points (one called "Driver test location"), and the same driver appears many times.
- Reviews: Mongo uses integer `restaurant_id`s that match no PostgreSQL restaurant, only 2 menus exist, and uniform random ratings and tags make every bar the same length.

## 2. Approach

A token-driven restyle in plain CSS:

- New `web/src/theme.css` holds every design token as a CSS custom property and is imported first.
- `styles.css` and `screens.css` reference the tokens instead of hard-coded colours, fonts and sizes.
- No new dependencies. Mantine (planned in the PRDs) was rejected: rewriting every component is too much for tonight.

## 3. Visual system

### Colour tokens

| Token | Value | Use |
|---|---|---|
| `--brand` | `#E8590C` | Accent fills: active nav marker, chart series, map origin, focus ring |
| `--brand-strong` | `#C2410C` | Primary button background, orange text (5.2:1 with white; `#E8590C` is only 3.6:1) |
| `--brand-soft` | `#FFF4E6` | Active nav background, selected rows, highlighted cards |
| `--success` / `--success-soft` | `#2F9E44` / `#EBFBEE` | CREDIT, DELIVERED, successful checkout |
| `--danger` / `--danger-soft` | `#E03131` / `#FFF5F5` | DEBIT, errors, insufficient balance |
| `--warning` / `--warning-soft` | `#F08C00` / `#FFF9DB` | PREPARING, "already has an active order" |
| `--info` / `--info-soft` | `#1971C2` / `#E7F5FF` | DELIVERING, drivers on the map |
| `--text` | `#212529` | Body text |
| `--text-muted` | `#6C757D` | Secondary text (4.7:1; the guide's `#868E96` is 3.3:1 and fails AA) |
| `--surface` / `--page` | `#FFFFFF` / `#F8F9FA` | Cards / page background |
| `--border` | `#E9ECEF` | Card and table borders |

Status text on soft backgrounds uses darker shades of the same hue, so every badge passes 4.5:1.

### Type

- **Inter** (Google Fonts) everywhere, fallback `system-ui, sans-serif`.
- Scale: page title 24/600, section title 18/600, card title 16/600, body 14/400, table 13/400, caption 12/500. Nothing below 12 px.
- Money: `font-variant-numeric: tabular-nums`, right-aligned in tables, formatted `₹1,234.50`.

### Shape and spacing

- 8 px grid (8/16/24/32), radius 8 px (12 px for large cards), 1 px `--border`, at most a very light shadow.
- Stat cards drop the pastel icon tile; icons are 16 px in `--text-muted`.

### Identity

- Orange square mark with a utensil icon, plus the "BiteStream" wordmark in Inter 700.
- The warm palette carries into the chart series, map origin marker and 5 km circle.

### Responsive

- **≥ 1200 px:** sidebar plus content, max width 1440 px.
- **768–1199 px:** stat cards in 2 columns; split layouts stack.
- **< 768 px:** the sidebar is hidden. A top bar shows the brand mark, a burger button and the actor picker; the burger opens the navigation as a left drawer with a backdrop (Esc closes it). Cards stack, tables scroll horizontally, and the map list sits below the map. No horizontal page scroll at 390 px.

## 4. Screen changes

| Screen | Change |
|---|---|
| Shell | Tokenised sidebar, brand mark, phone top bar + drawer, larger actor picker |
| Browse | Entity tabs as a segmented control; status badges use the tokens; order ID shown short and mono; full IDs only in the drawer |
| Place order | Same layout, restyled; wallet before → after with the signed difference; result panel tinted success or danger |
| Wallet history | Styled date inputs; amounts signed and coloured (−₹ red, +₹ green); DEBIT/CREDIT pill kept in the action column only |
| Analytics | See §5.1 |
| Driver map | See §5.2 |
| Reviews & menus | See §5.3 |

## 5. Data fixes

### 5.1 Analytics (PostgreSQL)

- **Materialized view.** `sql/05_materialized_views.sql`: `restaurant_completed_revenue` gains `NOW() AS refreshed_at` (every refresh recomputes it), so "last refreshed" lives in the database.
- **Moving average.** `GET /api/analytics/moving-average?restaurantId=<uuid>`:
  - Returns `[{ order_date, daily_revenue, moving_average_7_day }]` for the last 30 days of that restaurant.
  - Uses Workflow 2 steps 1–4 unchanged: daily revenue, gap-filled calendar, `AVG … ROWS BETWEEN 6 PRECEDING AND CURRENT ROW`.
  - `restaurantId` is required (400 if missing or invalid); an unknown restaurant returns 404.
- **Rankings.** `GET /api/analytics/rankings?page=&pageSize=`: the original Workflow 2 query (`DENSE_RANK`), paginated, returning `{ data, page, pageSize, total }`.
- **Summary.** `GET /api/analytics/summary` also returns `refreshed_at` from the view.
- **Refresh.** `POST /api/analytics/refresh` returns the new `refreshed_at` and `duration_ms`.
- **UI.**
  - Restaurant picker, defaulting to rank #1.
  - `ComposedChart`: daily-revenue bars plus the 7-day average line, in brand colours.
  - Ranking table: rank, name, latest day, daily revenue, 7-day average. Row click loads that restaurant's chart.
  - Summary cards plus "Last refreshed …" and a Refresh button.

### 5.2 Driver map (MongoDB + PostgreSQL)

- **Endpoint.** `GET /api/map/nearby?lat=&lng=&radiusKm=5` runs this pipeline:
  - `$geoNear` (5,000 m, `active: true`)
  - `$sort { driver_id: 1, created_at: -1 }`
  - `$group` by `driver_id`, keeping the latest ping and that ping's distance (so the marker and the listed distance agree)
  - `$sort { distanceMeters: 1 }`
  - `$limit 20`
- `mongo/02_workflow3_geonear.js` gets the same pipeline (a documented change to the inherited script).
- **UI.**
  - Origin is a real restaurant (the existing `RestaurantPicker`, defaulting to the first result) or a click on the map.
  - Orange origin marker, 5 km circle, blue driver markers.
  - List sorted by distance, showing driver id, distance (m/km) and last ping time.
  - Polling every 10 s with a pause toggle.

### 5.3 Reviews & menus (MongoDB)

- **Seeder.** `data_generation/mongo_seeder.py`:
  - Reads restaurant `id` and `name` from PostgreSQL (`psycopg2` is already a requirement; same `DB_*` environment variables as the PG seeder).
  - Uses the UUID string as `restaurant_id` in `Reviews` and `Menus`.
  - Creates one `Menus` document per restaurant with varied shapes: some items have `customization_addons`, some `dietary_tags` or `spice_level`, some categories are combos.
  - Ratings are skewed (more 4–5★ than 1–2★), and tag frequency is skewed and correlated with rating.
  - Calls `random.seed(42)` so the data is reproducible.
  - Driver ping generation is unchanged.
- **Endpoints.**
  - `GET /api/reviews/analytics?restaurantId=` adds an optional `$match` *before* the `$facet`; without it the result is the global pipeline, as in the original script.
  - `GET /api/reviews/menus?restaurantId=` returns that restaurant's menu document, or 404 `MENU_NOT_FOUND`.
- **UI.**
  - Restaurant picker with an "All restaurants" option.
  - Average-rating and review-count cards.
  - Rating-distribution bars and top-10 tag bars.
  - Menu shown as an accordion (category → items with price → add-ons); optional fields appear only when present.

## 6. Error handling

- Every screen keeps its loading skeleton, empty state and error banner with Retry.
- New endpoints return `{ error, code }` like the existing ones: `INVALID_ID` 400, `RESTAURANT_NOT_FOUND` 404, `MENU_NOT_FOUND` 404.

## 7. Testing

- **Existing.** The 14 tests in `api/test/transaction.test.js` must still pass.
- **New.** `api/test/analytics_map_reviews.test.js`:
  1. One day's `moving_average_7_day` equals the mean of that day and the 6 before it, computed independently in the test.
  2. Rankings are non-decreasing; the page size is respected.
  3. `refreshed_at` after `POST /refresh` is later than before.
  4. Map: every `distanceMeters` ≤ 5000, results sorted ascending, no duplicate `driver_id`.
  5. Reviews: rating-distribution counts sum to the total; the average is between 1 and 5; a restaurant filter returns fewer reviews than the global result.
  6. Menus: a known restaurant returns a menu; a random UUID returns 404.
- **Build.** `vite build` succeeds.
- **Visual.** Every screen checked at 1440 px and 390 px with no horizontal scroll; before/after screenshots go to `docs/screenshots/`.

## 8. Docs

- `style_guide.md`: plain CSS instead of Mantine; the contrast-adjusted tokens above; the token file location.
- README:
  - Fill Nisarg's Code column.
  - Add the change-log rows for `sql/05`, `mongo/02` and `mongo_seeder.py`.
- `handover_note.md`: rows #5, #7, #10 (timestamp) and #12 marked done.

## 9. Out of scope tonight

- Figma file and PNG wireframes (separate deliverable).
- Ping simulator (the README already says to re-seed if the 2-hour TTL empties the map).
- A Mantine migration.
- New screens such as "My Orders".

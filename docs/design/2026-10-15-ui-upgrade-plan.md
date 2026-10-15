# UI Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all six screens to the documented style guide and fix the data bugs that make Analytics, Map and Reviews look broken, for tonight's submission.

**Architecture:**
- Design tokens live in `web/src/theme.css` (CSS custom properties) and are mirrored in `web/src/theme.js` for Recharts and Leaflet, which need literal colour values.
- The existing CSS files are rewritten against the tokens.
- API changes stay thin: the SQL and Mongo pipelines do the work; Express only validates, paginates and reshapes.

**Tech Stack:** React 18 + Vite, plain CSS, Recharts, react-leaflet, Express, `pg`, `mongodb`, `node --test`, Python seeders (`psycopg2`, `pymongo`).

**Spec:** [2026-10-15-ui-upgrade-design.md](2026-10-15-ui-upgrade-design.md)

## Global Constraints

- Tokens are exactly as in spec §3. `--brand-strong` (`#C2410C`) is used for any orange text or button fill. `--text-muted` is `#6C757D`.
- Inter only; nothing below 12 px.
- No new npm or pip dependencies.
- Every screen keeps its loading, empty and error states.
- Every inherited-script change is marked `[Team 26]` in the code and listed in the README change log.
- API errors use the existing shape `{ error, code }`.

## Review Focus

1. **Map origin with no drivers nearby** (click far away, or pings expired by the 2-hour TTL). Expected: an empty state, not an error. Test: a far-away `lat`/`lng` returns `data: []` with status 200 (Task 4).
2. **Malformed `restaurantId`** on analytics, reviews or menus. Expected: 400 `INVALID_ID`, not a 500. Tests in Tasks 3 and 5.
3. **Restaurant with no delivered orders in range.** Expected: 30 zero-revenue days and a chart note, not a crash. The API returns zero rows padded by the calendar; the UI shows "No delivered orders in the last 30 days" when every value is 0 (Task 3).
4. **Phone width 390 px.** Expected: no horizontal page scroll and the burger drawer opens and closes. Checked in Task 6.
5. **Unknown restaurant UUID.** Expected: 404 `RESTAURANT_NOT_FOUND` for moving-average and 404 `MENU_NOT_FOUND` for menus. Tests in Tasks 3 and 5.

---

### Task 1: Design tokens and shell

**Files:**
- Create: `web/src/theme.css`, `web/src/theme.js`
- Rewrite: `web/src/styles.css` (shell, shared and Sai-screen classes, readable rather than minified)
- Modify: `web/src/main.jsx` (import `theme.css` first), `web/src/App.jsx` (phone top bar and burger state), `web/src/components/Sidebar.jsx` (`mobileOpen` and `onClose` props, brand mark)

**Interfaces:**
- **Produces:**
  - CSS custom properties `--brand`, `--brand-strong`, `--brand-soft`, `--success*`, `--danger*`, `--warning*`, `--info*`, `--text`, `--text-muted`, `--surface`, `--page`, `--border`, `--radius`, `--radius-lg`, `--font`.
  - `theme.js` exports `colors = { brand, brandStrong, brandSoft, success, danger, warning, info, text, muted, border, grid }`.
- **Sidebar props:** `{ page, setPage, collapsed, setCollapsed, apiStatus, mobileOpen, onClose }`.

- [ ] **Step 1:** Write `theme.css` with the spec §3 tokens and the Inter `@import`. Mirror the hex values in `theme.js`.
- [ ] **Step 2:** Rewrite `styles.css`:
  - Every class in the shell, panels, stats, tables, buttons, banners, map, reviews and empty states uses `var(--…)`.
  - Body 14 px, tables 13 px, captions 12 px.
  - `.stat-icon` loses its background and becomes a muted 16 px icon.
- [ ] **Step 3:** Phone layout under 768 px:
  - `.sidebar` is translated off-screen; `.sidebar.mobile-open` slides it in, with a `.nav-backdrop` behind it.
  - `.topbar` shows a `.burger` button.
  - `.main-area` has a margin of 0.
  - Esc and a backdrop click close the drawer, and so does choosing a page.
- [ ] **Step 4:** Build with `npm run build --prefix web`. It should compile with no errors.
- [ ] **Step 5:** Commit `feat(ui): design tokens, Inter, phone burger nav`.

### Task 2: Browse, Place order, Wallet restyle

**Files:**
- Rewrite: `web/src/screens.css` against the tokens.
- Modify: `web/src/pages/Browse.jsx` (tabs become a segmented control with `className="segmented"`), `web/src/pages/WalletHistory.jsx` (signed coloured amounts already exist via `debit-text` and `credit-text`; keep them).

**Interfaces:**
- **Consumes:** the tokens from Task 1.

- [ ] **Step 1:** Rewrite `screens.css` with:
  - status and action badges in the token soft/strong pairs
  - the drawer
  - form fields with a 40 px height, 14 px text and a focus ring in `--brand`
  - result panels tinted with `--success-soft` and `--danger-soft`
  - date inputs styled like `.input`
- [ ] **Step 2:** Browse: apply the segmented tab style. The order ID stays short and mono.
- [ ] **Step 3:** Build passes. Browse, Place order (success and refused) and Wallet render correctly at 1440 px.
- [ ] **Step 4:** Commit `feat(ui): restyle browse, place order, wallet`.

### Task 3: Analytics (SQL, API, screen)

**Files:**
- Modify:
  - `sql/05_materialized_views.sql`: add `NOW() AS refreshed_at`, with a `[Team 26]` comment.
  - `api/src/routes/analytics.js`
  - `web/src/services/api.js`
  - `web/src/pages/Analytics.jsx`
- Test: `api/test/analytics_map_reviews.test.js` (new)

**Interfaces:**
- **Produces:**
  - `GET /api/analytics/moving-average?restaurantId=<uuid>` returns `{ data: [{ order_date: 'YYYY-MM-DD', daily_revenue, moving_average_7_day }], restaurant: { id, name } }`.
  - `GET /api/analytics/rankings?page&pageSize` returns `{ data: [{ restaurant_id, restaurant_name, order_date, daily_revenue, moving_average_7_day, revenue_rank }], page, pageSize, total }`.
  - `GET /api/analytics/summary` returns `{ data: { total_revenue, orders_processed, restaurants, average_order_value, refreshed_at } }`.
  - `POST /api/analytics/refresh` returns `{ data: { refreshed_at, duration_ms } }`.
  - Client: `api.movingAverage(restaurantId)`, `api.rankings(params)`.

- [ ] **Step 1: Write failing tests.**

```js
test('moving average of the last day equals the mean of that day and the 6 before it', async () => {
  const { body: ranks } = await api('GET', '/analytics/rankings?pageSize=1');
  const id = ranks.data[0].restaurant_id;
  const { status, body } = await api('GET', `/analytics/moving-average?restaurantId=${id}`);
  assert.equal(status, 200);
  assert.equal(body.data.length, 30);
  const last = body.data.at(-1);
  const expected = (await getPgPool().query(
    `SELECT ROUND(COALESCE(SUM(total_amount),0) / 7.0, 2) AS v FROM orders
     WHERE restaurant_id = $1 AND status = 'DELIVERED'
       AND created_at::date BETWEEN $2::date - 6 AND $2::date`, [id, last.order_date])).rows[0].v;
  assert.equal(Number(last.moving_average_7_day), Number(expected));
});
test('rankings are paginated and DENSE_RANK is non-decreasing', ...);   // pageSize=25 -> 25 rows, total 500
test('refresh moves refreshed_at forward', ...);
test('moving average rejects a malformed id (400) and an unknown restaurant (404)', ...);
```

- [ ] **Step 2:** Run `npm test --prefix api`. The new tests should fail (no `restaurantId` filter, no pagination, no `refreshed_at`).
- [ ] **Step 3:** Implement the routes:
  - One `stepsOneToFour(filter)` builder produces the Workflow 2 CTEs, so the per-restaurant series and the ranking share one copy of the SQL.
  - The 30-day cut is applied after the window, so early days still have 6 preceding rows.
  - Dates are returned as text.
- [ ] **Step 4:** Re-run `sql/05` locally, then refresh. Run the tests; they should pass.
- [ ] **Step 5:** Screen:
  - `RestaurantPicker`, defaulting to rank #1.
  - `ComposedChart` with bars for `daily_revenue` (`colors.brandSoft` fill with a `colors.brand` stroke) and a line for `moving_average_7_day` (`colors.brandStrong`).
  - Paginated ranking table with no UUIDs; a row click selects that restaurant.
  - Summary cards plus "Last refreshed …" with a Refresh button.
- [ ] **Step 6:** Commit `fix(analytics): per-restaurant 7-day series, paginated ranking, refreshed_at`.

### Task 4: Driver map (pipeline, API, screen)

**Files:**
- Modify: `api/src/routes/map.js`, `mongo/02_workflow3_geonear.js` (`[Team 26]` comment), `web/src/pages/DriverMap.jsx`
- Test: `api/test/analytics_map_reviews.test.js`

**Interfaces:**
- **Produces:** `GET /api/map/nearby?lat&lng&radiusKm` returns `{ origin, radiusKm, data: [{ driver_id, location, created_at, distanceMeters }] }`, with at most 20 rows, one per driver, sorted ascending.

- [ ] **Step 1: Write failing tests.**

```js
test('nearby drivers: one row per driver, sorted, all within 5 km', async () => {
  const r = (await getPgPool().query('SELECT latitude, longitude FROM restaurants ORDER BY id LIMIT 1')).rows[0];
  const { body } = await api('GET', `/map/nearby?lat=${r.latitude}&lng=${r.longitude}`);
  const ids = body.data.map((d) => d.driver_id);
  assert.ok(body.data.length > 0 && body.data.length <= 20);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(body.data.every((d, i, a) => d.distanceMeters <= 5000 && (i === 0 || a[i - 1].distanceMeters <= d.distanceMeters)));
});
test('a far-away origin returns an empty list, not an error', ...); // lat=0&lng=0 -> 200, []
```

- [ ] **Step 2:** Run the tests. They should fail (duplicates, `$limit 100`).
- [ ] **Step 3:** Implement the pipeline:
  - `$geoNear` → `$sort {driver_id:1, created_at:-1}` → `$group {_id:'$driver_id', location:{$first}, created_at:{$first}, distanceMeters:{$first}}` → `$sort {distanceMeters:1}` → `$limit 20`
  - Run it with `allowDiskUse: true`.
  - Mirror the pipeline in `mongo/02`.
- [ ] **Step 4:** Run the tests; they should pass.
- [ ] **Step 5:** Screen:
  - Origin comes from `RestaurantPicker` (default: the first restaurant) or a map click (`useMapEvents`), labelled "Pinned location".
  - Origin `divIcon` in brand orange, circle in brand, drivers in info blue.
  - List rows show driver id, distance and "last ping 3 min ago".
  - Clicking a row flies the map to that driver.
- [ ] **Step 6:** Commit `fix(map): one row per driver, real restaurant origins`.

### Task 5: Reviews and menus (seeder, API, screen)

**Files:**
- Modify: `data_generation/mongo_seeder.py`, `api/src/routes/reviews.js`, `web/src/services/api.js`, `web/src/pages/Reviews.jsx`
- Test: `api/test/analytics_map_reviews.test.js`

**Interfaces:**
- **Produces:**
  - `GET /api/reviews/analytics?restaurantId=` (optional) returns `{ data: { averageRating, totalReviews, distribution, topTags } }`.
  - `GET /api/reviews/menus?restaurantId=` returns `{ data: menuDoc }`, or 404 `MENU_NOT_FOUND`.
  - Client: `api.reviewAnalytics(restaurantId)`, `api.menu(restaurantId)`.

- [ ] **Step 1: Write failing tests.**

```js
test('rating distribution adds up and the restaurant filter narrows the facet', ...);
test('menus: known restaurant 200, unknown 404 MENU_NOT_FOUND, malformed 400', ...);
```

- [ ] **Step 2:** Seeder:
  - Read restaurants from PostgreSQL with the same `DB_*` variables as the PG seeder.
  - Call `random.seed(42)`.
  - Build menus from cuisine templates with optional `customization_addons`, `dietary_tags`, `spice_level` and combo categories.
  - Give each restaurant a quality offset that skews its rating weights; draw tags from positive, neutral or negative pools by rating.
  - Spread review `created_at` over the last 60 days.
  - Leave driver pings unchanged.
- [ ] **Step 3:** Re-run both seeders locally (the PG seeder first, because it truncates), then `sql/05` and refresh.
- [ ] **Step 4:** API:
  - An optional `$match {restaurant_id}` goes before `$facet`.
  - The menu `findOne` returns 404 if nothing is found.
  - `requireUuid` handles validation.
  - Run the tests; they should pass.
- [ ] **Step 5:** Screen:
  - `RestaurantPicker` plus a segmented "All restaurants | This restaurant" scope for the charts.
  - Stat cards.
  - Rating bars in `--warning`; tag bars in `colors.brand`.
  - Menu accordion (`<details>`): category → items with price → add-ons; badges for `dietary_tags` and `spice_level` only when present.
- [ ] **Step 6:** Commit `fix(reviews): link reviews and menus to real restaurants, menu accordion`.

### Task 6: Verify, screenshots, docs

**Files:**
- Modify: `docs/design/style_guide.md`, `README.md` (change log rows; Nisarg's Code column), `docs/handover_note.md` (rows #5, #7, #10, #12)
- Create: `docs/screenshots/*` (after screenshots)

- [ ] **Step 1:** `npm test --prefix api`: all old and new tests pass. `npm run build --prefix web` passes.
- [ ] **Step 2:** Check all 6 screens at 1440 px and 390 px:
  - `document.documentElement.scrollWidth === innerWidth` on every phone screen
  - the burger drawer opens, closes and navigates
  - no console errors
- [ ] **Step 3:** Save screenshots to `docs/screenshots/` at 1x JPG and keep the README image links valid.
- [ ] **Step 4:** Update the docs.
- [ ] **Step 5:** Commit `docs: style guide, change log, handover rows for UI upgrade`.

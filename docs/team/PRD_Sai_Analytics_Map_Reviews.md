# PRD — Analytics, Map, Reviews + Menus · Owner: Kodavali Sai

**Team repo:** https://github.com/MohitT130/SSD_2 (branch `main`; contains the full `team10_a1` commit history, as the PDF requires) · Team overview: [docs/team/README.md](README.md)

## 1. Goal

Build screens **4–6** of the PDF's Project mapping, end to end: database fixes → API → React screen → tests.

| # | Screen | P1 BiteStream | Workflow | Store |
|---|---|---|---|---|
| 4 | Analytics | per restaurant | **Workflow 2** + materialized view | PostgreSQL |
| 5 | Map | nearest driver to restaurant | **Workflow 3** (`$geoNear`) | MongoDB (+ restaurant coordinates from PostgreSQL) |
| 6 | Reviews + catalog | Reviews + Menus | **Workflow 4** (`$facet`) + Menus | MongoDB |

Rubric weight: Workflow Screens (30, shared with Mohit) and Front-End Quality (15).

## 2. Users

- **Restaurant manager**: revenue trend, rank, what customers say, the menu.
- **Operations / dispatch**: nearest active drivers.

See [docs/design/users.md](../design/users.md).

## 3. Dependencies on Mohit (check before you start)

| You need | From Mohit | By |
|---|---|---|
| `api/` + `web/` scaffold, `AppShell`, `client.js`, empty pages `/analytics`, `/map`, `/reviews` | Phase 0 | **H1** |
| `GET /api/restaurants?search=` (restaurant selectors on all three of your screens) | Browse API | **H2** |
| Restaurants seeded inside the driver-ping area (`lat 17.36–17.46`, `lng 78.33–78.43`) | `postgres_seeder.py` fix #7 | **H2** |

Until H2, hard-code one restaurant UUID or the point `[78.4071, 17.4483]` and keep going.

## 4. Database work (fixes from the handover note)

### PostgreSQL (you own `sql/05_*` and `sql/06_*`)

| # | Change | Why |
|---|---|---|
| 1 | Add `NOW() AS refreshed_at` to `restaurant_completed_revenue` | The PDF requires a "last refreshed" time. PostgreSQL has no built-in refresh timestamp; every refresh recomputes `NOW()` |
| 2 | Refresh the MV once at the end of seeding (or in the API on startup if it is empty) | It is created before seeding, so it currently has **0 rows** (verified) |
| 3 | Keep the original Workflow 2 query, and additionally wrap steps 1–4 as `fn_restaurant_moving_average(p_restaurant_id UUID) RETURNS TABLE(order_date date, daily_revenue numeric, moving_average_7_day numeric)` | The original returns only the latest day (all 500 rows are `2026-10-14`), so there's nothing to chart |
| 4 | Turn the final ranking query into `CREATE OR REPLACE VIEW v_restaurant_revenue_rank AS …` | The ranking table pages over a view. Same SQL, still `DENSE_RANK()` |
| 5 | `DROP … IF EXISTS` / `CREATE OR REPLACE` guards | Scripts can't be re-run today |

Keep the window frame `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` and the calendar gap-filling. The PDF says "using the Part A window-function query", so reuse it rather than rewriting it.

### MongoDB (you own `mongo/*`, `mongo_seeder.py`, `ping_simulator.py`)

| # | Change | Why |
|---|---|---|
| 6 | `mongo_seeder.py` reads restaurant `id`, `name`, lat/lng from PostgreSQL (`psycopg2` is already in `requirements.txt`) and uses the **UUID string** as `restaurant_id` in `Reviews` and `Menus` | Currently integers 1–100, so menus and reviews can't be linked to a real restaurant |
| 7 | Generate a `Menus` document for **every** restaurant with varied shapes (some with `customization_addons`, some with `dietary_tags`, `spice_level`, combos) | Shows off the "flexible catalog"; there are only 2 menus today |
| 8 | Seed pings around **restaurant locations**, with `created_at` within the last ~30 minutes | Pings must exist near restaurants; the 2-hour TTL deletes old ones |
| 9 | New `data_generation/ping_simulator.py` (or an API interval behind `POST /api/map/simulate-pings`): every 5 s, move about 50 active drivers slightly and insert fresh pings | The PDF wants "new pings should appear without a full page reload". It also keeps the map populated during the viva despite the TTL |
| 10 | `mongo/02_workflow3_geonear.js`: `$geoNear` (5000 m, `active: true`) → `$sort: {driver_id: 1, created_at: -1}` → `$group` by `driver_id` taking the latest ping and minimum distance → `$sort: {distance: 1}` → `$limit: 20` | `$limit: 1` returns a single driver; without grouping, 62,770 pings repeat 7,038 drivers |
| 11 | `mongo/03_workflow4_facet.js`: optional `$match: {restaurant_id}` **before** `$project` | Per-restaurant review analytics; unchanged when no restaurant is chosen |
| 12 | `mongo_seeder.py`: `random.seed(42)` | Reproducible demo |

Update the **"What we changed"** rows #4–#7, #10, #12 in [docs/handover_note.md](../handover_note.md) once done.

## 5. API endpoints you implement

Full contract: [docs/api_endpoints.md](../api_endpoints.md) §5–§7.

| Endpoint | Notes |
|---|---|
| `GET /api/analytics/moving-average?restaurantId=` | `SELECT * FROM fn_restaurant_moving_average($1)` |
| `GET /api/analytics/rankings?page&pageSize` | `SELECT … FROM v_restaurant_revenue_rank ORDER BY revenue_rank, restaurant_name LIMIT/OFFSET`, with `total` |
| `GET /api/analytics/summary` | From the MV: total completed revenue, completed orders, restaurant count, average per restaurant, top 5, `refreshed_at` |
| `POST /api/analytics/refresh` | `CALL refresh_restaurant_completed_revenue()`; returns new `refreshed_at` and `duration_ms` |
| `GET /api/map/nearest-drivers?restaurantId=` or `?lng&lat`, `radius=5000`, `limit=20` | Look up restaurant coordinates in PostgreSQL, then run the Mongo pipeline from #10. Note GeoJSON order is **`[lng, lat]`** |
| `POST /api/map/simulate-pings` | Optional demo trigger for #9 |
| `GET /api/reviews/facets?restaurantId=` | The `$facet` pipeline from #11, reshaped to `{rating_distribution, most_frequent_tags, overall_average_rating}` |
| `GET /api/reviews?restaurantId&page` | Paginated recent reviews (comments list) |
| `GET /api/menus/:restaurantId` | 404 `MENU_NOT_FOUND` when absent |

## 6. Screens: requirements and acceptance criteria

### 6.1 Analytics (`/analytics`): Workflow 2 + materialized view

PDF: *"A chart of the 7-day moving average revenue per restaurant using the Part A window-function query. A ranked table based on `DENSE_RANK()`. Summary numbers from the materialized view, with a 'last refreshed' time and a button to refresh it."*

- [ ] `StatCard` row from `/summary`: completed revenue, completed orders, restaurants, average per restaurant
- [ ] "Last refreshed: 14 Oct 2026, 15:00:12" + **Refresh** button → `POST /refresh` → cards and timestamp update; button shows loading; success toast with duration
- [ ] Restaurant selector (default: rank #1) → **line chart** of `moving_average_7_day` over about 30 days, with daily revenue as bars behind it (Mantine `CompositeChart`)
- [ ] **Ranking table** (`DENSE_RANK`): rank, restaurant, latest date, daily revenue, 7-day average; paginated; clicking a row loads that restaurant in the chart
- [ ] Demo tip: place an order, advance it to DELIVERED, then hit Refresh. The MV totals change, which proves the refresh works

### 6.2 Driver Map (`/map`): Workflow 3

PDF: *"A map showing the results of the `$geoNear` pipeline around a selectable origin, with a 5 km radius and a list of results sorted by distance. New pings should appear without a full page reload (polling is fine)."*

- [ ] Leaflet map with **OpenStreetMap tiles** (free, no key; keep the attribution)
- [ ] Origin selectable two ways: **restaurant dropdown** (default) or **click on the map**. Origin marker plus a **5 km circle**
- [ ] Driver markers; the list beside the map (below it on phones) is **sorted by distance**, showing driver id, distance (m/km) and last ping time
- [ ] Clicking a list item highlights its marker and opens a popup with the same details
- [ ] Polling every 5 s with TanStack Query `refetchInterval` (no page reload); "Live · updated 15:04:31" indicator; pause/resume toggle
- [ ] Empty state "No active drivers within 5 km right now" and error state

### 6.3 Reviews & Menu (`/reviews`): Workflow 4

PDF: *"Charts driven by the `$facet` pipeline: rating distribution, top tags, and overall average rating. Also display at least one flexible catalog document (Menus) in a readable way."*

- [ ] Restaurant selector with an **"All restaurants"** option (the global `$facet`, same as the original script)
- [ ] `StatCard`: overall average rating (★ x.xx) and review count
- [ ] Bar chart: rating distribution 1–5★
- [ ] Horizontal bar chart: top 10 tags
- [ ] **Menu** for the selected restaurant as an accordion: category → items with price → add-ons. Optional fields (`spice_level`, `dietary_tags`) are shown only when present, which demonstrates the flexible schema
- [ ] Optional: latest 10 review comments
- [ ] Empty states: "No reviews yet", "This restaurant has no menu yet"

## 7. Tests

`api/test/analytics_map_reviews.test.js` (Vitest + Supertest, real databases):

1. `POST /analytics/refresh` → `refreshed_at` is later than before
2. `/analytics/rankings` → ranks are non-decreasing and ties share a rank (`DENSE_RANK`)
3. `/analytics/moving-average` → each day's value equals the average of that day and the 6 before it (check one day by hand)
4. `/map/nearest-drivers` → every `distance_m ≤ 5000`, sorted ascending, no duplicate `driver_id`
5. `/reviews/facets` → the rating-distribution counts add up to the review count; average is between 1 and 5

## 8. README sections you write

**Assumptions** (merge the original team's list with ours), the **change log** of every inherited-script change (the PDF requires listing *every* change), and how to start the ping simulator.

## 9. Timeline

| By | Milestone |
|---|---|
| H1 | MV + Workflow 2 SQL fixes (#1–#5) done |
| H2 | Mongo seeder + pipeline fixes (#6–#12) done, reseeded after Mohit's PostgreSQL reseed |
| H3 | Analytics complete |
| H5 | Map complete with live polling |
| H6 | Reviews & Menu complete; Nisarg's visual QA fixes applied |
| H7 | Tests passing; README assumptions + change log |
| H8 | Fresh-clone run-through of the README on a teammate's laptop |

## 10. Viva prep for your area

Be ready to explain:

- `ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` vs `RANGE`
- why missing days are filled with 0
- `DENSE_RANK` vs `RANK`
- why `REFRESH … CONCURRENTLY` needs a unique index
- `$geoNear` must be the first stage and needs a 2dsphere index
- the `[lng, lat]` order
- the TTL index (`expireAfterSeconds: 7200`)
- what `$facet` does and why `$unwind` is needed for tags
- why the original Map query could never return a driver for a restaurant

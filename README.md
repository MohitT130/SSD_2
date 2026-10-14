# BiteStream: Assignment 2 Front End (Team 26)

A web front end for the inherited **BiteStream** food-delivery backend (PostgreSQL + MongoDB, project P1). It lets a user run the four Assignment 1 workflows from a browser instead of by hand, plus browsing.

| | |
|---|---|
| **Repository** | https://github.com/MohitT130/SSD_2 (created from [`team10_a1`](https://github.com/sreelasyamuvva/team10_a1) with its full commit history) |
| **Final commit hash** | `TODO: fill in after the last commit` |
| **Demo video (≤ 5 min)** | `TODO: YouTube (unlisted) link` |
| **Inherited backend README** | [docs/part_a_README.md](docs/part_a_README.md) |
| **Handover note** | [docs/handover_note.md](docs/handover_note.md) |
| **API endpoints** | [docs/api_endpoints.md](docs/api_endpoints.md) |
| **Design (users, wireframes, style guide)** | [docs/design/](docs/design/) |

## Contents

1. [Screens](#1-screens)
2. [Running it](#2-running-it)
3. [Tech choices](#3-tech-choices)
4. [How each screen is wired to the database](#4-how-each-screen-is-wired-to-the-database)
5. [Tests](#5-tests)
6. [Assumptions](#6-assumptions)
7. [Changes to the inherited scripts](#7-changes-to-the-inherited-scripts)
8. [Project structure](#8-project-structure)
9. [Team and contributions](#9-team-and-contributions)

---

## 1. Screens

| # | Screen | Route | What it does |
|---|---|---|---|
| 1 | **Browse** | `#/browse` | Customers, restaurants and orders with server-side pagination, search, filters and a detail drawer per record; "Advance status" on orders |
| 2 | **Place order** (Workflow 1) | `#/order` | Calls `sp_execute_checkout`. Shows the wallet before/after, a friendly reason when the order is refused (insufficient balance, or an order already in progress) and the new `wallet_audit_logs` row written by the trigger |
| 3 | **Wallet history** (Audit) | `#/wallet` | Read-only `wallet_audit_logs` for one customer, with a date filter, opening/closing totals and a running balance |
| 4 | **Analytics** (Workflow 2 + materialized view) | `#/analytics` | 7-day moving-average revenue, `DENSE_RANK()` ranking table, materialized-view summary with refresh |
| 5 | **Live driver map** (Workflow 3) | `#/map` | `$geoNear` around a selectable origin, 5 km radius, list sorted by distance, polling every 10 s |
| 6 | **Reviews & menus** (Workflow 4) | `#/reviews` | `$facet` rating distribution, top tags, average rating, plus the `Menus` catalog |

**Demo user switching:** the header's **"Acting as"** picker chooses the customer (no login). It shows their wallet balance and whether they have an active order, and the choice is remembered across reloads.

![Place order: success with the trigger-written audit row](docs/screenshots/place_order_desktop.png)

<img src="docs/screenshots/browse_mobile.png" alt="Browse on a phone" width="260">

## 2. Running it

### Prerequisites

| Tool | Version used |
|---|---|
| Node.js | 20+ (tested on 24) |
| Python | 3.10+ (tested on 3.14) |
| PostgreSQL | 13+ (tested on 16) |
| MongoDB | 6+ (tested on 8.3), plus `mongosh` |

### Option A: local databases (tested)

Run all commands from the repository root.

**1. PostgreSQL schema.** Create an empty database called `bitestream`, then run the scripts in order. All of them are safe to re-run.

```bash
createdb -U postgres bitestream
psql -U postgres -d bitestream -f sql/01_schema_ddl.sql
psql -U postgres -d bitestream -f sql/02_indexes.sql
psql -U postgres -d bitestream -f sql/03_triggers_and_audit.sql
psql -U postgres -d bitestream -f sql/04_stored_procedures.sql
psql -U postgres -d bitestream -f sql/05_materialized_views.sql
psql -U postgres -d bitestream -f sql/07_fixes_transactions.sql
```

`sql/06_window_analytics.sql` is a query (Workflow 2), not a schema change; the API runs it.

**2. Seed data** (about 20 s). The PostgreSQL seeder must run first, because restaurants are created there.

```bash
python -m pip install -r data_generation/requirements.txt

# macOS / Linux
export DB_PASSWORD=your_postgres_password DB_HOST=localhost
python data_generation/postgres_seeder.py
python data_generation/mongo_seeder.py

# Windows PowerShell
$env:DB_PASSWORD="your_postgres_password"; $env:DB_HOST="localhost"
py data_generation/postgres_seeder.py
py data_generation/mongo_seeder.py
```

Then create the MongoDB indexes:

```bash
mongosh BiteStream mongo/01_collections_and_indexes.js
```

> Driver pings expire after 2 hours (TTL index from Assignment 1). If the map is empty, re-run `mongo_seeder.py`.

**3. API** (terminal 1)

```bash
cd api
cp .env.example .env        # Windows: copy .env.example .env  — then set your PostgreSQL password
npm install
npm run dev                 # http://localhost:4000/api/health
```

**4. Web app** (terminal 2)

```bash
cd web
npm install
npm run dev                 # open http://localhost:5173
```

### Option B: Docker Compose

```bash
docker compose up -d postgres mongo         # schema + indexes are created on first start
docker compose --profile seed run --rm seed # load the seed data
docker compose exec mongo mongosh BiteStream /docker-entrypoint-initdb.d/01_collections_and_indexes.js
```

Then start the API and web app as in steps 3–4 (`DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bitestream`). The compose file is provided for convenience; our team tested Option A.

### Demo script (≈ 5 minutes)

1. **Browse → Orders**: page through 50,000 orders, filter *Preparing*, open an order.
2. **Acting as**: tick "Only customers without an active order" and pick one.
3. **Place order**: choose a restaurant, ₹450 → success (wallet drops, DEBIT audit row appears).
4. **Place order again** → refused: *an order is already in progress* (partial unique index).
5. **Advance to DELIVERING → DELIVERED**, then place the order again → accepted.
6. **"More than the wallet"** chip → refused: *not enough money*, nothing charged.
7. **Wallet history**: filter today's date, check the running balance against balance after.
8. **Analytics**, **Live driver map**, **Reviews & menus**.

## 3. Tech choices

| Layer | Choice | Why |
|---|---|---|
| Front end | **React 18 + Vite** | Component-based screens, instant dev server, nothing to configure |
| Styling | **Plain CSS** (`styles.css`, `screens.css`) | One small, consistent design system without a UI framework to learn; easy to restyle from the Figma design |
| Charts | **Recharts** | Simple React API for the line/bar charts |
| Map | **Leaflet + react-leaflet + OpenStreetMap tiles** | Free, no API key or billing account (Google Maps / Mapbox need one) |
| Icons | **lucide-react** | Consistent, tree-shaken SVG icons |
| Routing | Tiny hash router (`web/src/router.js`) | Screens and filters survive reloads and can be shared as links, with no extra dependency |
| API | **Node.js + Express** | Same language as the front end; thin layer that only calls the database |
| DB drivers | **`pg`** and the official **`mongodb`** driver | Parameterised queries; procedures are called with `CALL` exactly as in Assignment 1 |
| Tests | **Node's built-in test runner** (`node --test`) | No extra dependencies; tests run against the real seeded database |

The database does the real work, as the assignment asks. The API never re-implements a rule that a procedure, constraint, trigger, view or pipeline already enforces; it only translates database errors into friendly messages.

Everything used is free and open source.

## 4. How each screen is wired to the database

| Screen | Endpoint(s) | Database object(s) |
|---|---|---|
| Browse | `GET /users`, `/restaurants`, `/orders` (+ `/:id`) | tables; `LIMIT/OFFSET` pagination with indexes on `orders(created_at)`, `(status, created_at)`, `(user_id)`, `(restaurant_id)` |
| Place order | `POST /checkout` | `sp_execute_checkout`, `chk_wallet_balance`, `idx_active_user_order`, trigger `wallet_balance_audit` |
| Order status | `PATCH /orders/:id/advance` | `sp_advance_order_status` (new) |
| Wallet history | `GET /users/:id/audit` | `wallet_audit_logs`, index `idx_wallet_audit_user_ts` (new), window `SUM() OVER (ORDER BY timestamp)` |
| Analytics | `GET /analytics/*`, `POST /analytics/refresh` | Workflow 2 window query (`AVG … ROWS BETWEEN 6 PRECEDING`, `DENSE_RANK()`), `restaurant_completed_revenue`, `refresh_restaurant_completed_revenue()` |
| Map | `GET /map/nearby` | `DriverPings` `$geoNear` + `2dsphere` index |
| Reviews & menus | `GET /reviews/analytics`, `/reviews/menus` | `Reviews` `$facet`, `Menus` |

**Loading, empty and error states:**
- Every list shows skeleton rows while loading.
- Every list shows an empty state with a hint when nothing matches.
- Failed requests show an error banner with **Retry**.
- A global banner appears if the API is unreachable, and the sidebar shows the API status.

## 5. Tests

```bash
cd api
npm test
```

There are 14 integration tests in `api/test/transaction.test.js`. They run against the seeded database, because the behaviour under test lives in the database:

| Area | Cases |
|---|---|
| Workflow 1 | success (balance debited, DEBIT audit row from the trigger); second active order blocked (409, wallet and audit unchanged); advance PREPARING → DELIVERING → DELIVERED then re-order succeeds; insufficient balance (422, nothing charged); zero/negative/malformed amounts (400); the procedure itself rejects negatives; unknown restaurant/customer (404) |
| Browse | server-side pagination, page-size cap, search + filter |
| Audit | running balance equals `balance_after` for every row; date range filtering; inclusive end date; inverted range rejected |

We focused the tests on the transaction path because it is where money moves and where the inherited code was broken. The tests place a few real orders for one customer and deliver them afterwards, so the data stays consistent.

We also checked every screen manually in Chrome at 1440 px and 390 px wide (no horizontal page scroll on phones).

## 6. Assumptions

1. **No authentication.** The PDF says real login is not required. Anyone using the app can act as any customer through the "Acting as" picker.
2. **Currency is INR (₹)**, with two decimals, matching `DECIMAL(10,2)`.
3. **Order lifecycle:** PREPARING → DELIVERING → DELIVERED, forward only. There is no cancel state, because the inherited `chk_order_status` only allows these three values.
4. **One active order per customer.** An order is "active" while PREPARING or DELIVERING, as defined by the inherited partial unique index.
5. **Wallet top-ups** exist only in the seed data, as CREDIT rows. The app does not offer a top-up screen because none of the four workflows requires one.
6. **Seed data:**
   - about 20% of customers have one active order, which is their newest
   - each wallet history is a consistent chain: orders are DEBITs, top-ups are CREDITs, and an automatic top-up is added whenever a debit would make the balance negative
7. **Restaurants and drivers share one area** (Hyderabad), so "nearest driver to a restaurant" can return results.
8. **Date filters** on the audit screen use the viewer's local calendar days.
9. **Running balance** is computed with a window function and shown next to the trigger's stored `balance_after`, so the two can be compared. They match on all seed and app-generated data.
10. Assumptions made by the original team are kept and listed in [docs/part_a_README.md](docs/part_a_README.md#7-assumptions).

## 7. Changes to the inherited scripts

Every change is marked `[Team 26]` in the code. The full reasoning and evidence are in [docs/handover_note.md](docs/handover_note.md).

| File | Change | Why |
|---|---|---|
| `sql/01_schema_ddl.sql` | `DROP TABLE … CASCADE` | Re-running failed because the materialized view depends on `orders` |
| `sql/02_indexes.sql` | `CREATE … INDEX IF NOT EXISTS` | Re-runnable |
| `sql/03_triggers_and_audit.sql` | `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER` | Re-runnable |
| `sql/04_stored_procedures.sql` | Removed `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ` | **Every `CALL` failed** with SQLSTATE 25001; the `FOR UPDATE` row lock already protects the wallet |
| `sql/04_stored_procedures.sql` | Reject `amount <= 0` (SQLSTATE 22023); `User does not exist` uses SQLSTATE P0002 | A negative amount **credited** the wallet |
| `sql/07_fixes_transactions.sql` (new) | `sp_advance_order_status`; indexes `idx_wallet_audit_user_ts`, `idx_orders_status_created_at` | Status changes needed by the PDF; audit/browse queries no longer scan the whole table |
| `data_generation/postgres_seeder.py` | Restaurants moved to the driver-ping area; ~20% active orders; consistent wallet chains; `TRUNCATE` before insert; refresh the materialized view after seeding | Map returned 0 drivers; 96.8% of users could not order; audit trail was random; re-seeding doubled the data; the view was empty |

## 8. Project structure

```text
.
├── README.md                 # this file
├── docker-compose.yml
├── docs/
│   ├── handover_note.md      # what we inherited, what was broken, what we changed
│   ├── api_endpoints.md      # API contract
│   ├── design/               # users, wireframes, style guide
│   ├── screenshots/
│   ├── team/                 # work split and per-member PRDs
│   ├── part_a_README.md      # original Assignment 1 README
│   ├── mongo_schema_map.json, relational_erd.png
├── sql/  mongo/  data_generation/  performance/    # Assignment 1 (+ our fixes)
├── api/                      # Express API
│   ├── src/app.js            # routes + error handling (imported by tests)
│   ├── src/server.js         # starts the server
│   ├── src/errors.js         # PostgreSQL error → friendly API error
│   ├── src/routes/           # users, restaurants, orders, checkout | analytics, map, reviews
│   └── test/                 # integration tests
└── web/                      # React + Vite front end
    └── src/
        ├── pages/            # Browse, PlaceOrder, WalletHistory | Analytics, DriverMap, Reviews
        ├── components/       # Sidebar, ActorPicker, RestaurantPicker, AdvanceButton, Panel, StatCard, ui.jsx
        ├── context/          # "Acting as" customer
        ├── services/api.js   # API client
        └── router.js         # hash routing
```

## 9. Team and contributions

Team 26. The allocation sheet lists four members; **Jyotiraditya Kumar is no longer at the college and did not take part**.

| Member | Design | Code | Documentation |
|---|---|---|---|
| **Nisarg Bhojani** | Users, wireframes, Figma design system, visual QA | `TODO` | Design docs, screenshots, demo video |
| **Kodavali Sai** | `TODO` | API + screens: Analytics, Live driver map, Reviews & menus | `TODO` |
| **Mohit Tripathi** | Wireframes for Browse / Place order / Wallet | Inherited-DB fixes (checkout procedure, status procedure, indexes, seeder), API + screens: Browse, Place order, Wallet history, "Acting as" picker, tests | Handover note, API endpoints, README |
| Jyotiraditya Kumar | – | – | – (left the college) |

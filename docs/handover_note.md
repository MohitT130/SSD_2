# Handover Note — inheriting `team10_a1` (BiteStream)

**From:** Team 26 (Nisarg Bhojani, Kodavali Sai, Mohit Tripathi) · **Inherited repo:** https://github.com/sreelasyamuvva/team10_a1 · **Our repo:** https://github.com/MohitT130/SSD_2 (all 27 original commits kept) · **Tested on:** 14 Oct 2026, Windows 11, PostgreSQL 16.14, MongoDB 8.3, Python 3.14

We followed the original README exactly: SQL `01`–`05` → `postgres_seeder.py` → `mongo_seeder.py` → `mongo/01`–`03`, then probed every object the front end depends on.

## What worked

- All SQL scripts (`01`–`05`) and both seeders ran first time on a fresh database: 10,000 users, 500 restaurants, 50,000 orders, 120,000 audit logs; 2 menus, 50,000 reviews, 500,501 driver pings.
- Schema constraints are sound: `chk_wallet_balance`, `chk_order_status`, foreign keys, and the partial unique index `idx_active_user_order` correctly blocks a second PREPARING/DELIVERING order (SQLSTATE `23505`).
- The wallet trigger `wallet_balance_audit` fires on every balance change and writes the correct DEBIT/CREDIT row.
- `refresh_restaurant_completed_revenue()` (`REFRESH … CONCURRENTLY`) works: 500 rows in ~60 ms.
- Workflow 2 (`06_window_analytics.sql`) returns 500 ranked restaurants in ~100 ms; the calendar gap-filling is a nice touch.
- Mongo scripts `01`–`03` run cleanly; `$geoNear` uses `location_2dsphere`, `$facet` returns all three facets.
- The README and the performance evidence are thorough and honest.

## What did not work (verified)

| # | Problem | Evidence | Impact on the UI |
|---|---|---|---|
| 1 | **`sp_execute_checkout` fails on every call.** `SET TRANSACTION ISOLATION LEVEL` is issued after `CALL` has already started the transaction. | `ERROR 25001: SET TRANSACTION ISOLATION LEVEL must be called before any query`, also on a brand-new connection | Workflow 1 is unusable |
| 2 | A negative amount **credits** the wallet (no `amount > 0` check). | With #1 removed, `amount = -1000` → balance +1000, CREDIT audit row | Money can be created |
| 3 | Duplicate active order surfaces as a raw `duplicate key value violates unique constraint` error. | SQLSTATE `23505` | Needs a friendly message |
| 4 | Restaurants are seeded around **Colombo** (lat 6.85–7.05, lng 79.80–80.00), driver pings around **Hyderabad** (lat 17.32–17.48, lng 78.27–78.43). | `$geoNear` from any restaurant → **0 drivers** | "Nearest driver to restaurant" can never return a result |
| 5 | Mongo `Reviews`/`Menus` use **integer** `restaurant_id` (1–100; only 2 menus); PostgreSQL uses UUIDs. | `Menus.restaurant_id ∈ {1, 2}` | Reviews/menu cannot be shown for a real restaurant |
| 6 | All `DriverPings` are timestamped within the last 2 h and the TTL is 2 h. | 19,001 pings deleted within minutes of creating the index | The map is empty about 2 h after seeding |
| 7 | `$geoNear` has `$limit: 1` and pings are not de-duplicated per driver. | 62,770 pings from 7,038 drivers within 5 km | A "sorted list" repeats drivers |
| 8 | 96.8% of users (9,680/10,000) already have an active order. | Seeder status logic | Almost every checkout attempt is blocked |
| 9 | Seeded `wallet_audit_logs` are random and not tied to balances or orders. | Latest `balance_after` = `wallet_balance` for **0/10,000** users; 0/50,000 orders have a matching debit | "Running balance" view is meaningless |
| 10 | The materialized view is created *before* seeding, so it is **empty** until refreshed, and it has no refresh timestamp. | 0 rows after README order | Analytics summary is blank; "last refreshed" is impossible |
| 11 | No way to move an order through PREPARING → DELIVERING → DELIVERED. | No such routine in `public` | Cannot demonstrate the partial unique index |
| 12 | Workflow 2 returns only the latest day per restaurant. | All 500 rows have `order_date = 2026-10-14` | Cannot chart the 7-day moving average over time |
| 13 | No index on `wallet_audit_logs(user_id, timestamp)`. | `Seq Scan on wallet_audit_logs` for one user's history | Audit screen scales poorly |
| 14 | Scripts are not re-runnable and the PG seeder appends. | Re-running `01` → `2BP01` (MV depends on `orders`); `02` → `42P07`; `03` → `42710`; seeding twice → 20,000 users | Painful resets during development |

## What we changed and why

Every change is marked `[Team 26]` in the code and listed in the README change log. "Verified" means it is covered by `api/test/transaction.test.js` or was re-checked against the database.

| Fix | File | Addresses | Status |
|---|---|---|---|
| Remove the misplaced `SET TRANSACTION`; the `SELECT … FOR UPDATE` row lock already serialises concurrent checkouts on one wallet | `sql/04_stored_procedures.sql` | #1 | ✅ Done, verified |
| Reject `p_total_amount <= 0` inside the procedure (SQLSTATE 22023) and in the API | `sql/04_stored_procedures.sql`, `api/src/routes/checkout.js` | #2 | ✅ Done, verified |
| Map SQLSTATE `P0001` / `23505` / `23503` / `P0002` / `55000` to friendly API errors | `api/src/errors.js` | #3 | ✅ Done, verified |
| Restaurants seeded inside the driver-ping area (lat 17.36–17.46, lng 78.33–78.43) | `data_generation/postgres_seeder.py` | #4 | ✅ Done (PostgreSQL side) |
| Seed `Menus`/`Reviews` with PostgreSQL restaurant UUIDs | `data_generation/mongo_seeder.py` | #5 | ⏳ Pending (Sai) |
| Ping simulator so the map is not emptied by the 2-hour TTL | `data_generation/` or `api/` | #6 | ⏳ Pending (Sai) |
| `$geoNear` → one row per driver → sort by distance | `mongo/02_workflow3_geonear.js` + `api/src/routes/map.js` | #7 | ⏳ Pending (Sai) |
| New `sp_advance_order_status(order_id)`; seeder keeps only the newest order of ~20% of users active (2,069 of 10,000) | `sql/07_fixes_transactions.sql`, seeder | #8, #11 | ✅ Done, verified |
| Audit logs generated as a consistent chain per user (orders become DEBITs, plus top-up CREDITs); wallet = end of chain | `data_generation/postgres_seeder.py` | #9 | ✅ Done: 10,000/10,000 wallets match, 0 chain breaks |
| Materialized view refreshed at the end of seeding | `data_generation/postgres_seeder.py` | #10 (empty MV) | ✅ Done |
| "Last refreshed" timestamp stored in the database | `sql/05_materialized_views.sql` | #10 (timestamp) | ⏳ Pending (Sai) |
| Per-restaurant 7-day moving-average series | `sql/06_window_analytics.sql` + `api/src/routes/analytics.js` | #12 | ⏳ Pending (Sai) |
| `idx_wallet_audit_user_ts` on `wallet_audit_logs(user_id, timestamp DESC)` and `idx_orders_status_created_at` | `sql/07_fixes_transactions.sql` | #13 | ✅ Done: audit query now uses an index scan |
| `DROP TABLE … CASCADE`, `CREATE INDEX IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`; seeder `TRUNCATE`s first | `sql/01`–`03`, seeder | #14 | ✅ Done: all scripts re-run cleanly |

## Suggestions for the original authors

1. Test procedures the way a client will call them (a fresh `CALL` from a driver), not only inside an interactive session. Issue #1 would have shown up immediately.
2. Generate cross-database data from one source of truth (shared IDs and one geographic area) so the stores can actually be joined by the service layer.
3. Seed data that respects business invariants (audit trail consistent with balances, realistic share of active orders), not just row counts.
4. Make setup scripts idempotent and document a one-command reset (e.g. `docker-compose`).
5. Validate inputs inside procedures; constraints alone do not stop negative amounts.

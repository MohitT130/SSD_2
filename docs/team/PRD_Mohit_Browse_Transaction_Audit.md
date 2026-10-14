# PRD — Browse, Transaction, Audit (+ project scaffold) · Owner: Mohit Tripathi

**Team repo:** https://github.com/MohitT130/SSD_2 (branch `main`; contains the full `team10_a1` commit history, as the PDF requires) · Team overview: [docs/team/README.md](README.md)

## 1. Goal

Build screens **1–3** of the PDF's Project mapping, end to end: database fixes → API → React screen → tests.

| # | Screen | P1 BiteStream | Workflow |
|---|---|---|---|
| 1 | Browse | users, restaurants, orders | – |
| 2 | Transaction | place order | **Workflow 1** (`sp_execute_checkout`) |
| 3 | Audit | wallet | `wallet_audit_logs` + trigger |

You also own the **shared scaffold**, because Sai and Nisarg build on top of it. Push it first.

Rubric weight on your screens: Workflow Screens (30, shared with Sai), Front-End Quality (15: browsing at scale, loading/empty/error, responsiveness, code organisation).

## 2. Users

- **Customer**: places an order, checks wallet history.
- **Restaurant manager / operations**: browses orders and advances an order's status.

See [docs/design/users.md](../design/users.md).

## 3. Phase 0: scaffold (H0–H1, blocks everyone)

| Item | Detail |
|---|---|
| `api/` | Express app, `GET /api/health`, `pg` Pool and `MongoClient` in `api/src/db/`, central error handler that returns `{ error: { code, message } }`, `.env.example` (`PG*`, `MONGO_URI`, `PORT=4000`), CORS for `localhost:5173` |
| `web/` | Vite + React, Mantine (`@mantine/core`, `hooks`, `dates`, `charts`, `notifications`), TanStack Query, React Router; routes for all 6 pages (empty placeholders for Sai's) |
| `web/src/api/client.js` | `fetch` wrapper that throws an `ApiError` carrying `code` and `message` |
| Shell | `AppShell` with sidebar, burger menu on phone, **ActorPicker** (searchable user select showing wallet balance + "active order" badge), stored in a React context so every screen can read the current actor |
| Root files | `.gitignore` entries for `node_modules/`, `dist/`, `.env`; `npm` scripts `dev`, `test` in both packages |

**Done when** Sai can `git pull`, `npm i`, `npm run dev` and see his empty pages inside the shell.

## 4. Database work (fixes from the handover note)

| # | Change | File | Why |
|---|---|---|---|
| 1 | Remove `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;` from `sp_execute_checkout`. The `SELECT … FOR UPDATE` row lock already serialises concurrent checkouts on one wallet | `sql/04_stored_procedures.sql` | Every `CALL` currently fails with SQLSTATE `25001` (verified) |
| 2 | At the top of the procedure: `IF p_total_amount IS NULL OR p_total_amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero' USING ERRCODE = '22023'; END IF;` | same | A negative amount currently **credits** the wallet (verified) |
| 3 | New `sp_advance_order_status(p_order_id UUID)`: PREPARING → DELIVERING → DELIVERED; raises if already DELIVERED or not found | `sql/07_fixes_transactions.sql` | The PDF requires moving orders through statuses to demonstrate the partial unique index |
| 4 | `CREATE INDEX IF NOT EXISTS idx_wallet_audit_user_ts ON wallet_audit_logs (user_id, timestamp DESC);` | same | The audit query currently does a sequential scan |
| 5 | Seeder: generate each user's audit logs as a **consistent chain** (sorted by time, `balance_after` = previous ± amount, never below 0) and set `users.wallet_balance` to the last `balance_after` | `data_generation/postgres_seeder.py` | Currently 0 of 10,000 users have a consistent trail, so "running balance" would be meaningless |
| 6 | Seeder: only the **newest** order of about 20% of users is active (others DELIVERED) | same | 96.8% of users currently have an active order, so almost every checkout is blocked |
| 7 | Seeder: restaurant coordinates inside the driver-ping area: `lat 17.36–17.46`, `lng 78.33–78.43`. **Sai depends on this** for the Map | same | Restaurants are in Colombo and drivers in Hyderabad, so 0 results today |
| 8 | Seeder: `TRUNCATE … CASCADE` before inserting, so re-running doesn't double the data | same | Seeding twice currently gives 20,000 users |

Run order after your fixes: `sql/01`–`05`, `sql/07_fixes_transactions.sql`, `postgres_seeder.py`, then Sai's Mongo seeder (it reads restaurant IDs from PostgreSQL).

Update the **"What we changed"** rows #1, #2, #8, #9, #11, #13, #14 in [docs/handover_note.md](../handover_note.md) once each fix is done.

## 5. API endpoints you implement

Full contract: [docs/api_endpoints.md](../api_endpoints.md) §1–§4. Keep SQL in the database; the API only calls it.

| Endpoint | Notes |
|---|---|
| `GET /api/users` | `search` (ILIKE on name), `hasActiveOrder`, `page`, `pageSize`; returns `total` for pagination. Never return all rows |
| `GET /api/users/:id` | Includes `active_order` and the last 5 orders |
| `GET /api/restaurants`, `GET /api/restaurants/:id` | **Sai's Analytics and Map selectors use `GET /restaurants?search=`, so ship it early** |
| `GET /api/orders`, `GET /api/orders/:id` | Filters: `userId`, `restaurantId`, `status`; newest first |
| `POST /api/checkout` | Read balance → `CALL sp_execute_checkout($1,$2,$3)` on a pooled client **in autocommit (no `BEGIN`)** → read balance + newest audit row + new order. Map errors as below |
| `PATCH /api/orders/:id/advance` | Calls `sp_advance_order_status` |
| `GET /api/users/:id/audit` | `from`, `to`, `page`, `pageSize`; returns `running_balance` (window `SUM` over signed amounts) next to `balance_after`, plus opening and closing balance for the range |

Error mapping for `/checkout`:

| DB error | HTTP | `code` | Message shown |
|---|---|---|---|
| `P0001` "Insufficient wallet balance" | 422 | `INSUFFICIENT_BALANCE` | "Your wallet has ₹X but this order costs ₹Y. Nothing was charged." |
| `23505` on `idx_active_user_order` | 409 | `ACTIVE_ORDER_EXISTS` | "You already have an order in progress. It must be delivered before you place another." |
| `23503` on `fk_orders_restaurant` | 404 | `RESTAURANT_NOT_FOUND` | "That restaurant no longer exists." |
| `P0001` "User does not exist" | 404 | `USER_NOT_FOUND` | "That user does not exist." |
| `22023` / validation | 400 | `INVALID_AMOUNT` | "Amount must be greater than zero." |

## 6. Screens: requirements and acceptance criteria

### 6.1 Browse (`/browse`, tabs Users / Restaurants / Orders)

PDF: *"List the main entities … with pagination, basic search/filter, and a detail view per record. Do not load all 50,000+ rows into the browser at once."*

- [ ] Three tabs; each is a server-paginated `DataTable` (20 per page, page count from `total`)
- [ ] Users: search by name, filter "has active order", columns name / balance / active-order badge
- [ ] Restaurants: search by name, columns name / lat / lng
- [ ] Orders: filter by status, columns id / customer / restaurant / amount / status / created
- [ ] Clicking a row opens a `DetailDrawer`; the order drawer has an **"Advance status"** button that refreshes the table and the actor badge
- [ ] Search is debounced (300 ms); the page number and filters live in the URL query string (shareable, survives refresh)
- [ ] Skeleton while loading, `EmptyState` for no results, `ErrorState` with retry

### 6.2 Place Order (`/order`): Workflow 1

PDF: *"A form that calls the stored procedure. Show the actor's balance before and after. When the procedure fails (insufficient balance, or a second active order blocked by the partial unique index), show a friendly message. After success, show the new `wallet_audit_logs` entry so it is clear the trigger fired."*

- [ ] Form: customer (defaults to the current actor), restaurant (`SearchSelect` on `/restaurants`), amount (> 0, 2 decimals)
- [ ] Wallet card shows **Before** immediately and **After** once the response arrives, with the difference
- [ ] Success panel shows the new order (id, status PREPARING) **and the new audit row** (DEBIT, amount, balance_after, timestamp), labelled "written by trigger `wallet_balance_audit`"
- [ ] Failure panels for `INSUFFICIENT_BALANCE`, `ACTIVE_ORDER_EXISTS` (with an "Advance that order" button), `INVALID_AMOUNT`, and a generic error. The balance is shown as unchanged
- [ ] A warning before submitting if the selected customer already has an active order
- [ ] The submit button is disabled while the request runs (no double orders)

### 6.3 Wallet History (`/wallet`): Audit

PDF: *"A read-only view of `wallet_audit_logs` for a chosen user, with a date filter and a running balance."*

- [ ] User picker (defaults to the actor) and date-range filter
- [ ] Summary cards: opening balance, total debits, total credits, closing balance for the range
- [ ] Table: time, action (DEBIT red / CREDIT green), amount, balance after, **running balance**; newest first; paginated
- [ ] Read-only: no edit or delete anywhere
- [ ] Empty state "No wallet activity in this date range"

## 7. Tests (PDF Step 4: "for example, the transaction form's success and failure cases")

`api/test/checkout.test.js` (Vitest + Supertest, against the real seeded database):

1. Success → 201, `balanceAfter = balanceBefore − amount`, `auditEntry.action_type = 'DEBIT'`
2. Same user again → 409 `ACTIVE_ORDER_EXISTS`, balance unchanged, no new audit row
3. Advance that order to DELIVERED → checkout again → 201
4. Amount larger than the balance → 422 `INSUFFICIENT_BALANCE`, balance unchanged
5. Amount `-10` → 400 `INVALID_AMOUNT`, balance unchanged
6. `GET /users?page=2&pageSize=20` returns 20 items and `total = 10000`

`web/src/pages/transaction/Transaction.test.jsx` (React Testing Library, mocked API): shows the friendly insufficient-balance message, and shows the audit row on success.

## 8. README sections you write

Setup (fresh clone → running app), **Tech choices with justification**, Tests (how to run), and the repo URL plus the **final commit hash** (the last step before zipping).

## 9. Submission (you build the ZIP)

`26_a1b.zip`, **under 20 MB**, without `node_modules/`, `.venv/`, `dist/`, database dumps or `.env`. Upload once to Moodle; duplicates or wrong names are penalised.

## 10. Timeline

| By | Milestone |
|---|---|
| H1 | Scaffold merged (§3) |
| H2 | DB fixes #1–#8 done and reseeded; `/restaurants` endpoint live for Sai |
| H3 | Browse complete |
| H5 | Place Order complete with all failure states |
| H6 | Wallet History complete; Nisarg's visual QA fixes applied |
| H7 | Tests passing; README setup and tech sections |
| H9 | Final commit hash, ZIP, Moodle upload |

## 11. Viva prep for your area

Be ready to explain:

- why the original procedure failed (`SET TRANSACTION` after the `CALL` snapshot)
- why `FOR UPDATE` is enough
- how a `CHECK` violation becomes a rollback
- how the partial unique index works (`WHERE status IN ('PREPARING','DELIVERING')`)
- the trigger's `WHEN (OLD … IS DISTINCT FROM NEW …)`
- why OFFSET pagination is fine at 50,000 rows

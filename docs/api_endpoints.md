# BiteStream API — Endpoints

Base URL: `http://localhost:4000/api` · JSON in / JSON out · no authentication (the web app's "Acting as" picker chooses the customer and sends their id).

The API is intentionally thin: each workflow is delegated to the database object in the **DB object** column. Code: `api/src/routes/`.

## Conventions

- **Lists are paginated on the server.** `?page=1&pageSize=20` (`pageSize` max 100). The browser never receives more than one page.
  ```json
  { "data": [ ... ], "page": 1, "pageSize": 20, "total": 50000 }
  ```
- **Single records:** `{ "data": { ... } }`.
- **Errors:** non-2xx responses have a human-readable `error` and a machine-readable `code`; some add context fields.
  ```json
  { "error": "The wallet has ₹120.00 but this order costs ₹450.00. Nothing was charged.",
    "code": "INSUFFICIENT_BALANCE", "balanceBefore": "120.00", "balanceAfter": "120.00", "amount": "450.00" }
  ```
- IDs are PostgreSQL UUIDs. Money values are strings with 2 decimals (PostgreSQL `DECIMAL`), e.g. `"1250.00"`.

| `code` | HTTP | Meaning |
|---|---|---|
| `INVALID_ID`, `INVALID_AMOUNT`, `INVALID_STATUS`, `INVALID_DATE`, `INVALID_DATE_RANGE` | 400 | Bad input |
| `USER_NOT_FOUND`, `RESTAURANT_NOT_FOUND`, `ORDER_NOT_FOUND` | 404 | Unknown id |
| `ACTIVE_ORDER_EXISTS`, `ORDER_ALREADY_DELIVERED` | 409 | Conflicts with current state |
| `INSUFFICIENT_BALANCE` | 422 | Wallet cannot cover the order |
| `INTERNAL_ERROR` | 500 | Unexpected error (details in the API log) |

---

## 1. Browse

| Method & path | Query | Returns | DB object |
|---|---|---|---|
| `GET /users` | `search` (name, case-insensitive), `hasActiveOrder` (`true`/`false`), `page`, `pageSize` | paged `{ id, name, wallet_balance, has_active_order }`, sorted by name | `users` + `EXISTS` on `orders` |
| `GET /users/:id` | – | `{ id, name, wallet_balance, has_active_order, active_order \| null, recent_orders[5] }` | `users`, `orders`, `restaurants` |
| `GET /restaurants` | `search`, `page`, `pageSize` | paged `{ id, name, latitude, longitude }` | `restaurants` |
| `GET /restaurants/:id` | – | `{ id, name, latitude, longitude, completed_revenue, completed_order_count, active_orders }` | `restaurants` + materialized view `restaurant_completed_revenue` |
| `GET /orders` | `userId`, `restaurantId`, `status` (`PREPARING`/`DELIVERING`/`DELIVERED`), `page`, `pageSize` | paged `{ id, user_id, user_name, restaurant_id, restaurant_name, total_amount, status, created_at }`, newest first | `orders` (indexes on `user_id`, `restaurant_id`, `created_at`, `(status, created_at)`) |
| `GET /orders/:id` | – | one order with customer and restaurant names | `orders` |

## 2. Transaction — Workflow 1 (place order)

### `POST /checkout`

```json
{ "userId": "uuid", "restaurantId": "uuid", "amount": 450.00 }
```

Reads the wallet balance, runs `CALL sp_execute_checkout($1, $2, $3)` as a **plain autocommit statement** (the procedure issues its own `COMMIT`/`ROLLBACK`, so it must not be wrapped in `BEGIN`), then reads the new balance, the new order and the audit row written during the call.

**201 Created**
```json
{ "data": {
    "balanceBefore": "5000.00",
    "balanceAfter":  "4550.00",
    "order":      { "id": "uuid", "restaurant_name": "Byte Cafe 101", "total_amount": "450.00", "status": "PREPARING", "created_at": "…" },
    "auditEntry": { "id": "uuid", "action_type": "DEBIT", "amount_changed": "450.00", "balance_after": "4550.00", "timestamp": "…" } } }
```

**Failures** (the wallet is unchanged; `balanceBefore` / `balanceAfter` are returned whenever the customer exists):

| HTTP | `code` | Raised by |
|---|---|---|
| 422 | `INSUFFICIENT_BALANCE` | procedure: `chk_wallet_balance` violated → `ROLLBACK` → `'Insufficient wallet balance'` (P0001) |
| 409 | `ACTIVE_ORDER_EXISTS` | SQLSTATE `23505` on the partial unique index `idx_active_user_order` |
| 404 | `RESTAURANT_NOT_FOUND` | SQLSTATE `23503` on `fk_orders_restaurant` |
| 404 | `USER_NOT_FOUND` | API pre-check / procedure `'User does not exist'` (P0002) |
| 400 | `INVALID_AMOUNT` | API validation (≤ 0, not a number, > 2 decimals) and the procedure's own guard (22023) |

## 3. Order status (demonstrates the partial unique index)

| Method & path | Returns | DB object |
|---|---|---|
| `PATCH /orders/:id/advance` | `{ data: { id, previous_status, status } }`: PREPARING → DELIVERING → DELIVERED. 409 `ORDER_ALREADY_DELIVERED` when already final, 404 `ORDER_NOT_FOUND` | `CALL sp_advance_order_status($1)` (`sql/07_fixes_transactions.sql`) |

## 4. Audit trail

| Method & path | Query | Returns | DB object |
|---|---|---|---|
| `GET /users/:id/audit` | `from`, `to`: a date `YYYY-MM-DD` (`to` inclusive) **or** an ISO timestamp (`to` exclusive; the web app sends the viewer's local midnights); `page`, `pageSize` | paged `{ id, timestamp, action_type, amount_changed, balance_after, running_balance }` newest first, plus `user` and `summary { entries, total_debits, total_credits, opening_balance, closing_balance }` | `wallet_audit_logs` (index `idx_wallet_audit_user_ts`). `running_balance` = opening balance + `SUM(signed amount) OVER (ORDER BY timestamp)` |

---

## 5. Analytics — Workflow 2 + materialized view (`api/src/routes/analytics.js`)

| Method & path | Returns | DB object |
|---|---|---|
| `GET /analytics/moving-average` | `{ data: [ { revenue_date, moving_average_7_day } ] }` | Workflow 2 window query (`sql/06_window_analytics.sql`) |
| `GET /analytics/rankings` | `{ data: [ { restaurant_id, restaurant_name, order_date, daily_revenue, moving_average_7_day, revenue_rank } ] }` | Workflow 2 query with `DENSE_RANK()` |
| `GET /analytics/summary` | `{ data: { total_revenue, orders_processed, restaurants, average_order_value, last_refreshed } }` | `restaurant_completed_revenue` |
| `POST /analytics/refresh` | `{ success, lastRefreshed }` | `CALL refresh_restaurant_completed_revenue()` (`REFRESH … CONCURRENTLY`) |

## 6. Map — Workflow 3 (`api/src/routes/map.js`)

| Method & path | Query | Returns | DB object |
|---|---|---|---|
| `GET /map/nearby` | `lat`, `lng`, `radiusKm` (≤ 5) | `{ origin, radiusKm, data: [ { driver_id, active, location, distanceMeters, created_at } ] }` sorted by distance | MongoDB `DriverPings` `$geoNear` (`2dsphere`), `query: { active: true }` |

The web app polls this every 10 s so new pings appear without a page reload.

## 7. Reviews + catalog — Workflow 4 (`api/src/routes/reviews.js`)

| Method & path | Returns | DB object |
|---|---|---|
| `GET /reviews/analytics` | `{ data: { averageRating, totalReviews, distribution[], topTags[], restaurants[] } }` | MongoDB `Reviews` `$facet` |
| `GET /reviews/menus` | `{ data: [ menu documents ] }` | MongoDB `Menus` |

## 8. Misc

| Method & path | Returns |
|---|---|
| `GET /health` | `{ status: "ok", mode: "database" \| "demo" }`, polled by the sidebar's "API connected" indicator |

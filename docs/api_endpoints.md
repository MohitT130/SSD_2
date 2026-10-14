# BiteStream API — Endpoint Sketch

Base URL: `http://localhost:4000/api` · JSON in / JSON out · no auth (actor is chosen in the UI and sent as a parameter).

The API layer is intentionally thin: every workflow is delegated to the database object listed in the **DB object** column.

## Conventions

- **Pagination:** `?page=1&pageSize=20` (max `pageSize` 100). List responses:
  ```json
  { "items": [ ... ], "page": 1, "pageSize": 20, "total": 50000 }
  ```
- **Errors:** non-2xx responses always have the shape
  ```json
  { "error": { "code": "INSUFFICIENT_BALANCE", "message": "Human-readable explanation" } }
  ```
- IDs are PostgreSQL UUIDs (strings). Money values are strings with 2 decimals (from `DECIMAL`), e.g. `"1250.00"`.

---

## 1. Browse

| Method & path | Query / body | Returns | DB object |
|---|---|---|---|
| `GET /users` | `search` (name, ILIKE), `hasActiveOrder` (`true`/`false`), `page`, `pageSize` | paged `{ id, name, wallet_balance, has_active_order }` | `users` + `EXISTS` on `orders` (uses `idx_active_user_order`) |
| `GET /users/:id` | – | `{ id, name, wallet_balance, active_order: {…} \| null, recent_orders: [ … ] }` | `users`, `orders` |
| `GET /restaurants` | `search`, `page`, `pageSize` | paged `{ id, name, latitude, longitude }` | `restaurants` |
| `GET /restaurants/:id` | – | `{ id, name, latitude, longitude, completed_revenue, completed_order_count }` | `restaurants` + `restaurant_completed_revenue` |
| `GET /orders` | `userId`, `restaurantId`, `status` (`PREPARING`/`DELIVERING`/`DELIVERED`), `page`, `pageSize` | paged `{ id, user_id, user_name, restaurant_id, restaurant_name, total_amount, status, created_at }`, newest first | `orders` (indexes on `user_id`, `restaurant_id`, `created_at`) |
| `GET /orders/:id` | – | single order with user + restaurant names | `orders` |

## 2. Transaction — Workflow 1 (place order)

### `POST /checkout`

Body:
```json
{ "userId": "uuid", "restaurantId": "uuid", "amount": 450.00 }
```

The API reads the balance, runs `CALL sp_execute_checkout($1,$2,$3)` as a **top-level autocommit statement** (the procedure issues its own `COMMIT`/`ROLLBACK`, so it must not be wrapped in `BEGIN`), then reads the balance and the newest `wallet_audit_logs` row.

**201 Created**
```json
{
  "balanceBefore": "5000.00",
  "balanceAfter":  "4550.00",
  "order":      { "id": "uuid", "status": "PREPARING", "total_amount": "450.00", "created_at": "…" },
  "auditEntry": { "id": "uuid", "action_type": "DEBIT", "amount_changed": "450.00", "balance_after": "4550.00", "timestamp": "…" }
}
```

**Failures** (balance is re-read and returned so the UI can show it did not change):

| HTTP | `error.code` | Cause in DB | Friendly message |
|---|---|---|---|
| 422 | `INSUFFICIENT_BALANCE` | procedure raises `'Insufficient wallet balance'` (from `chk_wallet_balance`) | "Your wallet has ₹X but this order costs ₹Y." |
| 409 | `ACTIVE_ORDER_EXISTS` | SQLSTATE `23505` on `idx_active_user_order` | "You already have an order that is PREPARING/DELIVERING. Wait for it to be delivered before placing another." |
| 404 | `USER_NOT_FOUND` | procedure raises `'User does not exist'` | "That user does not exist." |
| 404 | `RESTAURANT_NOT_FOUND` | SQLSTATE `23503` on `fk_orders_restaurant` | "That restaurant does not exist." |
| 400 | `INVALID_AMOUNT` | validation (amount ≤ 0 or not a number) | "Amount must be greater than zero." |

## 3. Order status (needed to demonstrate the partial unique index)

| Method & path | Body | Returns | DB object |
|---|---|---|---|
| `PATCH /orders/:id/advance` | – | `{ id, previous_status, status }` — `PREPARING → DELIVERING → DELIVERED`; 409 `ALREADY_DELIVERED` if already final | new procedure `sp_advance_order_status(uuid)` (added by us, see handover note) |

## 4. Audit trail

| Method & path | Query | Returns | DB object |
|---|---|---|---|
| `GET /users/:id/audit` | `from`, `to` (ISO dates, optional), `page`, `pageSize` | paged `{ id, timestamp, action_type, amount_changed, balance_after, running_balance }`, newest first, plus `openingBalance` / `closingBalance` for the filtered range | `wallet_audit_logs` (new index on `(user_id, timestamp)`); `running_balance` computed with a `SUM(...) OVER (ORDER BY timestamp)` window |

## 5. Analytics — Workflow 2 + materialized view

| Method & path | Query / body | Returns | DB object |
|---|---|---|---|
| `GET /analytics/moving-average` | `restaurantId` (required) | `[ { order_date, daily_revenue, moving_average_7_day } ]` for the whole date range | Workflow 2 window query, wrapped as function `fn_restaurant_moving_average(uuid)` |
| `GET /analytics/rankings` | `page`, `pageSize` | paged `{ revenue_rank, restaurant_id, restaurant_name, order_date, daily_revenue, moving_average_7_day }` | Workflow 2 final query (`DENSE_RANK()`), wrapped as view `v_restaurant_revenue_rank` |
| `GET /analytics/summary` | – | `{ total_completed_revenue, total_completed_orders, restaurants, avg_revenue_per_restaurant, top_restaurants: [top 5], refreshed_at }` | `restaurant_completed_revenue` (MV) |
| `POST /analytics/refresh` | – | `{ refreshed_at, duration_ms }` | `CALL refresh_restaurant_completed_revenue()` (`REFRESH … CONCURRENTLY`) |

## 6. Map — Workflow 3 (nearest driver to restaurant)

| Method & path | Query | Returns | DB object |
|---|---|---|---|
| `GET /map/nearest-drivers` | **either** `restaurantId` (origin coordinates looked up in PostgreSQL) **or** `lng` + `lat`; `radius` (m, default 5000); `limit` (default 20) | `{ origin: {lng, lat}, radius, drivers: [ { driver_id, location: {lng, lat}, distance_m, created_at } ] }` sorted by distance | MongoDB `DriverPings` `$geoNear` (`2dsphere` index), `query: { active: true }`, grouped to one row per driver |

The UI polls this endpoint every 5 s (TanStack Query `refetchInterval`) so new pings appear without a page reload.

| `POST /map/simulate-pings` | body `{ count: 20 }` (optional, demo only) | `{ inserted }` | inserts fresh `DriverPings` near the origin (TTL index expires pings after 2 h) |
|---|---|---|---|

## 7. Reviews + catalog — Workflow 4

| Method & path | Query | Returns | DB object |
|---|---|---|---|
| `GET /reviews/facets` | `restaurantId` (optional; omitted = all reviews) | `{ rating_distribution: [ {rating, count} ], most_frequent_tags: [ {tag, count} ], overall_average_rating }` | MongoDB `Reviews` `$facet` pipeline (optional `$match` on `restaurant_id` before `$project`) |
| `GET /reviews` | `restaurantId`, `page`, `pageSize` | paged review documents, newest first | `Reviews` |
| `GET /menus/:restaurantId` | – | the menu document (`categories[] → items[] → customization_addons[]`), 404 `MENU_NOT_FOUND` if none | `Menus` |

## 8. Misc

| Method & path | Returns |
|---|---|
| `GET /health` | `{ postgres: "ok", mongo: "ok" }` (used by the UI banner and docker-compose healthcheck) |

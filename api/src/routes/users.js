import { Router } from 'express';
import { getPgPool } from '../db.js';
import { ApiError, requireUuid } from '../errors.js';
import { paged, readPage } from '../pagination.js';

const router = Router();

const ACTIVE_ORDER = `EXISTS (
  SELECT 1 FROM orders o
  WHERE o.user_id = u.id AND o.status IN ('PREPARING', 'DELIVERING')
)`;

// GET /api/users?search=&hasActiveOrder=true|false&page=&pageSize=
router.get('/', async (req, res, next) => {
  try {
    const p = readPage(req.query);
    const search = req.query.search?.trim() || null;
    const hasActive = req.query.hasActiveOrder === 'true' ? true : req.query.hasActiveOrder === 'false' ? false : null;

    const where = `
      WHERE ($1::text IS NULL OR u.name ILIKE '%' || $1 || '%')
        AND ($2::boolean IS NULL OR ${ACTIVE_ORDER} = $2)`;

    const [rows, count] = await Promise.all([
      getPgPool().query(
        `SELECT u.id, u.name, u.wallet_balance, ${ACTIVE_ORDER} AS has_active_order
         FROM users u ${where}
         ORDER BY u.name, u.id
         LIMIT $3 OFFSET $4`,
        [search, hasActive, p.pageSize, p.offset]
      ),
      getPgPool().query(`SELECT count(*) FROM users u ${where}`, [search, hasActive]),
    ]);

    res.json(paged(rows.rows, count.rows[0].count, p));
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:id — profile, current active order and the 5 latest orders
router.get('/:id', async (req, res, next) => {
  try {
    const id = requireUuid(req.params.id, 'User id');
    const pool = getPgPool();

    const user = await pool.query('SELECT id, name, wallet_balance FROM users WHERE id = $1', [id]);
    if (!user.rowCount) throw new ApiError(404, 'USER_NOT_FOUND', 'That customer does not exist.');

    const orders = await pool.query(
      `SELECT o.id, o.restaurant_id, r.name AS restaurant_name, o.total_amount, o.status, o.created_at
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [id]
    );

    const active = await pool.query(
      `SELECT o.id, o.restaurant_id, r.name AS restaurant_name, o.total_amount, o.status, o.created_at
       FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.user_id = $1 AND o.status IN ('PREPARING', 'DELIVERING')`,
      [id]
    );

    res.json({
      data: {
        ...user.rows[0],
        has_active_order: active.rowCount > 0,
        active_order: active.rows[0] ?? null,
        recent_orders: orders.rows,
      },
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/users/:id/audit?from=&to=&page=&pageSize=
//
// `from` / `to` are either dates (YYYY-MM-DD, `to` inclusive, interpreted in
// the database time zone) or ISO timestamps (exact instants, `to` exclusive).
// The web client sends the browser's local midnights as ISO timestamps.
//
// Read-only wallet history. `running_balance` is computed by a window function
// (opening balance + running SUM of signed amounts) and is shown next to the
// stored `balance_after` written by the wallet_balance_audit trigger.
router.get('/:id/audit', async (req, res, next) => {
  try {
    const id = requireUuid(req.params.id, 'User id');
    const p = readPage(req.query);
    const from = parseBound(req.query.from, 'from', false);
    const to = parseBound(req.query.to, 'to', true);

    if (from && to && Date.parse(from) >= Date.parse(to)) {
      throw new ApiError(400, 'INVALID_DATE_RANGE', 'The "from" date must be on or before the "to" date.');
    }

    const pool = getPgPool();
    const user = await pool.query('SELECT id, name, wallet_balance FROM users WHERE id = $1', [id]);
    if (!user.rowCount) throw new ApiError(404, 'USER_NOT_FOUND', 'That customer does not exist.');

    const filtered = `
      filtered AS (
        SELECT id, timestamp, action_type, amount_changed, balance_after,
               CASE action_type WHEN 'DEBIT' THEN -amount_changed ELSE amount_changed END AS signed_amount
        FROM wallet_audit_logs
        WHERE user_id = $1
          AND ($2::timestamptz IS NULL OR timestamp >= $2::timestamptz)
          AND ($3::timestamptz IS NULL OR timestamp < $3::timestamptz)
      )`;

    const [rows, summary] = await Promise.all([
      pool.query(
        `WITH ${filtered},
         with_running AS (
           SELECT *,
                  FIRST_VALUE(balance_after - signed_amount) OVER w
                    + SUM(signed_amount) OVER (w ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)
                    AS running_balance
           FROM filtered
           WINDOW w AS (ORDER BY timestamp, id)
         )
         SELECT id, timestamp, action_type, amount_changed, balance_after, running_balance
         FROM with_running
         ORDER BY timestamp DESC, id DESC
         LIMIT $4 OFFSET $5`,
        [id, from, to, p.pageSize, p.offset]
      ),
      pool.query(
        `WITH ${filtered}
         SELECT count(*) AS entries,
                COALESCE(SUM(amount_changed) FILTER (WHERE action_type = 'DEBIT'), 0) AS total_debits,
                COALESCE(SUM(amount_changed) FILTER (WHERE action_type = 'CREDIT'), 0) AS total_credits,
                (ARRAY_AGG(balance_after - signed_amount ORDER BY timestamp, id))[1] AS opening_balance,
                (ARRAY_AGG(balance_after ORDER BY timestamp DESC, id DESC))[1] AS closing_balance
         FROM filtered`,
        [id, from, to]
      ),
    ]);

    res.json({
      ...paged(rows.rows, summary.rows[0].entries, p),
      user: user.rows[0],
      summary: summary.rows[0],
    });
  } catch (e) {
    next(e);
  }
});

// Returns a value PostgreSQL can cast to timestamptz. An inclusive end date
// (YYYY-MM-DD) becomes the start of the following day so the SQL can use `<`.
function parseBound(value, label, isEnd) {
  if (value === undefined || value === '') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) {
    if (!isEnd) return value;
    const next = new Date(`${value}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))) {
    return value;
  }

  throw new ApiError(400, 'INVALID_DATE', `"${label}" must be a date like 2026-10-14 or an ISO timestamp.`);
}

export default router;

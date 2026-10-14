import { Router } from 'express';
import { getPgPool } from '../db.js';
import { ApiError, fromPgError, requireUuid } from '../errors.js';

const router = Router();

// POST /api/checkout  { userId, restaurantId, amount }
//
// Workflow 1. All business rules live in the database:
//   * sp_execute_checkout locks the wallet, debits it and inserts the order;
//   * chk_wallet_balance rejects an insufficient balance;
//   * idx_active_user_order (partial unique index) rejects a second active order;
//   * the wallet_balance_audit trigger writes the wallet_audit_logs row.
//
// The procedure issues its own COMMIT/ROLLBACK, so it is run as a plain
// autocommit CALL (pool.query), never inside BEGIN ... COMMIT.
router.post('/', async (req, res, next) => {
  const pool = getPgPool();
  let balanceBefore;
  let amount;

  try {
    const userId = requireUuid(req.body?.userId, 'Customer');
    const restaurantId = requireUuid(req.body?.restaurantId, 'Restaurant');
    amount = parseAmount(req.body?.amount);

    const before = await pool.query('SELECT wallet_balance FROM users WHERE id = $1', [userId]);
    if (!before.rowCount) throw new ApiError(404, 'USER_NOT_FOUND', 'That customer does not exist.');
    balanceBefore = before.rows[0].wallet_balance;

    const startedAt = await pool.query('SELECT clock_timestamp() AS now');

    await pool.query('CALL sp_execute_checkout($1, $2, $3)', [userId, restaurantId, amount]);

    const [after, order, audit] = await Promise.all([
      pool.query('SELECT wallet_balance FROM users WHERE id = $1', [userId]),
      // The new order is the customer's only active order (partial unique index).
      pool.query(
        `SELECT o.id, o.restaurant_id, r.name AS restaurant_name, o.total_amount, o.status, o.created_at
         FROM orders o JOIN restaurants r ON r.id = o.restaurant_id
         WHERE o.user_id = $1 AND o.status IN ('PREPARING', 'DELIVERING')`,
        [userId]
      ),
      // The row written by the wallet_balance_audit trigger during this call.
      pool.query(
        `SELECT id, user_id, action_type, amount_changed, balance_after, timestamp
         FROM wallet_audit_logs
         WHERE user_id = $1 AND timestamp >= $2
         ORDER BY timestamp DESC
         LIMIT 1`,
        [userId, startedAt.rows[0].now]
      ),
    ]);

    res.status(201).json({
      data: {
        balanceBefore,
        balanceAfter: after.rows[0].wallet_balance,
        order: order.rows[0] ?? null,
        auditEntry: audit.rows[0] ?? null,
      },
    });
  } catch (e) {
    const error = e instanceof ApiError ? e : fromPgError(e);

    if (error instanceof ApiError && balanceBefore !== undefined) {
      // The procedure rolled back, so the balance is unchanged; return it so the
      // screen can show "before = after".
      error.details = { balanceBefore, balanceAfter: balanceBefore, amount: amount?.toFixed(2) };

      if (error.code === 'INSUFFICIENT_BALANCE') {
        error.message = `The wallet has ₹${formatInr(balanceBefore)} but this order costs ₹${formatInr(amount)}. Nothing was charged.`;
      }
    }

    next(error);
  }
});

function parseAmount(value) {
  const amount = typeof value === 'string' ? Number(value.trim()) : value;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Amount must be greater than zero.');
  }
  if (Math.round(amount * 100) !== amount * 100) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Amount can have at most two decimal places.');
  }
  if (amount >= 1e8) {
    throw new ApiError(400, 'INVALID_AMOUNT', 'Amount is too large.');
  }
  return amount;
}

function formatInr(value) {
  return Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default router;

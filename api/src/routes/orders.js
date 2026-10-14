import { Router } from 'express';
import { getPgPool } from '../db.js';
import { ApiError, fromPgError, requireUuid } from '../errors.js';
import { paged, readPage } from '../pagination.js';

const router = Router();

const STATUSES = ['PREPARING', 'DELIVERING', 'DELIVERED'];

const ORDER_COLUMNS = `
  o.id, o.user_id, u.name AS user_name, o.restaurant_id, r.name AS restaurant_name,
  o.total_amount, o.status, o.created_at`;

// GET /api/orders?userId=&restaurantId=&status=&page=&pageSize=  (newest first)
router.get('/', async (req, res, next) => {
  try {
    const p = readPage(req.query);
    const userId = req.query.userId ? requireUuid(req.query.userId, 'User id') : null;
    const restaurantId = req.query.restaurantId ? requireUuid(req.query.restaurantId, 'Restaurant id') : null;
    const status = req.query.status || null;

    if (status && !STATUSES.includes(status)) {
      throw new ApiError(400, 'INVALID_STATUS', `Status must be one of ${STATUSES.join(', ')}.`);
    }

    const where = `
      WHERE ($1::uuid IS NULL OR o.user_id = $1)
        AND ($2::uuid IS NULL OR o.restaurant_id = $2)
        AND ($3::text IS NULL OR o.status = $3)`;

    const [rows, count] = await Promise.all([
      getPgPool().query(
        `SELECT ${ORDER_COLUMNS}
         FROM orders o
         JOIN users u ON u.id = o.user_id
         JOIN restaurants r ON r.id = o.restaurant_id
         ${where}
         ORDER BY o.created_at DESC, o.id
         LIMIT $4 OFFSET $5`,
        [userId, restaurantId, status, p.pageSize, p.offset]
      ),
      getPgPool().query(`SELECT count(*) FROM orders o ${where}`, [userId, restaurantId, status]),
    ]);

    res.json(paged(rows.rows, count.rows[0].count, p));
  } catch (e) {
    next(e);
  }
});

// GET /api/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = requireUuid(req.params.id, 'Order id');
    const result = await getPgPool().query(
      `SELECT ${ORDER_COLUMNS}
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN restaurants r ON r.id = o.restaurant_id
       WHERE o.id = $1`,
      [id]
    );

    if (!result.rowCount) throw new ApiError(404, 'ORDER_NOT_FOUND', 'That order does not exist.');
    res.json({ data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

// PATCH /api/orders/:id/advance — PREPARING -> DELIVERING -> DELIVERED
// Delegates to sp_advance_order_status (sql/07_fixes_transactions.sql).
router.patch('/:id/advance', async (req, res, next) => {
  try {
    const id = requireUuid(req.params.id, 'Order id');
    const result = await getPgPool().query('CALL sp_advance_order_status($1)', [id]);
    const { previous_status, new_status } = result.rows[0];

    res.json({ data: { id, previous_status, status: new_status } });
  } catch (e) {
    next(fromPgError(e));
  }
});

export default router;

import { Router } from 'express';
import { getPgPool } from '../db.js';
import { ApiError, requireUuid } from '../errors.js';
import { paged, readPage } from '../pagination.js';

const router = Router();

// GET /api/restaurants?search=&page=&pageSize=
router.get('/', async (req, res, next) => {
  try {
    const p = readPage(req.query);
    const search = req.query.search?.trim() || null;
    const where = `WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%')`;

    const [rows, count] = await Promise.all([
      getPgPool().query(
        `SELECT id, name, latitude, longitude
         FROM restaurants ${where}
         ORDER BY name, id
         LIMIT $2 OFFSET $3`,
        [search, p.pageSize, p.offset]
      ),
      getPgPool().query(`SELECT count(*) FROM restaurants ${where}`, [search]),
    ]);

    res.json(paged(rows.rows, count.rows[0].count, p));
  } catch (e) {
    next(e);
  }
});

// GET /api/restaurants/:id — with completed revenue from the materialized view
router.get('/:id', async (req, res, next) => {
  try {
    const id = requireUuid(req.params.id, 'Restaurant id');

    const result = await getPgPool().query(
      `SELECT r.id, r.name, r.latitude, r.longitude,
              mv.completed_revenue, mv.completed_order_count,
              (SELECT count(*) FROM orders o
               WHERE o.restaurant_id = r.id AND o.status IN ('PREPARING', 'DELIVERING')) AS active_orders
       FROM restaurants r
       LEFT JOIN restaurant_completed_revenue mv ON mv.restaurant_id = r.id
       WHERE r.id = $1`,
      [id]
    );

    if (!result.rowCount) throw new ApiError(404, 'RESTAURANT_NOT_FOUND', 'That restaurant does not exist.');
    res.json({ data: result.rows[0] });
  } catch (e) {
    next(e);
  }
});

export default router;

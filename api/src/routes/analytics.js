import { Router } from 'express';
import { getPgPool } from '../db.js';
import { ApiError, requireUuid } from '../errors.js';
import { paged, readPage } from '../pagination.js';

const router = Router();

// Workflow 2 (sql/06_window_analytics.sql), steps 1-4: daily revenue from
// DELIVERED orders, a gap-free calendar per restaurant, and the 7-day moving
// average (ROWS BETWEEN 6 PRECEDING AND CURRENT ROW). `forOneRestaurant`
// limits the calendar and the orders to restaurant $1, which gives the same
// numbers for that restaurant because the window is PARTITION BY restaurant_id.
const stepsOneToFour = (forOneRestaurant) => `
daily_revenue AS (
    SELECT
        o.restaurant_id,
        o.created_at::date AS order_date,
        SUM(o.total_amount) AS daily_revenue
    FROM orders AS o
    WHERE o.status = 'DELIVERED'
      ${forOneRestaurant ? 'AND o.restaurant_id = $1' : ''}
    GROUP BY o.restaurant_id, o.created_at::date
),
restaurant_calendar AS (
    SELECT
        r.id AS restaurant_id,
        r.name AS restaurant_name,
        calendar_day::date AS order_date
    FROM restaurants AS r
    CROSS JOIN LATERAL generate_series(
        (SELECT MIN(created_at::date) FROM orders),
        (SELECT MAX(created_at::date) FROM orders),
        INTERVAL '1 day'
    ) AS calendar_day
    ${forOneRestaurant ? 'WHERE r.id = $1' : ''}
),
daily_revenue_complete AS (
    SELECT
        rc.restaurant_id,
        rc.restaurant_name,
        rc.order_date,
        COALESCE(dr.daily_revenue, 0)::DECIMAL(12,2) AS daily_revenue
    FROM restaurant_calendar AS rc
    LEFT JOIN daily_revenue AS dr
        ON dr.restaurant_id = rc.restaurant_id
        AND dr.order_date = rc.order_date
),
moving_average AS (
    SELECT
        restaurant_id,
        restaurant_name,
        order_date,
        daily_revenue,
        AVG(daily_revenue) OVER (
            PARTITION BY restaurant_id
            ORDER BY order_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        )::DECIMAL(12,2) AS moving_average_7_day
    FROM daily_revenue_complete
)`;

// The complete Workflow 2 query (steps 5-6 rank each restaurant's latest
// 7-day average with DENSE_RANK), unchanged from sql/06.
const rankingQuery = `
WITH ${stepsOneToFour(false)},
latest_metrics AS (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY restaurant_id
            ORDER BY order_date DESC
        ) AS latest_row
    FROM moving_average
),
ranked_restaurants AS (
    SELECT
        restaurant_id,
        restaurant_name,
        order_date,
        daily_revenue,
        moving_average_7_day,
        DENSE_RANK() OVER (
            ORDER BY moving_average_7_day DESC
        ) AS revenue_rank
    FROM latest_metrics
    WHERE latest_row = 1
)
SELECT restaurant_id, restaurant_name, order_date, daily_revenue, moving_average_7_day, revenue_rank
FROM ranked_restaurants`;

const CHART_DAYS = 30;

// GET /api/analytics/moving-average?restaurantId=<uuid>
// The last 30 days of one restaurant. The 30-day cut is applied after the
// window function, so the first day shown still averages over 7 days.
router.get('/moving-average', async (req, res, next) => {
  try {
    const id = requireUuid(req.query.restaurantId, 'Restaurant id');
    const pool = getPgPool();

    const restaurant = await pool.query('SELECT id, name FROM restaurants WHERE id = $1', [id]);
    if (!restaurant.rowCount) throw new ApiError(404, 'RESTAURANT_NOT_FOUND', 'That restaurant does not exist.');

    const result = await pool.query(
      `WITH ${stepsOneToFour(true)}
       SELECT order_date::text AS order_date, daily_revenue, moving_average_7_day
       FROM moving_average
       WHERE order_date > (SELECT MAX(order_date) FROM moving_average) - $2::int
       ORDER BY order_date`,
      [id, CHART_DAYS]
    );

    res.json({ data: result.rows, restaurant: restaurant.rows[0] });
  } catch (e) {
    next(e);
  }
});

// GET /api/analytics/rankings?page=&pageSize=   (DENSE_RANK, paginated)
router.get('/rankings', async (req, res, next) => {
  try {
    const p = readPage(req.query);
    const result = await getPgPool().query(
      `SELECT restaurant_id, restaurant_name, order_date::text AS order_date,
              daily_revenue, moving_average_7_day, revenue_rank,
              count(*) OVER () AS total
       FROM (${rankingQuery}) ranked
       ORDER BY revenue_rank, restaurant_name, restaurant_id
       LIMIT $1 OFFSET $2`,
      [p.pageSize, p.offset]
    );

    const total = result.rows[0]?.total ?? 0;
    res.json(paged(result.rows.map(({ total: _t, ...row }) => row), total, p));
  } catch (e) {
    next(e);
  }
});

// GET /api/analytics/summary   (from the materialized view)
router.get('/summary', async (_req, res, next) => {
  try {
    const result = await getPgPool().query(`
      SELECT
        COALESCE(SUM(completed_revenue), 0) AS total_revenue,
        COALESCE(SUM(completed_order_count), 0) AS orders_processed,
        COUNT(*) AS restaurants,
        MAX(refreshed_at) AS refreshed_at
      FROM restaurant_completed_revenue
    `);

    const summary = result.rows[0];
    const revenue = Number(summary.total_revenue);
    const orders = Number(summary.orders_processed);

    res.json({ data: { ...summary, average_order_value: orders ? revenue / orders : 0 } });
  } catch (e) {
    next(e);
  }
});

// POST /api/analytics/refresh   (REFRESH MATERIALIZED VIEW CONCURRENTLY)
router.post('/refresh', async (_req, res, next) => {
  try {
    const pool = getPgPool();
    const started = performance.now();
    await pool.query('CALL refresh_restaurant_completed_revenue()');
    const durationMs = Math.round(performance.now() - started);

    const result = await pool.query('SELECT MAX(refreshed_at) AS refreshed_at FROM restaurant_completed_revenue');
    res.json({ data: { refreshed_at: result.rows[0].refreshed_at, duration_ms: durationMs } });
  } catch (e) {
    next(e);
  }
});

export default router;

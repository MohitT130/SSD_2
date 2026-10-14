import { Router } from 'express';
import { getPgPool } from '../db.js';

const router = Router();

const movingAverageQuery = `
WITH daily_revenue AS (
    SELECT
        o.restaurant_id,
        o.created_at::date AS order_date,
        SUM(o.total_amount) AS daily_revenue
    FROM orders AS o
    WHERE o.status = 'DELIVERED'
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
),
daily_revenue_complete AS (
    SELECT
        rc.restaurant_id,
        rc.restaurant_name,
        rc.order_date,
        COALESCE(dr.daily_revenue, 0)::DECIMAL(12,2)
            AS daily_revenue
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
),
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
SELECT
    restaurant_id,
    restaurant_name,
    order_date,
    daily_revenue,
    moving_average_7_day,
    revenue_rank
FROM ranked_restaurants
ORDER BY revenue_rank, restaurant_name
`;

router.get('/moving-average', async (req, res, next) => {
    try {
        const result = await getPgPool().query(`
            WITH analytics AS (${movingAverageQuery.replace(/;\\s*$/, '')})
            SELECT order_date AS revenue_date,
                   AVG(moving_average_7_day)::DECIMAL(12,2)
                       AS moving_average_7_day
            FROM analytics
            GROUP BY order_date
            ORDER BY order_date
        `);
        res.json({ data: result.rows, source: 'postgres' });
    } catch (e) {
        next(e);
    }
});

router.get('/rankings', async (req, res, next) => {
    try {
        const result = await getPgPool().query(movingAverageQuery);
        res.json({ data: result.rows, source: 'postgres' });
    } catch (e) {
        next(e);
    }
});

router.get('/summary', async (req, res, next) => {
    try {
        const result = await getPgPool().query(`
            SELECT
                COALESCE(SUM(completed_revenue), 0) AS total_revenue,
                COALESCE(SUM(completed_order_count), 0) AS orders_processed,
                COUNT(*) AS restaurants
            FROM restaurant_completed_revenue
        `);

        const summary = result.rows[0];
        const revenue = Number(summary.total_revenue);
        const orders = Number(summary.orders_processed);

        res.json({
            data: {
                ...summary,
                average_order_value: orders ? revenue / orders : 0,
                last_refreshed: null
            },
            source: 'postgres'
        });
    } catch (e) {
        next(e);
    }
});

router.post('/refresh', async (req, res, next) => {
    try {
        await getPgPool().query(
            'CALL refresh_restaurant_completed_revenue()'
        );
        res.json({
            success: true,
            lastRefreshed: new Date().toISOString(),
            source: 'postgres'
        });
    } catch (e) {
        next(e);
    }
});

export default router;
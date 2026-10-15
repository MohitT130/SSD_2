import { Router } from 'express';
import { getPgPool } from '../db.js';
const router = Router();

const movingAverageQuery = `
WITH daily_revenue AS (
 SELECT o.restaurant_id, o.created_at::date AS order_date, SUM(o.total_amount) AS daily_revenue
 FROM orders o WHERE o.status='DELIVERED' AND ($1::uuid IS NULL OR o.restaurant_id=$1::uuid)
 GROUP BY o.restaurant_id, o.created_at::date
), calendar AS (
 SELECT r.id restaurant_id, r.name restaurant_name, d::date order_date
 FROM restaurants r CROSS JOIN LATERAL generate_series((SELECT MIN(created_at::date) FROM orders),(SELECT MAX(created_at::date) FROM orders),interval '1 day') d
 WHERE ($1::uuid IS NULL OR r.id=$1::uuid)
), complete AS (
 SELECT c.restaurant_id,c.restaurant_name,c.order_date,COALESCE(d.daily_revenue,0)::numeric(12,2) daily_revenue
 FROM calendar c LEFT JOIN daily_revenue d ON d.restaurant_id=c.restaurant_id AND d.order_date=c.order_date
)
SELECT restaurant_id,restaurant_name,order_date AS revenue_date,daily_revenue,
 AVG(daily_revenue) OVER(PARTITION BY restaurant_id ORDER BY order_date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)::numeric(12,2) moving_average_7_day
FROM complete ORDER BY order_date`;

router.get('/moving-average', async (req,res,next)=>{
 try {
  const restaurantId = req.query.restaurantId || null;
  if (restaurantId && !/^[0-9a-f-]{36}$/i.test(restaurantId)) return res.status(400).json({error:'Invalid restaurantId.',code:'INVALID_RESTAURANT_ID'});
  const result=await getPgPool().query(movingAverageQuery,[restaurantId]);
  res.json({data:result.rows,source:'postgres'});
 } catch(e){next(e)}
});
router.get('/rankings',async(req,res,next)=>{
 try {
  const result=await getPgPool().query(`WITH daily AS (SELECT restaurant_id,created_at::date d,SUM(total_amount) revenue FROM orders WHERE status='DELIVERED' GROUP BY restaurant_id,created_at::date), averages AS (SELECT restaurant_id,d,AVG(revenue) OVER(PARTITION BY restaurant_id ORDER BY d ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) moving_average_7_day FROM daily), latest AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY restaurant_id ORDER BY d DESC) rn FROM averages) SELECT l.restaurant_id,r.name restaurant_name,l.d order_date,COALESCE(d.revenue,0) daily_revenue,l.moving_average_7_day,DENSE_RANK() OVER(ORDER BY l.moving_average_7_day DESC) revenue_rank FROM latest l JOIN restaurants r ON r.id=l.restaurant_id LEFT JOIN daily d ON d.restaurant_id=l.restaurant_id AND d.d=l.d WHERE l.rn=1 ORDER BY revenue_rank`);
  res.json({data:result.rows,source:'postgres'});
 }catch(e){next(e)}
});
router.get('/summary',async(req,res,next)=>{
 try{
  const result=await getPgPool().query(`SELECT COALESCE(SUM(completed_revenue),0) total_revenue,COALESCE(SUM(completed_order_count),0) orders_processed,COUNT(*) restaurants,(SELECT refreshed_at FROM restaurant_revenue_refresh_meta WHERE id=1) last_refreshed FROM restaurant_completed_revenue`);
  const s=result.rows[0]||{}; const revenue=Number(s.total_revenue||0), orders=Number(s.orders_processed||0);
  res.json({data:{...s,average_order_value:orders?revenue/orders:0},source:'postgres'});
 }catch(e){next(e)}
});
router.post('/refresh',async(req,res,next)=>{
 try{
  await getPgPool().query('CALL refresh_restaurant_completed_revenue()');
  const result=await getPgPool().query('SELECT refreshed_at FROM restaurant_revenue_refresh_meta WHERE id=1');
  res.json({success:true,lastRefreshed:result.rows[0]?.refreshed_at||null,source:'postgres'});
 }catch(e){next(e)}
});
export default router;

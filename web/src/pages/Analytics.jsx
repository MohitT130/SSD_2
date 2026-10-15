import { useCallback, useEffect, useState } from 'react';
import { BarChart3, IndianRupee, RefreshCw, ShoppingBag, Store, TrendingUp, Database } from 'lucide-react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import Panel from '../components/Panel';
import RestaurantPicker from '../components/RestaurantPicker';
import { EmptyState, ErrorBanner, Pagination, SkeletonRows } from '../components/ui';
import { chartTick, colors, tooltipStyle } from '../theme';
import { dateTime } from '../utils/format';

const PAGE_SIZE = 10;

const rupees = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n) || 0);

const shortDate = (yyyyMmDd) =>
  new Date(`${yyyyMmDd}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

// Screen 4: Workflow 2 (7-day moving average + DENSE_RANK) and the
// restaurant_completed_revenue materialized view.
export default function Analytics() {
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState('');

  const [ranking, setRanking] = useState({ data: [], total: 0 });
  const [rankPage, setRankPage] = useState(1);
  const [rankLoading, setRankLoading] = useState(true);
  const [rankError, setRankError] = useState('');

  const [restaurant, setRestaurant] = useState(null);
  const [series, setSeries] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState('');

  const loadSummary = useCallback(async () => {
    setSummaryError('');
    try {
      setSummary((await api.summary()).data);
    } catch (e) {
      setSummaryError(e.message);
    }
  }, []);

  const loadRanking = useCallback(async () => {
    setRankLoading(true);
    setRankError('');
    try {
      const result = await api.rankings({ page: rankPage, pageSize: PAGE_SIZE });
      setRanking(result);
      // Default the chart to the #1 restaurant.
      setRestaurant((current) => current ?? (result.data[0]
        ? { id: result.data[0].restaurant_id, name: result.data[0].restaurant_name }
        : null));
    } catch (e) {
      setRankError(e.message);
    } finally {
      setRankLoading(false);
    }
  }, [rankPage]);

  const loadSeries = useCallback(async () => {
    if (!restaurant) return;
    setSeriesLoading(true);
    setSeriesError('');
    try {
      setSeries((await api.movingAverage(restaurant.id)).data);
    } catch (e) {
      setSeriesError(e.message);
    } finally {
      setSeriesLoading(false);
    }
  }, [restaurant]);

  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => { loadRanking(); }, [loadRanking]);
  useEffect(() => { loadSeries(); }, [loadSeries]);

  async function refresh() {
    setRefreshing(true);
    setRefreshNote('');
    setSummaryError('');
    try {
      const result = await api.refresh();
      await loadSummary();
      setRefreshNote(`Rebuilt in ${result.data.duration_ms} ms`);
    } catch (e) {
      setSummaryError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  const noRevenue = series.length > 0 && series.every((day) => Number(day.daily_revenue) === 0);

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Workflow 2 · Restaurant performance</div>
          <h1>Analytics</h1>
          <p className="page-description">Revenue from delivered orders: a 7-day moving average per restaurant, a <code>DENSE_RANK()</code> league table, and totals from a materialized view.</p>
        </div>
      </div>

      <ErrorBanner message={summaryError} onRetry={loadSummary} />

      <div className="stats-grid board">
        <StatCard label="Completed revenue" value="—" countTo={summary ? Number(summary.total_revenue) : undefined} format={rupees} detail="Delivered orders only" icon={IndianRupee} />
        <StatCard label="Completed orders" value="—" countTo={summary ? Number(summary.orders_processed) : undefined} detail="Status DELIVERED" icon={ShoppingBag} />
        <StatCard label="Average order value" value="—" countTo={summary ? Number(summary.average_order_value) : undefined} format={rupees} detail="Revenue ÷ orders" icon={TrendingUp} />
        <StatCard label="Restaurants" value="—" countTo={summary ? Number(summary.restaurants) : undefined} detail="Rows in the view" icon={Store} />
      </div>

      <Panel className="snapshot-panel">
        <div className="refresh-row">
          <div>
            <strong><Database size={15} className="inline-icon" /> Snapshot from <code>restaurant_completed_revenue</code></strong>
            <p>Last refreshed {summary?.refreshed_at ? dateTime(summary.refreshed_at) : '—'}{refreshNote && ` · ${refreshNote}`}</p>
          </div>
          <button className="button primary" onClick={refresh} disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh view'}
          </button>
        </div>
      </Panel>

      <div className="analytics-grid">
        <Panel title="7-day moving average" subtitle="Daily revenue (bars) and its 7-day average (line), last 30 days">
          <div className="chart-toolbar">
            <RestaurantPicker value={restaurant} onChange={setRestaurant} />
            <div className="chart-legend">
              <span><i className="legend-swatch" style={{ background: colors.border }} />Daily revenue</span>
              <span><i className="legend-swatch line" style={{ background: colors.brandStrong }} />7-day average</span>
            </div>
          </div>

          <ErrorBanner message={seriesError} onRetry={loadSeries} />
          {seriesLoading && !series.length ? (
            <div className="chart-empty">Loading revenue…</div>
          ) : !restaurant ? (
            <div className="chart-empty">Choose a restaurant to see its trend.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={series} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="avgInk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={colors.brand} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={colors.brand} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={colors.grid} strokeDasharray="2 4" />
                  <XAxis dataKey="order_date" tickFormatter={shortDate} tick={chartTick} axisLine={false} tickLine={false} minTickGap={24} dy={6} />
                  <YAxis tickFormatter={(v) => (v >= 1000 ? `₹${Math.round(v / 1000)}k` : `₹${v}`)} tick={chartTick} axisLine={false} tickLine={false} width={52} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    formatter={(value, name) => [rupees(value), name]}
                    cursor={{ fill: colors.grid }}
                  />
                  <Bar dataKey="daily_revenue" name="Daily revenue" fill={colors.border} radius={[2, 2, 0, 0]} maxBarSize={16} />
                  <Area dataKey="moving_average_7_day" type="monotone" stroke="none" fill="url(#avgInk)" legendType="none" tooltipType="none" isAnimationActive={false} />
                  <Line dataKey="moving_average_7_day" name="7-day average" type="monotone" stroke={colors.brandStrong} strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: colors.brand, stroke: colors.paper, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
              {noRevenue && <p className="hint">No delivered orders for this restaurant in the last 30 days.</p>}
            </>
          )}
        </Panel>

        <Panel title="Revenue ranking" subtitle="DENSE_RANK() over each restaurant's latest 7-day average · click a row to chart it">
          <ErrorBanner message={rankError} onRetry={loadRanking} />
          <div className="table-wrap">
            <table className="data-table clickable-rows">
              <thead>
                <tr><th>Rank</th><th>Restaurant</th><th className="num">7-day avg</th><th className="num">Latest day</th></tr>
              </thead>
              <tbody>
                {rankLoading && !ranking.data.length ? <SkeletonRows rows={PAGE_SIZE} cols={4} /> : ranking.data.map((row) => (
                  <tr
                    key={row.restaurant_id}
                    className={row.restaurant_id === restaurant?.id ? 'selected' : ''}
                    onClick={() => setRestaurant({ id: row.restaurant_id, name: row.restaurant_name })}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setRestaurant({ id: row.restaurant_id, name: row.restaurant_name })}
                  >
                    <td><span className={`rank-number ${Number(row.revenue_rank) <= 3 ? `top medal-${row.revenue_rank}` : ''}`}>{row.revenue_rank}</span></td>
                    <td><strong>{row.restaurant_name}</strong><small>as of {shortDate(row.order_date)}</small></td>
                    <td className="money-cell">{rupees(row.moving_average_7_day)}</td>
                    <td className="num">{rupees(row.daily_revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rankLoading && !rankError && !ranking.data.length && (
              <EmptyState icon={BarChart3} title="No restaurants to rank" text="Seed the database and refresh." />
            )}
          </div>
          <Pagination page={rankPage} pageSize={PAGE_SIZE} total={Number(ranking.total) || 0} onChange={setRankPage} loading={rankLoading} />
        </Panel>
      </div>
    </div>
  );
}

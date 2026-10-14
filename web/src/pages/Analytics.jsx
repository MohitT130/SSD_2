
import { useEffect, useState } from 'react';
import {
  Activity,
  IndianRupee,
  ShoppingBag,
  Store,
  RefreshCw,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import Panel from '../components/Panel';

const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

export default function Analytics() {
  const [trend, setTrend] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(null);

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [a, r, s] = await Promise.all([
        api.movingAverage(),
        api.rankings(),
        api.summary(),
      ]);

      setTrend(Array.isArray(a.data) ? a.data : []);
      setRankings(Array.isArray(r.data) ? r.data : []);
      setSummary(s.data || {});
      setSource(a.source || s.source || '');

      setRefreshed(
        s.data?.lastRefreshed ||
        s.data?.last_refreshed ||
        null
      );
    } catch (e) {
      setError(e.message || 'Unable to load analytics data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function refresh() {
    setRefreshing(true);
    setError('');

    try {
      const result = await api.refresh();

      // Reload the data after refreshing the materialized view.
      await load();

      // Keep the timestamp returned by the refresh endpoint.
      setRefreshed(
        result.lastRefreshed ||
        result.data?.lastRefreshed ||
        null
      );
    } catch (e) {
      setError(e.message || 'Unable to refresh the reporting snapshot.');
    } finally {
      setRefreshing(false);
    }
  }

  const totalRevenue =
    summary?.totalRevenue ?? summary?.total_revenue;

  const totalOrders =
    summary?.totalOrders ??
    summary?.total_orders ??
    summary?.orders_processed;

  const averageOrderValue =
    summary?.averageOrderValue ??
    summary?.average_order_value;

  const restaurantCount =
    summary?.restaurantCount ??
    summary?.restaurant_count ??
    summary?.restaurants;

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">PERFORMANCE OVERVIEW</div>
          <h1>Analytics</h1>
          <p className="page-description">
            Track restaurant revenue, compare performance, and refresh
            your reporting snapshot.
          </p>
        </div>

        <button
          className="button secondary"
          onClick={load}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Reload data
        </button>
      </div>

      {source === 'demo' && (
        <div className="demo-banner">
          <span className="demo-dot" />
          Demo data is displayed. Connect and verify the inherited
          database before your final demo.
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button onClick={load}>Retry</button>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="Total revenue"
          value={summary ? money(totalRevenue) : '—'}
          detail="Across seeded orders"
          icon={IndianRupee}
          tone="blue"
        />

        <StatCard
          label="Orders processed"
          value={
            summary
              ? Number(totalOrders || 0).toLocaleString('en-IN')
              : '—'
          }
          detail="In current summary"
          icon={ShoppingBag}
          tone="violet"
        />

        <StatCard
          label="Average order value"
          value={summary ? money(averageOrderValue) : '—'}
          detail="Revenue per order"
          icon={TrendingUp}
          tone="green"
        />

        <StatCard
          label="Restaurants"
          value={
            summary
              ? Number(restaurantCount || 0).toLocaleString('en-IN')
              : '—'
          }
          detail="Included in analytics"
          icon={Store}
          tone="orange"
        />
      </div>

      <div className="analytics-grid">
        <Panel
          title="7-day revenue trend"
          subtitle="Moving average revenue · INR"
          className="trend-panel"
        >
          <div className="chart-legend">
            <span />
            <span>7-day moving average</span>
          </div>

          {loading ? (
            <div className="chart-empty">
              Loading revenue data…
            </div>
          ) : trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart
                data={trend}
                margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="revenueFill"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#4778ee"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor="#4778ee"
                      stopOpacity={0.01}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#e9edf4"
                />

                <XAxis
                  dataKey="revenue_date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8b95a7', fontSize: 12 }}
                  dy={10}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return Number.isNaN(date.getTime())
                      ? value
                      : date.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          timeZone: 'UTC',
                        });
                  }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8b95a7', fontSize: 12 }}
                  tickFormatter={(value) =>
                    `${Math.round(value / 1000)}k`
                  }
                  width={42}
                />

                <Tooltip
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      timeZone: 'UTC',
                    })
                  }
                  formatter={(value) => [
                    money(value),
                    '7-day moving average',
                  ]}
                  contentStyle={{
                    border: '1px solid #e9edf4',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="moving_average_7_day"
                  name="Moving average"
                  stroke="#4778ee"
                  strokeWidth={3}
                  fill="url(#revenueFill)"
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="chart-empty">
              No revenue data returned yet.
            </div>
          )}
        </Panel>

        <Panel
          title="Revenue by restaurant"
          subtitle="Ranked performance snapshot"
          className="rank-panel"
        >
          <div className="ranking-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Restaurant</th>
                  <th>Daily revenue</th>
                  <th>7-day average</th>
                </tr>
              </thead>

              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.restaurant_id || i}>
                    <td>
                      <span
                        className={`rank-number ${
                          Number(r.revenue_rank) <= 3 ? 'top' : ''
                        }`}
                      >
                        {r.revenue_rank ?? i + 1}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {r.restaurant_name || 'Restaurant'}
                      </strong>
                      <small>{r.restaurant_id || ''}</small>
                    </td>

                    <td className="money-cell">
                      {money(r.daily_revenue)}
                    </td>

                    <td className="money-cell">
                      {money(r.moving_average_7_day)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && rankings.length === 0 && (
              <div className="empty-inline">
                No ranking rows returned.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Materialized view"
        subtitle="Summary snapshot generated by PostgreSQL"
        action={
          <button
            className="button primary"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={refreshing ? 'spin' : ''}
            />
            {refreshing ? 'Refreshing…' : 'Refresh snapshot'}
          </button>
        }
      >
        <div className="refresh-row">
          <div className="refresh-icon">
            <Activity size={20} />
          </div>

          <div>
            <strong>
              {refreshed
                ? `Last refreshed ${new Date(refreshed).toLocaleString()}`
                : 'Refresh time not available'}
            </strong>
            <p>
              The refresh action calls the API, which refreshes the
              configured materialized view.
            </p>
          </div>

          <div className="refresh-status">
            <span className="status-dot" />
            {refreshing ? 'Updating' : 'Ready'}
          </div>
        </div>
      </Panel>
    </div>
  );
}

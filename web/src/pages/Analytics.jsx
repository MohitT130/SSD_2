
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
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { api } from '../services/api';
import StatCard from '../components/StatCard';
import Panel from '../components/Panel';
import RestaurantPicker from '../components/RestaurantPicker';

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value, includeYear = false) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value ?? '');
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });
};

const formatAxisValue = (value) => {
  const amount = Number(value);

  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }

  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }

  if (amount >= 1000) {
    return `₹${(amount / 1000).toFixed(0)}k`;
  }

  return `₹${amount.toLocaleString('en-IN')}`;
};

const chartButtonStyle = (active) => ({
  padding: '8px 14px',
  border: active ? '1px solid #4778ee' : '1px solid #e2e8f0',
  borderRadius: 8,
  background: active ? '#4778ee' : '#ffffff',
  color: active ? '#ffffff' : '#475569',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
});

function RevenueChart({ data, chartType }) {
  const maxValue = Math.max(
    0,
    ...data.map((item) =>
      Number(item.moving_average_7_day) || 0
    )
  );

  // Add 15% headroom above the highest plotted value.
  const upperLimit = maxValue > 0
    ? Math.ceil((maxValue * 1.15) / 1000) * 1000
    : 10000;

  const commonProps = {
    data,
    margin: { top: 12, right: 16, left: 8, bottom: 8 },
  };

  const axes = (
    <>
      <CartesianGrid
        strokeDasharray="3 3"
        vertical={false}
        stroke="#e5eaf2"
      />

      <XAxis
        dataKey="revenue_date"
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#7b879b', fontSize: 11 }}
        tickMargin={12}
        minTickGap={24}
        tickFormatter={formatDate}
      />

      <YAxis
        axisLine={false}
        tickLine={false}
        tick={{ fill: '#7b879b', fontSize: 11 }}
        tickFormatter={formatAxisValue}
        width={72}
        domain={[0, upperLimit]}
        allowDataOverflow={false}
        tickCount={6}
      />

      <Tooltip
        labelFormatter={(value) => formatDate(value, true)}
        formatter={(value) => [
          money(value),
          '7-day moving average',
        ]}
        contentStyle={{
          border: '1px solid #e5eaf2',
          borderRadius: 12,
          padding: '12px 14px',
          boxShadow: '0 4px 16px rgba(25, 40, 70, 0.08)',
        }}
        cursor={
          chartType === 'bar'
            ? { fill: '#eef3ff' }
            : false
        }
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={340}>
      {chartType === 'bar' ? (
        <BarChart {...commonProps} barCategoryGap="25%">
          {axes}

          <Bar
            dataKey="moving_average_7_day"
            name="7-day moving average"
            fill="#4778ee"
            radius={[5, 5, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      ) : (
        <LineChart {...commonProps}>
          {axes}

          <Line
            type="monotone"
            dataKey="moving_average_7_day"
            name="7-day moving average"
            stroke="#4778ee"
            strokeWidth={3}
            dot={{ r: 3, fill: '#4778ee', strokeWidth: 0 }}
            activeDot={{
              r: 6,
              stroke: '#ffffff',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

export default function Analytics() {
  const [trend, setTrend] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [summary, setSummary] = useState(null);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshed, setRefreshed] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [chartType, setChartType] = useState('bar');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const [analytics, rankingResult, summaryResult] =
        await Promise.all([
          api.movingAverage(restaurant?.id),
          api.rankings(),
          api.summary(),
        ]);

      setTrend(
        Array.isArray(analytics.data) ? analytics.data : []
      );

      setRankings(
        Array.isArray(rankingResult.data)
          ? rankingResult.data
          : []
      );

      setSummary(summaryResult.data || {});
      setSource(analytics.source || summaryResult.source || '');

      setRefreshed(
        summaryResult.data?.last_refreshed ??
        summaryResult.data?.lastRefreshed ??
        null
      );
    } catch (err) {
      setError(err.message || 'Unable to load analytics data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [restaurant?.id]);

  async function refresh() {
    setRefreshing(true);
    setError('');

    try {
      await api.refresh();
      await load();
    } catch (err) {
      setError(err.message || 'Unable to refresh the reporting snapshot.');
    } finally {
      setRefreshing(false);
    }
  }

  const totalRevenue =
    summary?.totalRevenue ??
    summary?.total_revenue;

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

  const rankedRestaurants = rankings.slice(0, 20);

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
          type="button"
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
          Demo data is displayed. Verify the inherited database before
          your final demo.
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button type="button" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          label="Total revenue"
          value={summary ? money(totalRevenue) : '—'}
          detail="Across completed orders"
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

      <Panel
        title="Moving average filter"
        subtitle="Choose a restaurant to inspect its 7-day revenue moving average"
      >
        <RestaurantPicker
          value={restaurant}
          onChange={setRestaurant}
          disabled={loading}
        />

        {restaurant && (
          <p className="page-description">
            Showing revenue trend for <strong>{restaurant.name}</strong>.
          </p>
        )}
      </Panel>

      <div className="analytics-grid">
        <Panel
          title="7-day revenue moving average"
          subtitle={
            restaurant
              ? `Daily trend for ${restaurant.name} · INR`
              : 'Select a restaurant to view its individual trend'
          }
          className="trend-panel"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div className="chart-legend">
              <span />
              <span>7-day moving average</span>
            </div>

            <div
              role="group"
              aria-label="Chart type"
              style={{
                display: 'flex',
                gap: 6,
                padding: 4,
                background: '#f1f4f9',
                borderRadius: 10,
              }}
            >
              <button
                type="button"
                style={chartButtonStyle(chartType === 'bar')}
                aria-pressed={chartType === 'bar'}
                onClick={() => setChartType('bar')}
              >
                Bar chart
              </button>

              <button
                type="button"
                style={chartButtonStyle(chartType === 'line')}
                aria-pressed={chartType === 'line'}
                onClick={() => setChartType('line')}
              >
                Line chart
              </button>
            </div>
          </div>

          {loading ? (
            <div className="chart-empty">
              Loading revenue data…
            </div>
          ) : !restaurant ? (
            <div className="chart-empty">
              Select a restaurant above to view its individual revenue
              trend.
            </div>
          ) : trend.length === 0 ? (
            <div className="chart-empty">
              No moving-average data is available for this restaurant.
            </div>
          ) : (
            <RevenueChart data={trend} chartType={chartType} />
          )}
        </Panel>

        <Panel
          title="Revenue by restaurant"
          subtitle="Ranked performance snapshot · Top 20"
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
                {rankedRestaurants.map((row, index) => (
                  <tr key={row.restaurant_id || index}>
                    <td>
                      <span
                        className={`rank-number ${
                          Number(row.revenue_rank) <= 3 ? 'top' : ''
                        }`}
                      >
                        {row.revenue_rank ?? index + 1}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {row.restaurant_name || 'Restaurant'}
                      </strong>
                      <small>{row.restaurant_id || ''}</small>
                    </td>

                    <td className="money-cell">
                      {money(row.daily_revenue)}
                    </td>

                    <td className="money-cell">
                      {money(row.moving_average_7_day)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && rankedRestaurants.length === 0 && (
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
            type="button"
            className="button primary"
            onClick={refresh}
            disabled={refreshing || loading}
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
                ? `Last refreshed ${new Date(refreshed).toLocaleString('en-IN')}`
                : 'Refresh time not available'}
            </strong>

            <p>
              The refresh action updates the PostgreSQL materialized view.
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

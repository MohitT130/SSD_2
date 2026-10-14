import { useEffect, useState } from 'react';
import {
  Star,
  MessageSquare,
  Utensils,
  AlertCircle,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

import { api } from '../services/api';
import StatCard from '../components/StatCard';
import Panel from '../components/Panel';

export default function Reviews() {
  const [analytics, setAnalytics] = useState(null);
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [a, m] = await Promise.all([
          api.reviewAnalytics(),
          api.menus(),
        ]);

        setAnalytics(a.data);
        setMenus(m.data || []);
        setSource(a.source || '');
      } catch (e) {
        setError(e.message || 'Failed to load reviews and menus.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Convert nested MongoDB categories and items into individual menu cards.
  const menuItems = menus.flatMap((menu) =>
    (menu.categories || []).flatMap((category) =>
      (category.items || []).map((item, index) => ({
        ...item,
        restaurant_id: menu.restaurant_id,
        restaurant_name: menu.restaurant_name || menu.restaurantName || 'Restaurant',
        category_name: category.name || category.category_name || 'Menu item',
        key: `${menu.restaurant_id}-${category.name}-${item.name}-${index}`,
      }))
    )
  );

  const filtered = menuItems.filter((item) =>
    `${item.name || ''} ${item.restaurant_name || ''} ${item.category_name || ''}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  const distribution = (analytics?.distribution || [])
    .slice()
    .sort((a, b) => Number(b.rating) - Number(a.rating));

  const topTags = analytics?.topTags || [];

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">CUSTOMER EXPERIENCE</div>
          <h1>Reviews &amp; menus</h1>
          <p className="page-description">
            Understand customer sentiment and explore the restaurant catalog.
          </p>
        </div>

        <div className="rating-pill">
          <Star size={16} fill="currentColor" />
          {Number(analytics?.averageRating || 0).toFixed(1)} average rating
        </div>
      </div>

      {source === 'demo' && (
        <div className="demo-banner">
          <span className="demo-dot" />
          Demo data is displayed. Confirm collection and field names against the inherited $facet pipeline.
        </div>
      )}

      {error && (
        <div className="error-banner">
          <AlertCircle size={17} />
          <span>{error}</span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      <div className="stats-grid reviews-stats">
        <StatCard
          label="Average rating"
          value={analytics ? Number(analytics.averageRating || 0).toFixed(1) : '—'}
          detail="Out of 5 stars"
          icon={Star}
          tone="orange"
        />

        <StatCard
          label="Total reviews"
          value={analytics ? Number(analytics.totalReviews || 0).toLocaleString('en-IN') : '—'}
          detail="Across the review collection"
          icon={MessageSquare}
          tone="blue"
        />

        <StatCard
          label="Popular review tags"
          value={analytics ? topTags.length : '—'}
          detail="Top tags from $facet"
          icon={ArrowUpRight}
          tone="violet"
        />

        <StatCard
          label="Menu items"
          value={menuItems.length}
          detail="Individual items loaded"
          icon={Utensils}
          tone="green"
        />
      </div>

      <div className="analytics-grid reviews-charts">
        <Panel title="Rating distribution" subtitle="Number of reviews by star rating">
          <div className="rating-bars">
            {distribution.map((item) => (
              <div className="rating-line" key={item.rating}>
                <span className="rating-label">
                  {item.rating} <Star size={12} fill="currentColor" />
                </span>

                <div className="rating-track">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (Number(item.count) /
                          Math.max(1, ...distribution.map((d) => Number(d.count)))) *
                          100
                      )}%`,
                    }}
                  />
                </div>

                <span className="rating-count">
                  {Number(item.count).toLocaleString('en-IN')}
                </span>
              </div>
            ))}

            {!loading && !distribution.length && (
              <div className="empty-inline">No ratings returned.</div>
            )}
          </div>
        </Panel>

        <Panel title="Top review tags" subtitle="Most frequently mentioned themes">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={topTags}
              layout="vertical"
              margin={{ top: 0, right: 15, left: 5, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="#e9edf4"
              />
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8b95a7', fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="tag"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#667085', fontSize: 12 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  border: '1px solid #e9edf4',
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                name="Mentions"
                fill="#7a67df"
                radius={[0, 5, 5, 0]}
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel
        title="Menu catalog"
        subtitle="Readable catalog documents from MongoDB"
        action={
          <div className="search-box">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search menu items"
            />
          </div>
        }
      >
        <div className="menu-grid">
          {filtered.map((item) => (
            <article className="menu-card" key={item.key}>
              <div className="menu-card-top">
                <div className="menu-food-icon">
                  <Utensils size={18} />
                </div>
                <span className="menu-category">{item.category_name}</span>
              </div>

              <h3>{item.name || 'Untitled menu item'}</h3>

              <p>
                {item.description ||
                  (item.customization_addons?.length
                    ? `Customizable: ${item.customization_addons
                        .map((addon) => addon.name)
                        .join(', ')}`
                    : 'Menu item from the restaurant catalog.')}
              </p>

              <div className="menu-card-bottom">
                <span>{item.restaurant_name}</span>
                <strong>
                  {item.price != null
                    ? `₹${Number(item.price).toLocaleString('en-IN')}`
                    : 'Price N/A'}
                </strong>
              </div>
            </article>
          ))}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <Utensils size={25} />
              <strong>No menu items found</strong>
              <span>Try a different search term.</span>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
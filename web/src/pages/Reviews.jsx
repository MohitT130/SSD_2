import { useCallback, useEffect, useState } from 'react';
import { Flame, MessageSquare, Search, Star, Tag, Utensils } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../services/api';
import StatCard from '../components/StatCard';
import Panel from '../components/Panel';
import RestaurantPicker from '../components/RestaurantPicker';
import { EmptyState, ErrorBanner } from '../components/ui';
import { chartTick, colors, tooltipStyle } from '../theme';

const rupees = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Screen 6: Workflow 4 ($facet over Reviews) and one flexible Menus document.
export default function Reviews() {
  const [restaurant, setRestaurant] = useState(null);
  const [scope, setScope] = useState('restaurant'); // 'restaurant' | 'all'

  const [facets, setFacets] = useState(null);
  const [facetsLoading, setFacetsLoading] = useState(true);
  const [facetsError, setFacetsError] = useState('');

  const [menu, setMenu] = useState(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [query, setQuery] = useState('');

  // Default restaurant: the first one.
  useEffect(() => {
    api.restaurants({ pageSize: 1 })
      .then((result) => setRestaurant(result.data[0] ?? null))
      .catch((e) => setFacetsError(e.message));
  }, []);

  const facetRestaurantId = scope === 'restaurant' ? restaurant?.id : undefined;

  const loadFacets = useCallback(async () => {
    if (scope === 'restaurant' && !restaurant) return;
    setFacetsLoading(true);
    setFacetsError('');
    try {
      setFacets((await api.reviewAnalytics(facetRestaurantId)).data);
    } catch (e) {
      setFacetsError(e.message);
    } finally {
      setFacetsLoading(false);
    }
  }, [scope, restaurant, facetRestaurantId]);

  const loadMenu = useCallback(async () => {
    if (!restaurant) return;
    setMenuLoading(true);
    setMenuError('');
    try {
      setMenu((await api.menu(restaurant.id)).data);
    } catch (e) {
      setMenu(null);
      if (e.code !== 'MENU_NOT_FOUND') setMenuError(e.message);
    } finally {
      setMenuLoading(false);
    }
  }, [restaurant]);

  useEffect(() => { loadFacets(); }, [loadFacets]);
  useEffect(() => { loadMenu(); }, [loadMenu]);

  const distribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: facets?.distribution.find((row) => Number(row.rating) === rating)?.count ?? 0,
  }));
  const maxCount = Math.max(1, ...distribution.map((row) => row.count));
  const topTags = facets?.topTags ?? [];
  const scopeLabel = scope === 'all' ? 'all restaurants' : restaurant?.name ?? '…';

  const needle = query.trim().toLowerCase();
  const categories = (menu?.categories ?? [])
    .map((category) => ({
      ...category,
      items: category.items.filter((item) => !needle || `${item.name} ${category.name}`.toLowerCase().includes(needle)),
    }))
    .filter((category) => category.items.length);
  const itemCount = (menu?.categories ?? []).reduce((total, category) => total + category.items.length, 0);

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Workflow 4 · Customer voice</div>
          <h1>Reviews &amp; menus</h1>
          <p className="page-description">Ratings and tags from a <code>$facet</code> pipeline over <code>Reviews</code>, and the restaurant's menu from the flexible <code>Menus</code> catalog.</p>
        </div>
        {facets && (
          <div className="rating-pill"><Star size={16} fill="currentColor" /> {Number(facets.averageRating).toFixed(2)} average · {scopeLabel}</div>
        )}
      </div>

      <div className="chart-toolbar">
        <div className="origin-select">
          <RestaurantPicker value={restaurant} onChange={(r) => { setRestaurant(r); setScope('restaurant'); setQuery(''); }} />
        </div>
        <div className="tabs scope-tabs" role="tablist" aria-label="Review scope">
          <button className={`tab ${scope === 'restaurant' ? 'active' : ''}`} role="tab" aria-selected={scope === 'restaurant'} onClick={() => setScope('restaurant')}>This restaurant</button>
          <button className={`tab ${scope === 'all' ? 'active' : ''}`} role="tab" aria-selected={scope === 'all'} onClick={() => setScope('all')}>All restaurants</button>
        </div>
      </div>

      <ErrorBanner message={facetsError} onRetry={loadFacets} />

      <div className="stats-grid">
        <StatCard label="Average rating" value={facets ? `★ ${Number(facets.averageRating).toFixed(2)}` : '—'} detail={`Out of 5 · ${scopeLabel}`} icon={Star} />
        <StatCard label="Reviews" value={facets ? Number(facets.totalReviews).toLocaleString('en-IN') : '—'} detail={scopeLabel} icon={MessageSquare} />
        <StatCard label="Most mentioned" value={topTags[0]?.tag ?? '—'} detail={topTags[0] ? `${topTags[0].count.toLocaleString('en-IN')} mentions` : 'No tags yet'} icon={Tag} />
        <StatCard label="Menu items" value={menu ? itemCount : '—'} detail={menu ? `${menu.categories.length} categories` : 'No menu yet'} icon={Utensils} />
      </div>

      <div className="analytics-grid reviews-charts">
        <Panel title="Rating distribution" subtitle={`Reviews by star rating · ${scopeLabel}`}>
          {facetsLoading && !facets ? <div className="chart-empty">Loading ratings…</div> : facets?.totalReviews ? (
            <div className="rating-bars">
              {distribution.map((row) => (
                <div className="rating-line" key={row.rating}>
                  <span className="rating-label">{row.rating} <Star size={13} fill="currentColor" /></span>
                  <div className="rating-track"><div style={{ width: `${(row.count / maxCount) * 100}%` }} /></div>
                  <span className="rating-count">{row.count.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState icon={Star} title="No reviews yet" text="This restaurant has not been reviewed." />}
        </Panel>

        <Panel title="Top review tags" subtitle={`Most mentioned themes · ${scopeLabel}`}>
          {facetsLoading && !facets ? <div className="chart-empty">Loading tags…</div> : topTags.length ? (
            <ResponsiveContainer width="100%" height={Math.max(160, topTags.length * 30)}>
              <BarChart data={topTags} layout="vertical" margin={{ top: 0, right: 16, left: 4, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={colors.grid} />
                <XAxis type="number" tick={chartTick} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="tag" tick={{ ...chartTick, fill: colors.text }} axisLine={false} tickLine={false} width={116} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors.grid }} />
                <Bar dataKey="count" name="Mentions" fill={colors.brand} radius={[0, 4, 4, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={Tag} title="No tags yet" />}
        </Panel>
      </div>

      <Panel
        title={`Menu${restaurant ? ` · ${restaurant.name}` : ''}`}
        subtitle={menu ? `${itemCount} items · updated ${new Date(menu.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} · optional fields shown only where the document has them` : 'Flexible document from the Menus collection'}
        action={menu && (
          <div className="search-box">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search this menu" aria-label="Search this menu" />
          </div>
        )}
      >
        <ErrorBanner message={menuError} onRetry={loadMenu} />
        {menuLoading && !menu ? <div className="chart-empty">Loading menu…</div> : !menu ? (
          <EmptyState icon={Utensils} title="This restaurant has no menu yet" />
        ) : !categories.length ? (
          <EmptyState icon={Search} title={`Nothing matches “${query}”`} text="Try another dish or category." />
        ) : (
          <div className="menu-accordion">
            {categories.map((category) => (
              <details key={category.name} open>
                <summary><span>{category.name}</span><small>{category.items.length} item{category.items.length === 1 ? '' : 's'}</small></summary>
                <ul>
                  {category.items.map((item) => (
                    <li key={item.name} className="menu-item">
                      <div className="menu-item-main">
                        <strong>{item.name}</strong>
                        {(item.dietary_tags || item.spice_level) && (
                          <span className="menu-badges">
                            {item.dietary_tags?.map((tag) => <span key={tag} className="menu-badge diet">{tag}</span>)}
                            {item.spice_level && <span className="menu-badge spice"><Flame size={11} /> {item.spice_level}</span>}
                          </span>
                        )}
                        {item.combo_items && <span className="menu-note">Includes {item.combo_items.join(' + ')}</span>}
                        {item.customization_addons && (
                          <span className="menu-addons">
                            {item.customization_addons.map((addon) => (
                              <span key={addon.name}>+ {addon.name} {addon.price ? rupees(addon.price) : '(free)'}</span>
                            ))}
                          </span>
                        )}
                      </div>
                      <span className="menu-price">{rupees(item.price)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

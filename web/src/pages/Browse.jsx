import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Receipt, Search, ShoppingBag, Store, Users, Wallet, X } from 'lucide-react';
import { api } from '../services/api';
import { navigate, replaceParams } from '../router';
import { useActor } from '../context/ActorContext';
import Panel from '../components/Panel';
import AdvanceButton from '../components/AdvanceButton';
import { DetailList, Drawer, EmptyState, ErrorBanner, Pagination, SkeletonRows, StatusBadge } from '../components/ui';
import { dateTime, money, shortId } from '../utils/format';
import useDebounce from '../utils/useDebounce';

const PAGE_SIZE = 20;

const TABS = [
  { id: 'orders', label: 'Orders', icon: Receipt },
  { id: 'users', label: 'Customers', icon: Users },
  { id: 'restaurants', label: 'Restaurants', icon: Store },
];

// Screen 1 — Browse users, restaurants and orders.
// Everything is paginated on the server: the browser only ever holds one page
// (20 rows) of the 10,000 users / 500 restaurants / 50,000 orders.
export default function Browse({ params }) {
  const tab = TABS.some((t) => t.id === params.tab) ? params.tab : 'orders';
  const [selected, setSelected] = useState(null); // { type, id }
  const [reloadKey, setReloadKey] = useState(0);

  const setTab = (id) => navigate('browse', { tab: id });
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">DATA EXPLORER</div>
          <h1>Browse</h1>
          <p className="page-description">Search customers, restaurants and orders. Click a row to see its details.</p>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'orders' && <OrdersTab params={params} reloadKey={reloadKey} onOpen={(id) => setSelected({ type: 'order', id })} />}
      {tab === 'users' && <UsersTab params={params} reloadKey={reloadKey} onOpen={(id) => setSelected({ type: 'user', id })} />}
      {tab === 'restaurants' && <RestaurantsTab params={params} reloadKey={reloadKey} onOpen={(id) => setSelected({ type: 'restaurant', id })} />}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.type === 'order' ? 'Order' : selected?.type === 'user' ? 'Customer' : 'Restaurant'}
        subtitle={selected?.id}
      >
        {selected?.type === 'order' && <OrderDetail id={selected.id} onChanged={reload} onOpen={setSelected} />}
        {selected?.type === 'user' && <UserDetail id={selected.id} onChanged={reload} onOpen={setSelected} />}
        {selected?.type === 'restaurant' && <RestaurantDetail id={selected.id} onOpen={setSelected} />}
      </Drawer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared list loading: page + filters live in the URL (shareable, survive reload)

function usePagedList(fetcher, filters, reloadKey) {
  const [state, setState] = useState({ rows: [], total: 0, loading: true, error: '' });
  const key = JSON.stringify(filters);

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const result = await fetcher(filters);
      setState({ rows: result.data, total: result.total, loading: false, error: '' });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { load(); }, [load, reloadKey]);
  return { ...state, retry: load };
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="search-box toolbar-search">
      <Search size={15} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && <button className="clear-button" onClick={() => onChange('')} aria-label="Clear search"><X size={14} /></button>}
    </div>
  );
}

function useSearchParam(params, tab) {
  const [search, setSearch] = useState(params.q || '');
  const debounced = useDebounce(search);
  const page = Math.max(1, Number(params.page) || 1);

  const update = (next) => replaceAndNotify({ tab, ...params, ...next });

  useEffect(() => {
    if ((params.q || '') !== debounced) update({ q: debounced, page: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return { search, setSearch, query: params.q || '', page, update };
}

// replaceState does not fire hashchange; dispatch one so the route re-renders.
function replaceAndNotify(params) {
  replaceParams(params);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ---------------------------------------------------------------------------

function OrdersTab({ params, reloadKey, onOpen }) {
  const { page, update } = useSearchParam(params, 'orders');
  const status = params.status || '';
  const filters = { status, userId: params.userId, restaurantId: params.restaurantId, page, pageSize: PAGE_SIZE };
  const { rows, total, loading, error, retry } = usePagedList(api.orders, filters, reloadKey);
  const hasScope = params.userId || params.restaurantId;

  return (
    <Panel
      title="Orders"
      subtitle="Newest first · 50,000+ orders, loaded one page at a time"
      action={
        <div className="toolbar">
          <select className="select" value={status} onChange={(event) => update({ status: event.target.value, page: undefined })} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="PREPARING">Preparing</option>
            <option value="DELIVERING">Delivering</option>
            <option value="DELIVERED">Delivered</option>
          </select>
        </div>
      }
    >
      {hasScope && (
        <div className="filter-chips">
          {params.userId && <FilterChip label={`Customer ${shortId(params.userId)}`} onClear={() => update({ userId: undefined, page: undefined })} />}
          {params.restaurantId && <FilterChip label={`Restaurant ${shortId(params.restaurantId)}`} onClear={() => update({ restaurantId: undefined, page: undefined })} />}
        </div>
      )}
      <ErrorBanner message={error} onRetry={retry} />
      <div className="table-wrap">
        <table className="data-table clickable">
          <thead>
            <tr><th>Order</th><th>Customer</th><th>Restaurant</th><th className="num">Amount</th><th>Status</th><th>Placed</th></tr>
          </thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={6} /> : rows.map((order) => (
              <tr key={order.id} onClick={() => onOpen(order.id)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onOpen(order.id)}>
                <td className="mono">{shortId(order.id)}</td>
                <td><strong>{order.user_name}</strong></td>
                <td>{order.restaurant_name}</td>
                <td className="num money-cell">{money(order.total_amount)}</td>
                <td><StatusBadge status={order.status} /></td>
                <td>{dateTime(order.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && !rows.length && <EmptyState icon={Receipt} title="No orders match these filters" text="Try another status or clear the filters." />}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onChange={(next) => update({ page: next })} />
    </Panel>
  );
}

function UsersTab({ params, reloadKey, onOpen }) {
  const { search, setSearch, query, page, update } = useSearchParam(params, 'users');
  const active = params.active || '';
  const filters = { search: query, hasActiveOrder: active || undefined, page, pageSize: PAGE_SIZE };
  const { rows, total, loading, error, retry } = usePagedList(api.users, filters, reloadKey);

  return (
    <Panel
      title="Customers"
      subtitle="10,000 customers with prepaid wallets"
      action={
        <div className="toolbar">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name" />
          <select className="select" value={active} onChange={(event) => update({ active: event.target.value, page: undefined })} aria-label="Filter by active order">
            <option value="">All customers</option>
            <option value="true">With an active order</option>
            <option value="false">Without an active order</option>
          </select>
        </div>
      }
    >
      <ErrorBanner message={error} onRetry={retry} />
      <div className="table-wrap">
        <table className="data-table clickable">
          <thead>
            <tr><th>Name</th><th className="num">Wallet balance</th><th>Active order</th><th>Customer id</th></tr>
          </thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={4} /> : rows.map((user) => (
              <tr key={user.id} onClick={() => onOpen(user.id)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onOpen(user.id)}>
                <td><strong>{user.name}</strong></td>
                <td className="num money-cell">{money(user.wallet_balance)}</td>
                <td>{user.has_active_order ? <span className="status-badge preparing">Active</span> : <span className="muted">—</span>}</td>
                <td className="mono">{shortId(user.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && !rows.length && <EmptyState icon={Users} title={`No customers match “${query}”`} text="Check the spelling or clear the filter." />}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onChange={(next) => update({ page: next })} />
    </Panel>
  );
}

function RestaurantsTab({ params, reloadKey, onOpen }) {
  const { search, setSearch, query, page, update } = useSearchParam(params, 'restaurants');
  const filters = { search: query, page, pageSize: PAGE_SIZE };
  const { rows, total, loading, error, retry } = usePagedList(api.restaurants, filters, reloadKey);

  return (
    <Panel
      title="Restaurants"
      subtitle="500 restaurants in Hyderabad"
      action={<div className="toolbar"><SearchInput value={search} onChange={setSearch} placeholder="Search by name" /></div>}
    >
      <ErrorBanner message={error} onRetry={retry} />
      <div className="table-wrap">
        <table className="data-table clickable">
          <thead>
            <tr><th>Name</th><th className="num">Latitude</th><th className="num">Longitude</th><th>Restaurant id</th></tr>
          </thead>
          <tbody>
            {loading && !rows.length ? <SkeletonRows cols={4} /> : rows.map((restaurant) => (
              <tr key={restaurant.id} onClick={() => onOpen(restaurant.id)} tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && onOpen(restaurant.id)}>
                <td><strong>{restaurant.name}</strong></td>
                <td className="num">{restaurant.latitude.toFixed(5)}</td>
                <td className="num">{restaurant.longitude.toFixed(5)}</td>
                <td className="mono">{shortId(restaurant.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && !error && !rows.length && <EmptyState icon={Store} title={`No restaurants match “${query}”`} text="Try a shorter name, e.g. “Curry”." />}
      </div>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onChange={(next) => update({ page: next })} />
    </Panel>
  );
}

function FilterChip({ label, onClear }) {
  return (
    <span className="filter-chip">
      {label}
      <button onClick={onClear} aria-label={`Remove filter ${label}`}><X size={12} /></button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detail panels (inside the drawer)

function useDetail(fetcher, id) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const result = await fetcher(id);
      setState({ data: result.data, loading: false, error: '' });
    } catch (e) {
      setState({ data: null, loading: false, error: e.message });
    }
  }, [fetcher, id]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

function OrderDetail({ id, onChanged, onOpen }) {
  const { data: order, loading, error, reload } = useDetail(api.order, id);

  if (loading && !order) return <p className="hint">Loading order…</p>;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  return (
    <>
      <DetailList items={[
        ['Status', <StatusBadge key="s" status={order.status} />],
        ['Amount', money(order.total_amount)],
        ['Customer', <button key="u" className="link-button" onClick={() => onOpen({ type: 'user', id: order.user_id })}>{order.user_name}</button>],
        ['Restaurant', <button key="r" className="link-button" onClick={() => onOpen({ type: 'restaurant', id: order.restaurant_id })}>{order.restaurant_name}</button>],
        ['Placed', dateTime(order.created_at)],
      ]} />
      <AdvanceButton order={order} onAdvanced={() => { reload(); onChanged(); }} />
    </>
  );
}

function UserDetail({ id, onChanged, onOpen }) {
  const { data: user, loading, error, reload } = useDetail(api.user, id);
  const { actor, setActorId } = useActor();

  if (loading && !user) return <p className="hint">Loading customer…</p>;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  const isActor = actor?.id === user.id;

  return (
    <>
      <DetailList items={[
        ['Name', user.name],
        ['Wallet balance', money(user.wallet_balance)],
        ['Active order', user.active_order ? <StatusBadge key="a" status={user.active_order.status} /> : 'None — can place an order'],
      ]} />

      {user.active_order && (
        <div className="subsection">
          <h3>Active order</h3>
          <p className="hint">{user.active_order.restaurant_name} · {money(user.active_order.total_amount)} · {dateTime(user.active_order.created_at)}</p>
          <AdvanceButton order={{ ...user.active_order, user_id: user.id, user_name: user.name }} onAdvanced={() => { reload(); onChanged(); }} />
        </div>
      )}

      <div className="drawer-actions">
        <button className="button primary" disabled={isActor} onClick={() => setActorId(user.id)}>
          {isActor ? 'Current customer' : 'Act as this customer'}
        </button>
        <button className="button secondary" onClick={() => navigate('wallet', { user: user.id })}><Wallet size={15} /> Wallet history</button>
        <button className="button secondary" onClick={() => navigate('browse', { tab: 'orders', userId: user.id })}><Receipt size={15} /> All orders</button>
      </div>

      <div className="subsection">
        <h3>Recent orders</h3>
        {user.recent_orders.length === 0 ? <p className="hint">No orders yet.</p> : (
          <ul className="mini-list">
            {user.recent_orders.map((order) => (
              <li key={order.id}>
                <button className="link-button" onClick={() => onOpen({ type: 'order', id: order.id })}>
                  {order.restaurant_name}
                </button>
                <span>{money(order.total_amount)}</span>
                <StatusBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function RestaurantDetail({ id }) {
  const { data: restaurant, loading, error, reload } = useDetail(api.restaurant, id);

  if (loading && !restaurant) return <p className="hint">Loading restaurant…</p>;
  if (error) return <ErrorBanner message={error} onRetry={reload} />;

  return (
    <>
      <DetailList items={[
        ['Name', restaurant.name],
        ['Location', `${restaurant.latitude.toFixed(5)}, ${restaurant.longitude.toFixed(5)}`],
        ['Completed revenue', restaurant.completed_revenue != null ? money(restaurant.completed_revenue) : '—'],
        ['Completed orders', Number(restaurant.completed_order_count ?? 0).toLocaleString('en-IN')],
        ['Orders in progress', Number(restaurant.active_orders).toLocaleString('en-IN')],
      ]} />
      <p className="hint">Revenue figures come from the <code>restaurant_completed_revenue</code> materialized view (refresh it on the Analytics screen).</p>
      <div className="drawer-actions">
        <button className="button primary" onClick={() => navigate('order', { restaurant: restaurant.id })}><ShoppingBag size={15} /> Order from here</button>
        <button className="button secondary" onClick={() => navigate('browse', { tab: 'orders', restaurantId: restaurant.id })}>Orders <ArrowRight size={15} /></button>
      </div>
    </>
  );
}

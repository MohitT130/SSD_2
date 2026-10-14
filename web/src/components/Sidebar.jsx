import { Activity, MapPinned, Star, Utensils, ChevronLeft, ChevronRight, Database, ShoppingBag, Wallet } from 'lucide-react';

// Order follows the assignment's screen list (Browse, Transaction, Audit,
// Analytics, Map, Reviews).
const sections = [
  { caption: 'CUSTOMER', items: [
    { id: 'browse', label: 'Browse', icon: Database },
    { id: 'order', label: 'Place order', icon: ShoppingBag },
    { id: 'wallet', label: 'Wallet history', icon: Wallet },
  ] },
  { caption: 'OPERATIONS', items: [
    { id: 'analytics', label: 'Analytics', icon: Activity },
    { id: 'map', label: 'Live driver map', icon: MapPinned },
    { id: 'reviews', label: 'Reviews & menus', icon: Star },
  ] },
];

export default function Sidebar({ page, setPage, collapsed, setCollapsed, apiStatus }) {
  const statusText = apiStatus === 'ok' ? 'API connected' : apiStatus === 'down' ? 'API unreachable' : 'Checking API…';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="brand"><div className="brand-mark"><Utensils size={20} /></div>{!collapsed && <div><strong>BiteStream</strong><span>OPS CONSOLE</span></div>}</div>
      {sections.map(({ caption, items }) => (
        <div key={caption} className="nav-section">
          <div className="nav-caption">{caption}</div>
          <nav>
            {items.map(({ id, label, icon: Icon }) => (
              <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)} title={label} aria-current={page === id ? 'page' : undefined}>
                <Icon size={18} />{!collapsed && <span>{label}</span>}{page === id && !collapsed && <span className="nav-dot" />}
              </button>
            ))}
          </nav>
        </div>
      ))}
      <div className="sidebar-bottom">
        <div className={`status-pill ${apiStatus === 'down' ? 'down' : ''}`} title={statusText}><span className="status-dot" />{!collapsed && statusText}</div>
        <button className="collapse-button" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button>
      </div>
    </aside>
  );
}

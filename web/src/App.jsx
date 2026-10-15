import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import ActorPicker from './components/ActorPicker.jsx';
import Browse from './pages/Browse.jsx';
import PlaceOrder from './pages/PlaceOrder.jsx';
import WalletHistory from './pages/WalletHistory.jsx';
import Analytics from './pages/Analytics.jsx';
import DriverMap from './pages/DriverMap.jsx';
import Reviews from './pages/Reviews.jsx';
import { ActorProvider } from './context/ActorContext.jsx';
import { navigate, useHashRoute } from './router';
import { api } from './services/api';

const pages = {
  browse: { name: 'Browse', component: Browse },
  order: { name: 'Place order', component: PlaceOrder },
  wallet: { name: 'Wallet history', component: WalletHistory },
  analytics: { name: 'Analytics', component: Analytics },
  map: { name: 'Live driver map', component: DriverMap },
  reviews: { name: 'Reviews & menus', component: Reviews },
};

export default function App() {
  const route = useHashRoute();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const page = pages[route.page] ? route.page : 'browse';
  const Page = pages[page].component;

  // Phone navigation drawer: closes on Esc and whenever the page changes.
  useEffect(() => setMobileNavOpen(false), [page]);
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const onKey = (event) => event.key === 'Escape' && setMobileNavOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen]);

  useEffect(() => {
    const check = () => api.health().then(() => setApiStatus('ok')).catch(() => setApiStatus('down'));
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <ActorProvider>
      <div className="app-shell">
        <Sidebar
          page={page}
          setPage={(id) => { navigate(id); setMobileNavOpen(false); }}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          apiStatus={apiStatus}
          mobileOpen={mobileNavOpen}
        />
        {mobileNavOpen && <div className="nav-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />}
        <main className="main-area">
          <header className="topbar">
            <button className="icon-button burger" onClick={() => setMobileNavOpen(true)} aria-label="Open menu" aria-expanded={mobileNavOpen}>
              <Menu size={22} />
            </button>
            <div className="breadcrumbs"><span>BiteStream</span><span className="crumb-slash">/</span><strong>{pages[page].name}</strong></div>
            <div className="topbar-actions">
              <span className="acting-label">Acting as</span>
              <ActorPicker />
            </div>
          </header>
          {apiStatus === 'down' && (
            <div className="page-content api-down">
              <div className="error-banner" role="alert">
                <span>The API at http://localhost:4000 is not reachable. Start it with <code>npm run dev</code> in <code>api/</code>; data will load once it is running.</span>
              </div>
            </div>
          )}
          <Page key={page} params={route.params} />
          <footer className="app-footer"><span>© 2026 BiteStream · Team 26</span><span><i className="status-dot" /> CS6.302 Assignment 2</span></footer>
        </main>
      </div>
    </ActorProvider>
  );
}

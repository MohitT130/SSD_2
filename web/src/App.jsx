import { useState } from 'react';
import { Bell, Search, ChevronDown, Command, CircleHelp } from 'lucide-react';
import Sidebar from './components/Sidebar.jsx';
import Analytics from './pages/Analytics.jsx';
import DriverMap from './pages/DriverMap.jsx';
import Reviews from './pages/Reviews.jsx';
const pageNames={analytics:'Analytics',map:'Live driver map',reviews:'Reviews & menus'};
export default function App(){const [page,setPage]=useState('analytics'),[collapsed,setCollapsed]=useState(false);return <div className="app-shell"><Sidebar page={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed}/><main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageNames[page]}</strong></div><div className="topbar-actions"><div className="global-search"><Search size={16}/><span>Search anything…</span><kbd><Command size={11}/> K</kbd></div><button className="icon-button" aria-label="Help"><CircleHelp size={18}/></button><button className="icon-button notification-button" aria-label="Notifications"><Bell size={18}/><i/></button><div className="profile"><div className="profile-avatar">BS</div><div className="profile-copy"><strong>Ops team</strong><span>Administrator</span></div><ChevronDown size={15}/></div></div></header>{page==='analytics'?<Analytics/>:page==='map'?<DriverMap/>:<Reviews/>}<footer className="app-footer"><span>© 2026 BiteStream Operations</span><span><i className="status-dot"/> Internal dashboard · Assignment 2</span></footer></main></div>}

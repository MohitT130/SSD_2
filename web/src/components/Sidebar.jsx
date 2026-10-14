import { Activity, MapPinned, Star, Utensils, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
const items = [
  {id:'analytics',label:'Analytics',icon:Activity},
  {id:'map',label:'Live driver map',icon:MapPinned},
  {id:'reviews',label:'Reviews & menus',icon:Star}
];
export default function Sidebar({page,setPage,collapsed,setCollapsed}) {
 return <aside className={`sidebar ${collapsed?'collapsed':''}`}>
  <div className="brand"><div className="brand-mark"><Utensils size={20}/></div>{!collapsed&&<div><strong>BiteStream</strong><span>OPS CONSOLE</span></div>}</div>
  <div className="nav-caption">WORKSPACE</div>
  <nav>{items.map(({id,label,icon:Icon})=><button key={id} className={`nav-item ${page===id?'active':''}`} onClick={()=>setPage(id)} title={label}><Icon size={18}/>{!collapsed&&<span>{label}</span>}{page===id&&!collapsed&&<span className="nav-dot"/>}</button>)}</nav>
  <div className="sidebar-bottom"><div className="status-pill"><span className="status-dot"/>{!collapsed&&'System operational'}</div><button className="collapse-button" onClick={()=>setCollapsed(!collapsed)} aria-label="Toggle sidebar">{collapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button></div>
 </aside>
}

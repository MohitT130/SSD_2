const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';
async function request(path, options={}) {
  const response = await fetch(`${BASE}${path}`, { headers:{'Content-Type':'application/json'}, ...options });
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}
export const api = {
  health:()=>request('/health'),
  movingAverage:()=>request('/analytics/moving-average'),
  rankings:()=>request('/analytics/rankings'),
  summary:()=>request('/analytics/summary'),
  refresh:()=>request('/analytics/refresh',{method:'POST'}),
  nearby:(lat,lng,radiusKm=5)=>request(`/map/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  reviewAnalytics:()=>request('/reviews/analytics'),
  menus:()=>request('/reviews/menus')
};

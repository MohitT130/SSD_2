const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

// Errors carry the API's `code` (e.g. INSUFFICIENT_BALANCE), the HTTP status
// and the full body so screens can show a specific, friendly message.
export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

async function request(path, options={}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { headers:{'Content-Type':'application/json'}, ...options });
  } catch {
    throw new ApiError('Cannot reach the API. Is it running on port 4000?', 0, { code: 'NETWORK_ERROR' });
  }
  const body = await response.json().catch(()=>({}));
  if (!response.ok) throw new ApiError(body.error || `Request failed (${response.status})`, response.status, body);
  return body;
}

function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  health:()=>request('/health'),

  // Browse, Transaction, Audit
  users:(params={})=>request(`/users${qs(params)}`),
  user:(id)=>request(`/users/${id}`),
  audit:(id,params={})=>request(`/users/${id}/audit${qs(params)}`),
  restaurants:(params={})=>request(`/restaurants${qs(params)}`),
  restaurant:(id)=>request(`/restaurants/${id}`),
  orders:(params={})=>request(`/orders${qs(params)}`),
  order:(id)=>request(`/orders/${id}`),
  advanceOrder:(id)=>request(`/orders/${id}/advance`,{method:'PATCH'}),
  checkout:(body)=>request('/checkout',{method:'POST',body:JSON.stringify(body)}),

  // Analytics, Map, Reviews
  movingAverage:()=>request('/analytics/moving-average'),
  rankings:()=>request('/analytics/rankings'),
  summary:()=>request('/analytics/summary'),
  refresh:()=>request('/analytics/refresh',{method:'POST'}),
  nearby:(lat,lng,radiusKm=5)=>request(`/map/nearby?lat=${lat}&lng=${lng}&radiusKm=${radiusKm}`),
  reviewAnalytics:()=>request('/reviews/analytics'),
  menus:()=>request('/reviews/menus')
};

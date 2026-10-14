import { useEffect, useState } from 'react';

// Minimal hash router: #/order?restaurant=<id>  ->  { page: 'order', params: { restaurant } }
// Keeps the current screen and its filters across reloads without adding a
// routing dependency.
function parse() {
  const [path, query = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { page: path || 'browse', params: Object.fromEntries(new URLSearchParams(query)) };
}

export function navigate(page, params = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();
  const hash = `#/${page}${query ? `?${query}` : ''}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}

// Update the query string of the current page without adding history entries.
export function replaceParams(params) {
  const { page } = parse();
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  ).toString();
  window.history.replaceState(null, '', `#/${page}${query ? `?${query}` : ''}`);
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse);

  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  return route;
}

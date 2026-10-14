import { useEffect, useRef, useState } from 'react';
import { Search, Store } from 'lucide-react';
import { api } from '../services/api';
import useDebounce from '../utils/useDebounce';

// Searchable restaurant select backed by GET /api/restaurants?search=
// (500 restaurants, so results are fetched on demand instead of loaded at once).
export default function RestaurantPicker({ value, onChange, disabled }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounced = useDebounce(search);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.restaurants({ search: debounced, pageSize: 8 })
      .then((result) => !cancelled && setResults(result.data))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open, debounced]);

  return (
    <div className="combo" ref={ref}>
      <button type="button" className="combo-button" onClick={() => setOpen(!open)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}>
        <Store size={16} />
        <span className={value ? '' : 'placeholder'}>{value ? value.name : 'Choose a restaurant'}</span>
      </button>

      {open && (
        <div className="combo-menu" role="listbox">
          <div className="search-box">
            <Search size={15} />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search restaurants" />
          </div>
          {error && <div className="actor-menu-note error">{error}</div>}
          {loading && !results.length && <div className="actor-menu-note">Searching…</div>}
          {!loading && !error && !results.length && <div className="actor-menu-note">No restaurants match “{search}”.</div>}
          {results.map((restaurant) => (
            <button
              type="button"
              key={restaurant.id}
              className={`actor-option ${restaurant.id === value?.id ? 'selected' : ''}`}
              onClick={() => { onChange(restaurant); setOpen(false); setSearch(''); }}
              role="option"
              aria-selected={restaurant.id === value?.id}
            >
              <div className="profile-avatar small"><Store size={14} /></div>
              <div>
                <strong>{restaurant.name}</strong>
                <span>{restaurant.latitude.toFixed(4)}, {restaurant.longitude.toFixed(4)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

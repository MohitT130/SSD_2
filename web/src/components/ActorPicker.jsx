import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { api } from '../services/api';
import { useActor } from '../context/ActorContext';
import { initials, money } from '../utils/format';
import useDebounce from '../utils/useDebounce';

// Header control: "Acting as <customer>". Lets the demo switch between users
// without a login, and shows the wallet balance + active-order badge.
export default function ActorPicker() {
  const { actor, setActorId } = useActor();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounced = useDebounce(search);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => ref.current && !ref.current.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.users({ search: debounced, hasActiveOrder: onlyFree ? false : undefined, pageSize: 8 })
      .then((result) => !cancelled && setResults(result.data))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open, debounced, onlyFree]);

  function choose(user) {
    setActorId(user.id);
    setOpen(false);
    setSearch('');
  }

  return (
    <div className="actor-picker" ref={ref}>
      <button className="profile actor-button" onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open}>
        <div className="profile-avatar">{actor ? initials(actor.name) : '…'}</div>
        <div className="profile-copy">
          <strong>{actor ? actor.name : 'Loading customer…'}</strong>
          <span>
            {actor ? money(actor.wallet_balance) : 'Acting as'}
            {actor?.has_active_order && <em className="active-dot" title="Has an active order"> · active order</em>}
          </span>
        </div>
        <ChevronDown size={15} />
      </button>

      {open && (
        <div className="actor-menu" role="listbox">
          <div className="actor-menu-caption">ACT AS CUSTOMER (DEMO)</div>
          <div className="search-box actor-search">
            <Search size={15} />
            <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customers by name" />
          </div>
          <label className="actor-filter">
            <input type="checkbox" checked={onlyFree} onChange={(event) => setOnlyFree(event.target.checked)} />
            Only customers without an active order
          </label>
          {error && <div className="actor-menu-note error">{error}</div>}
          {loading && !results.length && <div className="actor-menu-note">Searching…</div>}
          {!loading && !error && !results.length && <div className="actor-menu-note">No customers match “{search}”.</div>}
          {results.map((user) => (
            <button key={user.id} className={`actor-option ${user.id === actor?.id ? 'selected' : ''}`} onClick={() => choose(user)} role="option" aria-selected={user.id === actor?.id}>
              <div className="profile-avatar small">{initials(user.name)}</div>
              <div>
                <strong>{user.name}</strong>
                <span>{money(user.wallet_balance)}{user.has_active_order && <em className="active-dot"> · active order</em>}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

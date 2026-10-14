import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

// "Acting as" customer for demos (the PDF asks for a simple way to switch
// users; real login is out of scope). The choice survives page reloads.
const STORAGE_KEY = 'bitestream.actorId';
const ActorContext = createContext(null);

function readStoredId() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function storeId(id) {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode: keep in memory only */ }
}

export function ActorProvider({ children }) {
  const [actorId, setActorIdState] = useState(readStoredId);
  const [actor, setActor] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (id) => {
    setError('');
    try {
      if (!id) {
        // First visit: start as a customer who can place an order right away.
        const first = await api.users({ hasActiveOrder: false, pageSize: 1 });
        id = first.data[0]?.id;
        if (!id) return;
        storeId(id);
        setActorIdState(id);
      }
      const result = await api.user(id);
      setActor(result.data);
    } catch (e) {
      if (e.code === 'USER_NOT_FOUND' || e.code === 'INVALID_ID') {
        // Stored id no longer exists (database was reseeded): pick a new one.
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        setActorIdState(null);
        return load(null);
      }
      setError(e.message);
    }
  }, []);

  useEffect(() => { load(actorId); }, [actorId, load]);

  const setActorId = useCallback((id) => {
    storeId(id);
    setActorIdState(id);
  }, []);

  const refreshActor = useCallback(() => load(actorId), [actorId, load]);

  return (
    <ActorContext.Provider value={{ actor, actorId, setActorId, refreshActor, error }}>
      {children}
    </ActorContext.Provider>
  );
}

export function useActor() {
  return useContext(ActorContext);
}

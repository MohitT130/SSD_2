import { useState } from 'react';
import { ChevronsRight } from 'lucide-react';
import { api } from '../services/api';
import { useActor } from '../context/ActorContext';
import { ErrorBanner } from './ui';

// Moves an order PREPARING -> DELIVERING -> DELIVERED via sp_advance_order_status.
// Used to demonstrate the partial unique index: once the active order is
// DELIVERED the customer can place a new one.
export default function AdvanceButton({ order, onAdvanced, compact = false }) {
  const { actor, refreshActor } = useActor();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const next = order.status === 'PREPARING' ? 'DELIVERING' : order.status === 'DELIVERING' ? 'DELIVERED' : null;

  if (!next) {
    return compact ? null : <p className="hint">This order is delivered, so it no longer blocks new orders for {order.user_name ?? 'this customer'}.</p>;
  }

  async function advance() {
    setBusy(true);
    setError('');
    try {
      const result = await api.advanceOrder(order.id);
      if (actor?.id === order.user_id) await refreshActor();
      onAdvanced?.(result.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="advance-box">
      <ErrorBanner message={error} />
      <button className="button primary" onClick={advance} disabled={busy}>
        <ChevronsRight size={15} /> {busy ? 'Updating…' : `Advance to ${next}`}
      </button>
      {!compact && (
        <p className="hint">Calls <code>sp_advance_order_status</code>. Once DELIVERED, the partial unique index lets this customer order again.</p>
      )}
    </div>
  );
}

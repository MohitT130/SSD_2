import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleSlash, Clock, ShoppingBag, Wallet, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { navigate } from '../router';
import { useActor } from '../context/ActorContext';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import RestaurantPicker from '../components/RestaurantPicker';
import AdvanceButton from '../components/AdvanceButton';
import { ActionBadge, DetailList, ErrorBanner, StatusBadge } from '../components/ui';
import { dateTime, money, shortId } from '../utils/format';

// Screen 2 — Transaction (Workflow 1).
// Calls POST /api/checkout, which runs the inherited stored procedure
// sp_execute_checkout. Shows the wallet before/after, a friendly explanation
// when the procedure refuses the order, and the wallet_audit_logs row written
// by the wallet_balance_audit trigger.
export default function PlaceOrder({ params }) {
  const { actor, refreshActor } = useActor();
  const [restaurant, setRestaurant] = useState(null);
  const [amount, setAmount] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { ok: true, data } | { ok: false, error }
  const [preloadError, setPreloadError] = useState('');

  // Pre-select a restaurant when arriving from Browse ("Order from here").
  useEffect(() => {
    if (!params.restaurant) return;
    api.restaurant(params.restaurant)
      .then((r) => setRestaurant(r.data))
      .catch((e) => setPreloadError(e.message));
  }, [params.restaurant]);

  // A new customer was picked in the header: clear the previous outcome.
  useEffect(() => { setResult(null); }, [actor?.id]);

  function validate() {
    if (!restaurant) return 'Choose a restaurant.';
    const value = Number(amount);
    if (amount.trim() === '' || !Number.isFinite(value)) return 'Enter the order amount.';
    if (value <= 0) return 'Amount must be greater than zero.';
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return 'Use at most two decimal places.';
    return '';
  }

  async function submit(event) {
    event.preventDefault();
    const problem = validate();
    setFieldError(problem);
    if (problem || !actor) return;

    setSubmitting(true);
    setResult(null);
    try {
      const response = await api.checkout({ userId: actor.id, restaurantId: restaurant.id, amount: Number(amount) });
      setResult({ ok: true, data: response.data });
    } catch (e) {
      setResult({ ok: false, error: e });
    } finally {
      setSubmitting(false);
      refreshActor();
    }
  }

  const before = result?.ok ? result.data.balanceBefore : result?.error?.body?.balanceBefore ?? actor?.wallet_balance;
  const after = result?.ok ? result.data.balanceAfter : result?.error?.body?.balanceAfter;
  const delta = after !== undefined ? Number(after) - Number(before) : null;

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">WORKFLOW 1 · CHECKOUT</div>
          <h1>Place an order</h1>
          <p className="page-description">
            Pays from the customer’s wallet using the stored procedure <code>sp_execute_checkout</code>.
          </p>
        </div>
      </div>

      <ErrorBanner message={preloadError} />

      <div className="order-grid">
        <Panel title="New order" subtitle="Ordering as the customer selected in the header">
          <form className="order-form" onSubmit={submit} noValidate>
            <label className="field">
              <span>Customer</span>
              <div className="readonly-field">
                <strong>{actor ? actor.name : 'Loading…'}</strong>
                <small>Change it with “Acting as” at the top right</small>
              </div>
            </label>

            <label className="field">
              <span>Restaurant</span>
              <RestaurantPicker value={restaurant} onChange={(r) => { setRestaurant(r); setFieldError(''); }} disabled={submitting} />
            </label>

            <label className="field">
              <span>Amount (₹)</span>
              <input
                className={`input ${fieldError && fieldError.toLowerCase().includes('amount') ? 'invalid' : ''}`}
                inputMode="decimal"
                placeholder="e.g. 450.00"
                value={amount}
                onChange={(event) => { setAmount(event.target.value); setFieldError(''); }}
                disabled={submitting}
              />
            </label>

            <div className="amount-chips" aria-label="Quick amounts">
              {[250, 450, 1200].map((value) => (
                <button type="button" key={value} className="chip" onClick={() => setAmount(String(value))}>{money(value)}</button>
              ))}
              {actor && (
                <button
                  type="button"
                  className="chip danger"
                  title="Demonstrates the insufficient-balance failure"
                  onClick={() => setAmount((Math.floor(Number(actor.wallet_balance)) + 500).toFixed(2))}
                >
                  More than the wallet
                </button>
              )}
            </div>

            {fieldError && <p className="field-error" role="alert">{fieldError}</p>}

            {actor?.active_order && (
              <div className="warning-box">
                <AlertTriangle size={17} />
                <div>
                  <strong>{actor.name} already has an order in progress</strong>
                  <p>
                    {actor.active_order.restaurant_name} · {money(actor.active_order.total_amount)} · <StatusBadge status={actor.active_order.status} />
                  </p>
                  <p>Placing another order will be refused by the partial unique index <code>idx_active_user_order</code>.</p>
                  <AdvanceButton compact order={{ ...actor.active_order, user_id: actor.id }} />
                </div>
              </div>
            )}

            <button className="button primary submit-button" type="submit" disabled={submitting || !actor}>
              <ShoppingBag size={16} /> {submitting ? 'Placing order…' : 'Place order'}
            </button>
          </form>
        </Panel>

        <div className="order-side">
          <div className="stats-grid two">
            <StatCard label="Wallet before" value={before !== undefined ? money(before) : '—'} detail="Read just before the procedure ran" icon={Wallet} tone="blue" />
            <StatCard
              label="Wallet after"
              value={after !== undefined ? money(after) : '—'}
              detail={delta === null ? 'Shown after you place the order' : delta === 0 ? 'Unchanged — nothing was charged' : `${money(Math.abs(delta))} charged`}
              icon={Wallet}
              tone={delta === null ? 'violet' : delta < 0 ? 'orange' : 'green'}
            />
          </div>

          {!result && !submitting && (
            <Panel title="Result" subtitle="The outcome of the stored procedure appears here">
              <div className="empty-state">
                <Clock size={25} />
                <strong>No order placed yet</strong>
                <span>Choose a restaurant and an amount, then press “Place order”.</span>
              </div>
            </Panel>
          )}

          {submitting && (
            <Panel title="Result"><div className="empty-state"><Clock size={25} /><strong>Running sp_execute_checkout…</strong></div></Panel>
          )}

          {result?.ok && <SuccessPanel data={result.data} />}
          {result && !result.ok && <FailurePanel error={result.error} actor={actor} />}
        </div>
      </div>
    </div>
  );
}

function SuccessPanel({ data }) {
  const { order, auditEntry } = data;

  return (
    <Panel title="Order placed" subtitle="Committed by sp_execute_checkout" className="result-panel success">
      <div className="result-heading success"><CheckCircle2 size={20} /> Payment taken and order created</div>

      {order && (
        <DetailList items={[
          ['Order', shortId(order.id)],
          ['Restaurant', order.restaurant_name],
          ['Amount', money(order.total_amount)],
          ['Status', <StatusBadge key="s" status={order.status} />],
        ]} />
      )}

      <div className="subsection">
        <h3>New wallet_audit_logs entry</h3>
        <p className="hint">Written automatically by the trigger <code>wallet_balance_audit</code> when the wallet balance changed.</p>
        {auditEntry ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Time</th><th>Action</th><th className="num">Amount</th><th className="num">Balance after</th></tr></thead>
              <tbody>
                <tr className="highlight-row">
                  <td>{dateTime(auditEntry.timestamp)}</td>
                  <td><ActionBadge action={auditEntry.action_type} /></td>
                  <td className="num money-cell">{money(auditEntry.amount_changed)}</td>
                  <td className="num money-cell">{money(auditEntry.balance_after)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : <p className="hint">No audit row was found for this order.</p>}
      </div>

      <div className="drawer-actions">
        <button className="button secondary" onClick={() => navigate('wallet')}>Open wallet history</button>
        <button className="button secondary" onClick={() => navigate('browse', { tab: 'orders', userId: order?.user_id })}>View orders</button>
      </div>
    </Panel>
  );
}

const FAILURES = {
  INSUFFICIENT_BALANCE: {
    title: 'Not enough money in the wallet',
    why: 'The wallet CHECK constraint (chk_wallet_balance ≥ 0) rejected the debit, so the procedure rolled the whole transaction back.',
  },
  ACTIVE_ORDER_EXISTS: {
    title: 'An order is already in progress',
    why: 'The partial unique index idx_active_user_order allows only one PREPARING or DELIVERING order per customer, so the procedure was rolled back.',
  },
  RESTAURANT_NOT_FOUND: { title: 'Restaurant not found', why: 'The orders → restaurants foreign key rejected the order.' },
  USER_NOT_FOUND: { title: 'Customer not found', why: 'The procedure could not find this customer.' },
  INVALID_AMOUNT: { title: 'Invalid amount', why: 'The amount must be greater than zero with at most two decimals.' },
};

function FailurePanel({ error, actor }) {
  const known = FAILURES[error.code];
  const Icon = error.code === 'ACTIVE_ORDER_EXISTS' ? CircleSlash : XCircle;

  return (
    <Panel title="Order not placed" subtitle={known ? 'Refused by the database — nothing was charged' : 'The request failed'} className="result-panel failure">
      <div className="result-heading failure"><Icon size={20} /> {known ? known.title : 'Something went wrong'}</div>
      <p className="result-message">{error.message}</p>
      {known && <p className="hint">Why: {known.why}</p>}
      {error.body?.balanceBefore !== undefined && (
        <p className="hint">Wallet balance is still {money(error.body.balanceBefore)} (no wallet_audit_logs row was written).</p>
      )}
      {error.code === 'ACTIVE_ORDER_EXISTS' && actor?.active_order && (
        <div className="subsection">
          <h3>Finish the active order first</h3>
          <p className="hint">{actor.active_order.restaurant_name} · {money(actor.active_order.total_amount)} · <StatusBadge status={actor.active_order.status} /></p>
          <AdvanceButton order={{ ...actor.active_order, user_id: actor.id }} />
        </div>
      )}
    </Panel>
  );
}

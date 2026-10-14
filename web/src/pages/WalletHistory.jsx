import { useCallback, useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, History, Landmark, Wallet } from 'lucide-react';
import { api } from '../services/api';
import { navigate, replaceParams } from '../router';
import { useActor } from '../context/ActorContext';
import Panel from '../components/Panel';
import StatCard from '../components/StatCard';
import { ActionBadge, EmptyState, ErrorBanner, Pagination, SkeletonRows } from '../components/ui';
import { dateTime, money, startOfLocalDay, startOfNextLocalDay } from '../utils/format';

const PAGE_SIZE = 20;

// Screen 3 — Audit trail. Read-only view of wallet_audit_logs for one customer
// with a date filter and a running balance (computed by a SQL window function
// and checked against balance_after written by the trigger).
export default function WalletHistory({ params }) {
  const { actor } = useActor();
  const userId = params.user || actor?.id;
  const [from, setFrom] = useState(params.from || '');
  const [to, setTo] = useState(params.to || '');
  const [applied, setApplied] = useState({ from: params.from || '', to: params.to || '' });
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], total: 0, summary: null, user: null, loading: true, error: '' });

  const load = useCallback(async () => {
    if (!userId) return;
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const result = await api.audit(userId, {
        from: startOfLocalDay(applied.from),
        to: startOfNextLocalDay(applied.to),
        page,
        pageSize: PAGE_SIZE,
      });
      setState({ rows: result.data, total: result.total, summary: result.summary, user: result.user, loading: false, error: '' });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [userId, applied, page]);

  useEffect(() => { load(); }, [load]);

  // New customer selected -> back to page 1.
  useEffect(() => { setPage(1); }, [userId]);

  function apply(event) {
    event.preventDefault();
    if (from && to && from > to) {
      setState((s) => ({ ...s, error: 'The “From” date must be on or before the “To” date.' }));
      return;
    }
    setPage(1);
    setApplied({ from, to });
    replaceParams({ user: params.user, from, to });
  }

  function clear() {
    setFrom('');
    setTo('');
    setPage(1);
    setApplied({ from: '', to: '' });
    replaceParams({ user: params.user });
  }

  const { rows, total, summary, user, loading, error } = state;
  const viewingOther = params.user && params.user !== actor?.id;

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">AUDIT TRAIL · READ ONLY</div>
          <h1>Wallet history</h1>
          <p className="page-description">
            Every wallet change recorded in <code>wallet_audit_logs</code> {user ? <>for <strong>{user.name}</strong></> : ''}.
          </p>
        </div>
        {viewingOther && (
          <button className="button secondary" onClick={() => navigate('wallet')}>Show my wallet</button>
        )}
      </div>

      <form className="filter-bar" onSubmit={apply}>
        <label className="field inline">
          <span>From</span>
          <input className="input" type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field inline">
          <span>To</span>
          <input className="input" type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="button primary" type="submit">Apply</button>
        {(applied.from || applied.to) && <button className="button secondary" type="button" onClick={clear}>Clear dates</button>}
      </form>

      <ErrorBanner message={error} onRetry={load} />

      <div className="stats-grid">
        <StatCard label="Opening balance" value={summary?.opening_balance != null ? money(summary.opening_balance) : '—'} detail="Before the first entry in range" icon={Landmark} tone="blue" />
        <StatCard label="Debits" value={summary ? money(summary.total_debits) : '—'} detail="Orders paid" icon={ArrowUpRight} tone="orange" />
        <StatCard label="Credits" value={summary ? money(summary.total_credits) : '—'} detail="Wallet top-ups" icon={ArrowDownLeft} tone="green" />
        <StatCard label="Closing balance" value={summary?.closing_balance != null ? money(summary.closing_balance) : '—'} detail={`${Number(summary?.entries ?? 0).toLocaleString('en-IN')} ${Number(summary?.entries) === 1 ? 'entry' : 'entries'} in range`} icon={Wallet} tone="violet" />
      </div>

      <Panel title="Entries" subtitle="Newest first · running balance from SUM(...) OVER (ORDER BY timestamp)">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th><th>Action</th><th className="num">Amount</th>
                <th className="num">Balance after (trigger)</th><th className="num">Running balance (window)</th>
              </tr>
            </thead>
            <tbody>
              {loading && !rows.length ? <SkeletonRows cols={5} /> : rows.map((row) => (
                <tr key={row.id}>
                  <td>{dateTime(row.timestamp)}</td>
                  <td><ActionBadge action={row.action_type} /></td>
                  <td className={`num money-cell ${row.action_type === 'DEBIT' ? 'debit-text' : 'credit-text'}`}>
                    {row.action_type === 'DEBIT' ? '−' : '+'}{money(row.amount_changed)}
                  </td>
                  <td className="num money-cell">{money(row.balance_after)}</td>
                  <td className="num money-cell">
                    {money(row.running_balance)}
                    {row.running_balance === row.balance_after && <CheckCircle2 className="match-icon" size={13} aria-label="matches balance after" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !error && !rows.length && (
            <EmptyState icon={History} title="No wallet activity in this date range" text="Pick a wider range or clear the dates." />
          )}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onChange={setPage} />
      </Panel>
    </div>
  );
}

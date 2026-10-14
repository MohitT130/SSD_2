export const money = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(Number(value) || 0);

export const dateTime = (value) =>
  value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const shortId = (id) => (id ? `${String(id).slice(0, 8)}…` : '—');

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || '?';

// Local calendar day -> ISO instant of its start, so the API filters by the
// viewer's own midnight rather than the server's time zone.
export const startOfLocalDay = (yyyyMmDd) => (yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`).toISOString() : undefined);

export const startOfNextLocalDay = (yyyyMmDd) => {
  if (!yyyyMmDd) return undefined;
  const date = new Date(`${yyyyMmDd}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
};

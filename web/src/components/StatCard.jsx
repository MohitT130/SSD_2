import CountUp from './CountUp.jsx';

// A small receipt: label, perforation, printed figure. Pass `countTo` (a
// number) and `format` to count the figure up; otherwise `value` is shown.
export default function StatCard({ label, value, detail, icon: Icon, tone = 'blue', countTo, format }) {
  const counted = typeof countTo === 'number' && Number.isFinite(countTo);
  return (
    <div className="stat-card">
      <div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}>{Icon && <Icon size={18} />}</div></div>
      <div className="stat-value">{counted ? <CountUp to={countTo} format={format} /> : value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

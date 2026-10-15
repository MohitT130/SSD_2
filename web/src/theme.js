// Literal colour values for Recharts and Leaflet, which cannot read CSS
// variables. Keep in sync with theme.css (the source of truth).
export const colors = {
  brand: '#E8590C',
  brandStrong: '#C2410C',
  brandSoft: '#FFF4E6',
  brandLine: '#FFD8A8',
  success: '#2F9E44',
  danger: '#E03131',
  warning: '#F08C00',
  info: '#1971C2',
  text: '#212529',
  muted: '#6C757D',
  border: '#E9ECEF',
  grid: '#F1F3F5',
};

export const chartTick = { fill: colors.muted, fontSize: 12 };

export const tooltipStyle = {
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  fontSize: 13,
  boxShadow: '0 12px 32px rgba(33, 37, 41, .14)',
};

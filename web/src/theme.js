// Literal colour values for Recharts and Leaflet, which cannot read CSS
// variables. Keep in sync with theme.css (the source of truth).
export const colors = {
  brand: '#E8590C',
  brandStrong: '#C2410C',
  brandSoft: '#FDEFE3',
  brandLine: '#F6C9A4',
  success: '#2E7D32',
  danger: '#B23A12',
  warning: '#B7791F',
  info: '#2B4C7E',
  text: '#221C17',
  muted: '#6B5E52',
  border: '#E4D7C3',
  grid: '#EFE5D5',
  paper: '#FFFDF8',
};

export const fonts = {
  serif: "'Fraunces', Georgia, serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
};

export const chartTick = { fill: colors.muted, fontSize: 12, fontFamily: fonts.mono };

export const tooltipStyle = {
  background: colors.paper,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  fontSize: 13,
  boxShadow: '0 18px 40px rgba(34, 28, 23, .18)',
};

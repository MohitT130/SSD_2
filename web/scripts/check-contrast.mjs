// WCAG contrast check for the design tokens in src/theme.css.
// Every text/background pair the UI uses must reach 4.5:1 (AA, normal text).
//   npm run check:contrast
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
const tokens = Object.fromEntries([...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
tokens.white = '#FFFFFF';

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const pairs = [
  ['text', 'page'], ['text', 'surface'],
  ['text-muted', 'page'], ['text-muted', 'surface'],
  ['brand-strong', 'surface'], ['brand-strong', 'brand-soft'], ['white', 'brand-strong'],
  ...['success', 'danger', 'warning', 'info'].flatMap((s) => [[`${s}-strong`, `${s}-soft`], [`${s}-strong`, 'surface']]),
];

let failed = 0;
for (const [fg, bg] of pairs) {
  if (!tokens[fg] || !tokens[bg]) { console.log(`MISSING  --${fg} / --${bg}`); failed++; continue; }
  const r = ratio(tokens[fg], tokens[bg]);
  const ok = r >= 4.5;
  if (!ok) failed++;
  console.log(`${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(5)}:1  --${fg} on --${bg}`);
}
console.log(failed ? `\n${failed} pair(s) below 4.5:1` : '\nAll pairs meet WCAG AA (4.5:1).');
process.exit(failed ? 1 : 0);

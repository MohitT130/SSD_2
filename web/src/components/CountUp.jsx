import { useEffect, useRef, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const defaultFormat = (n) => Math.round(n).toLocaleString('en-IN');

// Counts a printed figure up to `to` (ease-out, ~0.7 s). From the second
// change on it counts from the previous value, so a refresh visibly moves
// the number. With reduced motion it shows the final value immediately.
export default function CountUp({ to, format = defaultFormat, duration = 700 }) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? to : 0));
  const shown = useRef(prefersReducedMotion() ? to : 0);

  useEffect(() => {
    if (prefersReducedMotion()) {
      shown.current = to;
      setValue(to);
      return undefined;
    }
    const from = shown.current;
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * (1 - (1 - t) ** 3);
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return <span>{format(value)}</span>;
}

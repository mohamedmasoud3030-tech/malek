import { useEffect, useRef } from 'react';
import { animate, useInView } from 'framer-motion';

type CountUpProps = {
  value: number;
  suffix?: string;
  className?: string;
};

/** Counts from 0 to `value` when scrolled into view, with locale-aware digits. */
export function CountUp({ value, suffix = '', className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const controls = animate(0, value, {
      duration: 1.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(latest) {
        if (ref.current) {
          ref.current.textContent = `${Math.round(latest)}${suffix}`;
        }
      },
    });
    return () => controls.stop();
  }, [inView, value, suffix]);

  return (
    <span ref={ref} className={className} dir="ltr">
      0{suffix}
    </span>
  );
}

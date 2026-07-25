import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
};

/**
 * Static reveal wrapper.
 * Marketing pages now follow the operational UI baseline: no decorative motion
 * classes or scroll-triggered animation wrappers.
 */
export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}

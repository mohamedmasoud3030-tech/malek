import type { ReactNode } from 'react';

type RevealProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

/**
 * Static reveal wrapper.
 * Marketing pages now follow the operational UI baseline: no decorative motion
 * classes or scroll-triggered animation wrappers.
 */
export function Reveal({ children, className }: RevealProps) {
  return <div className={className}>{children}</div>;
}

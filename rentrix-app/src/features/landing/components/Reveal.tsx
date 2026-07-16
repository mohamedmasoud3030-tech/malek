import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  once?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade-and-rise on scroll — direction-agnostic so it stays safe in RTL. */
export function Reveal({ children, delay = 0, y = 28, className, once = true }: RevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-72px' }}
      transition={{ duration: 0.7, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

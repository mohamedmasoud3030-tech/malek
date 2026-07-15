import type { LucideIcon } from 'lucide-react';

export type LandingFeature = Readonly<{
  icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}>;

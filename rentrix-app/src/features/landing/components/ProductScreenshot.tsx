import { useState } from 'react';
import { cn } from '@/lib/utils';
import { AppPreview } from './AppPreview';

/**
 * Renders a real captured screenshot from `public/landing/`. If the image is
 * missing (not generated yet), it gracefully falls back to the in-app
 * `AppPreview` mock so the page never shows a broken image.
 */
export function ProductScreenshot({
  src,
  alt,
  className,
}: Readonly<{ src: string; alt: string; className?: string }>) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AppPreview className={className} />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('w-full rounded-3xl border border-border/60 shadow-2xl', className)}
    />
  );
}

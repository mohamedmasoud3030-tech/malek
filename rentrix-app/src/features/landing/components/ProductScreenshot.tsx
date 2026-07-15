import { useState } from 'react';
import { AppPreview } from './AppPreview';

/**
 * Renders a real captured screenshot from `public/landing/`. If the image is
 * missing (not generated yet), it gracefully falls back to the in-app
 * `AppPreview` mock so the page never shows a broken image.
 */
export function ProductScreenshot({ src, alt }: Readonly<{ src: string; alt: string }>) {
  const [failed, setFailed] = useState(false);
  if (failed) return <AppPreview />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full rounded-3xl border border-border/60 shadow-2xl"
    />
  );
}

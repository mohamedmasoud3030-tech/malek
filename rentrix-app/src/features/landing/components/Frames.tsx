/** Device-style frames that make real app screenshots look presented, not pasted. */
import type { ReactNode } from 'react';
import { APP_HOST } from '../constants';

export function BrowserFrame({
  src,
  alt,
  url = APP_HOST,
  className = '',
  imgClassName = '',
  glow = true,
  loading = 'lazy',
  fetchPriority = 'auto',
}: {
  src: string;
  alt: string;
  url?: string;
  className?: string;
  imgClassName?: string;
  glow?: boolean;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'auto' | 'high' | 'low';
}) {
  return (
    <div className={`relative ${className}`}>
      {glow ? (
        <div
          aria-hidden="true"
          className="absolute -inset-8 rounded-[2.5rem] bg-gradient-to-t from-brand-500/25 via-brand-400/10 to-transparent blur-2xl"
        />
      ) : null}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-850 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-rose-400/80" />
            <span className="size-3 rounded-full bg-amber-400/80" />
            <span className="size-3 rounded-full bg-emerald-400/80" />
          </div>
          <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-lg bg-white/5 px-3 py-1 text-[11px] text-slate-400">
            <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="10" width="16" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 1 1 8 0v3" />
            </svg>
            <span dir="ltr">{url}</span>
          </div>
          <div className="w-10" />
        </div>
        <img
          src={src}
          alt={alt}
          loading={loading}
          fetchPriority={fetchPriority}
          className={`block w-full ${imgClassName}`}
        />
      </div>
    </div>
  );
}

export function PhoneFrame({
  src,
  alt,
  className = '',
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative mx-auto w-[240px] rounded-[2.6rem] border border-white/15 bg-ink-900 p-2 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] sm:w-[270px] ${className}`}
    >
      <div className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-ink-900" />
      <div className="overflow-hidden rounded-[2rem] border border-white/5 bg-black">
        <img src={src} alt={alt} loading="lazy" className="block w-full" />
      </div>
    </div>
  );
}

export function FrameCaption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-center text-xs text-slate-500">{children}</p>
  );
}

import { Outlet } from '@tanstack/react-router';

export function AuthLayout() {
  return (
    <main
      className="relative isolate min-h-screen min-h-dvh overflow-x-hidden bg-[hsl(var(--color-bg))]"
      dir="rtl"
    >
      {/* Subtle grid pattern — professional, not decorative */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.035] dark:opacity-[0.045]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--color-text-primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--color-text-primary)) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div className="relative z-10">
        <Outlet />
      </div>
    </main>
  );
}

import { Outlet } from '@tanstack/react-router';

export function AuthLayout() {
  return (
    <main
      className="relative isolate min-h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.18),transparent_30%),radial-gradient(circle_at_bottom_right,hsl(var(--accent)/0.14),transparent_26%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]"
      dir="rtl"
    >
      <div className="animate-pulse-soft pointer-events-none absolute -right-24 top-16 size-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="animate-float-soft pointer-events-none absolute -left-16 bottom-12 size-64 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative z-10 grid min-h-dvh place-items-center p-4 sm:p-6 lg:p-10">
        <Outlet />
      </div>
    </main>
  );
}

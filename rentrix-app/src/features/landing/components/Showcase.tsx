import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, FileBarChart, Settings2, ClipboardList, Play, X, Building2, ScrollText, WalletCards, Wrench, Bot, Zap } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

const TAB_META = [
  { id: 'dashboard', icon: LayoutDashboard, src: '/landing/dashboard.webp' },
  { id: 'properties', icon: Building2, src: '/landing/properties.png' },
  { id: 'contracts', icon: ScrollText, src: '/landing/contracts.png' },
  { id: 'financials', icon: WalletCards, src: '/landing/financials.png' },
  { id: 'maintenance', icon: Wrench, src: '/landing/maintenance.png' },
  { id: 'ai-assistant', icon: Bot, src: '/landing/ai-assistant.png' },
  { id: 'automation', icon: Zap, src: '/landing/automation.png' },
  { id: 'workspace', icon: FileBarChart, src: '/landing/workspace.png' },
  { id: 'settings', icon: Settings2, src: '/landing/settings.png' },
  { id: 'entity-form', icon: ClipboardList, src: '/landing/entity-form.png' },
] as const;

const DEMO_VIDEO_SRC = '/landing/malik-demo.mp4';

export function Showcase() {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  const [videoOpen, setVideoOpen] = useState(false);
  const current = TAB_META[active];

  // Close on ESC + lock body scroll while the modal is open
  useEffect(() => {
    if (!videoOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setVideoOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [videoOpen]);

  return (
    <section id="showcase" className="section-light relative overflow-hidden border-t border-border/70">
      <div
        aria-hidden="true"
        className="absolute -top-32 end-[-6%] size-[420px] rounded-full bg-primary/10 blur-[110px]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          tone="light"
          kicker={t.showcase.kicker}
          title={t.showcase.title}
          subtitle={t.showcase.subtitle}
        />

        <Reveal className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="group inline-flex items-center gap-3 rounded-full border border-primary/20 bg-background px-6 py-3 text-sm font-extrabold text-brand-700 shadow-[0_14px_30px_-14px_rgba(37,84,235,0.5)] transition duration-300 hover:border-primary/40 hover:shadow-[0_20px_40px_-16px_rgba(37,84,235,0.55)]"
          >
            <span className="relative grid size-9 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:scale-105">
              <span aria-hidden="true" className="absolute inset-0 rounded-full bg-primary/50 " />
              <Play className="relative size-4 fill-current" aria-hidden="true" />
            </span>
            {t.showcase.watchVideo}
            <span className="text-xs font-bold text-muted-foreground">3:22</span>
          </button>
        </Reveal>

        <Reveal className="mt-12">
          <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr] lg:gap-10">
            {/* Tab list */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
              {TAB_META.map((tab, i) => {
                const Icon = tab.icon;
                const copy = t.showcase.tabs[i];
                const isActive = i === active;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`group flex min-w-[200px] items-center gap-3 rounded-2xl border p-4 text-start transition duration-300 lg:min-w-0 ${
                      isActive
                        ? 'border-brand-600 bg-background shadow-[0_16px_40px_-16px_rgba(37,84,235,0.45)]'
                        : 'border-border/70 bg-background/80 hover:border-primary/30 hover:bg-background'
                    }`}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary'
                      }`}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-extrabold ${
                          isActive ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {copy.label}
                      </span>
                      <span className="mt-0.5 hidden text-xs leading-5 text-muted-foreground lg:block">
                        {copy.caption}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Screenshot viewport */}
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-6 rounded-[2rem] bg-primary/5 bg-primary/5 blur-2xl"
              />
              <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-background shadow-[0_35px_70px_-25px_rgba(12,26,54,0.35)]">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={current.id}
                    src={current.src}
                    alt={t.showcase.tabs[active].caption}
                    initial={{ opacity: 0, scale: 0.985, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 1.01, y: -8 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="block w-full"
                  />
                </AnimatePresence>
                <div className="border-t border-border/60 bg-muted/40 px-5 py-3.5 text-sm font-semibold text-muted-foreground">
                  {t.showcase.tabs[active].caption}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Video modal */}
      <AnimatePresence>
        {videoOpen ? (
          <motion.div
            key="video-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.showcase.watchVideo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 grid place-items-center bg-background/85 p-4 backdrop-blur-sm"
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-4xl"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                aria-label={t.showcase.closeVideo}
                className="absolute -top-12 end-0 grid size-10 place-items-center rounded-full border border-white/15 bg-muted/50 text-primary-foreground transition hover:bg-background/20"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
              <video
                src={DEMO_VIDEO_SRC}
                controls
                autoPlay
                playsInline
                className="w-full rounded-2xl border border-border/70 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]"
              />
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

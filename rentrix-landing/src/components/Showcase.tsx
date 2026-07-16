import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutDashboard, FileBarChart, Settings2, ClipboardList } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

const TAB_META = [
  { id: 'dashboard', icon: LayoutDashboard, src: '/screenshots/dashboard.png' },
  { id: 'workspace', icon: FileBarChart, src: '/screenshots/workspace.png' },
  { id: 'settings', icon: Settings2, src: '/screenshots/settings.png' },
  { id: 'entity-form', icon: ClipboardList, src: '/screenshots/entity-form.png' },
] as const;

export function Showcase() {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);
  const current = TAB_META[active];

  return (
    <section id="showcase" className="section-light relative overflow-hidden border-t border-slate-200/70">
      <div
        aria-hidden="true"
        className="absolute -top-32 end-[-6%] size-[420px] rounded-full bg-brand-500/10 blur-[110px]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          tone="light"
          kicker={t.showcase.kicker}
          title={t.showcase.title}
          subtitle={t.showcase.subtitle}
        />

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
                        ? 'border-brand-600 bg-white shadow-[0_16px_40px_-16px_rgba(37,84,235,0.45)]'
                        : 'border-slate-200 bg-white/60 hover:border-brand-300 hover:bg-white'
                    }`}
                  >
                    <span
                      className={`grid size-10 shrink-0 place-items-center rounded-xl transition ${
                        isActive
                          ? 'bg-brand-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600'
                      }`}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-extrabold ${
                          isActive ? 'text-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {copy.label}
                      </span>
                      <span className="mt-0.5 hidden text-xs leading-5 text-slate-500 lg:block">
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
                className="absolute -inset-6 rounded-[2rem] bg-gradient-to-t from-brand-500/15 to-cyan-400/10 blur-2xl"
              />
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_35px_70px_-25px_rgba(12,26,54,0.35)]">
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
                <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3.5 text-sm font-semibold text-slate-600">
                  {t.showcase.tabs[active].caption}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

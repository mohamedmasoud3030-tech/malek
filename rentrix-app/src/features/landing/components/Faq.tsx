import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

export function Faq() {
  const { t } = useLanguage();
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="section-light bg-grid-light relative overflow-hidden border-t border-border/70">
      <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeader
          tone="light"
          kicker={t.faq.kicker}
          title={t.faq.title}
          subtitle={t.faq.subtitle}
        />

        <div className="mt-12 space-y-3">
          {t.faq.items.map((item, i) => {
            const isOpen = i === open;
            return (
              <Reveal key={item.q} delay={i * 0.04}>
                <div
                  className={`overflow-hidden rounded-2xl border transition duration-300 ${
                    isOpen
                      ? 'border-brand-600/40 bg-background shadow-[0_18px_40px_-20px_rgba(37,84,235,0.35)]'
                      : 'border-border/70 bg-background/90 hover:border-primary/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start sm:px-6 sm:py-5"
                  >
                    <span className="text-sm font-extrabold text-foreground sm:text-base">
                      {item.q}
                    </span>
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-full transition ${
                        isOpen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
                    </span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-5 pb-5 text-sm leading-8 text-muted-foreground sm:px-6">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

import { ShieldCheck, History, Database, Radar } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionHeader } from './SectionHeader';
import { Reveal } from './Reveal';

const ITEM_ICONS = [ShieldCheck, History, Database, Radar];

export function Security() {
  const { t } = useLanguage();

  return (
    <section id="security" className="section-light relative overflow-hidden border-t border-border/70">
      <div
        aria-hidden="true"
        className="absolute -top-24 start-[8%] size-80 rounded-full bg-success-bg blur-[110px]"
      />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16">
          <SectionHeader
            tone="light"
            align="start"
            kicker={t.security.kicker}
            title={t.security.title}
            subtitle={t.security.subtitle}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            {t.security.items.map((item, i) => {
              const Icon = ITEM_ICONS[i % ITEM_ICONS.length];
              return (
                <Reveal key={item.title} delay={i * 0.07} className="h-full">
                  <div className="light-card group h-full rounded-2xl p-6 transition duration-300 hover:shadow-[0_24px_50px_-20px_rgba(12,26,54,0.25)]">
                    <div className="mb-4 grid size-11 place-items-center rounded-xl bg-success-bg/12 text-success transition duration-300 group-hover:scale-110">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <h3 className="text-base font-extrabold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-[13px] leading-7 text-muted-foreground">{item.description}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

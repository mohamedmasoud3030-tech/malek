import { Reveal } from './Reveal';

type SectionHeaderProps = {
  kicker: string;
  title: string;
  subtitle?: string;
  tone?: 'dark' | 'light';
  align?: 'center' | 'start';
};

export function SectionHeader({
  kicker,
  title,
  subtitle,
  tone = 'dark',
  align = 'center',
}: SectionHeaderProps) {
  const isDark = tone === 'dark';
  return (
    <Reveal
      className={
        align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl text-start'
      }
    >
      <span
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold tracking-wide ${
          isDark
            ? 'border-brand-400/30 bg-brand-500/10 text-brand-300'
            : 'border-brand-600/20 bg-brand-50 text-brand-700'
        }`}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {kicker}
      </span>
      <h2
        className={`mt-5 text-3xl font-bold leading-[1.25] tracking-tight sm:text-4xl lg:text-[2.75rem] lg:leading-[1.2] ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`mt-4 text-base leading-8 sm:text-lg ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}
        >
          {subtitle}
        </p>
      ) : null}
    </Reveal>
  );
}

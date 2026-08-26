import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { settingsSections, type SettingsSectionId } from '../settingsSections';

export function SettingsWorkspaceNav({
  activeSection,
  onChange,
}: Readonly<{
  activeSection: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
}>) {
  const active = settingsSections.find((section) => section.id === activeSection) ?? settingsSections[0];
  const ActiveIcon = active.icon;

  return (
    <>
      <div className="space-y-2 md:hidden">
        <nav
          className="overflow-x-auto rounded-2xl border border-border/70 bg-card p-2 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="أقسام الإعدادات"
        >
          <div className="flex min-w-max gap-1.5">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 min-w-[8.75rem] items-center gap-2 rounded-xl border px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                      : 'border-border/60 bg-background text-foreground hover:border-primary/25 hover:bg-primary/5',
                  )}
                  onClick={() => onChange(section.id)}
                >
                  <span className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg',
                    selected ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground',
                  )}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="truncate text-xs font-black">{section.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <div className="flex min-h-11 items-start gap-2 rounded-xl border border-primary/15 bg-primary/[0.035] px-3 py-2">
          <ActiveIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-xs font-bold leading-5 text-muted-foreground" aria-live="polite">
            <span className="font-black text-foreground">{active.label}: </span>{active.description}
          </p>
        </div>
      </div>

      <nav className="hidden md:block" aria-label="أقسام الإعدادات">
        <div className="sticky top-4 overflow-hidden rounded-3xl border border-border/70 bg-card shadow-card">
          <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
            <p className="text-[11px] font-black text-primary">مساحات الإعداد</p>
            <p className="mt-0.5 text-sm font-black">اختر القسم الذي تريد تعديله</p>
          </div>
          <div className="space-y-1 p-2">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-16 w-full items-start gap-3 rounded-2xl px-3 py-3 text-start transition-[background-color,color,box-shadow,transform]',
                    'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20',
                    selected
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-foreground hover:-translate-y-px hover:bg-muted/60',
                  )}
                  onClick={() => onChange(section.id)}
                >
                  <span className={cn(
                    'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl',
                    selected ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                  )}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{section.label}</span>
                    <span className={cn(
                      'mt-0.5 line-clamp-2 block text-[11px] font-bold leading-5',
                      selected ? 'text-primary-foreground/75' : 'text-muted-foreground',
                    )}>
                      {section.description}
                    </span>
                  </span>
                  <ChevronLeft className="mt-1 size-4 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

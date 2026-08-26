import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  settingsSections,
  type SettingsSectionId,
  type SettingsSectionListItem,
} from '../settingsSections';

export function SettingsWorkspaceNav({
  activeSection,
  onChange,
  sections = settingsSections,
}: Readonly<{
  activeSection: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  sections?: readonly SettingsSectionListItem[];
}>) {
  return (
    <>
      <nav className="no-scrollbar -mx-1 overflow-x-auto px-1 md:hidden" aria-label="أقسام إعدادات المكتب">
        <div className="flex min-w-max gap-1.5">
          {sections.map((section) => {
            const Icon = section.icon;
            const selected = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border/70 bg-card text-muted-foreground hover:border-primary/25 hover:bg-primary/5 hover:text-foreground',
                )}
                onClick={() => onChange(section.id)}
              >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <nav className="hidden md:block" aria-label="أقسام الإعدادات">
        <div className="sticky top-4 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
          <div className="border-b border-border/60 px-3 py-2.5">
            <p className="text-xs font-black">أقسام إعدادات المكتب</p>
          </div>
          <div className="space-y-1 p-1.5">
            {sections.map((section) => {
              const Icon = section.icon;
              const selected = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  type="button"
                  aria-current={selected ? 'page' : undefined}
                  className={cn(
                    'group flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start transition-[background-color,color,box-shadow]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25',
                    selected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-muted/60',
                  )}
                  onClick={() => onChange(section.id)}
                >
                  <span className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg',
                    selected ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                  )}>
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-black">{section.label}</span>
                  <ChevronLeft className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

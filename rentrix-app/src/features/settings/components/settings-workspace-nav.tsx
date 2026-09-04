import { ChevronLeft } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  settingsSections,
  type SettingsSectionId,
  type SettingsSectionListItem,
} from '../registry/sectionRegistry';

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
      <nav className="lg:hidden" aria-label="أقسام إعدادات المكتب">
        <Select
          aria-label="قسم الإعدادات"
          value={activeSection}
          onChange={(event) => onChange(event.target.value as SettingsSectionId)}
          className="min-h-11 w-full rounded-xl"
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>{section.label}</option>
          ))}
        </Select>
      </nav>

      <nav className="hidden lg:block" aria-label="أقسام الإعدادات">
        <div className="sticky top-[calc(var(--app-header-height)+0.75rem)] max-h-[calc(var(--visual-viewport-height,100dvh)-var(--app-header-height)-1.5rem)] overflow-y-auto overflow-x-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
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

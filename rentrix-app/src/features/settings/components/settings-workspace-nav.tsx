import { ChevronLeft } from 'lucide-react';
import { Select } from '@/components/ui/select';
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

  return (
    <>
      <div className="space-y-2 md:hidden">
        <label className="grid gap-1.5 text-sm font-black" htmlFor="settings-section-select">
          القسم الحالي
          <Select
            id="settings-section-select"
            value={activeSection}
            onChange={(event) => onChange(event.target.value as SettingsSectionId)}
          >
            {settingsSections.map((section) => (
              <option key={section.id} value={section.id}>{section.label}</option>
            ))}
          </Select>
        </label>
        <p className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-xs font-bold leading-5 text-muted-foreground" aria-live="polite">
          {active.description}
        </p>
      </div>

      <nav className="hidden md:block" aria-label="أقسام الإعدادات">
        <div className="sticky top-4 space-y-1 rounded-2xl border border-border/70 bg-card p-2 shadow-sm">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const selected = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors',
                  selected
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground hover:bg-muted',
                )}
                onClick={() => onChange(section.id)}
              >
                <span className={cn(
                  'grid size-9 shrink-0 place-items-center rounded-xl',
                  selected ? 'bg-primary-foreground/15' : 'bg-muted text-muted-foreground group-hover:text-foreground',
                )}>
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black">{section.label}</span>
                  <span className={cn(
                    'mt-0.5 line-clamp-1 block text-[11px] font-bold',
                    selected ? 'text-primary-foreground/75' : 'text-muted-foreground',
                  )}>
                    {section.description}
                  </span>
                </span>
                <ChevronLeft className="size-4 shrink-0 opacity-60" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

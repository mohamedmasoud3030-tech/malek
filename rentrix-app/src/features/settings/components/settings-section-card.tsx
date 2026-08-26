import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { settingsSections, type SettingsSectionId } from '../settingsSections';

type SectionCardProps = Readonly<{
  id: SettingsSectionId;
  activeId: SettingsSectionId;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}>;

export function SectionCard({ id, activeId, title, subtitle, children }: SectionCardProps) {
  const definition = settingsSections.find((section) => section.id === id);
  const Icon = definition?.icon;

  return (
    <Card
      id={id}
      role="tabpanel"
      hidden={activeId !== id}
      className="scroll-mt-24 overflow-hidden rounded-2xl border-border/70 shadow-sm"
      data-settings-section={id}
    >
      <CardHeader className="border-b border-border/60 bg-muted/20 px-3 py-3 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
          {Icon ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary sm:size-10 sm:rounded-2xl">
              <Icon className="size-4 sm:size-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black sm:text-base">{title}</h2>
            <p className="mt-0.5 text-[11px] font-bold leading-5 text-muted-foreground sm:mt-1 sm:text-xs">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

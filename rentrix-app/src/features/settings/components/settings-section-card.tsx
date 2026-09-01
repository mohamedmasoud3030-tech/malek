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
      aria-label={title}
      hidden={activeId !== id}
      className="scroll-mt-24 overflow-visible rounded-none border-0 bg-transparent shadow-none md:overflow-hidden md:rounded-2xl md:border md:border-border/70 md:bg-card md:shadow-sm"
      data-settings-section={id}
    >
      <CardHeader className="border-b border-border/55 bg-transparent px-0 py-2 md:bg-muted/20 md:px-5 md:py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <p data-settings-section-title className="truncate text-xs font-black text-muted-foreground md:text-sm md:text-foreground">
              {title}
            </p>
            <p className="mt-0.5 hidden text-xs font-semibold leading-5 text-muted-foreground md:block">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 px-0 pb-0 pt-3 md:space-y-4 md:p-5">{children}</CardContent>
    </Card>
  );
}

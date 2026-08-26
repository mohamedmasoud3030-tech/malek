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
      className="scroll-mt-28 overflow-hidden rounded-3xl border-border/70 shadow-card"
      data-settings-section={id}
    >
      <CardHeader className="border-b border-border/60 bg-gradient-to-l from-primary/[0.055] via-muted/15 to-transparent px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black">{title}</h2>
              <span className="rounded-full border border-primary/15 bg-background/70 px-2.5 py-1 text-[10px] font-black text-primary">
                قسم مستقل
              </span>
            </div>
            <p className="mt-1 text-xs font-bold leading-5 text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

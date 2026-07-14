import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SettingsSectionId } from '../settingsSections';

type SectionCardProps = Readonly<{
  id: SettingsSectionId;
  activeId: SettingsSectionId;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}>;

export function SectionCard({ id, activeId, title, subtitle, children }: SectionCardProps) {
  return (
    <Card id={id} role="tabpanel" hidden={activeId !== id} className="scroll-mt-28 border-border/60">
      <CardHeader className="space-y-1 border-b border-border/60 bg-muted/20 px-4 py-3 sm:px-5">
        <CardTitle className="text-sm font-black">{title}</CardTitle>
        <p className="text-[11px] font-bold text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

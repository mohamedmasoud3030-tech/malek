import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
        {/* h2: these are top-level sections directly under the page h1
            (CardTitle is h3, which skips a level here — axe heading-order). */}
        <h2 className="text-sm font-black">{title}</h2>
        <p className="text-xs font-bold text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">{children}</CardContent>
    </Card>
  );
}

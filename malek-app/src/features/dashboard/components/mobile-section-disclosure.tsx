import { memo, useId, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Mobile-only «details on demand» wrapper for the heavier dashboard sections.
 *
 * On phones the section body starts collapsed behind one calm disclosure
 * button, so «اليوم» keeps a single focus; from `md` up the section always
 * renders exactly as before and the disclosure control is hidden. Nothing is
 * removed — the same section component renders inside the panel either way.
 */
export const MobileSectionDisclosure = memo(function MobileSectionDisclosure({
  title,
  description,
  children,
}: Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div data-dashboard-mobile-disclosure>
      <div className="md:hidden">
        <Button
          type="button"
          variant="ghost"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="min-h-11 w-full justify-between rounded-xl border border-border/60 bg-card px-4 py-3 text-start"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{title}</span>
            {description ? (
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>
            ) : null}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </Button>
      </div>
      <div
        id={panelId}
        data-dashboard-mobile-disclosure-panel
        data-open={open ? 'true' : 'false'}
      >
        {children}
      </div>
    </div>
  );
});

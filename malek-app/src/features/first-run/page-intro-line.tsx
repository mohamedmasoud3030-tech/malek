import { Info } from 'lucide-react';
import { resolvePageIntro } from './page-intro';
import { useCurrentPathname } from './use-current-pathname';

/**
 * سطر شرح واحد بسيط أعلى كل صفحة داخل النظام. يتعرض مرة واحدة من AppShell
 * فوق الـ Outlet، ويختفي تماما في الصفحات اللي ملهاش شرح (الدخول مثلا).
 */
export function PageIntroLine() {
  const pathname = useCurrentPathname();
  const intro = resolvePageIntro(pathname);
  if (!intro) return null;

  return (
    <p
      data-page-intro
      className="mx-auto flex w-full max-w-[110rem] items-start gap-1.5 px-3 pt-3 text-[12px] leading-5 text-muted-foreground sm:px-4"
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{intro}</span>
    </p>
  );
}

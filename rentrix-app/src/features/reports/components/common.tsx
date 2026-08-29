import { ArrowUpLeft } from 'lucide-react';

type SafeLinkProps = Readonly<{
  href: string;
  label: string;
}>;

export function SafeAnchor({ href, label }: SafeLinkProps) {
  return (
    <a className="inline-flex items-center gap-1 font-bold text-primary hover:underline" href={href}>
      {label}
      <ArrowUpLeft className="size-3" aria-hidden="true" />
    </a>
  );
}

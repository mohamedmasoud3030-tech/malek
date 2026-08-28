type PropertyInfoItemProps = Readonly<{ label: string; value: string }>;

export function PropertyInfoItem({ label, value }: PropertyInfoItemProps) {
  return (
    <div className="min-w-0 border-b border-border/60 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-bold leading-6 [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

type PropertyInfoItemProps = Readonly<{ label: string; value: string }>;

export function PropertyInfoItem({ label, value }: PropertyInfoItemProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

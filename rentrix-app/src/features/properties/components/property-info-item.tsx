type PropertyInfoItemProps = Readonly<{ label: string; value: string }>;

export function PropertyInfoItem({ label, value }: PropertyInfoItemProps) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

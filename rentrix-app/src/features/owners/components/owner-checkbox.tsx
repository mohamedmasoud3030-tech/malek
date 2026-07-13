type OwnerCheckboxProps = Readonly<{
  checked: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}>;

// No shared Checkbox primitive exists under components/ui,
// so owner forms use this small native fallback until a shared primitive is added.
export function OwnerCheckbox({ checked, label, onCheckedChange, className }: OwnerCheckboxProps) {
  return (
    <label className={className ?? 'flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 text-sm font-bold'}>
      <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.currentTarget.checked)} />
      <span>{label}</span>
    </label>
  );
}

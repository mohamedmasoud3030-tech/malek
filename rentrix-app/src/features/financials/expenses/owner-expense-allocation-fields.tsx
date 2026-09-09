import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { usePropertyOwners } from "@/features/owners/useOwners";
import { useOwnerAgreements } from "@/features/owners/useOwnerAgreements";
import type { OwnerExpenseAllocation } from "./expenseService";

type Props = {
  propertyId: string;
  date: string;
  allocations: OwnerExpenseAllocation[];
  evidence: string;
  onChange: (rows: OwnerExpenseAllocation[]) => void;
  onEvidenceChange: (value: string) => void;
};
/** Explicit approved allocation, not automatic ownership-percentage arithmetic.
 * The server revalidates identities, scope, amount and effective agreement. */
export function OwnerExpenseAllocationFields({
  propertyId,
  date,
  allocations,
  evidence,
  onChange,
  onEvidenceChange,
}: Props) {
  const owners = usePropertyOwners(propertyId);
  const agreements = useOwnerAgreements(propertyId);
  const eligible = (owners.data ?? []).filter(
    (row) =>
      row.owner &&
      (!row.starts_on || row.starts_on <= date) &&
      (!row.ends_on || row.ends_on >= date),
  );
  const change = (index: number, patch: Partial<OwnerExpenseAllocation>) =>
    onChange(allocations.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  return (
    <fieldset
      className="space-y-3 rounded-xl border p-4"
      aria-label="توزيع مصروف المالك"
    >
      <legend className="px-2 font-bold">توزيع مصروف المالك</legend>
      <p className="text-sm text-muted-foreground">
        حدد المبالغ المعتمدة لكل مالك. تُسجّل كذمم على الملاك، ولا تُخصم
        تلقائياً من أموالهم. المقاصة تتطلب حقاً سارياً وتسوية معتمدة.
      </p>
      {owners.isError || agreements.isError ? (
        <p role="alert">
          تعذر تحميل نطاق الملاك والاتفاقيات. أعد المحاولة قبل الحفظ.
        </p>
      ) : null}
      {owners.isPending && propertyId ? (
        <p role="status">جارٍ تحميل الملاك…</p>
      ) : null}
      {allocations.map((a, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-2">
          <label>
            المالك
            <Select
              aria-label={`المالك ${i + 1}`}
              value={a.owner_id}
              onChange={(e) =>
                change(i, {
                  owner_id: e.target.value,
                  owner_agreement_id: undefined,
                })
              }
            >
              <option value="">اختر المالك</option>
              {eligible.map((o) => (
                <option key={o.id} value={o.owner_id}>
                  {o.owner?.name || o.owner?.full_name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            المبلغ المخصص
            <Input
              aria-label={`المبلغ المخصص ${i + 1}`}
              type="number"
              min="0.001"
              step="0.001"
              value={a.amount || ""}
              onChange={(e) => change(i, { amount: Number(e.target.value) })}
            />
          </label>
          <label>
            الاتفاقية المرجعية (اختياري)
            <Select
              aria-label={`الاتفاقية المرجعية ${i + 1}`}
              value={a.owner_agreement_id ?? ""}
              onChange={(e) =>
                change(i, { owner_agreement_id: e.target.value || undefined })
              }
            >
              <option value="">بدون حق مقاصة مفترض</option>
              {(agreements.data ?? [])
                .filter((g) => g.owner_id === a.owner_id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.agreement_type} · {g.starts_on}
                  </option>
                ))}
            </Select>
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => onChange(allocations.filter((_, j) => i !== j))}
          >
            إزالة التوزيع {i + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={!propertyId || owners.isError || owners.isPending}
        onClick={() => onChange([...allocations, { owner_id: "", amount: 0 }])}
      >
        إضافة توزيع
      </Button>
      <label className="block">
        مرجع اعتماد التوزيع
        <Textarea
          aria-label="مرجع اعتماد التوزيع"
          value={evidence}
          onChange={(e) => onEvidenceChange(e.target.value)}
          placeholder="مرجع الفاتورة أو اعتماد الالتزام والمبالغ"
        />
      </label>
    </fieldset>
  );
}

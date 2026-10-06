import { Download, FileText, Printer } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActionMenu } from '@/components/ui/action-menu';
import { StatusBadge } from '@/components/ui/status-badge';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import type { ContractDetail } from '../services/contractService';
import { useContractEvidenceState } from '../evidence/use-contract-evidence';
import {
  printLeaseSummary,
  downloadLeaseSummaryPdf,
  printUnitInspection,
  downloadUnitInspectionPdf,
} from './contract-documents';

/**
 * Issuable contract documents, grouped inside the existing Documents tab.
 *
 * Only capabilities with authoritative backing are exposed:
 *  - Lease Summary: every field comes from the canonical ContractDetail row.
 *  - Unit Inspection reports: one action per REVIEWED inspection record —
 *    the maker-checker approved state from the evidence authority. Draft,
 *    completed-but-unreviewed, or change-requested inspections never print,
 *    and no inspection is ever auto-selected on the tenant's behalf.
 *
 * Lease notices, tenant final clearance, and the legal dossier are NOT
 * offered here: no canonical notice entity, clearance ruling, or dispute
 * timeline exists yet, and fabricating those facts client-side is forbidden.
 */
export function ContractDocumentActionsSection({ contract }: Readonly<{ contract: ContractDetail }>) {
  const documentSettings = useDocumentSettings();
  const evidenceQuery = useContractEvidenceState(contract.id);
  const disabled = !documentSettings.isReady;
  const settings = documentSettings.companySettings;

  const reviewedInspections = (evidenceQuery.data?.inspections ?? []).filter(
    (inspection) => inspection.status === 'REVIEWED',
  );

  return (
    <Card data-contract-document-actions>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-primary" aria-hidden="true" />
          إصدار مستندات العقد
        </CardTitle>
        <CardDescription>
          تصدر المستندات من بيانات العقد والفحوصات المعتمدة فقط؛ لا يُصدر النظام إشعارات أو مخالصات دون سجل معتمد.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">ملخص عقد الإيجار</p>
            <p className="mt-0.5 text-xs text-muted-foreground">صحيفة موجزة ببيانات العقد والمستأجر والوحدة.</p>
          </div>
          <ActionMenu
            variant="labeled"
            label="إصدار"
            disabled={disabled}
            items={[
              { id: 'lease-summary-print', label: 'طباعة', icon: Printer, onClick: () => void printLeaseSummary(contract, settings) },
              { id: 'lease-summary-pdf', label: 'تنزيل PDF', icon: Download, onClick: () => void downloadLeaseSummaryPdf(contract, settings) },
            ]}
          />
        </div>

        {reviewedInspections.map((inspection) => (
          <div key={inspection.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
            <div className="min-w-0">
              <p className="text-sm font-bold">
                {inspection.kind === 'MOVE_IN' ? 'محضر فحص الدخول' : 'محضر فحص الإخلاء'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                تاريخ الفحص <span dir="ltr">{inspection.inspected_on}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="success">معتمد</StatusBadge>
              <ActionMenu
                variant="labeled"
                label="إصدار"
                disabled={disabled}
                items={[
                  { id: `inspection-print-${inspection.id}`, label: 'طباعة', icon: Printer, onClick: () => void printUnitInspection({ inspection, contract, settings }) },
                  { id: `inspection-pdf-${inspection.id}`, label: 'تنزيل PDF', icon: Download, onClick: () => void downloadUnitInspectionPdf({ inspection, contract, settings }) },
                ]}
              />
            </div>
          </div>
        ))}

        {reviewedInspections.length === 0 && !evidenceQuery.isLoading ? (
          <p className="text-xs text-muted-foreground">
            لا توجد محاضر فحص معتمدة بعد؛ يصدر محضر الفحص فور اعتماد مراجعته من قسم «التسجيل والتسليم».
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

from pathlib import Path


def replace_once(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    src = path.read_text()
    if old not in src:
        raise SystemExit(f'expected pattern not found: {path_str}')
    path.write_text(src.replace(old, new, 1))


communication = 'rentrix-app/src/features/communication/components/communication-hub-view.tsx'
replace_once(
    communication,
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { Button } from '@/components/ui/button';",
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport { Button } from '@/components/ui/button';",
)
replace_once(
    communication,
'''  const rowActions = (row: CommunicationRecord) => (\n    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <Button variant="secondary" onClick={() => onEdit(row)}><Edit className="size-4" />تعديل</Button>\n      {row.status !== 'archived' ? (\n        <Button variant="danger" disabled={isArchiving} onClick={() => setArchiveCandidate(row)}><Archive className="size-4" />أرشفة</Button>\n      ) : null}\n    </div>\n  );''',
'''  const rowActions = (row: CommunicationRecord) => (\n    <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <ActionMenu\n        label={`إجراءات ${row.contact_name}`}\n        items={[\n          { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => onEdit(row) },\n          ...(row.status !== 'archived' ? [{ id: 'archive', label: 'أرشفة', icon: Archive, danger: true, disabled: isArchiving, onClick: () => setArchiveCandidate(row) }] : []),\n        ]}\n      />\n    </div>\n  );''',
)

commissions = 'rentrix-app/src/features/commissions/components/commissions-view.tsx'
replace_once(
    commissions,
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { Button } from \"@/components/ui/button\";",
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { ActionMenu } from \"@/components/ui/action-menu\";\nimport { Button } from \"@/components/ui/button\";",
)
replace_once(
    commissions,
'''  return (\n    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <Button className="min-h-11" variant="secondary" onClick={onEdit}>\n        <Edit className="me-1 size-4" />تعديل\n      </Button>\n      {onPayClick ? (\n        <Button className="min-h-11" onClick={onPayClick}>\n          <Banknote className="me-1 size-4" />صرف مالي\n        </Button>\n      ) : null}\n      {onReverseClick ? (\n        <Button className="min-h-11" variant="secondary" onClick={onReverseClick}>\n          <Undo2 className="me-1 size-4" />عكس الصرف\n        </Button>\n      ) : null}\n      {row.status !== 'paid' && row.status !== 'cancelled' ? (\n        <Button className="min-h-11" variant="danger" disabled={disabled} onClick={onArchiveClick}>\n          <Archive className="me-1 size-4" />إلغاء\n        </Button>\n      ) : null}\n    </div>\n  );''',
'''  return (\n    <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <ActionMenu\n        label={`إجراءات عمولة ${row.staff_name}`}\n        items={[\n          { id: 'edit', label: 'تعديل', icon: Edit, onClick: onEdit },\n          ...(onPayClick ? [{ id: 'pay', label: 'صرف مالي', icon: Banknote, onClick: onPayClick }] : []),\n          ...(onReverseClick ? [{ id: 'reverse', label: 'عكس الصرف', icon: Undo2, onClick: onReverseClick }] : []),\n          ...(row.status !== 'paid' && row.status !== 'cancelled' ? [{ id: 'cancel', label: 'إلغاء', icon: Archive, danger: true, disabled, onClick: onArchiveClick }] : []),\n        ]}\n      />\n    </div>\n  );''',
)

utilities = 'rentrix-app/src/features/utilities/components/utilities-workspace.tsx'
replace_once(
    utilities,
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { Button } from '@/components/ui/button';",
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport { Button } from '@/components/ui/button';\nimport { ExportMenu } from '@/components/ui/export-menu';",
)
replace_once(
    utilities,
'''      render: (bill) => (\n        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n          <Button\n            variant="secondary"\n            size="sm"\n            aria-label={`تفاصيل فاتورة المرافق ${bill.bill_number ?? 'فاتورة مرافق بلا مرجع'}`}\n            onClick={() => setBillToPreview(bill)}\n          >\n            <FileText className="size-4" />التفاصيل\n          </Button>\n          <Button variant="danger" size="sm" aria-label={`أرشفة فاتورة المرافق ${bill.bill_number ?? 'فاتورة مرافق بلا مرجع'}`} onClick={() => setBillToArchive(bill)}>\n            <Trash2 className="size-4" />أرشفة\n          </Button>\n        </div>\n      ),''',
'''      render: (bill) => (\n        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n          <ActionMenu\n            label={`إجراءات ${bill.bill_number ?? 'فاتورة المرافق'}`}\n            items={[\n              { id: 'details', label: 'التفاصيل', icon: FileText, onClick: () => setBillToPreview(bill) },\n              { id: 'archive', label: 'أرشفة', icon: Trash2, danger: true, onClick: () => setBillToArchive(bill) },\n            ]}\n          />\n        </div>\n      ),''',
)
replace_once(
    utilities,
'''  const headerActions = (\n    <div className="flex flex-wrap gap-2">\n      <Button variant="outline" onClick={handlePrint} disabled={!documentSettings.isReady || isError}><Printer className="size-4" />طباعة كشف المرافق</Button>\n      <Button variant="secondary" onClick={handleDownloadPdf} disabled={!documentSettings.isReady || isError}><Download className="size-4" />تنزيل PDF</Button>\n    </div>\n  );''',
'''  const headerActions = (\n    <ExportMenu\n      label="تصدير كشف المرافق"\n      disabled={!documentSettings.isReady || isError}\n      items={[\n        { id: 'print', label: 'طباعة', icon: Printer, onClick: handlePrint },\n        { id: 'pdf', label: 'تنزيل PDF', icon: Download, onClick: handleDownloadPdf },\n      ]}\n    />\n  );''',
)

print('secondary row/export actions consolidated')

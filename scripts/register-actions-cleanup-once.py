from pathlib import Path


def replace_once(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    src = path.read_text()
    if old not in src:
        raise SystemExit(f'expected pattern not found: {path_str}')
    src = src.replace(old, new, 1)
    path.write_text(src)


# People: row click already opens details; secondary operations belong to ActionMenu.
people = 'rentrix-app/src/features/people/people-list-page.tsx'
replace_once(
    people,
    'import { useDialogNavigate } from "@/app/router/background-location";\nimport { Button } from "@/components/ui/button";',
    'import { useDialogNavigate } from "@/app/router/background-location";\nimport { ActionMenu } from "@/components/ui/action-menu";\nimport { Button } from "@/components/ui/button";',
)
replace_once(
    people,
'''      render: (person) => (\n        <div\n          className="flex flex-wrap gap-2"\n          onClick={(event) => event.stopPropagation()}\n          onKeyDown={(event) => event.stopPropagation()}\n        >\n          <Button\n            variant="secondary"\n            className="min-h-11 px-3"\n            onClick={() => dialogNavigate({ to: '/people/$personId', params: { personId: person.id } })}\n          >\n            عرض\n          </Button>\n          <Button\n            variant="secondary"\n            className="min-h-11 px-3"\n            onClick={() => openEdit(person.id)}\n          >\n            <Edit className="size-4" aria-hidden="true" />\n            تعديل\n          </Button>\n          <Button\n            variant="danger"\n            className="min-h-11 px-3"\n            aria-label={`أرشفة ${person.full_name}`}\n            onClick={() => setDeleteId(person.id)}\n          >\n            <Trash2 className="size-4" aria-hidden="true" />\n            أرشفة\n          </Button>\n        </div>\n      ),''',
'''      render: (person) => (\n        <div\n          className="flex"\n          onClick={(event) => event.stopPropagation()}\n          onKeyDown={(event) => event.stopPropagation()}\n        >\n          <ActionMenu\n            label={`إجراءات ${person.full_name}`}\n            items={[\n              { id: 'view', label: 'عرض', onClick: () => dialogNavigate({ to: '/people/$personId', params: { personId: person.id } }) },\n              { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => openEdit(person.id) },\n              { id: 'archive', label: 'أرشفة', icon: Trash2, danger: true, onClick: () => setDeleteId(person.id) },\n            ]}\n          />\n        </div>\n      ),''',
)

# Service providers: keep view available and collapse edit/archive into the shared row menu.
providers = 'rentrix-app/src/features/service-providers/service-providers-page.tsx'
replace_once(
    providers,
    "import { useDialogNavigate } from '@/app/router/background-location';\nimport type { ActiveFilterItem } from '@/components/ui/active-filter-bar';",
    "import { useDialogNavigate } from '@/app/router/background-location';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport type { ActiveFilterItem } from '@/components/ui/active-filter-bar';",
)
replace_once(
    providers,
'''      render: (provider) => (\n        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n          <Button type="button" variant="secondary" className="min-h-11" onClick={() => void navigate({ to: '/service-providers/$providerId', params: { providerId: provider.id } })}>عرض</Button>\n          {canWrite ? <Button type="button" variant="secondary" className="min-h-11" onClick={() => dialogNavigate({ to: '/service-providers/$providerId/edit', params: { providerId: provider.id } })}><Edit className="me-1 size-4" aria-hidden="true" />تعديل</Button> : null}\n          {canWrite ? <Button type="button" variant="ghost" className="min-h-11 text-destructive" onClick={() => setArchiveTarget(provider)}><Trash2 className="me-1 size-4" aria-hidden="true" />أرشفة</Button> : null}\n        </div>\n      ),''',
'''      render: (provider) => (\n        <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n          <ActionMenu\n            label={`إجراءات ${provider.name}`}\n            items={[\n              { id: 'view', label: 'عرض', onClick: () => void navigate({ to: '/service-providers/$providerId', params: { providerId: provider.id } }) },\n              ...(canWrite ? [\n                { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => dialogNavigate({ to: '/service-providers/$providerId/edit', params: { providerId: provider.id } }) },\n                { id: 'archive', label: 'أرشفة', icon: Trash2, danger: true, onClick: () => setArchiveTarget(provider) },\n              ] : []),\n            ]}\n          />\n        </div>\n      ),''',
)

# Lands: two secondary operations, one shared menu.
lands = 'rentrix-app/src/features/lands/components/lands-view.tsx'
replace_once(
    lands,
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { Button } from '@/components/ui/button';",
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport { Button } from '@/components/ui/button';",
)
replace_once(
    lands,
'''  const rowActions = (row: LandRecord) => (\n    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <Button variant="secondary" onClick={() => onEdit(row)}><Edit className="size-4" />تعديل</Button>\n      {row.status !== 'archived' ? (\n        <Button variant="danger" disabled={isArchiving} onClick={() => setArchiveCandidate(row)}><Archive className="size-4" />أرشفة</Button>\n      ) : null}\n    </div>\n  );''',
'''  const rowActions = (row: LandRecord) => (\n    <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <ActionMenu\n        label={`إجراءات ${row.name || row.plot_no || 'الأرض'}`}\n        items={[\n          { id: 'edit', label: 'تعديل', icon: Edit, onClick: () => onEdit(row) },\n          ...(row.status !== 'archived' ? [{ id: 'archive', label: 'أرشفة', icon: Archive, danger: true, disabled: isArchiving, onClick: () => setArchiveCandidate(row) }] : []),\n        ]}\n      />\n    </div>\n  );''',
)

# Leads: RowActions was itself a local visual action system; reduce it to ActionMenu.
leads = 'rentrix-app/src/features/leads/components/leads-view.tsx'
replace_once(
    leads,
    'import type { ActiveFilterItem } from \'@/components/ui/active-filter-bar\';\nimport { Button } from "@/components/ui/button";',
    'import type { ActiveFilterItem } from \'@/components/ui/active-filter-bar\';\nimport { ActionMenu } from "@/components/ui/action-menu";\nimport { Button } from "@/components/ui/button";',
)
replace_once(
    leads,
'''  return (\n    <div className="mt-3 flex flex-wrap gap-2">\n      <Button className="min-h-11" variant="secondary" onClick={onEdit}>\n        <Edit className="me-2 size-4" />\n        تعديل\n      </Button>\n      <Button\n        className="min-h-11"\n        variant="danger"\n        disabled={disabled}\n        onClick={onArchiveClick}\n      >\n        <Archive className="me-2 size-4" />\n        أرشفة\n      </Button>\n    </div>\n  );''',
'''  return (\n    <div className="flex">\n      <ActionMenu\n        label={`إجراءات العميل ${id}`}\n        items={[\n          { id: 'edit', label: 'تعديل', icon: Edit, onClick: onEdit },\n          { id: 'archive', label: 'أرشفة', icon: Archive, danger: true, disabled, onClick: onArchiveClick },\n        ]}\n      />\n    </div>\n  );''',
)

# Receipts: the row already opens the detail; print/void/view should not occupy three equal-width buttons.
receipts = 'rentrix-app/src/features/financials/receipts/receipts-page.tsx'
replace_once(
    receipts,
    "import { RegisterHeading, RegisterMetricStrip } from '@/components/layout/register-summary';\nimport { Button } from '@/components/ui/button';",
    "import { RegisterHeading, RegisterMetricStrip } from '@/components/layout/register-summary';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport { Button } from '@/components/ui/button';",
)
replace_once(
    receipts,
'''    { key: 'actions', header: 'الإجراءات', priority: 'actions', render: (receipt) => (\n      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n        <Button variant="secondary" className="min-h-11 px-3" onClick={() => setSelectedReceiptId(receipt.id)}>عرض</Button>\n        <Button variant="secondary" className="min-h-11 px-3" onClick={() => openReceiptPrintView(receipt.id)}><Printer className="me-2 size-4" />طباعة</Button>\n        {canVoidReceipt && receipt.status === 'posted' ? (\n          <Button variant="danger" className="min-h-11 px-3" onClick={() => openVoidDialog(receipt)} disabled={requestVoidMutation.isPending}>\n            <Ban className="me-2 size-4" />طلب إلغاء\n          </Button>\n        ) : null}\n      </div>\n    ) },''',
'''    { key: 'actions', header: 'الإجراءات', priority: 'actions', render: (receipt) => (\n      <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n        <ActionMenu\n          label={`إجراءات الإيصال ${receipt.receipt_number}`}\n          items={[\n            { id: 'view', label: 'عرض', icon: Eye, onClick: () => setSelectedReceiptId(receipt.id) },\n            { id: 'print', label: 'طباعة', icon: Printer, onClick: () => openReceiptPrintView(receipt.id) },\n            ...(canVoidReceipt && receipt.status === 'posted' ? [{\n              id: 'void',\n              label: 'طلب إلغاء',\n              icon: Ban,\n              danger: true,\n              disabled: requestVoidMutation.isPending,\n              onClick: () => openVoidDialog(receipt),\n            }] : []),\n          ]}\n        />\n      </div>\n    ) },''',
)

print('register row actions consolidated: people, service providers, lands, leads, receipts')

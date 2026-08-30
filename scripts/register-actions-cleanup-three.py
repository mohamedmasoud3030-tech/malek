from pathlib import Path


def replace_once(path_str: str, old: str, new: str) -> None:
    path = Path(path_str)
    src = path.read_text()
    if old not in src:
        raise SystemExit(f'expected pattern not found: {path_str}')
    path.write_text(src.replace(old, new, 1))


# Bank reconciliation: one row action owner instead of two equal buttons.
bank = 'rentrix-app/src/features/financials/reconciliation/bank-reconciliation-page.tsx'
replace_once(
    bank,
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { Button } from '@/components/ui/button';",
    "import type { ActiveFilterItem } from '@/components/ui/active-filter-bar';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport { Button } from '@/components/ui/button';",
)
replace_once(
    bank,
'''      render: (line) => (line.status === 'unmatched' ? (\n        <div className="flex flex-wrap gap-2">\n          <Button variant="secondary" className="min-h-11 px-3 text-xs" onClick={() => onMatch(line)}>مطابقة</Button>\n          <Button variant="secondary" className="min-h-11 px-3 text-xs" disabled={isIgnoring} onClick={() => onIgnore(line.id)}>تجاهل</Button>\n        </div>\n      ) : '—'),''',
'''      render: (line) => (line.status === 'unmatched' ? (\n        <div className="flex">\n          <ActionMenu\n            label={`إجراءات حركة ${line.description}`}\n            items={[\n              { id: 'match', label: 'مطابقة', onClick: () => onMatch(line) },\n              { id: 'ignore', label: 'تجاهل', disabled: isIgnoring, onClick: () => onIgnore(line.id) },\n            ]}\n          />\n        </div>\n      ) : '—'),''',
)

# Automation: enable/disable + run-now is one row action surface.
automation = 'rentrix-app/src/features/automation/components/automation-center-view.tsx'
replace_once(
    automation,
    "import { AsyncContentState } from '@/components/async-content-state';\nimport { Badge } from '@/components/ui/badge';",
    "import { AsyncContentState } from '@/components/async-content-state';\nimport { ActionMenu } from '@/components/ui/action-menu';\nimport { Badge } from '@/components/ui/badge';",
)
replace_once(
    automation,
'''    return (\n    <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n      <Button variant="secondary" disabled={toggleMut.isPending} onClick={() => toggleMut.mutate({ id: rule.id, enabled: !rule.is_enabled })}>\n        {rule.is_enabled ? <PauseCircle className="size-4" /> : <PlayCircle className="size-4" />}\n        {rule.is_enabled ? 'إيقاف' : 'تفعيل'}\n      </Button>\n      <Button variant="outline" disabled={executeMut.isPending || !queueSupported} title={queueSupported ? undefined : 'نوع القاعدة غير مدعوم في العامل المتين'} onClick={() => executeMut.mutate(rule.id)}>\n        <RefreshCw className="size-4" />{queueSupported ? 'تشغيل الآن' : 'غير مدعوم'}\n      </Button>\n    </div>\n    );''',
'''    return (\n      <div className="flex" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>\n        <ActionMenu\n          label={`إجراءات ${rule.name}`}\n          items={[\n            {\n              id: 'toggle',\n              label: rule.is_enabled ? 'إيقاف' : 'تفعيل',\n              icon: rule.is_enabled ? PauseCircle : PlayCircle,\n              disabled: toggleMut.isPending,\n              onClick: () => toggleMut.mutate({ id: rule.id, enabled: !rule.is_enabled }),\n            },\n            {\n              id: 'run',\n              label: queueSupported ? 'تشغيل الآن' : 'غير مدعوم',\n              icon: RefreshCw,\n              disabled: executeMut.isPending || !queueSupported,\n              onClick: () => executeMut.mutate(rule.id),\n            },\n          ]}\n        />\n      </div>\n    );''',
)

# Remove feature wrappers that only recreated FilterBar's own horizontal/filter layout.
people = 'rentrix-app/src/features/people/people-list-page.tsx'
replace_once(
    people,
'''        filters={\n          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">\n            <Select\n              aria-label="تصفية الأشخاص حسب النوع"\n              value={type}\n              onChange={(event) => {\n                setType(event.target.value as PersonTypeFilter);\n                setPage(1);\n              }}\n              className="min-h-11 w-36 shrink-0 rounded-lg"\n            >\n              <option value="all">كل الأنواع</option>\n              {personTypeValues.map((item) => (\n                <option key={item} value={item}>\n                  {personTypeLabels[item]}\n                </option>\n              ))}\n            </Select>\n\n          </div>\n        }''',
'''        filters={\n          <Select\n            aria-label="تصفية الأشخاص حسب النوع"\n            value={type}\n            onChange={(event) => {\n              setType(event.target.value as PersonTypeFilter);\n              setPage(1);\n            }}\n            className="min-h-11 w-36 shrink-0 rounded-lg"\n          >\n            <option value="all">كل الأنواع</option>\n            {personTypeValues.map((item) => (\n              <option key={item} value={item}>\n                {personTypeLabels[item]}\n              </option>\n            ))}\n          </Select>\n        }''',
)

providers = 'rentrix-app/src/features/service-providers/service-providers-page.tsx'
replace_once(
    providers,
'''        filters={(\n          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto overscroll-x-contain no-scrollbar">\n            <Select aria-label="تصفية مزودي الخدمات حسب الحالة" value={status} onChange={(event) => { setStatus(event.target.value as ServiceProviderStatusFilter); setPage(1); }} className="min-h-11 w-32 shrink-0">\n              <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option>\n            </Select>\n            <Select aria-label="تصفية حسب نوع الخدمة" value={categoryId} disabled={categoriesQuery.isLoading || categoriesQuery.isError} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }} className="min-h-11 w-40 shrink-0">\n              <option value="">كل الأنواع</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}\n            </Select>\n\n          </div>\n        )}''',
'''        filters={(\n          <>\n            <Select aria-label="تصفية مزودي الخدمات حسب الحالة" value={status} onChange={(event) => { setStatus(event.target.value as ServiceProviderStatusFilter); setPage(1); }} className="min-h-11 w-32 shrink-0">\n              <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option>\n            </Select>\n            <Select aria-label="تصفية حسب نوع الخدمة" value={categoryId} disabled={categoriesQuery.isLoading || categoriesQuery.isError} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }} className="min-h-11 w-40 shrink-0">\n              <option value="">كل الأنواع</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}\n            </Select>\n          </>\n        )}''',
)

print('bank/automation row actions and redundant filter wrappers consolidated')

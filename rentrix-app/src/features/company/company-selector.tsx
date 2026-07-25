import { useState } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useCompany, type Company } from '@/hooks/use-company';

/**
 * Full-page company selector — shown after login when user
 * belongs to multiple companies and hasn't selected one yet.
 */
export function CompanySelectorPage() {
  const { companies, activeCompany, switchCompany } = useCompany();
  const [isSwitching, setIsSwitching] = useState<string | null>(null);

  const handleSelect = async (company: Company) => {
    setIsSwitching(company.id);
    try {
      await switchCompany(company.id);
    } finally {
      setIsSwitching(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-8" dir="rtl">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-primary/10">
            <Building2 className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold">اختر مساحة العمل</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            أنت عضو في أكتر من مكتب — اختر المكتب اللي عايز تدخله
          </p>
        </div>

        {/* Company list */}
        <div className="space-y-2">
          {companies.map((company) => {
            const isActive = company.id === activeCompany?.id;
            const isSwitchingThis = isSwitching === company.id;

            return (
              <button
                key={company.id}
                onClick={() => handleSelect(company)}
                disabled={isSwitchingThis}
                className={`flex w-full items-center gap-3 rounded-xl border p-4 text-right transition
                  ${isActive
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                  }
                  disabled:opacity-60 disabled:cursor-not-allowed
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20`}
              >
                <div className={`grid size-10 shrink-0 place-items-center rounded-lg text-sm font-bold
                  ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {company.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{company.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {company.currency} · {company.locale}
                  </p>
                </div>
                {isActive && <Check className="size-5 shrink-0 text-primary" />}
                {isSwitchingThis && (
                  <span className="size-5 shrink-0 rounded-full border-2 border-primary border-t-transparent" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Compact company switcher for the app header/sidebar.
 * Only visible when user belongs to multiple companies.
 */
export function CompanySwitcher() {
  const { companies, activeCompany, switchCompany, hasMultipleCompanies } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  if (!hasMultipleCompanies || !activeCompany) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm transition hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-xs font-bold text-primary">
          {activeCompany.name.charAt(0)}
        </div>
        <span className="flex-1 truncate text-right font-medium">{activeCompany.name}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {isOpen && (
        <div
          className="absolute top-full z-50 mt-1 w-full min-w-[200px] rounded-lg border border-border bg-card shadow-elevated"
          role="listbox"
        >
          {companies.map((company) => {
            const isActive = company.id === activeCompany.id;
            return (
              <button
                key={company.id}
                onClick={async () => {
                  if (!isActive) await switchCompany(company.id);
                  setIsOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition first:rounded-t-lg last:rounded-b-lg hover:bg-muted/50
                  ${isActive ? 'bg-primary/5 text-primary font-semibold' : ''}`}
                role="option"
                aria-selected={isActive}
              >
                <div className="grid size-6 shrink-0 place-items-center rounded text-[10px] font-bold bg-primary/10 text-primary">
                  {company.name.charAt(0)}
                </div>
                <span className="flex-1 truncate text-right">{company.name}</span>
                {isActive && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('destructive action terminology and confirmation dialogs UX contract', () => {
  const confirmDialogSource = readFileSync(
    resolve(import.meta.dirname, '../../components/ui/confirm-dialog.tsx'),
    'utf8',
  );

  const contractsListSource = readFileSync(
    resolve(import.meta.dirname, './ContractsListPage.tsx'),
    'utf8',
  );

  const docShellSource = readFileSync(
    resolve(import.meta.dirname, '../../components/documents/contextual-documents-panel.tsx'),
    'utf8',
  );

  const terminateSource = readFileSync(
    resolve(import.meta.dirname, './lifecycle/ContractTerminationDialog.tsx'),
    'utf8',
  );

  it('removes misleading permanent delete language from contract archive dialogs', () => {
    expect(contractsListSource).not.toContain('سيتم حذف العقد بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.');
    expect(contractsListSource).not.toContain('أرشفة العقد (حذف العقد؟)');
    expect(contractsListSource).toContain('أرشفة العقد؟');
    expect(contractsListSource).toContain('سيتم أرشفة العقد وإخفاؤه من القائمة النشطة مع الاحتفاظ بسجله المحاسبي');
  });

  it('removes cannot be undone language from contract document archive dialogs', () => {
    expect(docShellSource).not.toContain('لا يمكن التراجع عن هذا الإجراء بعد الحذف.');
    expect(docShellSource).toContain('أرشفة المستند');
    expect(docShellSource).toContain('مع الاحتفاظ بسجله.');
  });

  it('updates default confirm dialog description to explain archival record retention', () => {
    expect(confirmDialogSource).not.toContain("description = 'لا يمكن التراجع عن هذا الإجراء.'");
    expect(confirmDialogSource).toContain('سجلات الفواتير والمدفوعات المرتبطة تبقى محفوظة في سجل التدقيق');
  });

  it('accurately describes contract termination as ending planned duration while preserving prior accounting history', () => {
    expect(terminateSource).toContain('سيتم إنهاء العقد الإيجاري قبل موعده المخطط وتغيير حالته إلى "منتهٍ"');
    expect(terminateSource).toContain('والحفاظ الكامل على السجلات والقيود المحاسبية السابقة');
  });
});

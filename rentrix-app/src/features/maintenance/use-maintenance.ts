import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { expenseKeys } from '../financials/expenses/useExpenses';
import { financialReportKeys } from '../financials/reports/useFinancialReports';
import { createMaintenance, listMaintenance, resolveMaintenanceWithExpense, updateMaintenance, updateMaintenanceStatus, type MaintenancePayload, type MaintenanceStatus, type MaintenanceUpdate } from './maintenance-service';
export const maintenanceKeys = { all: ['maintenance'] as const, list: (s: MaintenanceStatus, p: string) => [...maintenanceKeys.all, s, p] as const };
export function useMaintenance(status: MaintenanceStatus, propertyId: string) { return useQuery({ queryKey: maintenanceKeys.list(status, propertyId), queryFn: () => listMaintenance(status, propertyId) }); }
export function useCreateMaintenance() { const qc = useQueryClient(); return useMutation({ mutationFn: (p: MaintenancePayload) => createMaintenance(p), onSuccess: async () => { await qc.invalidateQueries({ queryKey: maintenanceKeys.all }); toast.success('تم حفظ طلب الصيانة'); }, onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء طلب الصيانة') }); }

export function useUpdateMaintenance() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ requestId, payload }: { requestId: string; payload: MaintenanceUpdate }) => updateMaintenance(requestId, payload), onSuccess: async () => { await qc.invalidateQueries({ queryKey: maintenanceKeys.all }); toast.success('تم تعديل طلب الصيانة'); }, onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تعديل طلب الصيانة') }); }

export function useUpdateMaintenanceStatus() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ requestId, status }: { requestId: string; status: Exclude<MaintenanceStatus, 'all'> }) => updateMaintenanceStatus(requestId, status), onSuccess: async () => { await qc.invalidateQueries({ queryKey: maintenanceKeys.all }); toast.success('تم تحديث حالة طلب الصيانة'); }, onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تحديث حالة طلب الصيانة') }); }

export function useResolveMaintenanceWithExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, cost, notes }: { requestId: string; cost: number; notes: string | null }) => resolveMaintenanceWithExpense(requestId, cost, notes),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: maintenanceKeys.all }),
        qc.invalidateQueries({ queryKey: expenseKeys.all }),
        qc.invalidateQueries({ queryKey: financialReportKeys.all }),
      ]);
      toast.success('تم إغلاق طلب الصيانة وتسجيل التكلفة كمصروف');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إغلاق طلب الصيانة'),
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createUtilityBill,
  createUtilityMeter,
  listUtilityBills,
  listUtilityMeters,
  softDeleteUtilityBill,
  softDeleteUtilityMeter,
  updateUtilityBill,
  updateUtilityMeter,
  type UtilityBill,
  type UtilityBillFormValues,
  type UtilityBillStatus,
  type UtilityMeter,
  type UtilityMeterFormValues,
} from './utilities-service';

export function useUtilityMeters(propertyId?: string) {
  return useQuery({
    queryKey: ['utility-meters', propertyId ?? 'all'],
    queryFn: () => listUtilityMeters(propertyId),
  });
}

export function useUtilityBills(filter?: { propertyId?: string; status?: UtilityBillStatus; meterId?: string }) {
  return useQuery({
    queryKey: ['utility-bills', filter ?? {}],
    queryFn: () => listUtilityBills(filter),
  });
}

export function useCreateUtilityMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: UtilityMeterFormValues) => createUtilityMeter(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utility-meters'] });
    },
  });
}

export function useUpdateUtilityMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<UtilityMeterFormValues> }) => updateUtilityMeter(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utility-meters'] });
    },
  });
}

export function useDeleteUtilityMeter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteUtilityMeter(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utility-meters'] });
    },
  });
}

export function useCreateUtilityBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: UtilityBillFormValues) => createUtilityBill(values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utility-bills'] });
    },
  });
}

export function useUpdateUtilityBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: Partial<UtilityBillFormValues> }) => updateUtilityBill(id, values),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utility-bills'] });
    },
  });
}

export function useDeleteUtilityBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => softDeleteUtilityBill(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utility-bills'] });
    },
  });
}

export type UtilityMetersAndBills = {
  meters: UtilityMeter[];
  bills: UtilityBill[];
};

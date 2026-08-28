import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AppPermission } from '@/features/auth/permissions';
import {
  listEmployeeEffectivePermissions,
  setEmployeePermission,
} from '@/features/auth/permission-request-service';

export type EmployeePermissionEntry = Readonly<{
  user_id: string;
  permission: AppPermission;
  allowed: boolean;
  explicitly_set: boolean;
}>;

export function useEmployeePermissionManagement(enabled: boolean) {
  const permissionsQuery = useQuery({
    queryKey: ['governance-employee-effective-permissions'],
    queryFn: async () => (await listEmployeeEffectivePermissions()) as EmployeePermissionEntry[],
    enabled,
  });

  const permissionMutation = useMutation({
    mutationFn: ({ userId, permission, allowed }: {
      userId: string;
      permission: AppPermission;
      allowed: boolean;
    }) => setEmployeePermission(userId, permission, allowed),
    onSuccess: async () => {
      await permissionsQuery.refetch();
      toast.success('تم تحديث صلاحيات الموظف');
    },
    onError: () => toast.error('تعذر تحديث صلاحية الموظف'),
  });

  return {
    permissionsQuery,
    permissionMutation,
  };
}

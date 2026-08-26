import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  decidePermissionRequest,
  listPermissionRequestsForReview,
  revokePermissionGrant,
  type PermissionRequest,
} from '@/features/auth/permission-request-service';

export type { PermissionRequest } from '@/features/auth/permission-request-service';

export function usePermissionRequestReview() {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState<PermissionRequest | null>(null);
  const [decisionReason, setDecisionReason] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['permission-requests', 'review'],
    queryFn: () => listPermissionRequestsForReview(),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['permission-requests'] });
  };

  const decisionMutation = useMutation({
    mutationFn: ({ request, decision, reason }: {
      request: PermissionRequest;
      decision: 'APPROVED' | 'REJECTED';
      reason: string;
    }) => decidePermissionRequest(request.id, decision, reason),
    onSuccess: async (_result, variables) => {
      await refresh();
      setRejecting(null);
      setDecisionReason('');
      toast.success(variables.decision === 'APPROVED' ? 'تم اعتماد الصلاحية وتفعيلها.' : 'تم رفض الطلب وتسجيل السبب.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تسجيل القرار.'),
  });

  const revokeMutation = useMutation({
    mutationFn: (request: PermissionRequest) => revokePermissionGrant(
      request.requester_user_id,
      request.permission,
      'إلغاء المنحة من شاشة مراجعة الصلاحيات',
    ),
    onSuccess: async () => {
      await refresh();
      toast.success('تم إلغاء المنحة وتحديث صلاحيات المستخدم.');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إلغاء المنحة.'),
  });

  return {
    requestsQuery,
    requests: requestsQuery.data ?? [],
    decisionMutation,
    revokeMutation,
    rejecting,
    setRejecting,
    decisionReason,
    setDecisionReason,
  };
}

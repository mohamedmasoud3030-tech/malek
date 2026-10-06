import { useMutation } from '@tanstack/react-query';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { buildTenantPortalUrl, createTenantPortalLink } from '../tenant-portal-admin-service';

export function TenantPortalLinkAction({ tenantId }: Readonly<{ tenantId: string }>) {
  const { canAccess } = useAuth();
  const mutation = useMutation({
    mutationFn: () => createTenantPortalLink(tenantId),
    onSuccess: async (link) => {
      const url = buildTenantPortalUrl(link.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success('تم إنشاء رابط خاص جديد ونسخه. الرابط السابق أصبح غير صالح.');
      } catch {
        toast.error(`تم إنشاء الرابط لكن تعذر نسخه: ${url}`);
      }
    },
    onError: () => toast.error('تعذر إنشاء رابط بوابة المستأجر.'),
  });

  // users.manage is owner-only in the canonical catalog. The RPC repeats the
  // owner check server-side; this gate is presentation only.
  if (!canAccess('users.manage')) return null;

  return (
    <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Link2 className="me-2 size-4" />}
      إنشاء ونسخ رابط البوابة
    </Button>
  );
}

import { useMutation } from '@tanstack/react-query';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { buildOwnerPortalUrl, createOwnerPortalLink } from '../owner-portal-admin-service';

export function OwnerPortalLinkAction({ ownerId }: Readonly<{ ownerId: string }>) {
  const { canAccess } = useAuth();
  const mutation = useMutation({
    mutationFn: () => createOwnerPortalLink(ownerId),
    onSuccess: async (link) => {
      const url = buildOwnerPortalUrl(link.token);
      try {
        await navigator.clipboard.writeText(url);
        toast.success('تم إنشاء رابط عرض جديد ونسخه. الرابط السابق أصبح غير صالح.');
      } catch {
        toast.error(`تم إنشاء الرابط لكن تعذر نسخه: ${url}`);
      }
    },
    onError: () => toast.error('تعذر إنشاء رابط بوابة المالك.'),
  });

  if (!canAccess('owner.portal.link')) return null;

  return (
    <Button type="button" variant="secondary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending ? <Loader2 className="me-2 size-4 animate-spin" /> : <Link2 className="me-2 size-4" />}
      إنشاء ونسخ رابط عرض
    </Button>
  );
}

import { Link } from '@tanstack/react-router';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AccessDeniedProps = Readonly<{
  message?: string;
}>;

export function AccessDenied({ message }: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md overflow-hidden">
        <div className="h-1.5 bg-destructive" />
        <CardHeader className="items-center text-center">
          <ShieldAlert className="size-10 text-destructive" />
          <CardTitle className="text-xl">غير مصرح بالوصول</CardTitle>
          <CardDescription>
            {message ?? 'ليس لديك الصلاحية اللازمة لعرض هذه الصفحة. تواصل مع المدير أو المسؤول إذا كنت تحتاج إلى الوصول.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Button asChild>
            <Link to="/dashboard">العودة إلى لوحة التحكم</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

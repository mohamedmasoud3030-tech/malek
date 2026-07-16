import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center p-6">
      <Card className="max-w-lg text-center">
        <CardHeader>
          <CardTitle>الصفحة غير موجودة</CardTitle>
          <CardDescription>المسار المطلوب غير متاح في بنية Rentrix الجديدة.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild><Link to="/dashboard">العودة للوحة التحكم</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

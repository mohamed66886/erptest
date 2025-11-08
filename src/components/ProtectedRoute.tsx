import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert, Lock } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission: string;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredPermission,
  redirectTo = '/'
}) => {
  const { hasPermission, currentUser } = usePermissions();

  // إذا لم يكن هناك مستخدم مسجل دخول - لا نحتاج للتحقق هنا
  // لأن Index.tsx يتحقق من ذلك بالفعل
  // if (!currentUser) {
  //   return <Navigate to="/" replace />;
  // }

  // إذا لم يكن لديه صلاحية
  if (currentUser && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="p-4 bg-red-100 rounded-full">
                  <ShieldAlert className="h-12 w-12 text-red-600" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">
                  <Lock className="inline-block ml-2 h-6 w-6" />
                  غير مصرح بالدخول
                </h2>
                <p className="text-gray-600">
                  عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة.
                </p>
                <p className="text-sm text-gray-500">
                  يرجى التواصل مع المسؤول للحصول على الصلاحيات المناسبة.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => window.history.back()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  العودة للخلف
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

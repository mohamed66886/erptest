import { useState, useEffect } from 'react';

interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  position: string;
  permissions?: string[];
}

// دالة مساعدة لتحديث localStorage وإطلاق حدث
export const updateLocalStorageUser = (user: CurrentUser) => {
  localStorage.setItem('currentUser', JSON.stringify(user));
  window.dispatchEvent(new Event('localStorageUpdated'));
};

export const usePermissions = () => {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    // دالة لتحميل بيانات المستخدم
    const loadUser = () => {
      const storedUser = localStorage.getItem('currentUser');
      console.log('🔍 Loading user from localStorage:', storedUser);
      
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          console.log('✅ Parsed user:', user);
          console.log('📋 User permissions:', user.permissions);
          setCurrentUser(user);
          setPermissions(user.permissions || []);
        } catch (error) {
          console.error('❌ Error parsing user permissions:', error);
        }
      } else {
        // إذا لم يكن هناك مستخدم في localStorage، نظف الحالة
        console.log('⚠️ No user in localStorage');
        setCurrentUser(null);
        setPermissions([]);
      }
    };

    // تحميل البيانات عند التشغيل
    loadUser();

    // إضافة مستمع لتحديثات localStorage
    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔄 Storage event received:', e.key);
      if (e.key === 'currentUser') {
        loadUser();
      }
    };

    // الاستماع لتغييرات localStorage من نوافذ أخرى
    window.addEventListener('storage', handleStorageChange);

    // إضافة مستمع مخصص لنفس النافذة
    const handleCustomStorageChange = () => {
      console.log('🔔 Custom storage update event received');
      loadUser();
    };
    window.addEventListener('localStorageUpdated', handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageUpdated', handleCustomStorageChange);
    };
  }, []);

  const hasPermission = (pageId: string): boolean => {
    console.log(`🔐 Checking permission for "${pageId}"`);
    console.log(`👤 Current user:`, currentUser);
    console.log(`📜 Permissions:`, permissions);
    
    // مدير عام له صلاحية الوصول لكل الصفحات
    if (currentUser?.position === 'مدير عام') {
      console.log(`✅ User is "مدير عام" - access granted`);
      return true;
    }
    
    const hasAccess = permissions.includes(pageId);
    console.log(`${hasAccess ? '✅' : '❌'} Permission "${pageId}": ${hasAccess}`);
    return hasAccess;
  };

  const checkPermission = (pageId: string): boolean => {
    return hasPermission(pageId);
  };

  return {
    currentUser,
    permissions,
    hasPermission,
    checkPermission
  };
};

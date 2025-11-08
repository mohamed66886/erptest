# إصلاح مشكلة تجميد الكروت رغم وجود الصلاحيات

## المشكلة
مستخدم لديه صلاحية الوصول إلى صفحة "الطلبات"، لكن بعد تسجيل الدخول الكارت يظل متجمداً وغير قابل للنقر.

## السبب الجذري

### المشكلة في `usePermissions` Hook

**الكود القديم:**
```typescript
useEffect(() => {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    const user = JSON.parse(storedUser);
    setCurrentUser(user);
    setPermissions(user.permissions || []);
  }
}, []); // ❌ يعمل مرة واحدة فقط عند التحميل
```

**المشكلة:**
1. الـ `useEffect` يعمل مرة واحدة فقط عند تحميل المكون
2. عند تسجيل الدخول وحفظ البيانات في localStorage، الـ Hook لا يُعيد قراءة البيانات
3. المكونات التي تستخدم `hasPermission` تحصل على قيمة قديمة (فارغة)
4. النتيجة: جميع الكروت تظهر متجمدة حتى لو كان المستخدم لديه صلاحيات

## الحل المطبق

### 1. تحديث `usePermissions.ts`

**الكود الجديد:**
```typescript
useEffect(() => {
  // دالة لتحميل بيانات المستخدم
  const loadUser = () => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      setCurrentUser(user);
      setPermissions(user.permissions || []);
    } else {
      setCurrentUser(null);
      setPermissions([]);
    }
  };

  // تحميل البيانات عند التشغيل
  loadUser();

  // إضافة مستمع لتحديثات localStorage
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'currentUser') {
      loadUser();
    }
  };

  // الاستماع لتغييرات localStorage من نوافذ أخرى
  window.addEventListener('storage', handleStorageChange);

  // إضافة مستمع مخصص لنفس النافذة
  const handleCustomStorageChange = () => {
    loadUser();
  };
  window.addEventListener('localStorageUpdated', handleCustomStorageChange);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    window.removeEventListener('localStorageUpdated', handleCustomStorageChange);
  };
}, []);
```

**التحسينات:**
- ✅ إنشاء دالة `loadUser()` قابلة لإعادة الاستخدام
- ✅ الاستماع لحدث `storage` (للتحديثات من نوافذ أخرى)
- ✅ الاستماع لحدث مخصص `localStorageUpdated` (لنفس النافذة)
- ✅ تنظيف المستمعات عند إزالة المكون

### 2. تحديث `LoginPage.tsx`

**الكود القديم:**
```typescript
localStorage.setItem('currentUser', JSON.stringify({
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  position: user.position
}));
```

**الكود الجديد:**
```typescript
const userData = {
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  position: user.position,
  permissions: user.permissions || [] // ✅ إضافة الصلاحيات
};

localStorage.setItem('currentUser', JSON.stringify(userData));

// ✅ إطلاق حدث مخصص لإعلام المكونات الأخرى
window.dispatchEvent(new Event('localStorageUpdated'));
```

**التحسينات:**
- ✅ حفظ الصلاحيات في localStorage
- ✅ إطلاق حدث عند التحديث

### 3. تحديث `Index.tsx`

```typescript
const handleLogin = () => {
  const storedUser = localStorage.getItem('currentUser');
  if (storedUser) {
    const parsedUser = JSON.parse(storedUser);
    setCurrentUser(parsedUser);
    // ✅ إطلاق حدث لإعلام باقي المكونات
    window.dispatchEvent(new Event('localStorageUpdated'));
  }
  // ...
};
```

### 4. إضافة TypeScript Type

```typescript
interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  password: string;
  position: string;
  permissions?: string[]; // ✅ إضافة الصلاحيات
}
```

## كيف يعمل الحل

### تدفق تسجيل الدخول:

```
1. المستخدم يختار الحساب ويدخل كلمة المرور
   ↓
2. LoginPage: التحقق من كلمة المرور
   ↓
3. إنشاء userData يحتوي على الصلاحيات
   ↓
4. حفظ في localStorage
   ↓
5. إطلاق حدث 'localStorageUpdated'
   ↓
6. usePermissions يستمع للحدث
   ↓
7. إعادة قراءة localStorage
   ↓
8. تحديث permissions state
   ↓
9. OutputsManagement يُعيد التقييم
   ↓
10. الكروت تظهر بشكل صحيح حسب الصلاحيات ✅
```

### تدفق التحقق من الصلاحيات:

```
hasPermission('delivery-orders')
   ↓
1. إذا كان position === 'مدير عام' → return true ✅
   ↓
2. وإلا: تحقق من permissions.includes('delivery-orders')
   ↓
3. إذا موجود → return true ✅
   ↓
4. إذا غير موجود → return false ❌
```

## الاختبار

### السيناريو 1: مدير فرع مع صلاحيات محددة

**البيانات:**
```json
{
  "id": "123",
  "username": "ahmad_branch",
  "fullName": "أحمد محمد",
  "position": "مدير فرع",
  "permissions": ["delivery-orders", "confirm-orders"]
}
```

**النتيجة المتوقعة:**
- ✅ كارت "الطلبات" يعمل بشكل طبيعي
- ✅ كارت "تأكيد الطلبات" يعمل بشكل طبيعي
- ❌ كارت "الطلبات المكتملة" متجمد
- ❌ كارت "إدارة المستخدمين" متجمد

### السيناريو 2: مدير عام

**البيانات:**
```json
{
  "id": "456",
  "username": "admin",
  "fullName": "المدير العام",
  "position": "مدير عام",
  "permissions": []
}
```

**النتيجة المتوقعة:**
- ✅ جميع الكروت تعمل (بغض النظر عن الصلاحيات)

## الملفات المعدلة

1. **src/hooks/usePermissions.ts**
   - إضافة مستمعات للأحداث
   - دالة `loadUser()` قابلة لإعادة الاستخدام
   - تنظيف المستمعات

2. **src/components/LoginPage.tsx**
   - حفظ الصلاحيات في localStorage
   - إطلاق حدث `localStorageUpdated`
   - إضافة permissions للـ interface

3. **src/pages/Index.tsx**
   - إطلاق حدث عند تحديث المستخدم

## الفوائد

✅ **تحديث فوري**: الصلاحيات تُحدث فوراً بعد تسجيل الدخول
✅ **دقة أعلى**: لا توجد حالات متأخرة أو قيم قديمة
✅ **تزامن أفضل**: جميع المكونات تحصل على نفس البيانات
✅ **سهولة الصيانة**: كود نظيف ومنظم

## ملاحظات مهمة

1. **حدث storage**: يعمل فقط بين نوافذ مختلفة، لذلك نستخدم حدث مخصص لنفس النافذة
2. **Event Listeners**: يتم تنظيفها تلقائياً عند إزالة المكون
3. **Performance**: الحدث يُطلق فقط عند الحاجة، لا يؤثر على الأداء

---
**تاريخ الإصلاح**: 8 نوفمبر 2025
**الحالة**: ✅ تم الحل بنجاح

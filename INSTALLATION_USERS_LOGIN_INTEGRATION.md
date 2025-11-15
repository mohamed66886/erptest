# ربط مستخدمي التركيب بنظام تسجيل الدخول والصلاحيات

## نظرة عامة
تم ربط مستخدمي التركيب بنظام تسجيل الدخول والصلاحيات بنفس طريقة مستخدمي التوصيل، مع دعم كامل للصلاحيات والتحكم في الوصول.

---

## 🔄 التغييرات المطبقة

### 1. **تحديث صفحة تسجيل الدخول** (`src/components/LoginPage.tsx`)

#### أ. تحديث واجهة SystemUser
```typescript
interface SystemUser {
  id: string;
  username: string;
  fullName: string;
  password: string;
  position: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  permissions?: string[];
  accessType?: string;           // ✅ جديد
  userType?: 'delivery' | 'installation';  // ✅ جديد
  financialYearId?: string;      // ✅ جديد للتركيب
}
```

#### ب. دمج مستخدمي التركيب والتوصيل
```typescript
useEffect(() => {
  const fetchUsers = async () => {
    // 1️⃣ جلب مستخدمي التوصيل من مجموعة users
    const deliveryUsers = /* ... */;
    
    // 2️⃣ جلب مستخدمي التركيب من financial_years/{id}/installation_users
    const financialYearsSnapshot = await getDocs(collection(db, 'financial_years'));
    const installationUsers: SystemUser[] = [];
    
    for (const yearDoc of financialYearsSnapshot.docs) {
      const installationUsersSnapshot = await getDocs(
        collection(db, `financial_years/${yearDoc.id}/installation_users`)
      );
      // إضافة المستخدمين مع تمييز userType='installation'
    }
    
    // 3️⃣ دمج المستخدمين
    const allUsers = [...deliveryUsers, ...installationUsers];
    setUsers(allUsers);
  };
}, []);
```

#### ج. تحسين عرض المستخدمين
```tsx
<Option key={user.id} value={user.id}>
  <div className="flex flex-col">
    <div className="flex items-center gap-2">
      <span className="font-semibold">{user.fullName}</span>
      {user.userType && (
        <span className={`badge ${user.userType === 'installation' ? 'amber' : 'violet'}`}>
          {user.userType === 'installation' ? 'تركيب' : 'توصيل'}
        </span>
      )}
    </div>
    <span className="text-xs">{user.position}</span>
  </div>
</Option>
```

#### د. حفظ بيانات المستخدم عند تسجيل الدخول
```typescript
const userData = {
  id: user.id,
  username: user.username,
  fullName: user.fullName,
  position: user.position,
  branchId: user.branchId,
  branchName: user.branchName,
  warehouseId: user.warehouseId,
  warehouseName: user.warehouseName,
  permissions: user.permissions || [],
  accessType: user.accessType,        // ✅ جديد
  userType: user.userType,            // ✅ جديد
  financialYearId: user.financialYearId  // ✅ جديد
};

localStorage.setItem('currentUser', JSON.stringify(userData));
window.dispatchEvent(new Event('localStorageUpdated'));
```

---

### 2. **تحديث Hook الصلاحيات** (`src/hooks/usePermissions.ts`)

```typescript
interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  position: string;
  permissions?: string[];
  userType?: 'delivery' | 'installation';  // ✅ جديد
  financialYearId?: string;                // ✅ جديد
  accessType?: string;                     // ✅ جديد
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
}
```

**الفوائد:**
- دعم كامل لمستخدمي التركيب والتوصيل
- التمييز بين أنواع المستخدمين
- دعم الوصول المتقاطع (installation_delivery / delivery_installation)

---

### 3. **تحديث إدارة مستخدمي التركيب** (`src/pages/installation/UsersManagement.tsx`)

#### تحديث localStorage عند التعديل
```typescript
if (editingUser?.id) {
  await updateDoc(/* ... */);
  
  // تحديث localStorage إذا كان المستخدم الحالي
  const currentUserData = localStorage.getItem('currentUser');
  if (currentUserData) {
    const currentUser = JSON.parse(currentUserData);
    if (currentUser.id === editingUser.id && currentUser.userType === 'installation') {
      const updatedUser = {
        id: editingUser.id,
        username: userData.username,
        fullName: userData.fullName,
        position: userData.position,
        branchId: userData.branchId,
        permissions: userData.permissions,
        accessType: userData.accessType,
        userType: 'installation',
        financialYearId: currentFinancialYear.id
      };
      
      localStorage.setItem('currentUser', JSON.stringify(updatedUser));
      window.dispatchEvent(new Event('localStorageUpdated'));
    }
  }
}
```

---

## 📊 هيكل قاعدة البيانات

### مستخدمو التوصيل
```
/users/{userId}
  - username
  - fullName
  - password
  - position
  - branchId (optional)
  - warehouseId (optional)
  - permissions: []
  - accessType: 'delivery' | 'delivery_installation'
```

### مستخدمو التركيب
```
/financial_years/{yearId}/installation_users/{userId}
  - username
  - fullName
  - password
  - position
  - branchId (optional)
  - permissions: []
  - accessType: 'installation' | 'installation_delivery'
```

---

## 🔐 نظام الصلاحيات

### 1. مستخدم التوصيل فقط
- `accessType: 'delivery'`
- `userType: 'delivery'`
- الوصول إلى: 14 صفحة توصيل

### 2. مستخدم التوصيل + التركيب
- `accessType: 'delivery_installation'`
- `userType: 'delivery'`
- الوصول إلى: 14 صفحة توصيل + 7 صفحات تركيب

### 3. مستخدم التركيب فقط
- `accessType: 'installation'`
- `userType: 'installation'`
- `financialYearId: '{yearId}'`
- الوصول إلى: 7 صفحات تركيب

### 4. مستخدم التركيب + التوصيل
- `accessType: 'installation_delivery'`
- `userType: 'installation'`
- `financialYearId: '{yearId}'`
- الوصول إلى: 7 صفحات تركيب + 14 صفحة توصيل

---

## 🎯 تدفق تسجيل الدخول

```
1. المستخدم يختار الحساب من القائمة
   ↓
2. النظام يتعرف على نوع المستخدم (userType)
   ↓
3. التحقق من كلمة المرور
   ↓
4. حفظ بيانات المستخدم في localStorage:
   - المعلومات الأساسية
   - userType (delivery/installation)
   - accessType (نوع الوصول)
   - financialYearId (للتركيب)
   - permissions (الصلاحيات)
   ↓
5. إطلاق حدث 'localStorageUpdated'
   ↓
6. usePermissions يستمع ويحدث الصلاحيات
   ↓
7. الصفحات تعرض/تخفي حسب الصلاحيات
```

---

## 🧪 طريقة الاختبار

### 1. اختبار تسجيل الدخول
```javascript
// في Console
const user = JSON.parse(localStorage.getItem('currentUser'));
console.log('User Type:', user.userType);  // 'delivery' أو 'installation'
console.log('Access Type:', user.accessType);
console.log('Permissions:', user.permissions);
console.log('Financial Year:', user.financialYearId);  // للتركيب فقط
```

### 2. اختبار الصلاحيات
```javascript
// في Console
import { usePermissions } from '@/hooks/usePermissions';
const { hasPermission, currentUser } = usePermissions();

console.log(hasPermission('installation-orders'));  // true/false
console.log(hasPermission('delivery-orders'));      // true/false
```

### 3. اختبار تحديث البيانات
- سجل دخول كمستخدم تركيب
- اذهب إلى إدارة مستخدمي التركيب
- عدل بيانات حسابك
- تحقق من تحديث localStorage تلقائياً

---

## ✅ المزايا الجديدة

1. **✅ تسجيل دخول موحد**
   - مستخدمو التركيب والتوصيل في نفس الصفحة
   - تمييز واضح بين الأنواع (badges)

2. **✅ صلاحيات متكاملة**
   - دعم كامل لنظام الصلاحيات
   - التحكم في الوصول لكل صفحة
   - دعم الوصول المتقاطع بين الأنظمة

3. **✅ تحديث تلقائي**
   - عند تعديل بيانات المستخدم، يتم تحديث الجلسة تلقائياً
   - إطلاق أحداث لإعلام المكونات الأخرى

4. **✅ دعم السنوات المالية**
   - مستخدمو التركيب مرتبطون بالسنة المالية
   - يتم حفظ `financialYearId` في الجلسة

5. **✅ واجهة محسنة**
   - عرض نوع المستخدم (تركيب/توصيل) بشكل واضح
   - badges ملونة للتمييز

---

## 🔧 الملفات المعدلة

### 1. `src/components/LoginPage.tsx`
- تحديث interface SystemUser
- دمج مستخدمي التركيب والتوصيل
- تحسين عرض المستخدمين
- حفظ بيانات موسعة في localStorage

### 2. `src/hooks/usePermissions.ts`
- تحديث interface CurrentUser
- إضافة دعم userType
- إضافة دعم financialYearId
- إضافة دعم accessType

### 3. `src/pages/installation/UsersManagement.tsx`
- تحديث localStorage عند تعديل المستخدم
- دعم تحديث الجلسة الحالية
- إطلاق أحداث التحديث

---

## 📝 ملاحظات مهمة

### لمستخدمي التركيب
- يتم تخزينهم في `financial_years/{yearId}/installation_users`
- كل سنة مالية لها مستخدميها الخاصين
- يتم حفظ `financialYearId` في localStorage

### لمستخدمي التوصيل
- يتم تخزينهم في `users` (مجموعة عامة)
- غير مرتبطين بسنة مالية محددة
- `financialYearId` سيكون `undefined`

### الوصول المتقاطع
- يمكن لمستخدم التوصيل الوصول للتركيب عبر `delivery_installation`
- يمكن لمستخدم التركيب الوصول للتوصيل عبر `installation_delivery`
- الصلاحيات تعمل بشكل ديناميكي حسب `accessType`

---

## 🚀 الخطوات التالية (إن لزم الأمر)

1. **إضافة فلترة في صفحة تسجيل الدخول**
   - خيار لعرض مستخدمي التركيب فقط
   - خيار لعرض مستخدمي التوصيل فقط

2. **تحسين الأداء**
   - تخزين cache للمستخدمين
   - تحميل lazy للبيانات

3. **إضافة تقارير**
   - عدد مستخدمي التركيب النشطين
   - عدد مستخدمي التوصيل النشطين
   - توزيع الصلاحيات

---

## 🎉 النتيجة النهائية

الآن مستخدمو التركيب **مدمجون بالكامل** مع نظام تسجيل الدخول والصلاحيات:

✅ تسجيل دخول موحد
✅ صلاحيات متكاملة  
✅ دعم الوصول المتقاطع
✅ تحديث تلقائي للجلسة
✅ تمييز واضح بين الأنواع
✅ دعم السنوات المالية

---

**تاريخ التطبيق:** 15 نوفمبر 2025  
**الحالة:** ✅ مكتمل ويعمل بنجاح

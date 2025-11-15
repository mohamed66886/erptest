# 🚀 طريقة سريعة لإضافة مستخدم تركيب من Console

## استخدم هذا الكود في Console المتصفح

### 1. افتح Console (F12)

### 2. انسخ والصق هذا الكود:

```javascript
// استيراد Firebase
import { collection, addDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

// معرف السنة المالية (استخدم أحد هذه):
// 2025: 'uwPhx23jLXWvbDNgZPDL'
// 2024: '7yEfe3dFL5i6qUVm1V87'
// 2018: 'kbEIrI9McVnDtACAxgxt'

const yearId = 'uwPhx23jLXWvbDNgZPDL'; // سنة 2025

// بيانات المستخدم
const newUser = {
  username: 'installation_admin',
  fullName: 'مدير التركيب',
  password: '123456',
  position: 'مدير عام',
  accessType: 'installation',
  permissions: [
    'installation-settings',
    'technicians',
    'users-management',
    'installation-orders',
    'installation-confirmed-orders',
    'installation-completed-orders',
    'installation-archived-orders'
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

// إضافة المستخدم
addDoc(collection(db, `financialYears/${yearId}/installation_users`), newUser)
  .then(() => {
    console.log('✅ تم إضافة المستخدم بنجاح!');
    console.log('📋 بيانات المستخدم:', newUser);
  })
  .catch((error) => {
    console.error('❌ خطأ في إضافة المستخدم:', error);
  });
```

---

## ⚡ بدلاً من ذلك، استخدم Firestore Console مباشرة:

### الخطوات:

1. **افتح Firebase Console:** https://console.firebase.google.com
2. **اذهب إلى Firestore Database**
3. **انتقل إلى المسار:**
   ```
   financialYears/uwPhx23jLXWvbDNgZPDL/installation_users
   ```
4. **اضغط "إضافة مستند" (Add document)**
5. **استخدم "Auto-ID" لإنشاء معرف تلقائي**
6. **أضف الحقول التالية:**

```
Field Name              Type        Value
──────────────────────────────────────────────────────────────
username                string      installation_admin
fullName                string      مدير التركيب
password                string      123456
position                string      مدير عام
accessType              string      installation
permissions             array       [اضغط + لإضافة عناصر]
  └─ [0]                string      installation-settings
  └─ [1]                string      technicians
  └─ [2]                string      users-management
  └─ [3]                string      installation-orders
  └─ [4]                string      installation-confirmed-orders
  └─ [5]                string      installation-completed-orders
  └─ [6]                string      installation-archived-orders
createdAt               timestamp   (اضغط "Set to server time")
updatedAt               timestamp   (اضغط "Set to server time")
```

7. **احفظ**

---

## 🧪 مستخدمين إضافيين للاختبار

### فني تركيب (صلاحيات محدودة):
```json
{
  "username": "installer1",
  "fullName": "أحمد محمد - فني",
  "password": "123456",
  "position": "فني",
  "accessType": "installation",
  "permissions": [
    "installation-orders",
    "installation-confirmed-orders"
  ]
}
```

### مشرف تركيب:
```json
{
  "username": "supervisor1",
  "fullName": "محمد علي - مشرف",
  "password": "123456",
  "position": "مشرف تركيب",
  "accessType": "installation",
  "permissions": [
    "technicians",
    "installation-orders",
    "installation-confirmed-orders",
    "installation-completed-orders"
  ]
}
```

### مدير فرع (مع معرف فرع):
```json
{
  "username": "branch_manager1",
  "fullName": "خالد أحمد - مدير فرع الرياض",
  "password": "123456",
  "position": "مدير فرع",
  "accessType": "installation",
  "branchId": "branch_id_here",
  "permissions": [
    "installation-settings",
    "technicians",
    "installation-orders",
    "installation-confirmed-orders",
    "installation-completed-orders"
  ]
}
```

### مستخدم مزدوج (تركيب + توصيل):
```json
{
  "username": "dual_user",
  "fullName": "عمر سعيد - مدير العمليات",
  "password": "123456",
  "position": "مدير عام",
  "accessType": "installation_delivery",
  "permissions": [
    "installation-settings",
    "technicians",
    "users-management",
    "installation-orders",
    "installation-confirmed-orders",
    "installation-completed-orders",
    "installation-archived-orders",
    "delivery-orders",
    "confirm-orders",
    "completed-orders",
    "drivers"
  ]
}
```

---

## ✅ بعد الإضافة

1. **حدّث صفحة تسجيل الدخول (F5)**
2. **افتح Console وتأكد من رؤية:**
   ```
   📋 Found X installation users in year 2025
   ```
3. **تحقق من القائمة المنسدلة** - يجب أن يظهر المستخدم مع:
   - 🔧 Badge "تركيب" (كهرماني)
   - 📅 رقم السنة (2025)

4. **سجل دخول واختبر الصلاحيات**

---

## 🐛 استكشاف الأخطاء

### إذا لم يظهر المستخدم:

1. **تحقق من المسار:**
   ```javascript
   // في Console
   console.log('المسار المتوقع:');
   console.log('financialYears/uwPhx23jLXWvbDNgZPDL/installation_users');
   ```

2. **تحقق من السنة المالية:**
   ```javascript
   // تأكد أن السنة نشطة
   // status === 'مفتوحة' أو activeStatus === 'نشطة'
   ```

3. **امسح Cache وحدّث الصفحة:**
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

---

**نصيحة:** ابدأ بإضافة مستخدم واحد فقط واختبره، ثم أضف المزيد.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";
import { Select, Table, Modal, Form, message, Space, Tag, Popconfirm, Input } from 'antd';
import { 
  UserCog, 
  Plus, 
  Edit, 
  Trash2
} from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useFinancialYear } from "@/hooks/useFinancialYear";

const { Option } = Select;

interface User {
  id?: string;
  username: string;
  fullName: string;
  password: string;
  position: 'مدير عام' | 'مشرف تركيب' | 'فني' | 'مدير فرع';
  accessType?: 'installation' | 'installation_delivery'; // نوع الوصول
  permissions: string[];
  branchId?: string; // معرف الفرع لمدير الفرع
  branchName?: string; // اسم الفرع لمدير الفرع
  createdAt?: Date | { toDate: () => Date };
  updatedAt?: Date | { toDate: () => Date };
}

interface Branch {
  id: string;
  name: string;
}

const InstallationUsersManagement: React.FC = () => {
  const navigate = useNavigate();
  const { currentFinancialYear } = useFinancialYear();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  const [selectedAccessType, setSelectedAccessType] = useState<string>('installation');
  const [form] = Form.useForm();

  // جميع الصفحات المتاحة في إدارة التركيب
  const installationPages = [
    { id: 'installation-settings', name: 'إعدادات التركيب', category: 'الإعدادات', system: 'installation' },
    { id: 'technicians', name: 'إدارة الفنيين', category: 'الإعدادات', system: 'installation' },
    { id: 'users-management', name: 'إدارة المستخدمين', category: 'الإعدادات', system: 'installation' },
    { id: 'installation-orders', name: 'الطلبات', category: 'العمليات', system: 'installation' },
    { id: 'installation-confirmed-orders', name: 'الطلبات المؤكدة', category: 'العمليات', system: 'installation' },
    { id: 'installation-completed-orders', name: 'الطلبات المكتملة', category: 'العمليات', system: 'installation' },
    { id: 'installation-archived-orders', name: 'الطلبات المؤرشفة', category: 'العمليات', system: 'installation' },
  ];

  // جميع الصفحات المتاحة في إدارة التوصيلات
  const deliveryPages = [
    { id: 'governorates', name: 'إدارة المحافظات', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'regions', name: 'إدارة المناطق', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'districts', name: 'إدارة الأحياء', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'drivers', name: 'إدارة السائقين', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'branch-status', name: 'حالة الفرع', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'delivery-warehouses', name: 'مستودعات التوصيل', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'link-branches', name: 'ربط الفروع', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'delivery-settings', name: 'إعدادات التوصيل', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'delivery-users', name: 'إدارة مستخدمي التوصيل', category: 'إعدادات التوصيل', system: 'delivery' },
    { id: 'delivery-orders', name: 'طلبات التوصيل', category: 'عمليات التوصيل', system: 'delivery' },
    { id: 'confirm-orders', name: 'تأكيد طلبات التوصيل', category: 'عمليات التوصيل', system: 'delivery' },
    { id: 'completed-orders', name: 'طلبات التوصيل المكتملة', category: 'عمليات التوصيل', system: 'delivery' },
    { id: 'archived-orders', name: 'طلبات التوصيل المؤرشفة', category: 'عمليات التوصيل', system: 'delivery' },
    { id: 'comprehensive-reports', name: 'تقارير التوصيل الشاملة', category: 'تقارير التوصيل', system: 'delivery' },
  ];

  // في نظام إدارة التركيب، نعرض صفحات التركيب فقط
  const availablePages = installationPages;

  // تحميل البيانات عند بدء الصفحة
  useEffect(() => {
    if (currentFinancialYear) {
      fetchUsers();
    }
    fetchBranches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFinancialYear]);

  // تحميل المستخدمين
  const fetchUsers = async () => {
    if (!currentFinancialYear) return;
    
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(
        collection(db, `financialYears/${currentFinancialYear.id}/installation_users`)
      );
      const usersData = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      message.error('خطأ في تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  // تحميل الفروع
  const fetchBranches = async () => {
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Branch[];
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching branches:', error);
      message.error('خطأ في تحميل الفروع');
    }
  };

  // فتح نافذة الإضافة
  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setSelectedPermissions([]);
    setSelectedPosition('');
    setSelectedAccessType('installation'); // دائماً تركيب فقط
    setIsModalVisible(true);
  };

  // فتح نافذة التعديل
  const handleEdit = (user: User) => {
    setEditingUser(user);
    const permissions = user.permissions || [];
    // دائماً تركيب فقط في نظام إدارة التركيب
    setSelectedPermissions(permissions);
    setSelectedPosition(user.position);
    setSelectedAccessType('installation'); // فرض نوع الوصول ليكون تركيب فقط
    form.setFieldsValue({
      username: user.username,
      fullName: user.fullName,
      password: user.password,
      position: user.position,
      accessType: 'installation', // فرض نوع الوصول
      branchId: user.branchId,
      permissions: permissions
    });
    setIsModalVisible(true);
  };

  // حذف مستخدم
  const handleDelete = async (userId: string) => {
    if (!currentFinancialYear) return;
    
    try {
      await deleteDoc(doc(db, `financialYears/${currentFinancialYear.id}/installation_users`, userId));
      message.success('تم حذف المستخدم بنجاح');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error('خطأ في حذف المستخدم');
    }
  };

  // حفظ المستخدم
  const handleSave = async (values: Partial<User>) => {
    if (!currentFinancialYear) {
      message.error('يرجى اختيار السنة المالية');
      return;
    }

    // التحقق من اختيار الفرع لمدير الفرع
    if (values.position === 'مدير فرع' && !values.branchId) {
      message.error('يرجى اختيار الفرع لمدير الفرع');
      return;
    }

    try {
      setLoading(true);
      
      const userData: Partial<User> = {
        username: values.username,
        fullName: values.fullName,
        password: values.password,
        position: values.position,
        accessType: values.accessType || 'installation',
        permissions: selectedPermissions,
        updatedAt: new Date()
      };

      // إضافة معرف الفرع واسم الفرع إذا كان مدير فرع
      if (values.position === 'مدير فرع' && values.branchId) {
        userData.branchId = values.branchId;
        // إضافة اسم الفرع أيضاً
        const selectedBranch = branches.find(b => b.id === values.branchId);
        if (selectedBranch) {
          userData.branchName = selectedBranch.name;
        }
      }

      if (editingUser?.id) {
        // تحديث مستخدم موجود
        await updateDoc(
          doc(db, `financialYears/${currentFinancialYear.id}/installation_users`, editingUser.id),
          userData
        );
        message.success('تم تحديث المستخدم بنجاح');
        
        // تحديث localStorage إذا كان المستخدم الحالي هو الذي يتم تعديله
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
              branchName: userData.branchName,
              permissions: userData.permissions,
              accessType: userData.accessType,
              userType: 'installation',
              financialYearId: currentFinancialYear.id
            };
            console.log('🔄 Updating currentUser in localStorage:', updatedUser);
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            
            // إطلاق حدث التحديث
            window.dispatchEvent(new Event('localStorageUpdated'));
            
            message.info('تم تحديث بيانات جلستك الحالية، قد تحتاج لإعادة تحميل الصفحة');
          }
        }
      } else {
        // إضافة مستخدم جديد
        await addDoc(
          collection(db, `financialYears/${currentFinancialYear.id}/installation_users`),
          {
            ...userData,
            createdAt: new Date()
          }
        );
        message.success('تم إضافة المستخدم بنجاح');
      }

      setIsModalVisible(false);
      form.resetFields();
      setSelectedPermissions([]);
      setSelectedPosition('');
      setSelectedAccessType('installation');
      fetchUsers();
    } catch (error) {
      console.error('Error saving user:', error);
      message.error('خطأ في حفظ المستخدم');
    } finally {
      setLoading(false);
    }
  };

  // أعمدة الجدول
  const columns = [
    {
      title: 'اسم المستخدم',
      dataIndex: 'username',
      key: 'username',
      width: 150,
    },
    {
      title: 'الاسم الكامل',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 200,
    },
    {
      title: 'المنصب',
      dataIndex: 'position',
      key: 'position',
      width: 150,
      render: (position: string) => {
        const colors: Record<string, string> = {
          'مدير عام': 'blue',
          'مشرف تركيب': 'green',
          'فني': 'orange',
          'مدير فرع': 'purple'
        };
        return <Tag color={colors[position]}>{position}</Tag>;
      }
    },
    {
      title: 'نوع الوصول',
      dataIndex: 'accessType',
      key: 'accessType',
      width: 150,
      render: (accessType: string) => {
        const type = accessType || 'installation';
        return (
          <Tag color={type === 'installation_delivery' ? 'cyan' : 'geekblue'}>
            {type === 'installation_delivery' ? 'تركيب وتوصيل' : 'تركيب فقط'}
          </Tag>
        );
      }
    },
    {
      title: 'الفرع',
      dataIndex: 'branchId',
      key: 'branchId',
      width: 150,
      render: (_: unknown, record: User) => {
        if (!record.branchId) return '-';
        // أولاً: استخدام branchName المحفوظ
        if (record.branchName) return record.branchName;
        // ثانياً: البحث في قائمة الفروع
        const branch = branches.find(b => b.id === record.branchId);
        return branch ? branch.name : record.branchId;
      }
    },
    {
      title: 'عدد الصلاحيات',
      key: 'permissionsCount',
      width: 120,
      render: (_: unknown, record: User) => (
        <Tag color="purple">{record.permissions?.length || 0} صفحة</Tag>
      )
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: User) => (
        <Space size="small">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(record)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Popconfirm
            title="هل أنت متأكد من حذف هذا المستخدم؟"
            onConfirm={() => handleDelete(record.id!)}
            okText="نعم"
            cancelText="لا"
          >
            <Button
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // تجميع الصلاحيات حسب الفئة
  const groupedPermissions = availablePages.reduce((acc, page) => {
    if (!acc[page.category]) {
      acc[page.category] = [];
    }
    acc[page.category].push(page);
    return acc;
  }, {} as Record<string, typeof availablePages>);

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      <Helmet>
        <title>إدارة المستخدمين | ERP90 Dashboard</title>
        <meta name="description" content="إدارة مستخدمي نظام التركيب والصلاحيات" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
              <UserCog className="h-8 w-8 text-amber-600 dark:text-amber-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إدارة المستخدمين</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة حسابات المستخدمين والصلاحيات</p>
            </div>
          </div>
          
          <Button
            onClick={handleAdd}
            className="bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة مستخدم جديد
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التركيب", to: "/management/installation" },
          { label: "إدارة المستخدمين" },
        ]}
      />

      {/* جدول المستخدمين */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة المستخدمين</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `إجمالي ${total} مستخدم`
            }}
            scroll={{ x: 1000 }}
          />
        </CardContent>
      </Card>

      {/* نافذة الإضافة/التعديل */}
      <Modal
        title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setSelectedPermissions([]);
          setSelectedPosition('');
        }}
        footer={null}
        width={800}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          className="mt-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* اسم المستخدم */}
            <Form.Item
              name="username"
              label="اسم المستخدم"
              rules={[{ required: true, message: 'يرجى إدخال اسم المستخدم' }]}
            >
              <Input placeholder="أدخل اسم المستخدم" />
            </Form.Item>

            {/* الاسم الكامل */}
            <Form.Item
              name="fullName"
              label="الاسم الكامل"
              rules={[{ required: true, message: 'يرجى إدخال الاسم الكامل' }]}
            >
              <Input placeholder="أدخل الاسم الكامل" />
            </Form.Item>

            {/* كلمة المرور */}
            <Form.Item
              name="password"
              label="كلمة المرور"
              rules={[{ required: true, message: 'يرجى إدخال كلمة المرور' }]}
            >
              <Input.Password 
                placeholder="أدخل كلمة المرور"
                visibilityToggle
              />
            </Form.Item>

            {/* المنصب */}
            <Form.Item
              name="position"
              label="المنصب"
              rules={[{ required: true, message: 'يرجى اختيار المنصب' }]}
            >
              <Select 
                placeholder="اختر المنصب"
                onChange={(value) => setSelectedPosition(value)}
              >
                <Option value="مدير عام">مدير عام</Option>
                <Option value="مشرف تركيب">مشرف تركيب</Option>
                <Option value="فني">فني</Option>
                <Option value="مدير فرع">مدير فرع</Option>
              </Select>
            </Form.Item>
          </div>

          {/* نوع الوصول */}
          <Form.Item
            name="accessType"
            label="نوع الوصول"
            initialValue="installation"
          >
            <Select 
              value="installation"
              disabled
              style={{ 
                backgroundColor: '#f5f5f5',
                color: '#666'
              }}
            >
              <Option value="installation">تركيب فقط</Option>
            </Select>
            <div className="mt-1 text-xs text-gray-500">
               نوع الوصول ثابت على "تركيب فقط" في نظام إدارة التركيب
            </div>
          </Form.Item>

          {/* اختيار الفرع (يظهر فقط لمدير الفرع) */}
          {selectedPosition === 'مدير فرع' && (
            <Form.Item
              name="branchId"
              label="الفرع"
              rules={[{ required: true, message: 'يرجى اختيار الفرع' }]}
            >
              <Select placeholder="اختر الفرع">
                {branches.map(branch => (
                  <Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {/* الصلاحيات */}
          <Form.Item
            label={`الصلاحيات - ${selectedAccessType === 'installation_delivery' ? 'تركيب وتوصيل' : 'تركيب فقط'}`}
            className="mt-4"
          >
            <div className="space-y-4 border rounded-lg p-4 max-h-96 overflow-y-auto">
              {selectedAccessType === 'installation_delivery' && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800 font-medium">
                    💡 تم تفعيل صلاحيات التركيب والتوصيل - يمكن للمستخدم الوصول إلى كلا النظامين
                  </p>
                </div>
              )}
              {Object.entries(groupedPermissions).map(([category, pages]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <h4 className="font-semibold text-gray-700 flex items-center gap-2">
                      {category}
                      {category.includes('التوصيل') && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">توصيل</span>
                      )}
                    </h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const categoryPageIds = pages.map(p => p.id);
                          setSelectedPermissions(prev => {
                            const newPerms = new Set([...prev, ...categoryPageIds]);
                            return Array.from(newPerms);
                          });
                        }}
                      >
                        تحديد الكل
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const categoryPageIds = pages.map(p => p.id);
                          setSelectedPermissions(prev => 
                            prev.filter(p => !categoryPageIds.includes(p))
                          );
                        }}
                      >
                        إلغاء الكل
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pr-4">
                    {pages.map((page) => (
                      <div key={page.id} className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id={page.id}
                          checked={selectedPermissions.includes(page.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions([...selectedPermissions, page.id]);
                            } else {
                              setSelectedPermissions(selectedPermissions.filter(p => p !== page.id));
                            }
                          }}
                          className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                        />
                        <label htmlFor={page.id} className="text-sm text-gray-700 cursor-pointer">
                          {page.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm text-gray-500">
              تم تحديد {selectedPermissions.length} من {availablePages.length} صفحة
            </div>
          </Form.Item>

          {/* أزرار الحفظ والإلغاء */}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsModalVisible(false);
                form.resetFields();
                setSelectedPermissions([]);
                setSelectedPosition('');
                setSelectedAccessType('installation');
              }}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={loading}
            >
              {loading ? 'جاري الحفظ...' : editingUser ? 'تحديث' : 'إضافة'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default InstallationUsersManagement;

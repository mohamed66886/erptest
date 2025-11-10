import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";
import { Select, Table, Modal, Form, message, Space, Tag, Popconfirm, Input, Checkbox as AntCheckbox } from 'antd';
import { 
  UserCog, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff,
  Save,
  X
} from 'lucide-react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const { Option } = Select;

interface User {
  id?: string;
  username: string;
  fullName: string;
  password: string;
  position: 'مدير عام' | 'مدير فرع' | 'مدير مستودع';
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  permissions: string[];
  createdAt?: any;
  updatedAt?: any;
}

interface Branch {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name: string;
}

const UsersManagement: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [form] = Form.useForm();

  // جميع الصفحات المتاحة في إدارة التوصيلات
  const availablePages = [
    { id: 'governorates', name: 'إدارة المحافظات', category: 'الإعدادات' },
    { id: 'regions', name: 'إدارة المناطق', category: 'الإعدادات' },
    { id: 'districts', name: 'إدارة الأحياء', category: 'الإعدادات' },
    { id: 'drivers', name: 'إدارة السائقين', category: 'الإعدادات' },
    { id: 'branch-status', name: 'حالة الفرع', category: 'الإعدادات' },
    { id: 'delivery-warehouses', name: 'مستودعات التوصيل', category: 'الإعدادات' },
    { id: 'link-branches', name: 'ربط الفروع', category: 'الإعدادات' },
    { id: 'delivery-settings', name: 'إعدادات التوصيل', category: 'الإعدادات' },
    { id: 'users', name: 'إدارة المستخدمين', category: 'الإعدادات' },
    { id: 'delivery-orders', name: 'الطلبات', category: 'العمليات' },
    { id: 'confirm-orders', name: 'تأكيد الطلبات', category: 'العمليات' },
    { id: 'completed-orders', name: 'الطلبات المكتملة', category: 'العمليات' },
    { id: 'archived-orders', name: 'الطلبات المؤرشفة', category: 'العمليات' },
    { id: 'comprehensive-reports', name: 'التقارير الشاملة', category: 'التقارير' },
  ];

  // تحميل البيانات عند بدء الصفحة
  useEffect(() => {
    fetchUsers();
    fetchBranches();
    fetchWarehouses();
  }, []);

  // تحميل المستخدمين
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
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
    }
  };

  // تحميل مستودعات التوصيل
  const fetchWarehouses = async () => {
    try {
      const warehousesSnapshot = await getDocs(collection(db, 'delivery_warehouses'));
      const warehousesData = warehousesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      })) as Warehouse[];
      setWarehouses(warehousesData);
    } catch (error) {
      console.error('Error fetching delivery warehouses:', error);
    }
  };

  // فتح نافذة الإضافة
  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setSelectedPermissions([]);
    setIsModalVisible(true);
  };

  // فتح نافذة التعديل
  const handleEdit = (user: User) => {
    setEditingUser(user);
    const permissions = user.permissions || [];
    setSelectedPermissions(permissions);
    form.setFieldsValue({
      username: user.username,
      fullName: user.fullName,
      password: user.password,
      position: user.position,
      branchId: user.branchId,
      warehouseId: user.warehouseId,
      permissions: permissions
    });
    setIsModalVisible(true);
  };

  // حذف مستخدم
  const handleDelete = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      message.success('تم حذف المستخدم بنجاح');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      message.error('خطأ في حذف المستخدم');
    }
  };

  // حفظ المستخدم
  const handleSave = async (values: any) => {
    try {
      setLoading(true);
      
      console.log('💾 Saving user with permissions:', selectedPermissions);
      
      const userData: any = {
        username: values.username,
        fullName: values.fullName,
        password: values.password,
        position: values.position,
        permissions: selectedPermissions,
        updatedAt: new Date()
      };

      console.log('📦 User data to save:', userData);

      // إضافة الفرع إذا كان مدير فرع
      if (values.position === 'مدير فرع' && values.branchId) {
        const selectedBranch = branches.find(b => b.id === values.branchId);
        userData.branchId = values.branchId;
        userData.branchName = selectedBranch?.name;
      }

      // إضافة المستودع إذا كان مدير مستودع
      if (values.position === 'مدير مستودع' && values.warehouseId) {
        const selectedWarehouse = warehouses.find(w => w.id === values.warehouseId);
        userData.warehouseId = values.warehouseId;
        userData.warehouseName = selectedWarehouse?.name;
      }

      if (editingUser?.id) {
        // تحديث مستخدم موجود
        await updateDoc(doc(db, 'users', editingUser.id), userData);
        message.success('تم تحديث المستخدم بنجاح');
        
        // تحديث localStorage إذا كان المستخدم الحالي هو الذي يتم تعديله
        const currentUserData = localStorage.getItem('currentUser');
        if (currentUserData) {
          const currentUser = JSON.parse(currentUserData);
          if (currentUser.id === editingUser.id) {
            const updatedUser = {
              id: editingUser.id,
              username: userData.username,
              fullName: userData.fullName,
              position: userData.position,
              branchId: userData.branchId,
              branchName: userData.branchName,
              warehouseId: userData.warehouseId,
              warehouseName: userData.warehouseName,
              permissions: userData.permissions
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
        userData.createdAt = new Date();
        await addDoc(collection(db, 'users'), userData);
        message.success('تم إضافة المستخدم بنجاح');
      }

      setIsModalVisible(false);
      form.resetFields();
      setSelectedPermissions([]);
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
        const colors: any = {
          'مدير عام': 'blue',
          'مدير فرع': 'green',
          'مدير مستودع': 'orange'
        };
        return <Tag color={colors[position]}>{position}</Tag>;
      }
    },
    {
      title: 'الفرع/المستودع',
      key: 'location',
      width: 150,
      render: (_: any, record: User) => {
        if (record.position === 'مدير فرع') {
          return <span>{record.branchName || '-'}</span>;
        }
        if (record.position === 'مدير مستودع') {
          return <span>{record.warehouseName || '-'}</span>;
        }
        return '-';
      }
    },
    {
      title: 'عدد الصلاحيات',
      key: 'permissionsCount',
      width: 120,
      render: (_: any, record: User) => (
        <Tag color="purple">{record.permissions?.length || 0} صفحة</Tag>
      )
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: User) => (
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

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      <Helmet>
        <title>إدارة المستخدمين | ERP90 Dashboard</title>
        <meta name="description" content="إدارة المستخدمين والصلاحيات" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg">
              <UserCog className="h-8 w-8 text-violet-600 dark:text-violet-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إدارة المستخدمين</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة حسابات المستخدمين والصلاحيات</p>
            </div>
          </div>
          
          <Button
            onClick={handleAdd}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Plus className="h-5 w-5 ml-2" />
            إضافة مستخدم جديد
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 to-purple-500"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التوصيلات", to: "/management/outputs" },
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
                onChange={() => {
                  form.setFieldsValue({ branchId: undefined, warehouseId: undefined });
                }}
              >
                <Option value="مدير عام">مدير عام</Option>
                <Option value="مدير فرع">مدير فرع</Option>
                <Option value="مدير مستودع">مدير مستودع</Option>
              </Select>
            </Form.Item>

            {/* اختيار الفرع (يظهر فقط لمدير الفرع) */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.position !== currentValues.position
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('position') === 'مدير فرع' ? (
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
                ) : null
              }
            </Form.Item>

            {/* اختيار المستودع (يظهر فقط لمدير المستودع) */}
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => 
                prevValues.position !== currentValues.position
              }
            >
              {({ getFieldValue }) =>
                getFieldValue('position') === 'مدير مستودع' ? (
                  <Form.Item
                    name="warehouseId"
                    label="مستودع التوصيل"
                    rules={[{ required: true, message: 'يرجى اختيار مستودع التوصيل' }]}
                  >
                    <Select placeholder="اختر مستودع التوصيل">
                      {warehouses.map(warehouse => (
                        <Option key={warehouse.id} value={warehouse.id}>
                          {warehouse.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                ) : null
              }
            </Form.Item>
          </div>

          {/* الصلاحيات */}
          <Form.Item
            label="الصلاحيات - اختر الصفحات التي يمكن للمستخدم الوصول إليها"
          >
            <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
              <div className="space-y-4">
                {['الإعدادات', 'العمليات', 'التقارير'].map(category => (
                  <div key={category}>
                    <h4 className="font-semibold text-gray-700 mb-2 text-base">{category}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {availablePages
                        .filter(page => page.category === category)
                        .map(page => (
                          <div key={page.id} className="mb-2">
                            <AntCheckbox
                              checked={selectedPermissions.includes(page.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const newPermissions = [...selectedPermissions, page.id];
                                  setSelectedPermissions(newPermissions);
                                  form.setFieldsValue({ permissions: newPermissions });
                                } else {
                                  const newPermissions = selectedPermissions.filter(p => p !== page.id);
                                  setSelectedPermissions(newPermissions);
                                  form.setFieldsValue({ permissions: newPermissions });
                                }
                              }}
                            >
                              {page.name}
                            </AntCheckbox>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
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
              }}
            >
              <X className="h-4 w-4 ml-2" />
              إلغاء
            </Button>
            <Button
              type="submit"
              className="bg-violet-600 hover:bg-violet-700"
              disabled={loading}
            >
              <Save className="h-4 w-4 ml-2" />
              {editingUser ? 'تحديث' : 'حفظ'}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersManagement;

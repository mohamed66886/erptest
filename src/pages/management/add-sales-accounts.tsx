import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import Breadcrumb from '@/components/Breadcrumb';
import { Plus, Percent } from 'lucide-react';
import { Select as AntdSelect } from 'antd';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { getAccounts, Account } from '@/services/accountsService';
import { fetchBranches, Branch } from '@/utils/branches';
import { 
  fetchSalesAccounts, 
  addSalesAccountWithSubAccount, 
  deleteSalesAccountWithSubAccount,
  updateSalesAccount,
  SalesAccount as SalesAccountType 
} from '@/services/salesAccountsService';
// Ant Design imports
import { Modal, Form, Input, Select, Button, Table, message } from 'antd';
import { PlusOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, CalendarOutlined } from '@ant-design/icons';

const AddSalesAccounts: React.FC = () => {
  // الحسابات
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  // الفروع
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // تحميل الحسابات من قاعدة البيانات
  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const accounts = await getAccounts();
      // ترتيب الحسابات حسب الكود
      const sortedAccounts = accounts.sort((a, b) => {
        const codeA = parseInt(a.code) || 0;
        const codeB = parseInt(b.code) || 0;
        return codeA - codeB;
      });
      setAllAccounts(sortedAccounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoadingAccounts(false);
    }
  };

  // تحميل الفروع من قاعدة البيانات
  const loadBranches = async () => {
    try {
      setLoadingBranches(true);
      const fetchedBranches = await fetchBranches();
      setBranches(fetchedBranches);
    } catch (error) {
      console.error('Error loading branches:', error);
      setBranches([]);
    } finally {
      setLoadingBranches(false);
    }
  };

  // تحميل الحسابات والفروع عند بداية تشغيل المكون
  useEffect(() => {
    loadAccounts();
    loadBranches();
  }, []);
  // السنة المالية
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
  }, [currentFinancialYear]);

  const handleFiscalYearChange = (value: string) => {
    setFiscalYear(value);
    const selectedYear = activeYears.find(y => y.year.toString() === value);
    if (selectedYear) {
      setCurrentFinancialYear(selectedYear);
    }
  };

  // Modal and Form logic
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [modalLoading, setModalLoading] = useState(false);

  const handleAdd = () => {
    setIsModalOpen(true);
    form.resetFields();
  };

  const handleModalOk = async () => {
    setModalLoading(true);
    try {
      const values = await form.validateFields();
      await addSalesAccountWithSubAccount({
        nameAr: values.nameAr,
        nameEn: values.nameEn,
        branch: values.branch,
        parentAccount: values.parentAccount,
        fiscalYear: fiscalYear
      });
      setIsModalOpen(false);
      form.resetFields();
      loadSalesAccounts();
      message.success('تم إضافة حساب المبيعات والحساب الفرعي بنجاح');
    } catch (error) {
      console.error('Error adding sales account:', error);
      message.error('حدث خطأ أثناء إضافة حساب المبيعات');
    } finally {
      setModalLoading(false);
    }
  };

  const handleModalCancel = () => {
    setIsModalOpen(false);
  };

  const [salesAccounts, setSalesAccounts] = useState<SalesAccountType[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSalesAccounts = async () => {
    try {
      setLoading(true);
      const accounts = await fetchSalesAccounts();
      setSalesAccounts(accounts);
    } catch (error) {
      console.error('Error loading sales accounts:', error);
      message.error('حدث خطأ أثناء تحميل حسابات المبيعات');
    } finally {
      setLoading(false);
    }
  };

  // تحميل حسابات المبيعات عند بداية تشغيل المكون
  useEffect(() => {
    loadSalesAccounts();
  }, []);

  // حالة لتخزين الحساب الجاري تعديله
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editingAccount, setEditingAccount] = useState<SalesAccountType | null>(null);
  const [editModalLoading, setEditModalLoading] = useState(false);

  // فتح مودال التعديل مع البيانات
  const handleEdit = (id: string) => {
    const account = salesAccounts.find(acc => acc.id === id);
    if (account) {
      setEditingAccount(account);
      editForm.setFieldsValue({
        nameAr: account.nameAr,
        nameEn: account.nameEn,
        branch: account.branch,
        parentAccount: account.parentAccount
      });
      setEditModalOpen(true);
    }
  };

  // حفظ التعديلات
  const handleEditModalOk = async () => {
    setEditModalLoading(true);
    try {
      const values = await editForm.validateFields();
      // تعديل بيانات حساب المبيعات فقط (لا يعدل الحساب الفرعي)
      await updateSalesAccount(editingAccount.id!, { ...values, fiscalYear });
      setEditModalOpen(false);
      setEditingAccount(null);
      editForm.resetFields();
      loadSalesAccounts();
      message.success('تم تعديل حساب المبيعات بنجاح');
    } catch (error) {
      console.error('Error editing sales account:', error);
      message.error('حدث خطأ أثناء تعديل حساب المبيعات');
    } finally {
      setEditModalLoading(false);
    }
  };

  const handleEditModalCancel = () => {
    setEditModalOpen(false);
    setEditingAccount(null);
    editForm.resetFields();
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSalesAccountWithSubAccount(id);
      loadSalesAccounts();
      message.success('تم حذف حساب المبيعات والحساب الفرعي بنجاح');
    } catch (error) {
      console.error('Error deleting sales account:', error);
      message.error('حدث خطأ أثناء حذف حساب المبيعات');
    }
  };

  const columns = [
    {
      title: '#',
      dataIndex: 'index',
      key: 'index',
      render: (_: unknown, __: unknown, idx: number) => idx + 1,
      width: 60,
      align: 'center' as const,
    },
    { 
      title: 'اسم الحساب (عربي)', 
      dataIndex: 'nameAr', 
      key: 'nameAr' 
    },
    { 
      title: 'اسم الحساب (إنجليزي)', 
      dataIndex: 'nameEn', 
      key: 'nameEn' 
    },
    { 
      title: 'الفرع', 
      dataIndex: 'branch', 
      key: 'branch',
      render: (branchId: string) => branches.find(b => b.id === branchId)?.name || ''
    },
    { 
      title: 'الحساب الأب', 
      dataIndex: 'parentAccount', 
      key: 'parentAccount',
      render: (accId: string) => allAccounts.find(a => a.id === accId)?.nameAr || ''
    },
    {
      title: 'كود الحساب الفرعي',
      dataIndex: 'subAccountCode',
      key: 'subAccountCode',
      render: (code: string) => code || 'لم يتم إنشاء حساب فرعي',
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      align: 'center' as const,
      render: (_: unknown, record: SalesAccountType) => (
        <>
          <Button 
            icon={<EditOutlined style={{ color: '#1677ff' }} />} 
            type="link" 
            onClick={() => handleEdit(record.id!)} 
          />
          <Button 
            icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />} 
            type="link" 
            onClick={() => handleDelete(record.id!)} 
          />
        </>
      ),
    },
  ];

  const handleExport = () => {
    // Add export logic here
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      <Helmet>
        <title>إضافة حسابات مبيعات | ERP90 Dashboard</title>
        <meta name="description" content="إضافة حسابات مبيعات جديدة في ERP90 Dashboard" />
      </Helmet>
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Plus className="h-8 w-8 text-blue-600" />
          </div>
          <div className="flex flex-col ">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">حسابات المبيعات</h1>
            <p className="text-gray-600 dark:text-gray-400">إدارة حسابات المبيعات و ايرادات المبيعات
</p>
          </div>
        </div>
        {/* السنة المالية Dropdown */}
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
          <span className="flex items-center gap-2">
            <CalendarOutlined className="text-purple-600 dark:text-purple-300" style={{ fontSize: 24 }} />
            <label className="text-base font-medium text-gray-700 dark:text-gray-300">السنة المالية:</label>
          </span>
          <div className="min-w-[160px]">
            <AntdSelect
              value={fiscalYear}
              onChange={handleFiscalYearChange}
              style={{ 
                width: 160, 
                height: 40, 
                fontSize: 16, 
                borderRadius: 8, 
                background: '#fff', 
                textAlign: 'right', 
                boxShadow: '0 1px 6px rgba(0,0,0,0.07)', 
                border: '1px solid #e2e8f0'
              }}
              styles={{ 
                popup: { 
                  root: { 
                    textAlign: 'right', 
                    fontSize: 16 
                  } as React.CSSProperties 
                } 
              }}
              size="middle"
              placeholder="السنة المالية"
            >
              {activeYears && activeYears.map(y => (
                <AntdSelect.Option key={y.id} value={y.year.toString()}>{y.year}</AntdSelect.Option>
              ))}
            </AntdSelect>
          </div>
        </div>
      </div>
      </div>
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "إضافة حسابات مبيعات" }
        ]}
      />
      <Modal
        title="إضافة حساب مبيعات جديد"
        open={isModalOpen}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        okText="إضافة"
        cancelText="إلغاء"
        confirmLoading={modalLoading}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ nameAr: '', nameEn: '', branch: '', parentAccount: '' }}
        >
          <Form.Item
            label="اسم حساب المبيعات (عربي)"
            name="nameAr"
            rules={[{ required: true, message: 'يرجى إدخال اسم حساب المبيعات بالعربي' }]}
          >
            <Input placeholder="اسم حساب المبيعات بالعربي" />
          </Form.Item>
          <Form.Item
            label="اسم حساب المبيعات (إنجليزي)"
            name="nameEn"
            rules={[{ required: true, message: 'يرجى إدخال اسم حساب المبيعات بالإنجليزي' }]}
          >
            <Input placeholder="اسم حساب المبيعات بالإنجليزي" />
          </Form.Item>
          <Form.Item
            label="الفرع"
            name="branch"
            rules={[{ required: true, message: 'يرجى اختيار الفرع' }]}
          >
            <Select
              placeholder={loadingBranches ? "جاري تحميل الفروع..." : "اختر الفرع"}
              loading={loadingBranches}
              showSearch
              notFoundContent={loadingBranches ? "جاري التحميل..." : "لا توجد فروع متاحة"}
              filterOption={(input, option) => {
                const branch = branches.find(b => b.id === option?.value);
                return branch ? branch.name.toLowerCase().includes(input.toLowerCase()) : false;
              }}
            >
              {branches.map(branch => (
                <Select.Option key={branch.id} value={branch.id}>
                  {branch.name} {branch.code ? `(${branch.code})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="الحساب الأب"
            name="parentAccount"
            rules={[{ required: true, message: 'يرجى اختيار الحساب الأب' }]}
          >
            <Select 
              placeholder={loadingAccounts ? "جاري تحميل الحسابات..." : "اختر الحساب الأب"}
              loading={loadingAccounts}
              showSearch
              notFoundContent={loadingAccounts ? "جاري التحميل..." : "لا توجد حسابات متاحة"}
              filterOption={(input, option) => {
                const account = allAccounts.find(acc => acc.id === option?.value);
                return account ? 
                  account.nameAr.toLowerCase().includes(input.toLowerCase()) ||
                  account.code.toLowerCase().includes(input.toLowerCase())
                  : false;
              }}
            >
              {allAccounts
                .filter(account => account.hasSubAccounts || account.level === 1) // فقط الحسابات التي يمكن أن تحتوي على حسابات فرعية
                .map(account => (
                  <Select.Option key={account.id} value={account.id}>
                    {account.code} - {account.nameAr}
                    {account.level && account.level > 1 && ` (مستوى ${account.level})`}
                  </Select.Option>
                ))
              }
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="تعديل حساب المبيعات"
        open={editModalOpen}
        onOk={handleEditModalOk}
        onCancel={handleEditModalCancel}
        okText="حفظ التعديلات"
        cancelText="إلغاء"
        confirmLoading={editModalLoading}
      >
        <Form
          form={editForm}
          layout="vertical"
          initialValues={{ nameAr: '', nameEn: '', branch: '', parentAccount: '' }}
        >
          <Form.Item
            label="اسم حساب المبيعات (عربي)"
            name="nameAr"
            rules={[{ required: true, message: 'يرجى إدخال اسم حساب المبيعات بالعربي' }]}
          >
            <Input placeholder="اسم حساب المبيعات بالعربي" />
          </Form.Item>
          <Form.Item
            label="اسم حساب المبيعات (إنجليزي)"
            name="nameEn"
            rules={[{ required: true, message: 'يرجى إدخال اسم حساب المبيعات بالإنجليزي' }]}
          >
            <Input placeholder="اسم حساب المبيعات بالإنجليزي" />
          </Form.Item>
          <Form.Item
            label="الفرع"
            name="branch"
            rules={[{ required: true, message: 'يرجى اختيار الفرع' }]}
          >
            <Select
              placeholder={loadingBranches ? "جاري تحميل الفروع..." : "اختر الفرع"}
              loading={loadingBranches}
              showSearch
              notFoundContent={loadingBranches ? "جاري التحميل..." : "لا توجد فروع متاحة"}
              filterOption={(input, option) => {
                const branch = branches.find(b => b.id === option?.value);
                return branch ? branch.name.toLowerCase().includes(input.toLowerCase()) : false;
              }}
            >
              {branches.map(branch => (
                <Select.Option key={branch.id} value={branch.id}>
                  {branch.name} {branch.code ? `(${branch.code})` : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="الحساب الأب"
            name="parentAccount"
            rules={[{ required: true, message: 'يرجى اختيار الحساب الأب' }]}
          >
            <Select 
              placeholder={loadingAccounts ? "جاري تحميل الحسابات..." : "اختر الحساب الأب"}
              loading={loadingAccounts}
              showSearch
              notFoundContent={loadingAccounts ? "جاري التحميل..." : "لا توجد حسابات متاحة"}
              filterOption={(input, option) => {
                const account = allAccounts.find(acc => acc.id === option?.value);
                return account ? 
                  account.nameAr.toLowerCase().includes(input.toLowerCase()) ||
                  account.code.toLowerCase().includes(input.toLowerCase())
                  : false;
              }}
            >
              {allAccounts
                .filter(account => account.hasSubAccounts || account.level === 1)
                .map(account => (
                  <Select.Option key={account.id} value={account.id}>
                    {account.code} - {account.nameAr}
                    {account.level && account.level > 1 && ` (مستوى ${account.level})`}
                  </Select.Option>
                ))
              }
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      <div className=" bg-white p-6 rounded-lg shadow-md mb-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24,  color: '#222' }}>حسابات المبيعات</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ height: 40, fontSize: 16, padding: '0 16px' }}>
            إضافة حساب مبيعات
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ backgroundColor: '#22c55e', color: '#fff', borderColor: '#22c55e', height: 40, fontSize: 16, padding: '0 16px' }}>
            تصدير
          </Button>
        </div>
      </div>
      <Card>
        <Table
          className="custom-table-header"
          dataSource={salesAccounts}
          columns={columns}
          rowKey={(record: SalesAccountType) => record.id!}
          loading={loading}
          pagination={false}
          locale={{ emptyText: 'لا توجد حسابات مبيعات' }}
        />
      </Card>
    </div>
    </div>
  );
};

export default AddSalesAccounts;

/* أضف هذا في أعلى الملف أو في ملف CSS مناسب مثل App.css أو index.css */
/*
.custom-table-header .ant-table-thead > tr > th {
  background: #e0f2fe !important;
  color: #222 !important;
}
*/

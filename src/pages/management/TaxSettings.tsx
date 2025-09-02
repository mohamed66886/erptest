import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import Breadcrumb from '@/components/Breadcrumb';
import { DollarSignIcon, Plus } from 'lucide-react';
import { Select as AntdSelect, Table, Button, Modal, message } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { SearchOutlined } from '@ant-design/icons';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { motion } from 'framer-motion';
import { EditOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { 
  fetchTaxSettings, 
  deleteTaxSettingWithSubAccount, 
  TaxSetting 
} from '@/services/taxSettingsService';
import { getAccounts, Account } from '@/services/accountsService';
import { fetchBranches, Branch } from '@/utils/branches';

const TaxSettings: React.FC = () => {
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

  const largeControlStyle = {
    height: 48,
    fontSize: 18,
    borderRadius: 8,
    padding: '8px 16px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
    background: '#fff',
    border: '1.5px solid #d9d9d9',
    transition: 'border-color 0.3s',
  };
  const labelStyle = {
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  };

  const [isLoading, setIsLoading] = useState(false);
  const [taxSettings, setTaxSettings] = useState<TaxSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const navigate = useNavigate();

  // تحميل البيانات
  const loadTaxSettings = async () => {
    try {
      setLoading(true);
      const settings = await fetchTaxSettings();
      setTaxSettings(settings);
    } catch (error) {
      console.error('Error loading tax settings:', error);
      message.error('حدث خطأ أثناء تحميل إعدادات الضرائب');
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const accounts = await getAccounts();
      setAllAccounts(accounts);
    } catch (error) {
      console.error('Error loading accounts:', error);
      setAllAccounts([]);
    }
  };

  const loadBranches = async () => {
    try {
      const fetchedBranches = await fetchBranches();
      setBranches(fetchedBranches);
    } catch (error) {
      console.error('Error loading branches:', error);
      setBranches([]);
    }
  };

  useEffect(() => {
    loadTaxSettings();
    loadAccounts();
    loadBranches();
  }, []);

  const handleSearch = () => {
    setIsLoading(true);
    // هنا منطق البحث الحقيقي (يمكنك ربطه بالبيانات لاحقًا)
    setTimeout(() => {
      setIsLoading(false);
    }, 1500); // محاكاة تحميل لمدة 1.5 ثانية
  }

  const handleEdit = (id: string) => {
    // منطق التعديل - يمكن إضافة مودال للتعديل لاحقاً
    message.info('تعديل الضريبة: ' + id);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTaxSettingWithSubAccount(id);
      loadTaxSettings();
      message.success('تم حذف إعداد الضريبة والحساب الفرعي بنجاح');
    } catch (error) {
      console.error('Error deleting tax setting:', error);
      message.error('حدث خطأ أثناء حذف إعداد الضريبة');
    }
  };

  const handleExport = () => {
    // منطق التصدير
    message.success('تم تصدير إعدادات الضرائب!');
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
      key: 'nameAr', 
      align: 'right' as const 
    },
    { 
      title: 'اسم الحساب (إنجليزي)', 
      dataIndex: 'nameEn', 
      key: 'nameEn', 
      align: 'right' as const 
    },
    { 
      title: 'الفرع', 
      dataIndex: 'branch', 
      key: 'branch', 
      align: 'right' as const,
      render: (branchId: string) => branches.find(b => b.id === branchId)?.name || ''
    },
    { 
      title: 'الحساب الأب', 
      dataIndex: 'parentAccount', 
      key: 'parentAccount', 
      align: 'right' as const,
      render: (accId: string) => allAccounts.find(a => a.id === accId)?.nameAr || ''
    },
    { 
      title: 'كود الحساب الفرعي', 
      dataIndex: 'subAccountCode', 
      key: 'subAccountCode', 
      align: 'right' as const,
      render: (code: string) => code || 'لم يتم إنشاء حساب فرعي'
    },
    { 
      title: 'النسبة (%)', 
      dataIndex: 'percent', 
      key: 'percent', 
      align: 'right' as const,
      render: (percent: number) => `${percent}%`
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      align: 'center' as const,
      render: (_: unknown, record: TaxSetting) => (
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

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      <Helmet>
        <title>إعدادات الضرائب | ERP90 Dashboard</title>
        <meta name="description" content="إعدادات نظام الضرائب ERP90 Dashboard" />
        <meta name="keywords" content="ERP, ضرائب, إعدادات, Tax, Settings" />
      </Helmet>
            <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Plus className="h-8 w-8 text-blue-600" />
          </div>
          <div className="flex flex-col ">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إعدادات الضرايب</h1>
            <p className="text-gray-600 dark:text-gray-400">إدارة إعدادات نظام الضرايب للمبيعات</p>
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
          { label: "إدارة المبيعات", to: "/management" },
          { label: "إعدادات الضرائب" }
        ]}
      />
    <motion.div 
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
  className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
>
  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
  <motion.button
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -6, boxShadow: '0 6px 24px rgba(0,0,0,0.18)' }}
    transition={{ type: 'spring', stiffness: 350, damping: 22 }}
    type="button"
    className="absolute left-4 top-4 flex items-center gap-2 select-none bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 text-white px-6 py-2 rounded-lg font-bold text-lg shadow-md"
    onClick={() => navigate('/management/add-tax-setting')}
    style={{zIndex:2}}
  >
    <Plus className="w-5 h-5" />
    إضافة
  </motion.button>
  <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
    خيارات البحث
  </h3>
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
    <div className="flex flex-col">
      <span style={labelStyle}>الاسم</span>
      <input
        type="text"
        placeholder="ابحث بالاسم"
        style={largeControlStyle}
        className="w-full"
      />
    </div>
    <div className="flex flex-col">
      <span style={labelStyle}>الفرع</span>
      <AntdSelect
        placeholder="اختر الفرع"
        style={{ width: '100%', ...largeControlStyle }}
        size="large"
        allowClear
      >
        {/* ضع خيارات الفروع هنا */}
        <AntdSelect.Option value="branch1">فرع 1</AntdSelect.Option>
        <AntdSelect.Option value="branch2">فرع 2</AntdSelect.Option>
      </AntdSelect>
    </div>
    <div className="flex flex-col">
      <span style={labelStyle}>الحساب الأب</span>
      <AntdSelect
        placeholder="اختر الحساب الأب"
        style={{ width: '100%', ...largeControlStyle }}
        size="large"
        allowClear
      >
        {/* ضع خيارات الحسابات هنا */}
        <AntdSelect.Option value="parent1">حساب أب 1</AntdSelect.Option>
        <AntdSelect.Option value="parent2">حساب أب 2</AntdSelect.Option>
      </AntdSelect>
    </div>
    <div className="flex flex-col">
      <span style={labelStyle}>النسبة</span>
      <input
        type="number"
        placeholder="ابحث بالنسبة"
        style={largeControlStyle}
        className="w-full"
      />
    </div>
  </div>
  <div className="flex items-center gap-4 mt-4">
    <motion.button
      whileHover={{ y: -6, boxShadow: '0 6px 24px rgba(0,0,0,0.18)' }}
      transition={{ type: 'spring', stiffness: 350, damping: 22 }}
      type="button"
      className={`bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700 text-white px-6 py-2 rounded-lg font-bold text-lg flex items-center gap-2 shadow-md ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
      onClick={handleSearch}
      disabled={isLoading}
    >
      <SearchOutlined className="text-white text-xl" />
      {isLoading ? (
        <>
          <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-blue-400 rounded-full mr-2"></span>
          جاري البحث...
        </>
      ) : (
        'بحث'
      )}
    </motion.button>
    <span className="text-gray-500 text-sm">
      نتائج البحث: 0
    </span>
  </div>
</motion.div>
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
    >
      <div className="overflow-x-auto mt-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, color: '#222' }}>إعدادات الضرائب</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<CalendarOutlined />} style={{ height: 40, fontSize: 16, padding: '0 16px' }} onClick={handleExport}>
              طباعة
            </Button>
            <Button icon={<DownloadOutlined />} style={{ backgroundColor: '#22c55e', color: '#fff', borderColor: '#22c55e', height: 40, fontSize: 16, padding: '0 16px' }} onClick={() => {/* منطق تصدير اكسل */}}>
              تصدير Excel
            </Button>
          </div>
        </div>
        <Card>
          <Table
            className="custom-table-header"
            dataSource={taxSettings}
            columns={columns}
            rowKey={(record: TaxSetting) => record.id!}
            loading={loading}
            pagination={false}
            locale={{ emptyText: 'لا توجد إعدادات ضرائب' }}
          />
        </Card>
      </div>
    </motion.div>
    </div>
  );
};

export default TaxSettings;

/* أضف هذا في أعلى الملف أو في ملف CSS مناسب مثل App.css أو index.css */
/*
.custom-table-header .ant-table-thead > tr > th {
  background: #e0f2fe !important;
  color: #222 !important;
}
*/

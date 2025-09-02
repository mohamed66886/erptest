import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import { Button, Select as AntdSelect, Input, message } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Breadcrumb from '@/components/Breadcrumb';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { Plus } from 'lucide-react';
import { CalendarOutlined } from '@ant-design/icons';
import { fetchBranches, Branch } from '@/utils/branches';
import { getAccounts, Account } from '@/services/accountsService';
import { addTaxSettingWithSubAccount } from '@/services/taxSettingsService';

const AddTaxSetting: React.FC = () => {
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

  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    branch: '',
    parentAccount: '',
    percent: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // التحقق من صحة البيانات
    if (!form.nameAr || !form.nameEn || !form.branch || !form.parentAccount || !form.percent) {
      message.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (parseFloat(form.percent) <= 0 || parseFloat(form.percent) > 100) {
      message.error('يرجى إدخال نسبة صحيحة بين 0 و 100');
      return;
    }

    setLoading(true);
    try {
      await addTaxSettingWithSubAccount({
        nameAr: form.nameAr,
        nameEn: form.nameEn,
        branch: form.branch,
        parentAccount: form.parentAccount,
        percent: parseFloat(form.percent),
        fiscalYear: fiscalYear
      });
      
      message.success('تم إضافة إعداد الضريبة والحساب الفرعي بنجاح!');
      
      // إعادة تعيين النموذج
      setForm({
        nameAr: '',
        nameEn: '',
        branch: '',
        parentAccount: '',
        percent: '',
      });
      
      // يمكنك إعادة التوجيه إلى صفحة قائمة الإعدادات
      // navigate('/management/tax-settings');
    } catch (error) {
      console.error('Error adding tax setting:', error);
      message.error('حدث خطأ أثناء إضافة إعداد الضريبة');
    } finally {
      setLoading(false);
    }
  };

  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);

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
      setAllAccounts([]);
    } finally {
      setLoadingAccounts(false);
    }
  };

  useEffect(() => {
    // جلب الحسابات من قاعدة البيانات
    loadAccounts();
  }, []);

  useEffect(() => {
    // جلب الفروع من قاعدة البيانات
    const fetchAllBranches = async () => {
      try {
        const fetchedBranches = await fetchBranches();
        setBranches(fetchedBranches);
      } catch (error) {
        setBranches([]);
      }
    };
    fetchAllBranches();
  }, []);

  return (
    <div className="w-full p-4 sm:p-6 min-h-screen" dir="rtl">
      <Helmet>
        <title>إضافة إعداد ضريبة | ERP90 Dashboard</title>
      </Helmet>
                  <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Plus className="h-8 w-8 text-blue-600" />
          </div>
          <div className="flex flex-col ">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إضافة إعداد ضريبة</h1>
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
                  showSearch
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
          { label: "إعدادات الضرائب", to: "/management/tax-settings" },
          { label: "إضافة إعداد ضريبة" }
        ]}
      />
                  <Card className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block mb-2 font-semibold">اسم الحساب (عربي)</label>
            <Input
              value={form.nameAr}
              onChange={e => handleChange('nameAr', e.target.value)}
              placeholder="أدخل اسم الحساب بالعربي"
              size="large"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">اسم الحساب (انجليزي)</label>
            <Input
              value={form.nameEn}
              onChange={e => handleChange('nameEn', e.target.value)}
              placeholder="أدخل اسم الحساب بالانجليزي"
              size="large"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">الفرع</label>
            <AntdSelect
              showSearch
              value={form.branch || undefined}
              onChange={value => handleChange('branch', value)}
              placeholder="اختر الفرع"
              size="large"
              style={{ width: '100%' }}
              filterOption={(input, option) => {
                const label = typeof option?.children === 'string' ? option.children : '';
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {branches.map(branch => (
                <AntdSelect.Option key={branch.id} value={branch.id}>{branch.name}</AntdSelect.Option>
              ))}
            </AntdSelect>
          </div>
          <div>
            <label className="block mb-2 font-semibold">الحساب الأب</label>
            <AntdSelect
              showSearch
              value={form.parentAccount || undefined}
              onChange={value => handleChange('parentAccount', value)}
              placeholder={loadingAccounts ? "جاري تحميل الحسابات..." : "اختر الحساب الأب"}
              loading={loadingAccounts}
              size="large"
              style={{ width: '100%' }}
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
                  <AntdSelect.Option key={account.id} value={account.id}>
                    {account.code} - {account.nameAr}
                    {account.level && account.level > 1 && ` (مستوى ${account.level})`}
                  </AntdSelect.Option>
                ))
              }
            </AntdSelect>
          </div>
          <div>
            <label className="block mb-2 font-semibold">النسبة (%)</label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={form.percent}
                onChange={e => handleChange('percent', e.target.value)}
                placeholder="أدخل النسبة"
                size="large"
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<ArrowRightOutlined />}
                size="large"
                loading={loading}
                onClick={handleSubmit}
                className="font-bold text-lg"
                style={{ minWidth: 120 }}
              >
                حفظ الإعداد
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AddTaxSetting;

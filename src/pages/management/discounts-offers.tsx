import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { Select as AntdSelect } from 'antd';
import { Helmet } from 'react-helmet';
import Breadcrumb from '@/components/Breadcrumb';
import { Percent, Gift, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DatePicker, Input, Select, Button } from 'antd';
import { SearchOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import 'antd/dist/reset.css';
import dayjs, { Dayjs } from 'dayjs';
import { Table } from 'antd';
import styles from './ReceiptVoucher.module.css';

const { Option } = Select;

const labelStyle: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#555',
  marginBottom: 4,
};
// ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة أمر البيع

// ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة أمر البيع
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

function disabledDate(current: Dayjs | null): boolean {
  // Disable future dates
  return !!current && current.isAfter(dayjs(), 'day');
}

// Mock data
const branches = [
  { id: '1', name: 'الفرع الرئيسي' },
  { id: '2', name: 'فرع 2' },
];
const warehouses = [
  { id: '1', nameAr: 'المخزن الرئيسي' },
  { id: '2', nameAr: 'مخزن 2' },
];
const paymentMethods = [
  { id: '1', name: 'نقدي' },
  { id: '2', name: 'بطاقة' },
];
const filteredInvoices = [{ id: 1 }, { id: 2 }];

interface DiscountOfferRow {
  key: number;
  name: string;
  branch: string;
  type: string;
  fromDate: string;
  toDate: string;
  percent: string;
}

const DiscountsOffers: React.FC = () => {
  // السنة المالية
  const navigate = useNavigate();
  const navigateToAdd = () => {
    window.scrollTo(0, 0);
    navigate('/management/discounts-offers/add');
  };
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
  // State variables
  const [dateFrom, setDateFrom] = useState<Date | null>(null);
  const [dateTo, setDateTo] = useState<Date | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [warehouseId, setWarehouseId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(undefined);
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>('');
  const [showMore, setShowMore] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const branchesLoading = false;

  // تفعيل البحث تلقائيًا عند تغيير أي خيار
  React.useEffect(() => {
    handleSearch();
    
  // eslint-disable-next-line
  }, [invoiceNumber, dateFrom, dateTo, branchId]);


  function handleSearch() {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  }

  function handleExport() {
    // يمكنك هنا إضافة منطق التصدير الحقيقي
    alert('تم تصدير النتائج إلى ملف Excel بنجاح!');
  }

  function handlePrint() {
    // يمكنك هنا إضافة منطق الطباعة الحقيقي
    alert('تم إرسال النتائج للطباعة!');
  }

  // Helper to get branch name from branch id
  function getBranchName(branchId: string): string {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : 'غير محدد';
  }

  // Mock filtered rows for Table
  function getFilteredRows(): DiscountOfferRow[] {
    // Example data, replace with real filtering logic
    return [
      {
        key: 1,
        name: 'خصم موسمي',
        branch: '1',
        type: 'خصم',
        fromDate: '2025-08-01',
        toDate: '2025-08-31',
        percent: '20%'
      },
      {
        key: 2,
        name: 'هدية مجانية',
        branch: '2',
        type: 'عرض',
        fromDate: '2025-08-10',
        toDate: '2025-08-30',
        percent: '—'
      },
    ];
  }



  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      <Helmet>
        <title>الخصومات والعروض | ERP90 Dashboard</title>
        <meta name="description" content="إدارة الخصومات والعروض في نظام ERP90" />
      </Helmet>


            <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-yellow-100 dark:bg-blue-900 rounded-lg">
          <Percent className="h-8 w-8  text-red-600  " />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">الخصومات والعروض</h1>
          <p className="text-gray-600 dark:text-gray-400">نظام الخصومات والعروض للعملاء</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <Percent className="text-purple-600 dark:text-purple-300 w-6 h-6" />
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
                dropdownStyle={{ textAlign: 'right', fontSize: 16 }}
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-pink-500"></div>
      </div>
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "الخصومات والعروض" },
        ]}
      />
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-red-100 rounded-lg">
            <Gift className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">العروض و التخفيضات</h2>
            <p className="text-sm sm:text-base text-gray-600">إدارة وتحديث العروض والخصومات</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {/* مثال على عرض */}
          <div className="p-4 bg-pink-50 rounded-lg shadow flex flex-col items-start">
            <div className="flex items-center mb-2">
              <Percent className="h-6 w-6 text-pink-500 mr-2" />
              <span className="font-bold text-pink-700">خصم موسمي</span>
            </div>
            <p className="text-gray-700 text-sm mb-2">خصم 20% على جميع المنتجات حتى نهاية الشهر.</p>
          </div>
          {/* مثال آخر */}
          <div className="p-4 bg-yellow-50 rounded-lg shadow flex flex-col items-start">
            <div className="flex items-center mb-2">
              <Gift className="h-6 w-6 text-yellow-500 mr-2" />
              <span className="font-bold text-yellow-700">هدية مجانية</span>
            </div>
            <p className="text-gray-700 text-sm mb-2">احصل على هدية مجانية عند شراء منتجات بقيمة 500 جنيه أو أكثر.</p>
          </div>
          {/* مثال ثالث */}
          <div className="p-4 bg-indigo-50 rounded-lg shadow flex flex-col items-start">
            <div className="flex items-center mb-2">
              <RefreshCw className="h-6 w-6 text-indigo-500 mr-2" />
              <span className="font-bold text-indigo-700">تحديث العروض</span>
            </div>
            <p className="text-gray-700 text-sm mb-2">تحديث بيانات العروض والخصومات الحالية.</p>
          </div>
        </div>
      </div>
              {/* Search Options */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <SearchOutlined className="text-emerald-600" /> خيارات البحث
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span style={labelStyle}>الاسم</span>
              <Input 
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="ادخل الاسم"
                style={largeControlStyle}
                size="large"
                allowClear
              />
            </div>
            <div className="flex flex-col">
              <span style={labelStyle}>من تاريخ</span>
              <DatePicker 
                value={dateFrom}
                onChange={setDateFrom}
                placeholder="اختر التاريخ"
                style={largeControlStyle}
                size="large"
                format="YYYY-MM-DD"
                locale={arEG}
                disabledDate={disabledDate}
              />
            </div>
            <div className="flex flex-col">
              <span style={labelStyle}>إلى تاريخ</span>
              <DatePicker 
                value={dateTo}
                onChange={setDateTo}
                placeholder="اختر التاريخ"
                style={largeControlStyle}
                size="large"
                format="YYYY-MM-DD"
                locale={arEG}
                disabledDate={disabledDate}
              />
            </div>
            <div className="flex flex-col">
              <span style={labelStyle}>الفرع</span>
              <Select
                value={branchId}
                onChange={setBranchId}
                placeholder="اختر الفرع"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                optionFilterProp="label"
                allowClear
                showSearch
                loading={branchesLoading}
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
                className={styles.selectDropdown}
              >
                {branches.map(branch => (
                  <Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          {/* تم حذف الخيارات الإضافية بناءً على طلبك */}
          
          <div className="flex items-center gap-4 mt-4">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
              loading={isLoading}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
            >
              {isLoading ? "جاري البحث..." : "بحث"}
            </Button>
            <span className="text-gray-500 text-sm">
              نتائج البحث: {filteredInvoices.length} عروض
            </span>
          </div>

          <Button
            type="primary"
            className="absolute left-4 top-4 flex items-center gap-2 select-none bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
            size="large"
            icon={<Gift />}
            onClick={navigateToAdd}
          >
            إضافة
          </Button>
        </motion.div>

                {/* Search Results */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm overflow-x-auto relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
          
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              نتائج البحث ({filteredInvoices.length} عروض)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={filteredInvoices.length === 0}
                className="bg-blue-300 hover:bg-blue-400 border-blue-300 hover:border-blue-400 font-bold text-white"
                size="large"
              >
                تصدير إكسل
              </Button>
              <Button
                type="primary"
                icon={<FileTextOutlined />}
                onClick={handlePrint}
                className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                size="large"
              >
                طباعة
              </Button>
            </div>
          </div>

          <Table
            columns={[ 
              {
                title: 'الاسم',
                dataIndex: 'name',
                key: 'name',
                width: 180,
                render: (text: string) => <span className="font-bold text-blue-600">{text}</span>
              },
              {
                title: 'النسبة',
                dataIndex: 'percent',
                key: 'percent',
                width: 100,
                render: (text: string) => <span className="font-bold text-pink-600">{text}</span>
              },
              {
                title: 'الفرع',
                dataIndex: 'branch',
                key: 'branch',
                width: 140,
                render: (text: string) => getBranchName(text)
              },
              {
                title: 'النوع',
                dataIndex: 'type',
                key: 'type',
                width: 120,
                render: (text: string) => <span className="font-medium">{text}</span>
              },
              {
                title: 'من تاريخ',
                dataIndex: 'fromDate',
                key: 'fromDate',
                width: 120,
                render: (text: string) => text
              },
              {
                title: 'إلى تاريخ',
                dataIndex: 'toDate',
                key: 'toDate',
                width: 120,
                render: (text: string) => text
              },
              {
                title: 'الإجراءات',
                key: 'actions',
                width: 120,
                render: (_: unknown, record: DiscountOfferRow) => (
                  <div className="flex gap-2 justify-center">
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => alert('تعديل ' + record.name)}
                      aria-label="تعديل"
                    />
                    <Button
                      type="link"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => alert('حذف ' + record.name)}
                      aria-label="حذف"
                    />
                  </div>
                )
              }
            ]}
            dataSource={getFilteredRows()}
            rowKey="key"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              position: ['bottomRight'],
              showTotal: (total, range) => `عرض ${range[0]}-${range[1]} من ${total} نتيجة`
            }}
            loading={isLoading}
            scroll={{ x: 800 }}
            size="small"
            bordered
            className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-gray-800 [&_.ant-table-thead_>_tr_>_th]:border-blue-200 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
            locale={{
              emptyText: isLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-pulse flex space-x-4">
                    <div className="flex-1 space-y-4 py-1">
                      <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">لا توجد بيانات</div>
              )
            }}
          />
        </motion.div>
    </div>
  );
};

export default DiscountsOffers;

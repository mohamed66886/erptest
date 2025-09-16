import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { SearchOutlined, SaveOutlined, PlusOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import { FileText } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import dayjs from 'dayjs';
import { Button, Input, Select, Table, message, Form, Row, Col, DatePicker, Spin, Modal, Space, Card, Divider, Tabs } from 'antd';
import Breadcrumb from "../../components/Breadcrumb";
import { db } from '@/lib/firebase';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { FinancialYear } from '@/services/financialYearsService';
import { fetchCashBoxes } from '../../services/cashBoxesService';
import { fetchBankAccounts } from '../../services/bankAccountsService';
import { GiMagicBroom } from 'react-icons/gi';
import * as XLSX from 'xlsx';
import { Upload } from 'antd';
import ItemSearchModal from '@/components/ItemSearchModal';
import styles from '@/styles/SelectStyles.module.css';

// Type definitions
interface Branch {
  id: string;
  name?: string;
  code?: string;
  number?: string;
  branchNumber?: string;
}

interface Warehouse {
  id: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
  branch?: string;
  documentType?: 'invoice' | 'warehouse';
  quotationTypes?: string[];
  allowedUsers?: string[];
  allowedBranches?: string[];
  status?: 'active' | 'inactive' | 'suspended';
}

interface Customer {
  id: string;
  nameAr?: string;
  nameEn?: string;
  name?: string;
  phone?: string;
  phoneNumber?: string;
  mobile?: string;
  commercialReg?: string;
  taxFile?: string;
  taxFileNumber?: string;
}

interface Delegate {
  id: string;
  name?: string;
  email?: string;
}

interface CompanyData {
  taxRate?: string;
}

interface InventoryItem {
  id: string;
  name: string;
  itemCode?: string;
  salePrice?: number;
  discount?: number;
  isVatIncluded?: boolean;
  type?: string;
  tempCodes?: boolean;
  allowNegative?: boolean;
}

interface QuotationItem {
  itemNumber: string;
  itemName: string;
  quantity: string;
  unit: string;
  price: string;
  discountPercent: string;
  discountValue: number;
  taxPercent: string;
  taxValue: number;
  total: number;
  isNewItem?: boolean;
}

interface QuotationData {
  quotationNumber: string;
  entryNumber: string;
  date: string;
  branch: string;
  warehouse: string;
  customerNumber: string;
  customerName: string;
  delegate: string;
  priceRule: string;
  commercialRecord: string;
  taxFile: string;
  dueDate?: string;
  validUntil?: string;
}

interface Totals {
  afterDiscount: number;
  afterTax: number;
  total: number;
  tax: number;
}

const { TabPane } = Tabs;

const AddQuotationPage: React.FC = () => {
  const { user } = useAuth();
  
  // المتغيرات الجديدة للواجهة المطلوبة
  const [periodRange, setPeriodRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [refNumber, setRefNumber] = useState("");
  const [refDate, setRefDate] = useState<dayjs.Dayjs | null>(null);
  const [movementType, setMovementType] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<string | null>(null);
  const [sideType, setSideType] = useState<string | null>(null);
  const [sideNumber, setSideNumber] = useState("");
  const [sideName, setSideName] = useState("");
  const [operationClass, setOperationClass] = useState<string | null>(null);
  const [statement, setStatement] = useState("");

  // متغيرات الأصناف
  const [activeTab, setActiveTab] = useState("new");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [price, setPrice] = useState("");
  const [costCenterName, setCostCenterName] = useState("");
  const [showItemModal, setShowItemModal] = useState(false);
  const [addedItems, setAddedItems] = useState<Array<{
    itemCode: string;
    itemName: string;
    quantity: string;
    unit: string;
    price: string;
    costCenterName: string;
  }>>([]);

  // متغيرات مودال البحث عن العميل
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountModalType, setAccountModalType] = useState("عميل");
  const [customerAccounts, setCustomerAccounts] = useState<{ code: string; nameAr: string; mobile?: string; taxNumber?: string }[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<{ code: string; nameAr: string; mobile?: string }[]>([]);

  // متغيرات الإكسل
  const [excelFile, setExcelFile] = useState<File | null>(null);

  // البيانات الأساسية
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [units, setUnits] = useState<string[]>(['قطعة', 'كيلو', 'لتر', 'متر', 'صندوق', 'عبوة']);

  // بيانات عرض السعر
  const [quotationData, setQuotationData] = useState<QuotationData>({
    quotationNumber: '',
    entryNumber: '',
    date: dayjs().format('YYYY-MM-DD'),
    branch: '',
    warehouse: '',
    customerNumber: '',
    customerName: '',
    delegate: '',
    priceRule: '',
    commercialRecord: '',
    taxFile: '',
    dueDate: '',
    validUntil: ''
  });

  // دوال إدارة الأصناف
  const handleAddNewItem = () => {
    const finalUnit = unit && unit.trim() ? unit : "قطعة";
    if (
      !itemCode.trim() ||
      !itemName.trim() ||
      !finalUnit.trim() ||
      !quantity || Number(quantity) <= 0 ||
      !price || Number(price) <= 0
    ) {
      return message.error('يرجى إدخال جميع بيانات الصنف بشكل صحيح');
    }
    setAddedItems(items => [...items, { itemCode, itemName, quantity, unit: finalUnit, price, costCenterName }]);
    setItemCode('');
    setItemName('');
    setQuantity('1');
    setUnit('');
    setPrice('');
    setCostCenterName('');
  };

  // دوال إدارة الإكسل
  const handleExcelUpload = (info: { file: { status?: string; name?: string; originFileObj?: File } }) => {
    const { file } = info;
    if (file.status === "done") {
      message.success(`${file.name || 'ملف'} تم رفع الملف بنجاح`);
      if (file.originFileObj) {
        setExcelFile(file.originFileObj);
        // قراءة ملف الإكسل وتحويله إلى أصناف
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
          // توقع أن أول صف هو رؤوس الأعمدة أو بيانات مباشرة
          const items = rows
            .filter((row: string[]) => Array.isArray(row) && row.length >= 6)
            .map((row: string[]) => ({
              itemCode: String(row[0] || ""),
              itemName: String(row[1] || ""),
              quantity: String(row[2] || "1"),
              unit: String(row[3] || "قطعة"),
              price: String(row[4] || ""),
              costCenterName: String(row[5] || "")
            }))
            .filter(item => item.itemCode && item.itemName && item.quantity && item.unit && item.price);
          if (!items.length) {
            message.error("لم يتم العثور على أصناف صالحة في الملف");
            return;
          }
          setAddedItems(prev => [...prev, ...items]);
        };
        reader.readAsArrayBuffer(file.originFileObj);
      }
    } else if (file.status === "error") {
      message.error(`${file.name || 'ملف'} حدث خطأ أثناء رفع الملف`);
    }
  };

  // دالة الحفظ والطباعة
  const handleSaveAndPrint = () => {
    if (!quotationData.branch) return message.error('يرجى اختيار الفرع');
    if (!quotationData.warehouse) return message.error('يرجى اختيار المخزن');
    if (!accountType) return message.error('يرجى اختيار نوع الحساب');
    if (!quotationData.customerNumber) return message.error('يرجى إدخال رقم الحساب');
    if (!quotationData.customerName) return message.error('يرجى إدخال اسم الحساب');
    if (!addedItems.length) return message.error('يرجى إضافة الأصناف');

    // تحويل التواريخ إلى نصوص قبل الحفظ
    const saveData = {
      entryNumber: quotationData.entryNumber,
      periodRange: [
        periodRange[0] ? periodRange[0].format('YYYY-MM-DD') : null,
        periodRange[1] ? periodRange[1].format('YYYY-MM-DD') : null
      ],
      quotationNumber: quotationData.quotationNumber,
      date: quotationData.date,
      refNumber,
      refDate: refDate ? refDate.format('YYYY-MM-DD') : null,
      branch: quotationData.branch,
      warehouse: quotationData.warehouse,
      movementType,
      accountType,
      customerNumber: quotationData.customerNumber,
      customerName: quotationData.customerName,
      sideType,
      sideNumber,
      sideName,
      operationClass,
      statement,
      items: addedItems
    };
    console.log('بيانات الحفظ المرسلة إلى :', saveData);
    message.success('تم حفظ البيانات بنجاح');
    setAddedItems([]);
  };

  // رقم القيد تلقائي
  const [entryNumber, setEntryNumber] = useState("");

  // توليد رقم قيد تلقائي عند تحميل الصفحة
  useEffect(() => {
    const autoNumber = `QU-${Date.now().toString().slice(-6)}`;
    setEntryNumber(autoNumber);
    setQuotationData(prev => ({ ...prev, entryNumber: autoNumber }));
  }, []);

  // السنة المالية من السياق
  const { currentFinancialYear } = useFinancialYear();

  // تعيين الفترة المحاسبية حسب السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setPeriodRange([start, end]);
    }
  }, [currentFinancialYear]);

  // رقم عرض السعر تلقائي
  const [quotationNumber, setQuotationNumber] = useState("");

  // توليد رقم عرض سعر تلقائي عند تحميل الصفحة
  useEffect(() => {
    const autoQuotationNumber = `QT-${Date.now().toString().slice(-6)}`;
    setQuotationNumber(autoQuotationNumber);
    setQuotationData(prev => ({ ...prev, quotationNumber: autoQuotationNumber }));
  }, []);

  // تاريخ عرض السعر الافتراضي هو اليوم
  const [quotationDate, setQuotationDate] = useState(dayjs());

  // جلب بيانات الفروع
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'branches'));
        const branchesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Branch[];
        setBranches(branchesData);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    fetchBranches();
  }, []);

  // جلب بيانات المخازن
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'warehouses'));
        const warehousesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Warehouse[];
        setWarehouses(warehousesData);
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  // جلب بيانات العملاء
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'customers'));
        const customersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Customer[];
        setCustomers(customersData);
      } catch (error) {
        console.error('Error fetching customers:', error);
      }
    };
    fetchCustomers();
  }, []);

  // عند تغيير الفرع، فلترة المخازن واختيار أول مخزن مرتبط
  useEffect(() => {
    if (!quotationData.branch || !warehouses.length) return;
    const filtered = warehouses.filter(w => {
      if (w.branch) return w.branch === quotationData.branch;
      if (w.allowedBranches && Array.isArray(w.allowedBranches)) return w.allowedBranches.includes(quotationData.branch);
      return false;
    });
    if (filtered.length) {
      setQuotationData(prev => ({ ...prev, warehouse: filtered[0].id }));
    } else {
      setQuotationData(prev => ({ ...prev, warehouse: '' }));
    }
  }, [quotationData.branch, warehouses]);

  // جلب بيانات العملاء للمودال
  useEffect(() => {
    if (showAccountModal && accountModalType === "عميل") {
      setCustomerAccounts(customers.map(acc => ({
        code: acc.id || '',
        nameAr: acc.nameAr || acc.name || '',
        mobile: acc.mobile || acc.phone || '',
        taxNumber: acc.taxFileNumber || acc.taxFile || ''
      })));
    }
  }, [showAccountModal, accountModalType, customers]);

  // عند تغيير التبويب لصنف جديد، اجعل الكمية 1
  useEffect(() => {
    if (activeTab === "new") {
      setQuantity("1");
    }
  }, [activeTab]);

  // أعمدة الجدول
  const itemColumns = [
    { title: 'رقم الصنف', dataIndex: 'itemCode', key: 'itemCode', width: 100 },
    { title: 'اسم الصنف', dataIndex: 'itemName', key: 'itemName', width: 150 },
    { title: 'الكمية', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: 'الوحدة', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: 'السعر', dataIndex: 'price', key: 'price', width: 100 },
    { title: 'مركز التكلفة', dataIndex: 'costCenterName', key: 'costCenterName', width: 120 },
    { 
      title: 'إجراءات', 
      key: 'actions', 
      width: 80, 
      render: (_: unknown, record: { itemCode: string }, idx: number) => (
        <Button danger size="small" onClick={() => {
          setAddedItems(items => items.filter((_, i) => i !== idx));
        }}>حذف</Button>
      ) 
    }
  ];

  // ستايل مشابه لسند القبض
  const largeControlStyle = {
    height: 48,
    fontSize: 18,
    borderRadius: 8,
    padding: "8px 16px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    background: "#fff",
    border: "1.5px solid #d9d9d9",
    transition: "border-color 0.3s",
  };
  const labelStyle = { fontSize: 18, fontWeight: 500 };

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
        <div className="flex items-center">
          <FileTextOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-blue-600 ml-1 sm:ml-3" />
          <h1 className="text-lg sm:text-2xl font-bold text-gray-800">إضافة عرض سعر</h1>
        </div>
        <p className="text-xs sm:text-base text-gray-600 mt-2">إدارة وعرض عروض الأسعار</p>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-500"></div>
      </div>
      
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "عروض الأسعار", to: "/stores/quotations" },
          { label: "إضافة عرض سعر" }
        ]}
      />

      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div className="grid grid-cols-4 gap-6 mb-4">
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم القيد</label>
            <Input value={entryNumber} disabled placeholder="رقم القيد تلقائي" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>الفترة المحاسبية</label>
            <DatePicker.RangePicker
              value={periodRange}
              onChange={setPeriodRange}
              format="YYYY-MM-DD"
              placeholder={["من تاريخ", "إلى تاريخ"]}
              style={largeControlStyle}
              size="large"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم عرض السعر</label>
            <Input value={quotationNumber} disabled placeholder="رقم عرض السعر تلقائي" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تاريخ عرض السعر</label>
            <DatePicker value={quotationDate} onChange={setQuotationDate} format="YYYY-MM-DD" placeholder="تاريخ عرض السعر" style={largeControlStyle} size="large" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم المرجع</label>
            <Input value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="رقم المرجع" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تاريخ المرجع</label>
            <DatePicker value={refDate} onChange={setRefDate} format="YYYY-MM-DD" placeholder="تاريخ المرجع" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>الفرع</label>
            <Select
              value={quotationData.branch}
              onChange={(value) => setQuotationData(prev => ({ ...prev, branch: value }))}
              placeholder="اختر الفرع"
              allowClear
              style={largeControlStyle}
              size="large"
              showSearch
              optionFilterProp="children"
            >
              {branches.map(b => (
                <Select.Option key={b.id} value={b.id}>
                  {b.name || b.branchNumber || b.code}
                </Select.Option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>المخزن</label>
            <Select
              value={quotationData.warehouse}
              onChange={(value) => setQuotationData(prev => ({ ...prev, warehouse: value }))}
              placeholder="اختر المخزن"
              allowClear
              style={largeControlStyle}
              size="large"
              showSearch
              optionFilterProp="children"
            >
              {warehouses.map(w => (
                <Select.Option key={w.id} value={w.id}>
                  {w.name || w.nameAr || w.nameEn}
                </Select.Option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>نوع الحركة</label>
            <Select value={movementType} onChange={setMovementType} placeholder="اختر نوع الحركة" allowClear style={largeControlStyle} size="large">
              <Select.Option value="عرض سعر">عرض سعر - Quotation</Select.Option>
              <Select.Option value="عرض سعر مبدئي">عرض سعر مبدئي - Preliminary Quote</Select.Option>
              <Select.Option value="عرض سعر نهائي">عرض سعر نهائي - Final Quote</Select.Option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>نوع الحساب</label>
            <Select value={accountType} onChange={setAccountType} placeholder="اختر نوع الحساب" allowClear style={largeControlStyle} size="large">
              <Select.Option value="عميل">عميل</Select.Option>
              <Select.Option value="عميل محتمل">عميل محتمل</Select.Option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم الحساب</label>
            <div style={{ display: "flex", gap: 8 }}>
              <Input 
                value={quotationData.customerNumber} 
                onChange={e => setQuotationData(prev => ({ ...prev, customerNumber: e.target.value }))} 
                placeholder="رقم الحساب" 
                style={largeControlStyle} 
                size="large"
                suffix={
                  <button
                    type="button"
                    style={{
                      borderRadius: 6,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 32,
                      width: 32,
                      border: 'none',
                      background: 'transparent'
                    }}
                    onClick={() => {
                      setAccountModalType(accountType || "عميل");
                      setShowAccountModal(true);
                    }}
                  >
                    <SearchOutlined style={{ color: '#0074D9' }} />
                  </button>
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>اسم الحساب</label>
            <Input 
              value={quotationData.customerName} 
              onChange={e => setQuotationData(prev => ({ ...prev, customerName: e.target.value }))} 
              placeholder="اسم الحساب" 
              style={largeControlStyle} 
              size="large"
              suffix={
                <button
                  type="button"
                  style={{
                    borderRadius: 6,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 32,
                    width: 32,
                    border: 'none',
                    background: 'transparent',
                    padding: 0
                  }}
                  onClick={() => {
                    setAccountModalType(accountType || "عميل");
                    setShowAccountModal(true);
                  }}
                >
                  <GiMagicBroom size={26} color="#0074D9" />
                </button>
              }
            />
          </div>

          {/* مودال البحث عن الحساب */}
          <Modal
            open={showAccountModal}
            onCancel={() => setShowAccountModal(false)}
            footer={null}
            title={accountModalType === "عميل" ? "بحث عن عميل" : "بحث عن عميل محتمل"}
            width={600}
          >
            <Input
              placeholder="بحث بالاسم أو رقم الحساب..."
              value={accountSearch}
              onChange={e => setAccountSearch(e.target.value)}
              style={{ marginBottom: 12, fontSize: 17, borderRadius: 8, padding: '8px 12px' }}
              allowClear
            />
            <Table
              dataSource={customerAccounts.filter(acc =>
                acc.code.includes(accountSearch) || acc.nameAr.includes(accountSearch) || (acc.mobile && acc.mobile.includes(accountSearch))
              )}
              columns={[
                { title: 'رقم الحساب', dataIndex: 'code', key: 'code', width: 120 },
                { title: 'اسم الحساب', dataIndex: 'nameAr', key: 'nameAr' },
                { title: 'جوال العميل', dataIndex: 'mobile', key: 'mobile', width: 140, render: (text: string | undefined) => text || '-' },
                { title: 'الرقم الضريبي', dataIndex: 'taxNumber', key: 'taxNumber', width: 160, render: (text: string | undefined) => text || '-' }
              ]}
              rowKey="code"
              pagination={{ pageSize: 8 }}
              size="small"
              bordered
              onRow={record => ({
                onClick: () => {
                  setQuotationData(prev => ({
                    ...prev,
                    customerNumber: record.code,
                    customerName: record.nameAr
                  }));
                  setShowAccountModal(false);
                },
                style: { cursor: 'pointer' }
              })}
            />
          </Modal>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>نوع الجهة</label>
            <Select value={sideType} onChange={setSideType} placeholder="اختر نوع الجهة" allowClear style={largeControlStyle} size="large">
              <Select.Option value="موظف">موظف</Select.Option>
              <Select.Option value="إدارة/قسم">إدارة / قسم</Select.Option>
              <Select.Option value="مشروع">مشروع</Select.Option>
              <Select.Option value="موقع">موقع</Select.Option>
              <Select.Option value="جهة أخرى">جهة أخرى</Select.Option>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم الجهة</label>
            <Input value={sideNumber} onChange={e => setSideNumber(e.target.value)} placeholder="رقم الجهة" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>اسم الجهة</label>
            <Input value={sideName} onChange={e => setSideName(e.target.value)} placeholder="اسم الجهة" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تصنيف العملية</label>
            <Select value={operationClass} onChange={setOperationClass} placeholder="اختر التصنيف" allowClear style={largeControlStyle} size="large">
              <Select.Option value="إنشاء عرض سعر">إنشاء عرض سعر</Select.Option>
              <Select.Option value="تجديد عرض سعر">تجديد عرض سعر</Select.Option>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">
          <div className="flex flex-col gap-2 col-span-3">
            <label style={labelStyle}>البيان</label>
            <Input.TextArea value={statement} onChange={e => setStatement(e.target.value)} placeholder="البيان" rows={2} style={{ ...largeControlStyle, minHeight: 48 }} />
          </div>
        </div>
      </div>

      {/* الأصناف */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div className="flex items-center mb-4">
          <span className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold ml-3">ص</span>
          <h2 className="text-xl font-bold text-gray-800">الأصناف</h2>
        </div>
        
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="صنف جديد" key="new">
            <div className="flex flex-row flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1">
                <Input
                  value={itemCode}
                  onChange={e => setItemCode(e.target.value)}
                  placeholder="رقم الصنف"
                  style={{ ...largeControlStyle, width: 200 }}
                  size="large"
                  suffix={
                    <button
                      type="button"
                      style={{
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: 32,
                        width: 32,
                        border: 'none',
                        background: 'transparent'
                      }}
                      onClick={() => setShowItemModal(true)}
                    >
                      <SearchOutlined style={{ color: '#0074D9' }} />
                    </button>
                  }
                />
              </div>
              <div className="flex flex-col gap-1">
                <Input
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="اسم الصنف"
                  style={{ ...largeControlStyle, width: 200 }}
                  size="large"
                />
                <ItemSearchModal
                  open={showItemModal}
                  onClose={() => setShowItemModal(false)}
                  onSelect={item => {
                    setItemCode(item.code || '');
                    setItemName(item.nameAr);
                    setPrice(item.price?.toString() || '');
                    setShowItemModal(false);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="الكمية" style={{...largeControlStyle, width: 90}} size="large" />
              </div>
              <div className="flex flex-col gap-1">
                <Select
                  showSearch
                  value={unit}
                  onChange={(value) => setUnit(value)}
                  style={{ width: 120, fontFamily: 'Cairo, sans-serif' }}
                  placeholder="الوحدة"
                  options={units.map(unit => ({ 
                    label: unit, 
                    value: unit 
                  }))}
                  size="large"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="السعر" style={{...largeControlStyle, width: 110}} size="large" />
              </div>
              <div className="flex flex-col gap-1">
                <Input value={costCenterName} onChange={e => setCostCenterName(e.target.value)} placeholder="اسم مركز التكلفة" style={largeControlStyle} size="large" />
              </div>
              <Button type="primary" className="bg-blue-600" style={{ height: 48, fontSize: 18, borderRadius: 8, marginRight: 0 }} onClick={handleAddNewItem}>إضافة الصنف</Button>
            </div>

            {/* جدول الأصناف المضافة */}
            <div className="mt-8">
              <Table
                dataSource={addedItems}
                columns={itemColumns}
                rowKey={(record, idx) => idx?.toString() || '0'}
                pagination={false}
                bordered
                locale={{ emptyText: 'لا توجد أصناف مضافة بعد' }}
              />
            </div>
          </TabPane>
          
          <TabPane tab="استيراد من ملف إكسل" key="excel">
            <div className="flex flex-col gap-4 items-start">
              <label style={labelStyle}>رفع ملف إكسل</label>
              <Upload 
                name="excel"
                accept=".xlsx,.xls"
                showUploadList={false}
                customRequest={({ file, onSuccess }) => {
                  setTimeout(() => {
                    onSuccess?.(null);
                  }, 0);
                }}
                onChange={handleExcelUpload}
              >
                <Button icon={<PlusOutlined />} style={{...largeControlStyle, display: 'flex', alignItems: 'center', gap: 8}}>
                  اختر ملف إكسل
                </Button>
              </Upload>
              <div style={{marginTop: 8, color: '#d97706', fontSize: 16, fontWeight: 500, background: '#fffbe6', borderRadius: 6, padding: '8px 12px', border: '1px solid #ffe58f', display: 'flex', alignItems: 'center', gap: 8}}>
                ⚠️ يجب أن يحتوي ملف الإكسل على الأعمدة التالية بالترتيب: رقم كود الصنف، اسم الصنف، الكمية، الوحدة، السعر، مركز التكلفة
              </div>
              {excelFile && (
                <div style={{color: '#16a34a', fontSize: 14, fontWeight: 500}}>
                  ✅ تم رفع الملف: {excelFile.name}
                </div>
              )}
            </div>

            {/* جدول الأصناف المضافة */}
            <div className="mt-8">
              <Table
                dataSource={addedItems}
                columns={itemColumns}
                rowKey={(record, idx) => idx?.toString() || '0'}
                pagination={false}
                bordered
                locale={{ emptyText: 'لا توجد أصناف مضافة بعد' }}
              />
            </div>
          </TabPane>
        </Tabs>

        {/* أزرار الحفظ والطباعة */}
        <div className="flex gap-4 mt-8 justify-center">
          <Button 
            type="primary" 
            size="large" 
            onClick={handleSaveAndPrint}
            style={{
              height: 48,
              fontSize: 18,
              borderRadius: 8,
              padding: '0 32px',
              backgroundColor: '#1890ff',
              borderColor: '#1890ff'
            }}
            icon={<SaveOutlined />}
          >
            حفظ وطباعة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddQuotationPage;

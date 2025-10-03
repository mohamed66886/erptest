import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { SearchOutlined, SaveOutlined, PlusOutlined, UserOutlined, FileTextOutlined, CloseOutlined } from '@ant-design/icons';
import { FileText, Calendar, Building2 } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { useAuth } from '@/contexts/useAuth';
import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import dayjs from 'dayjs';
import { Button, Input, Select, Table, message, Form, Row, Col, DatePicker, Spin, Modal, Space, Card, Divider, Tabs, Typography, Select as AntdSelect } from 'antd';
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
import styles from './ReceiptVoucher.module.css';

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

interface InventoryItem {
  id: string;
  numericId?: number;
  name: string;
  type?: 'رئيسي' | 'مستوى أول' | 'مستوى ثاني';
  parentId?: number;
  itemCode?: string;
  salePrice?: number;
  purchasePrice?: number;
  discount?: number;
  isVatIncluded?: boolean;
  tempCodes?: boolean;
  allowNegative?: boolean;
  minOrder?: number;
  supplier?: string;
  unit?: string;
  createdAt?: string;
}

interface CompanyData {
  arabicName?: string;
  englishName?: string;
  companyType?: string;
  commercialRegistration?: string;
  taxFile?: string;
  city?: string;
  region?: string;
  street?: string;
  district?: string;
  buildingNumber?: string;
  postalCode?: string;
  phone?: string;
  mobile?: string;
  logoUrl?: string;
  website?: string;
  taxRate?: string;
}

interface Delegate {
  id: string;
  name?: string;
  email?: string;
  uid?: string;
}

interface SalesInvoiceItem {
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

interface SalesInvoiceData {
  invoiceNumber: string;
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
  paymentMethod?: string;
  paymentStatus?: string;
  cashBox?: string;
}

interface CashBox {
  id?: string;
  nameAr: string;
  nameEn: string;
  branch: string;
  mainAccount?: string;
  subAccountId?: string;
  subAccountCode?: string;
}

interface Bank {
  id?: string;
  arabicName: string;
  englishName: string;
  branch?: string;
  mainAccount?: string;
  subAccountId?: string;
  subAccountCode?: string;
}

interface MultiplePayment {
  cash?: {
    cashBoxId: string;
    amount: string;
  };
  bank?: {
    bankId: string;
    amount: string;
  };
  card?: {
    bankId: string;
    amount: string;
  };
}

interface SavedInvoiceData {
  invoiceNumber: string;
  entryNumber: string;
  date: string;
  dueDate?: string | null;
  branch: string;
  warehouse: string;
  movementType: string;
  accountType: string;
  paymentMethod: string;
  paymentStatus: string;
  delegate: string;
  customer: {
    id: string;
    name: string;
    mobile: string;
    taxNumber: string;
  };
  items: Array<{
    itemNumber: string;
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    price: number;
    discountPercent: number;
    discountValue: number;
    taxPercent: number;
    taxValue: number;
    total: number;
  }>;
  totals: {
    subtotal: number;
    totalDiscount: number;
    afterDiscount: number;
    totalTax: number;
    finalTotal: number;
  };
  statement: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  multiplePayment?: MultiplePayment;
  cashBoxId?: string;
}

const { TabPane } = Tabs;

const AddSalesInvoicePage: React.FC = () => {
  const { user } = useAuth();
  const controls = useAnimation();
  
  // المتغيرات الجديدة للواجهة المطلوبة
  const [periodRange, setPeriodRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [refDate, setRefDate] = useState<dayjs.Dayjs | null>(null);
  const [movementType, setMovementType] = useState<string | null>("فاتورة مبيعات");
  const [accountType, setAccountType] = useState<string | null>("عميل");
  const [sideType, setSideType] = useState<string | null>(null);
  const [sideNumber, setSideNumber] = useState("");
  const [sideName, setSideName] = useState("");
  const [operationClass, setOperationClass] = useState<string | null>(null);
  const [statement, setStatement] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("نقدي");
  const [paymentStatus, setPaymentStatus] = useState<string>("مدفوع");
  
  // حالة الدفع المتعدد
  const [multiplePaymentMode, setMultiplePaymentMode] = useState<boolean>(false);
  const [multiplePayment, setMultiplePayment] = useState<MultiplePayment>({});
  
  // قوائم البيانات للدفع
  const [banks, setBanks] = useState<Bank[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<{id: string; name: string; value: string}[]>([]);

  // إضافة CSS للصف المعدل
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .edited-row {
        background-color: #e6f7ff !important;
        border: 2px solid #91d5ff !important;
      }
      
      .edited-row:hover {
        background-color: #bae7ff !important;
      }
      
      .edited-row td {
        background-color: inherit !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // متغيرات الأصناف
  const [activeTab, setActiveTab] = useState("new");
  const [itemCode, setItemCode] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("قطعة");
  const [price, setPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [showItemModal, setShowItemModal] = useState(false);
  const [addedItems, setAddedItems] = useState<Array<{
    itemCode: string;
    itemName: string;
    quantity: string;
    unit: string;
    price: string;
    discountPercent: number;
    taxPercent: number;
  }>>([]);

  // متغيرات مودال البحث عن العميل
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountModalType, setAccountModalType] = useState("عميل");
  const [customerAccounts, setCustomerAccounts] = useState<{ code: string; nameAr: string; mobile?: string; taxNumber?: string }[]>([]);
  const [supplierAccounts, setSupplierAccounts] = useState<{ code: string; nameAr: string; mobile?: string }[]>([]);

  // متغيرات الإكسل
  const [excelFile, setExcelFile] = useState<File | null>(null);
  
  // متغيرات التحكم في الحالة
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // لتتبع ما إذا كانت الفاتورة محفوظة
  const [lastSavedInvoice, setLastSavedInvoice] = useState<object | null>(null); // لحفظ بيانات آخر فاتورة تم حفظها

  // البيانات الأساسية
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [delegate, setDelegate] = useState<string>("");
  const [units, setUnits] = useState<string[]>(['قطعة', 'كيلو', 'لتر', 'متر', 'صندوق', 'عبوة']);
  const [companyData, setCompanyData] = useState<CompanyData>({});

  // بيانات فاتورة المبيعات
  const [invoiceData, setInvoiceData] = useState<SalesInvoiceData>({
    invoiceNumber: '',
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
    paymentMethod: 'نقدي',
    paymentStatus: 'مدفوع'
  });

  // دوال إدارة الأصناف
  const handleItemSelect = (selectedItemName: string) => {
    if (!selectedItemName) {
      // إذا تم مسح الاختيار
      setItemName('');
      setItemCode('');
      setPrice('');
      setDiscountPercent(0);
      const defaultTaxRate = companyData.taxRate ? parseFloat(companyData.taxRate) : 15;
      setTaxPercent(defaultTaxRate);
      setUnit('قطعة');
      return;
    }

    const selectedItem = items.find(item => item.name === selectedItemName);
    
    if (selectedItem) {
      // التحقق من أن الصنف غير موقوف مؤقتاً
      if (selectedItem.tempCodes) {
        message.warning(`تم إيقاف الصنف "${selectedItemName}" مؤقتاً ولا يمكن إضافته للفاتورة`);
        setItemName('');
        setItemCode('');
        setPrice('');
        setDiscountPercent(0);
        const defaultTaxRate = companyData.taxRate ? parseFloat(companyData.taxRate) : 15;
        setTaxPercent(defaultTaxRate);
        setUnit('قطعة');
        return;
      }

      // تعبئة البيانات تلقائياً
      setItemName(selectedItemName);
      setItemCode(selectedItem.itemCode || '');
      setPrice(selectedItem.salePrice ? String(selectedItem.salePrice) : '');
      setDiscountPercent(selectedItem.discount || 0);
      
      // الحصول على نسبة الضريبة من إعدادات الشركة
      const taxRate = companyData.taxRate ? parseFloat(companyData.taxRate) : 15;
      setTaxPercent(taxRate);
      
      // تعيين الوحدة إذا كانت متوفرة
      if (selectedItem.unit) {
        setUnit(selectedItem.unit);
      } else {
        setUnit('قطعة');
      }

      message.success(`تم تحديد الصنف: ${selectedItemName}`);
    } else {
      message.error('لم يتم العثور على بيانات الصنف المختار');
    }
  };

  // دالة لإعادة تعيين الحقول
  const resetFields = () => {
    setItemCode('');
    setItemName('');
    setQuantity('1');
    setUnit('قطعة');
    setPrice('');
    setDiscountPercent(0);
    // استخدام نسبة الضريبة من بيانات الشركة أو القيمة الافتراضية
    const defaultTaxRate = companyData.taxRate ? parseFloat(companyData.taxRate) : 15;
    setTaxPercent(defaultTaxRate);
  };

  const handleAddNewItem = () => {
    // التحقق من صحة البيانات مع رسائل خطأ أكثر وضوحاً
    if (!itemCode.trim()) {
      message.error('يرجى إدخال كود الصنف - هذا الحقل مطلوب');
      return;
    }
    if (!itemName.trim()) {
      message.error('يرجى اختيار اسم الصنف - هذا الحقل مطلوب');
      return;
    }
    if (!quantity || Number(quantity) <= 0) {
      message.error('يرجى إدخال كمية صحيحة أكبر من صفر');
      return;
    }
    if (!price || Number(price) < 0) {
      message.error('يرجى إدخال سعر صحيح (يمكن أن يكون صفر أو أكبر)');
      return;
    }
    if (discountPercent < 0 || discountPercent > 100) {
      message.error('نسبة الخصم يجب أن تكون بين 0 و 100');
      return;
    }

    const finalUnit = unit && unit.trim() ? unit : "قطعة";

    // إضافة الصنف
    const newItem = {
      itemCode: itemCode.trim(),
      itemName: itemName.trim(),
      quantity: quantity,
      unit: finalUnit,
      price: price,
      discountPercent: discountPercent || 0,
      taxPercent: taxPercent || 0
    };

    setAddedItems(items => {
      let newItems;
      
      // التحقق من أننا في وضع التعديل أم الإضافة
      if (editingItemIndex !== null) {
        // في وضع التعديل - نحديث الصنف الموجود
        newItems = [...items];
        newItems[editingItemIndex] = newItem;
        setEditingItemIndex(null); // إعادة تعيين حالة التعديل
        message.success('تم تحديث الصنف بنجاح');
      } else {
        // في وضع الإضافة - التحقق من التكرار
        const existingIndex = items.findIndex(item => 
          item.itemCode === newItem.itemCode && item.itemName === newItem.itemName
        );
        
        if (existingIndex !== -1) {
          // الصنف موجود - عرض خيارات للمستخدم
          Modal.confirm({
            title: 'صنف موجود بالفعل',
            content: `الصنف "${newItem.itemName}" موجود بالفعل في القائمة. ماذا تريد أن تفعل؟`,
            okText: 'دمج الكميات',
            cancelText: 'استبدال الصنف',
            onOk: () => {
              // دمج الكميات
              newItems = [...items];
              const existingItem = newItems[existingIndex];
              const existingQty = Number(existingItem.quantity) || 0;
              const newQty = Number(newItem.quantity) || 0;
              const totalQty = existingQty + newQty;
              
              newItems[existingIndex] = {
                ...newItem,
                quantity: totalQty.toString()
              };
              setAddedItems(newItems);
              resetFields();
              message.success(`تم دمج الكميات - الكمية الجديدة: ${totalQty}`);
            },
            onCancel: () => {
              // استبدال الصنف
              newItems = [...items];
              newItems[existingIndex] = newItem;
              setAddedItems(newItems);
              resetFields();
              message.success('تم استبدال الصنف بالبيانات الجديدة');
            }
          });
          return items; // إرجاع القائمة الحالية حتى يتم التحديث من داخل المودال
        } else {
          // صنف جديد - إضافة عادية
          newItems = [...items, newItem];
          message.success('تم إضافة الصنف بنجاح');
        }
      }
      
      return newItems;
    });
    
    // إعادة تعيين الحقول فقط إذا لم يكن هناك تكرار أو كان في وضع التعديل
    if (editingItemIndex !== null || !addedItems.some(item => 
      item.itemCode === newItem.itemCode && item.itemName === newItem.itemName
    )) {
      resetFields();
    }
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
          try {
            const data = new Uint8Array(e.target!.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
            
            // تجاهل الصف الأول إذا كان يحتوي على رؤوس الأعمدة
            const dataRows = rows.slice(1).filter((row: string[]) => Array.isArray(row) && row.length >= 5);
            
            if (dataRows.length === 0) {
              message.error("لم يتم العثور على بيانات صالحة في الملف");
              return;
            }

            const defaultTaxRate = companyData.taxRate ? parseFloat(companyData.taxRate) : 15;
            
            const items = dataRows
              .map((row: string[], index: number) => {
                try {
                  const itemCode = String(row[0] || "").trim();
                  const itemName = String(row[1] || "").trim();
                  const quantity = String(row[2] || "1").trim();
                  const unit = String(row[3] || "قطعة").trim();
                  const price = String(row[4] || "").trim();
                  const discountPercent = Number(row[5] || 0);

                  // التحقق من صحة البيانات الأساسية
                  if (!itemCode || !itemName || !quantity || !price) {
                    console.warn(`تم تجاهل الصف ${index + 2}: بيانات ناقصة`);
                    return null;
                  }

                  if (Number(quantity) <= 0 || Number(price) <= 0) {
                    console.warn(`تم تجاهل الصف ${index + 2}: قيم غير صحيحة`);
                    return null;
                  }

                  return {
                    itemCode,
                    itemName,
                    quantity,
                    unit,
                    price,
                    discountPercent: Math.max(0, Math.min(100, discountPercent)), // التأكد من أن الخصم بين 0 و 100
                    taxPercent: defaultTaxRate
                  };
                } catch (error) {
                  console.warn(`خطأ في معالجة الصف ${index + 2}:`, error);
                  return null;
                }
              })
              .filter(item => item !== null) as Array<{
                itemCode: string;
                itemName: string;
                quantity: string;
                unit: string;
                price: string;
                discountPercent: number;
                taxPercent: number;
              }>;

            if (items.length === 0) {
              message.error("لم يتم العثور على أصناف صالحة في الملف");
              return;
            }

            // التحقق من عدم تكرار الأصناف
            const existingCodes = new Set(addedItems.map(item => item.itemCode));
            const newItems = items.filter(item => !existingCodes.has(item.itemCode));
            const duplicateCount = items.length - newItems.length;

            if (duplicateCount > 0) {
              message.warning(`تم تجاهل ${duplicateCount} صنف مكرر`);
            }

            if (newItems.length > 0) {
              setAddedItems(prev => [...prev, ...newItems]);
              // إعادة تعيين فهرس الصف المعدل
              setEditingItemIndex(null);
              message.success(`تم إضافة ${newItems.length} صنف من ملف الإكسل بنجاح`);
            } else {
              message.warning("جميع الأصناف في الملف موجودة بالفعل");
            }

          } catch (error) {
            console.error('خطأ في قراءة ملف الإكسل:', error);
            message.error("حدث خطأ أثناء قراءة ملف الإكسل. تأكد من صحة تنسيق الملف");
          }
        };
        
        reader.readAsArrayBuffer(file.originFileObj);
      }
    } else if (file.status === "error") {
      message.error(`${file.name || 'ملف'} حدث خطأ أثناء رفع الملف`);
    }
  };

  // دالة الحفظ مع ربط Firebase
  const handleSave = async () => {
    // التحقق من صحة البيانات مع رسائل أكثر وضوحاً
    if (!invoiceData.branch) {
      message.error('يرجى اختيار الفرع - هذا الحقل مطلوب');
      return;
    }
    if (!invoiceData.warehouse) {
      message.error('يرجى اختيار المخزن - هذا الحقل مطلوب');
      return;
    }
    if (!accountType) {
      message.error('يرجى اختيار نوع الحساب (عميل أو عميل محتمل)');
      return;
    }
    if (!invoiceData.customerNumber.trim()) {
      message.error('يرجى إدخال رقم الحساب - هذا الحقل مطلوب');
      return;
    }
    if (!invoiceData.customerName.trim()) {
      message.error('يرجى إدخال اسم الحساب - هذا الحقل مطلوب');
      return;
    }
    if (!addedItems.length) {
      message.error('يرجى إضافة صنف واحد على الأقل قبل الحفظ');
      return;
    }
    if (!delegate) {
      message.error('يرجى اختيار البائع/المندوب - هذا الحقل مطلوب');
      return;
    }
    if (!paymentMethod) {
      message.error('يرجى اختيار طريقة الدفع - هذا الحقل مطلوب');
      return;
    }

    setSaving(true);
    
    try {
      // حساب الإجماليات
      const calculatedTotals = addedItems.reduce(
        (acc, item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.price) || 0;
          const discount = Number(item.discountPercent) || 0;
          const tax = Number(item.taxPercent) || 0;
          
          const subtotal = qty * price;
          const discountValue = (subtotal * discount) / 100;
          const afterDiscount = subtotal - discountValue;
          const taxValue = (afterDiscount * tax) / 100;
          const total = afterDiscount + taxValue;
          
          acc.subtotal += subtotal;
          acc.totalDiscount += discountValue;
          acc.totalTax += taxValue;
          acc.finalTotal += total;
          
          return acc;
        },
        { subtotal: 0, totalDiscount: 0, totalTax: 0, finalTotal: 0 }
      );

      // التحقق من الدفع المتعدد
      if (multiplePaymentMode) {
        const cashAmount = parseFloat(multiplePayment.cash?.amount || '0');
        const bankAmount = parseFloat(multiplePayment.bank?.amount || '0');
        const cardAmount = parseFloat(multiplePayment.card?.amount || '0');
        const totalPaid = cashAmount + bankAmount + cardAmount;
        
        // التحقق من تطابق المبالغ مع هامش خطأ صغير
        if (Math.abs(totalPaid - calculatedTotals.finalTotal) > 0.01) {
          setSaving(false);
          message.error(`إجمالي المبالغ المدفوعة (${totalPaid.toFixed(2)}) يجب أن يساوي إجمالي الفاتورة (${calculatedTotals.finalTotal.toFixed(2)})`);
          return;
        }
        
        // التحقق من صحة بيانات الدفع المتعدد
        if (cashAmount > 0 && !multiplePayment.cash?.cashBoxId) {
          setSaving(false);
          message.error('يرجى اختيار الصندوق النقدي للمبلغ النقدي');
          return;
        }
        
        if (bankAmount > 0 && !multiplePayment.bank?.bankId) {
          setSaving(false);
          message.error('يرجى اختيار البنك للتحويل البنكي');
          return;
        }
        
        if (cardAmount > 0 && !multiplePayment.card?.bankId) {
          setSaving(false);
          message.error('يرجى اختيار البنك لبطاقة الشبكة');
          return;
        }
      } else if (paymentMethod === 'نقدي') {
        // التحقق من الصندوق النقدي للدفع العادي
        const availableCashBoxes = cashBoxes.filter(cb => cb.branch === invoiceData.branch);
        if (availableCashBoxes.length === 0) {
          setSaving(false);
          message.error('لا توجد صناديق نقدية متاحة لهذا الفرع. يرجى إضافة صندوق نقدي أولاً');
          return;
        }
        if (!invoiceData.cashBox) {
          // تعيين الصندوق الافتراضي تلقائياً
          setInvoiceData(prev => ({ ...prev, cashBox: availableCashBoxes[0].id }));
        }
      }

      // إعداد بيانات الفاتورة للحفظ
      const invoiceToSave: SavedInvoiceData = {
        invoiceNumber: invoiceNumber,
        entryNumber: entryNumber,
        date: invoiceDate.format('YYYY-MM-DD'),
        dueDate: refDate ? refDate.format('YYYY-MM-DD') : null,
        branch: invoiceData.branch,
        warehouse: invoiceData.warehouse,
        movementType: movementType || "فاتورة مبيعات",
        accountType: accountType || "عميل",
        paymentMethod,
        paymentStatus,
        delegate: delegate,
        customer: {
          id: invoiceData.customerNumber,
          name: invoiceData.customerName,
          mobile: customers.find(c => c.id === invoiceData.customerNumber)?.mobile || '',
          taxNumber: customers.find(c => c.id === invoiceData.customerNumber)?.taxFileNumber || ''
        },
        items: addedItems.map((item, index) => {
          const qty = Number(item.quantity);
          const price = Number(item.price);
          const discountPercent = Number(item.discountPercent);
          const taxPercent = Number(item.taxPercent);
          const subtotal = qty * price;
          const discountValue = (subtotal * discountPercent) / 100;
          const afterDiscount = subtotal - discountValue;
          const taxValue = (afterDiscount * taxPercent) / 100;
          const total = afterDiscount + taxValue;
          
          return {
            itemNumber: item.itemCode, // استخدام كود الصنف الفعلي
            itemCode: item.itemCode,
            itemName: item.itemName,
            quantity: qty,
            unit: item.unit,
            price: price,
            discountPercent: discountPercent,
            discountValue: discountValue,
            taxPercent: taxPercent,
            taxValue: taxValue,
            total: total
          };
        }),
        totals: {
          subtotal: calculatedTotals.subtotal,
          totalDiscount: calculatedTotals.totalDiscount,
          afterDiscount: calculatedTotals.subtotal - calculatedTotals.totalDiscount,
          totalTax: calculatedTotals.totalTax,
          finalTotal: calculatedTotals.finalTotal
        },
        statement: statement.trim(),
        createdBy: user?.uid || '',
        createdByName: user?.displayName || user?.email || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed' // حالة مكتملة للفاتورة
      };

      // إضافة بيانات الدفع المتعدد إذا كان مفعلاً
      if (multiplePaymentMode && multiplePayment) {
        invoiceToSave.multiplePayment = multiplePayment;
      } else if (paymentMethod === 'نقدي') {
        // إضافة الصندوق النقدي للدفع العادي
        const selectedCashBox = invoiceData.cashBox || cashBoxes.find(cb => cb.branch === invoiceData.branch)?.id;
        if (selectedCashBox) {
          invoiceToSave.cashBoxId = selectedCashBox;
        }
      }

      // حفظ في Firebase
      const docRef = await addDoc(collection(db, 'sales_invoices'), invoiceToSave);
      
      message.success(`تم حفظ الفاتورة بنجاح - رقم الفاتورة: ${invoiceNumber}`);
      setIsSaved(true); // تعيين الحالة إلى محفوظ - الآن يمكن الطباعة
      
      // حفظ بيانات الفاتورة المحفوظة للطباعة
      setLastSavedInvoice({
        id: docRef.id,
        ...invoiceToSave,
        items: addedItems
      });
      
      // إعادة تعيين النموذج لفاتورة جديدة بعد فترة قصيرة
      setTimeout(() => {
        setAddedItems([]);
        setEditingItemIndex(null);
        setInvoiceData(prev => ({
          ...prev,
          customerNumber: '',
          customerName: ''
        }));
        setStatement('');
        setIsSaved(false); // إعادة تعيين حالة الحفظ للفاتورة الجديدة
        setMultiplePaymentMode(false); // إعادة تعيين وضع الدفع المتعدد
        setMultiplePayment({}); // إعادة تعيين بيانات الدفع المتعدد
        setPaymentMethod('نقدي'); // إعادة تعيين طريقة الدفع إلى القيمة الافتراضية
        
        // إعادة تعيين المندوب إلى المستخدم الحالي
        if (delegates.length && user?.uid) {
          const currentUserDelegate = delegates.find(delegateItem => 
            delegateItem.uid === user.uid || 
            delegateItem.email === user.email
          );
          
          if (currentUserDelegate) {
            setDelegate(currentUserDelegate.id);
          }
        }
        
        // توليد رقم فاتورة جديد
        if (invoiceData.branch) {
          generateAndSetInvoiceNumber(invoiceData.branch);
          generateAndSetEntryNumber(invoiceData.branch);
        }
      }, 100); // انتظار 100ms فقط
      
    } catch (error) {
      console.error('خطأ في حفظ الفاتورة:', error);
      message.error('حدث خطأ أثناء حفظ الفاتورة. يرجى المحاولة مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  // دالة الطباعة للفاتورة
  const handlePrint = async () => {
    // التحقق من أن الفاتورة تم حفظها أولاً
    if (!isSaved || !lastSavedInvoice) {
      message.warning('يجب حفظ الفاتورة أولاً قبل الطباعة');
      return;
    }

    // استخدام البيانات المحفوظة للطباعة
    const savedData = lastSavedInvoice as {
      invoiceNumber: string;
      entryNumber: string;
      date: string;
      branch: string;
      warehouse: string;
      dueDate?: string;
      delegate?: string;
      paymentMethod?: string;
      paymentStatus?: string;
      multiplePayment?: MultiplePayment;
      customer: { 
        name: string;
        id?: string;
        mobile?: string;
      };
      items: Array<{
        itemCode: string;
        itemName: string;
        quantity: string;
        unit: string;
        price: string;
        discountPercent: number;
        taxPercent: number;
      }>;
    };

    // التحقق من وجود البيانات المطلوبة
    if (!savedData.branch) return message.error('يرجى اختيار الفرع');
    if (!savedData.warehouse) return message.error('يرجى اختيار المخزن');
    if (!savedData.customer?.name) return message.error('يرجى إدخال اسم العميل');
    if (!savedData.items?.length) return message.error('يرجى إضافة الأصناف');

    // جلب بيانات الشركة من الإعدادات (إذا لم تكن محملة بالفعل)
    let currentCompanyData = companyData;
    if (!currentCompanyData.arabicName) {
      try {
        const snapshot = await getDocs(collection(db, 'companies'));
        if (!snapshot.empty) {
          currentCompanyData = snapshot.docs[0].data() as CompanyData;
        }
      } catch (error) {
        console.error('Error fetching company data for print:', error);
        // استخدام بيانات افتراضية في حالة الخطأ
        currentCompanyData = {
          arabicName: 'شركة ERP90',
          englishName: 'ERP90 Company',
          companyType: 'شركة ذات مسؤولية محدودة',
          commercialRegistration: '1234567890',
          taxFile: '123456789012345',
          city: 'الرياض',
          region: 'منطقة الرياض',
          street: 'شارع الملك فهد',
          district: 'حي العليا',
          buildingNumber: '123',
          postalCode: '12345',
          phone: '+966112345678',
          mobile: '+966501234567',
          logoUrl: 'https://via.placeholder.com/150x80?text=LOGO',
          website: 'www.erp90.com'
        };
      }
    }

    // بيانات الفاتورة
    const invoiceTotals = {
      subtotal: savedData.items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        return sum + (qty * price);
      }, 0),
      totalDiscount: savedData.items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discountPercent) || 0;
        return sum + ((qty * price * discount) / 100);
      }, 0),
      totalTax: savedData.items.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discountPercent) || 0;
        const afterDiscount = qty * price * (1 - discount / 100);
        const tax = Number(item.taxPercent) || 0;
        return sum + ((afterDiscount * tax) / 100);
      }, 0)
    };

    const afterDiscount = invoiceTotals.subtotal - invoiceTotals.totalDiscount;
    const finalTotal = afterDiscount + invoiceTotals.totalTax;

    try {
      // Generate QR code data URL (using qrcode library)
      let qrDataUrl = '';
      try {
        // Dynamically import qrcode library
        const QRCode = (await import('qrcode')).default;
        const qrContent = JSON.stringify({
          invoiceNumber: savedData.invoiceNumber,
          company: currentCompanyData.arabicName,
          date: savedData.date,
          total: finalTotal,
          customer: savedData.customer?.name
        });
        qrDataUrl = await QRCode.toDataURL(qrContent, { width: 120, margin: 1 });
      } catch (e) {
        console.error('Error generating QR code:', e);
        qrDataUrl = '';
      }

      // إنشاء عنصر div مخفي للطباعة
      const printContainer = document.createElement('div');
      printContainer.id = 'print-container';
      printContainer.style.position = 'absolute';
      printContainer.style.left = '-9999px';
      printContainer.style.top = '-9999px';
      printContainer.style.width = '210mm';
      printContainer.style.height = 'auto';
      
      // إضافة محتوى عرض السعر
      printContainer.innerHTML = `
        <html>
        <head>
          <title>فاتورة مبيعات | Sales Invoice</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            @page { 
              size: A4; 
              margin: 8mm; 
            }
            @media print {
              html, body { 
                margin: 0 !important; 
                padding: 0 !important; 
                height: auto !important;
                overflow: hidden !important;
              }
              * { 
                -webkit-print-color-adjust: exact; 
                color-adjust: exact; 
                box-sizing: border-box;
              }
            }
            html, body {
              margin: 0;
              padding: 0;
              height: auto;
              overflow: visible;
              background-color: #fff !important;
            }
            body {
              font-family: 'Tajawal', sans-serif;
              direction: rtl;
              padding: 4mm;
              color: #000;
              font-size: 11px;
              line-height: 1.3;
              max-width: 100%;
              box-sizing: border-box;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4mm;
              border-bottom: 1px solid #000;
              padding-bottom: 2mm;
              page-break-inside: avoid;
            }
            .header-section {
              flex: 1;
              min-width: 0;
              padding: 0 8px;
              box-sizing: border-box;
            }
            .header-section.center {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              flex: 0 0 120px;
              max-width: 120px;
              min-width: 100px;
            }
            .logo {
              width: 150px;
              height: auto;
              margin-bottom: 8px;
            }
            .company-info-ar {
              text-align: right;
              font-size: 11px;
              font-weight: 500;
              line-height: 1.4;
            }
            .company-info-en {
              text-align: left;
              font-family: Arial, sans-serif;
              direction: ltr;
              font-size: 10px;
              font-weight: 500;
              line-height: 1.4;
            }
            .info-row-table {
              border: 1px solid #bbb;
              border-radius: 4px;
              margin-bottom: 0;
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
              margin-top: 0;
            }
            .info-row-table td {
              border: none;
              padding: 2px 8px;
              vertical-align: middle;
              font-weight: 500;
            }
            .info-row-table .label {
              color: #444;
              font-weight: bold;
              min-width: 80px;
              text-align: right;
            }
            .info-row-table .value {
              color: #222;
              text-align: left;
            }
            .info-row-container {
              display: flex;
              flex-direction: row;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 3mm;
              gap: 12px;
              page-break-inside: avoid;
            }
            .info-row-table.left {
              direction: rtl;
            }
            .info-row-table.right {
              direction: rtl;
            }
            .qr-center {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-width: 100px;
              max-width: 120px;
              flex: 0 0 120px;
            }
            .qr-code {
              width: 80px;
              height: 80px;
              border: 1px solid #ddd;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: Arial;
              font-size: 8px;
              text-align: center;
              margin-top: 4px;
            }
            .quotation-title { text-align: center; font-size: 16px; font-weight: bold; margin: 5mm 0; border: 1px solid #000; padding: 2mm; background-color: #f3f3f3; }
            .customer-info { margin-bottom: 5mm; border: 1px solid #ddd; padding: 3mm; }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-bottom: 3mm; 
              font-size: 10px;
              page-break-inside: avoid;
            }
            th, td { border: 1px solid #000; padding: 1.5mm; text-align: center; }
            th {
              background-color: #eae6e6;
              color: #000;
              font-weight: bold;
              font-size: 11px;
              letter-spacing: 0.3px;
            }
            .totals { 
              margin-top: 3mm; 
              border-top: 1px solid #000; 
              padding-top: 2mm; 
              font-weight: bold;
              page-break-inside: avoid;
            }
            .signature { 
              margin-top: 3mm; 
              display: flex; 
              justify-content: space-between;
              page-break-inside: avoid;
            }
            .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 2mm; }
            .footer { 
              margin-top: 3mm; 
              text-align: center; 
              font-size: 9px;
              page-break-inside: avoid;
            }
            .totals-container {
              display: flex;
              justify-content: flex-end;
              margin-top: 3mm;
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <!-- Header Section: Arabic (right), Logo (center), English (left) -->
          <div class="header">
            <div class="header-section company-info-ar">
              <div>${currentCompanyData.arabicName || ''}</div>
              <div>${currentCompanyData.companyType || ''}</div>
              <div>السجل التجاري: ${currentCompanyData.commercialRegistration || ''}</div>
              <div>الملف الضريبي: ${currentCompanyData.taxFile || ''}</div>
              <div>العنوان: ${currentCompanyData.city || ''} ${currentCompanyData.region || ''} ${currentCompanyData.street || ''} ${currentCompanyData.district || ''} ${currentCompanyData.buildingNumber || ''}</div>
              <div>الرمز البريدي: ${currentCompanyData.postalCode || ''}</div>
              <div>الهاتف: ${currentCompanyData.phone || ''}</div>
              <div>الجوال: ${currentCompanyData.mobile || ''}</div>
            </div>
            <div class="header-section center">
              <img src="${currentCompanyData.logoUrl || 'https://via.placeholder.com/100x50?text=Company+Logo'}" class="logo" alt="Company Logo">
              <div style="text-align: center; font-size: 12px; margin-top: 8px; padding: 4px 8px; border-radius: 4px;">
                فاتورة مبيعات
              </div>
            </div>
            <div class="header-section company-info-en">
              <div>${currentCompanyData.englishName || ''}</div>
              <div>${currentCompanyData.companyType || ''}</div>
              <div>Commercial Reg.: ${currentCompanyData.commercialRegistration || ''}</div>
              <div>Tax File: ${currentCompanyData.taxFile || ''}</div>
              <div>Address: ${currentCompanyData.city || ''} ${currentCompanyData.region || ''} ${currentCompanyData.street || ''} ${currentCompanyData.district || ''} ${currentCompanyData.buildingNumber || ''}</div>
              <div>Postal Code: ${currentCompanyData.postalCode || ''}</div>
              <div>Phone: ${currentCompanyData.phone || ''}</div>
              <div>Mobile: ${currentCompanyData.mobile || ''}</div>
            </div>
          </div>
          
          <!-- Info Row Section: Invoice info (right), QR (center), Customer info (left) -->
          <div class="info-row-container">
            <table class="info-row-table right">
              <tr><td class="label">رقم الفاتورة</td><td class="value">${savedData.invoiceNumber || ''}</td></tr>
              <tr><td class="label">رقم القيد</td><td class="value">${savedData.entryNumber || ''}</td></tr>
              <tr><td class="label">تاريخ الفاتورة</td><td class="value">${savedData.date || ''}</td></tr>
              <tr><td class="label">تاريخ الاستحقاق</td><td class="value">${savedData.dueDate || ''}</td></tr>
              <tr><td class="label">نوع الحركة</td><td class="value">${movementType || ''}</td></tr>
              <tr><td class="label">طريقة الدفع</td><td class="value">${savedData.paymentMethod || ''}</td></tr>
              <tr><td class="label">حالة الدفع</td><td class="value">${savedData.paymentStatus || ''}</td></tr>
            </table>
            <div class="qr-center">
              <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">
                ${(() => {
                  const branch = branches.find(b => b.id === savedData.branch);
                  return branch ? (branch.name || branch.id) : (savedData.branch || '');
                })()}
              </div>
              <div class="qr-code">
                ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" style="width:80px;height:80px;" />` : 'QR Code'}
              </div>
            </div>
            <table class="info-row-table left">
              <tr><td class="label">اسم العميل</td><td class="value">${savedData.customer?.name || ''}</td></tr>
              <tr><td class="label">رقم العميل</td><td class="value">${savedData.customer?.id || ''}</td></tr>
              <tr><td class="label">نوع الحساب</td><td class="value">${accountType || ''}</td></tr>
              <tr><td class="label">رقم الموبايل</td><td class="value">${savedData.customer?.mobile || ''}</td></tr>
            </table>
          </div>
          
          <!-- Items Table -->
          <table>
            <thead>
              <tr>
                <th>الرقم</th>
                <th>كود الصنف</th>
                <th>اسم الصنف</th>
                <th>الكمية</th>
                <th>الوحدة</th>
                <th>السعر</th>
                <th>نسبة الخصم %</th>
                <th>مبلغ الخصم</th>
                <th>الإجمالي قبل الضريبة</th>
                <th>نسبة الضريبة %</th>
                <th>قيمة الضريبة</th>
                <th>الإجمالي النهائي</th>
              </tr>
            </thead>
            <tbody>
              ${savedData.items.map((item, idx) => {
                const subtotal = Number(item.price) * Number(item.quantity);
                const discountValue = (subtotal * Number(item.discountPercent)) / 100;
                const afterDiscount = subtotal - discountValue;
                const taxValue = (afterDiscount * Number(item.taxPercent)) / 100;
                const total = afterDiscount + taxValue;
                return `<tr>
                  <td>${idx + 1}</td>
                  <td>${item.itemCode || ''}</td>
                  <td>${item.itemName || ''}</td>
                  <td>${item.quantity || ''}</td>
                  <td>${item.unit || ''}</td>
                  <td>${Number(item.price).toFixed(2)}</td>
                  <td>${item.discountPercent || '0'}</td>
                  <td>${discountValue.toFixed(2)}</td>
                  <td>${afterDiscount.toFixed(2)}</td>
                  <td>${item.taxPercent || '0'}</td>
                  <td>${taxValue.toFixed(2)}</td>
                  <td>${total.toFixed(2)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          
          <!-- Payment Details Section -->
          ${savedData.paymentMethod === 'متعدد' && savedData.multiplePayment ? `
            <div style="margin-top: 15px; margin-bottom: 15px;">
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 11px;">
                <thead>
                  <tr>
                    <td colspan="2" style="font-weight:bold; color:#fff; text-align:center; padding:7px 12px; border:1px solid #000; background:#305496;">تفاصيل طريقة الدفع</td>
                  </tr>
                </thead>
                <tbody>
                  ${savedData.multiplePayment.cash && parseFloat(savedData.multiplePayment.cash.amount || '0') > 0 ? `
                    <tr>
                      <td style="padding:5px 10px; border:1px solid #000; font-weight:500;">الدفع النقدي</td>
                      <td style="padding:5px 10px; border:1px solid #000; text-align:left;">${parseFloat(savedData.multiplePayment.cash.amount).toFixed(2)} ر.س</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 10px; border:1px solid #000; font-size:10px; color:#666;">الصندوق النقدي</td>
                      <td style="padding:5px 10px; border:1px solid #000; text-align:left; font-size:10px; color:#666;">
                        ${(() => {
                          const cashBox = cashBoxes.find(cb => cb.id === savedData.multiplePayment.cash?.cashBoxId);
                          return cashBox ? cashBox.nameAr : (savedData.multiplePayment.cash?.cashBoxId || '');
                        })()}
                      </td>
                    </tr>
                  ` : ''}
                  ${savedData.multiplePayment.bank && parseFloat(savedData.multiplePayment.bank.amount || '0') > 0 ? `
                    <tr>
                      <td style="padding:5px 10px; border:1px solid #000; font-weight:500;">التحويل البنكي</td>
                      <td style="padding:5px 10px; border:1px solid #000; text-align:left;">${parseFloat(savedData.multiplePayment.bank.amount).toFixed(2)} ر.س</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 10px; border:1px solid #000; font-size:10px; color:#666;">البنك</td>
                      <td style="padding:5px 10px; border:1px solid #000; text-align:left; font-size:10px; color:#666;">
                        ${(() => {
                          const bank = banks.find(b => b.id === savedData.multiplePayment.bank?.bankId);
                          return bank ? bank.arabicName : (savedData.multiplePayment.bank?.bankId || '');
                        })()}
                      </td>
                    </tr>
                  ` : ''}
                  ${savedData.multiplePayment.card && parseFloat(savedData.multiplePayment.card.amount || '0') > 0 ? `
                    <tr>
                      <td style="padding:5px 10px; border:1px solid #000; font-weight:500;">بطاقة الشبكة</td>
                      <td style="padding:5px 10px; border:1px solid #000; text-align:left;">${parseFloat(savedData.multiplePayment.card.amount).toFixed(2)} ر.س</td>
                    </tr>
                    <tr>
                      <td style="padding:5px 10px; border:1px solid #000; font-size:10px; color:#666;">بنك الشبكة</td>
                      <td style="padding:5px 10px; border:1px solid #000; text-align:left; font-size:10px; color:#666;">
                        ${(() => {
                          const bank = banks.find(b => b.id === savedData.multiplePayment.card?.bankId);
                          return bank ? bank.arabicName : (savedData.multiplePayment.card?.bankId || '');
                        })()}
                      </td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>
          ` : ''}
          
          <!-- Totals Section -->
          <div class="totals-container">
            <table style="border:1.5px solid #000; border-radius:6px; font-size:12px; min-width:300px; max-width:380px; border-collapse:collapse;">
              <tbody>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">إجمالي الفاتورة</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${invoiceTotals.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">مبلغ الخصم</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${invoiceTotals.totalDiscount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">الإجمالي بعد الخصم</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${afterDiscount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">قيمة الضريبة</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${invoiceTotals.totalTax.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">الإجمالي النهائي</td>
                  <td style="text-align:left; font-weight:700; padding:6px 10px; border:1px solid #000; background:#fff;">${finalTotal.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <!-- Signature Section -->
          <div class="signature">
            <div class="signature-box">
              <div>اسم العميل: ${savedData.customer?.name || ''}</div>
              <div>التوقيع: ___________________</div>
            </div>
            <div class="signature-box">
              <div>المندوب: ${savedData.delegate ? getDelegateName(savedData.delegate) : ''}</div>
              <div>التاريخ: ${savedData.date || ''}</div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            ${currentCompanyData.website ? `لزيارة متجرنا الإلكتروني / Visit our e-shop: ${currentCompanyData.website}` : ''}
          </div>
        </body>
        </html>
      `;

      // إضافة العنصر إلى الصفحة
      document.body.appendChild(printContainer);

      // إنشاء stylesheet مخصص للطباعة
      const printStyleElement = document.createElement('style');
      printStyleElement.innerHTML = `
        @media print {
          body * { visibility: hidden; }
          #print-container, #print-container * { visibility: visible; }
          #print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: hidden !important;
          }
          @page {
            margin: 8mm !important;
            size: A4 !important;
          }
          html, body {
            height: auto !important;
            overflow: hidden !important;
          }
        }
      `;
      document.head.appendChild(printStyleElement);

      // طباعة المستند
      window.print();

      // إزالة العناصر المؤقتة بعد الطباعة
      setTimeout(() => {
        document.body.removeChild(printContainer);
        document.head.removeChild(printStyleElement);
      }, 1000);

    } catch (error) {
      console.error('خطأ في الطباعة:', error);
      message.error('حدث خطأ أثناء الطباعة');
    }
  };

  // السنة المالية من السياق العام
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

  // تعيين الفترة المحاسبية حسب السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setPeriodRange([start, end]);
    }
  }, [currentFinancialYear]);

  // إعادة تعيين حالة الحفظ عند تعديل البيانات المهمة
  useEffect(() => {
    // إعادة تعيين حالة الحفظ فقط إذا كانت محفوظة بالفعل
    if (isSaved) {
      setIsSaved(false);
    }
  }, [addedItems, invoiceData.customerNumber, invoiceData.customerName, statement, paymentMethod, multiplePayment, isSaved]);

  // رقم الفاتورة تلقائي
  const [invoiceNumber, setInvoiceNumber] = useState("");
  // رقم القيد تلقائي
  const [entryNumber, setEntryNumber] = useState("");

  // دالة توليد رقم فاتورة جديد بناءً على رقم الفرع والسنة والتسلسل
  const generateInvoiceNumberAsync = async (branchId: string, branchesData: Branch[] = []): Promise<string> => {
    const date = new Date();
    const y = date.getFullYear();
    
    // البحث عن رقم الفرع الحقيقي من بيانات الفروع
    const branchObj = branchesData.find(b => b.id === branchId);
    const branchNumber = branchObj?.code || branchObj?.number || branchObj?.branchNumber || '1';
    
    try {
      // جلب عدد الفواتير لنفس الفرع في نفس السنة
      const q = query(
        collection(db, 'sales_invoices'),
        where('branch', '==', branchId)
      );
      const snapshot = await getDocs(q);
      
      // فلترة النتائج في الكود بدلاً من قاعدة البيانات لتجنب مشكلة الفهرس
      const currentYearInvoices = snapshot.docs.filter(doc => {
        const invoiceDate = doc.data().date;
        if (!invoiceDate) return false;
        const invoiceYear = new Date(invoiceDate).getFullYear();
        return invoiceYear === y;
      });
      
      const count = currentYearInvoices.length + 1;
      const serial = count;
      
      return `INV-${branchNumber}-${y}-${serial}`;
    } catch (error) {
      console.error('خطأ في توليد رقم الفاتورة:', error);
      // في حالة الخطأ، استخدم رقم عشوائي
      const randomSerial = Math.floor(Math.random() * 1000) + 1;
      return `INV-${branchNumber}-${y}-${randomSerial}`;
    }
  };

  // دالة توليد رقم القيد بناءً على رقم الفرع والسنة والتسلسل
  const generateEntryNumberAsync = async (branchId: string, branchesData: Branch[] = []): Promise<string> => {
    const date = new Date();
    const y = date.getFullYear();
    
    // البحث عن رقم الفرع الحقيقي من بيانات الفروع
    const branchObj = branchesData.find(b => b.id === branchId);
    const branchNumber = branchObj?.code || branchObj?.number || branchObj?.branchNumber || '1';
    
    try {
      // جلب عدد القيود لنفس الفرع في نفس السنة من مجموعة القيود المحاسبية
      const q = query(
        collection(db, 'accounting_entries'),
        where('branch', '==', branchId)
      );
      const snapshot = await getDocs(q);
      
      // فلترة النتائج في الكود بدلاً من قاعدة البيانات لتجنب مشكلة الفهرس
      const currentYearEntries = snapshot.docs.filter(doc => {
        const entryDate = doc.data().date;
        if (!entryDate) return false;
        const entryYear = new Date(entryDate).getFullYear();
        return entryYear === y;
      });
      
      const count = currentYearEntries.length + 1;
      const serial = count;
      
      return `ENT-${branchNumber}-${y}-${serial}`;
    } catch (error) {
      console.error('خطأ في توليد رقم القيد:', error);
      // في حالة الخطأ، استخدم رقم عشوائي
      const randomSerial = Math.floor(Math.random() * 1000) + 1;
      return `ENT-${branchNumber}-${y}-${randomSerial}`;
    }
  };

  // دالة توليد وتعيين رقم الفاتورة
  const generateAndSetInvoiceNumber = useCallback(async (branchIdValue: string) => {
    const invoiceNumber = await generateInvoiceNumberAsync(branchIdValue, branches);
    setInvoiceNumber(invoiceNumber);
    setInvoiceData(prev => ({ ...prev, invoiceNumber }));
  }, [branches]);

  // دالة توليد وتعيين رقم القيد
  const generateAndSetEntryNumber = useCallback(async (branchIdValue: string) => {
    const entryNumber = await generateEntryNumberAsync(branchIdValue, branches);
    setEntryNumber(entryNumber);
  }, [branches]);

  // تاريخ الفاتورة الافتراضي هو اليوم
  const [invoiceDate, setInvoiceDate] = useState(dayjs());

  // جلب بيانات الفروع
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, 'branches'));
        const branchesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Branch[];
        setBranches(branchesData);
      } catch (error) {
        console.error('Error fetching branches:', error);
        message.error('حدث خطأ في جلب بيانات الفروع');
      } finally {
        setLoading(false);
      }
    };
    fetchBranches();
  }, []);

  // جلب بيانات البنوك
  useEffect(() => {
    const fetchBanks = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'banks'));
        const banksData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Bank[];
        setBanks(banksData);
      } catch (error) {
        console.error('Error fetching banks:', error);
        message.error('حدث خطأ في جلب بيانات البنوك');
      }
    };
    fetchBanks();
  }, []);

  // جلب بيانات صناديق النقد
  useEffect(() => {
    const fetchCashBoxes = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'cash_boxes'));
        const cashBoxesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CashBox[];
        setCashBoxes(cashBoxesData);
      } catch (error) {
        console.error('Error fetching cash boxes:', error);
        message.error('حدث خطأ في جلب بيانات صناديق النقد');
      }
    };
    fetchCashBoxes();
  }, []);

  // جلب بيانات طرق الدفع
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'paymentMethods'));
        const paymentMethodsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.id,
          value: doc.data().name || doc.id
        }));
        

        // إضافة طريقة الدفع المتعدد
        paymentMethodsData.push({
          id: 'multiple',
          name: 'دفع متعدد',
          value: 'متعدد'
        });
        
        setPaymentMethods(paymentMethodsData);
      } catch (error) {
        console.error('Error fetching payment methods:', error);
        // استخدام طرق دفع افتراضية في حالة الخطأ
        setPaymentMethods([
          { id: 'cash', name: 'نقدي', value: 'نقدي' },
          { id: 'check', name: 'شيك', value: 'شيك' },
          { id: 'bank_transfer', name: 'حوالة بنكية', value: 'حوالة بنكية' },
          { id: 'credit_card', name: 'بطاقة ائتمان', value: 'بطاقة ائتمان' },
          { id: 'credit', name: 'آجل', value: 'آجل' },
          { id: 'multiple', name: 'دفع متعدد', value: 'متعدد' }
        ]);
      }
    };
    fetchPaymentMethods();
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
        message.error('حدث خطأ في جلب بيانات المخازن');
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
        message.error('حدث خطأ في جلب بيانات العملاء');
      }
    };
    fetchCustomers();
  }, []);

  // جلب بيانات المندوبين
  useEffect(() => {
    const fetchDelegates = async () => {
      try {
        // جلب من مجموعة salesRepresentatives بدلاً من delegates
        const snapshot = await getDocs(collection(db, 'salesRepresentatives'));
        const delegatesData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          email: doc.data().email,
          uid: doc.data().uid,
          phone: doc.data().phone,
          status: doc.data().status
        })) as Delegate[];
        
        if (delegatesData.length === 0) {
          message.warning('لا توجد بيانات مندوبين في النظام. يرجى إضافة مندوبين أولاً.');
        }
        
        setDelegates(delegatesData);
      } catch (error) {
        console.error('Error fetching delegates:', error);
        message.error('حدث خطأ في جلب بيانات المندوبين');
      }
    };
    fetchDelegates();
  }, []);

  // حالة تتبع الصف المعدل
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // جلب بيانات الأصناف
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'inventory_items'));
        const itemsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as InventoryItem[];
        setItems(itemsData);
      } catch (error) {
        console.error('Error fetching items:', error);
        message.error('حدث خطأ في جلب بيانات الأصناف');
      }
    };
    fetchItems();
  }, []);

  // جلب بيانات الشركة وتحديث نسبة الضريبة
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'companies'));
        if (!snapshot.empty) {
          const companyDataDoc = snapshot.docs[0].data();
          setCompanyData(companyDataDoc);
          
          // تحديث نسبة الضريبة الافتراضية
          const defaultTaxRate = companyDataDoc.taxRate ? parseFloat(companyDataDoc.taxRate) : 15;
          setTaxPercent(defaultTaxRate);
        } else {
          // إعداد نسبة ضريبة افتراضية إذا لم توجد بيانات شركة
          const defaultRate = 15;
          setTaxPercent(defaultRate);
          setCompanyData({ taxRate: defaultRate.toString() });
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
        // إعداد نسبة ضريبة افتراضية في حالة الخطأ
        const defaultRate = 15;
        setTaxPercent(defaultRate);
        setCompanyData({ taxRate: defaultRate.toString() });
      }
    };
    fetchCompanyData();
  }, []);

  // عند تغيير الفرع، فلترة المخازن واختيار أول مخزن مرتبط وتوليد رقم فاتورة جديد
  useEffect(() => {
    if (!invoiceData.branch || !warehouses.length) return;
    
    const filtered = warehouses.filter(w => {
      if (w.branch) return w.branch === invoiceData.branch;
      if (w.allowedBranches && Array.isArray(w.allowedBranches)) return w.allowedBranches.includes(invoiceData.branch);
      return false;
    });
    
    if (filtered.length) {
      setInvoiceData(prev => ({ ...prev, warehouse: filtered[0].id }));
    } else {
      setInvoiceData(prev => ({ ...prev, warehouse: '' }));
      message.warning(`لا توجد مخازن مرتبطة بالفرع المختار. يرجى ربط مخزن بهذا الفرع أولاً`);
    }
    
    // توليد رقم فاتورة جديد عند تغيير الفرع
    if (invoiceData.branch && branches.length) {
      generateAndSetInvoiceNumber(invoiceData.branch);
      generateAndSetEntryNumber(invoiceData.branch);
    }
  }, [invoiceData.branch, warehouses, branches.length, generateAndSetInvoiceNumber, generateAndSetEntryNumber]);

  // توليد رقم فاتورة تلقائي عند تحميل البيانات أو تغيير الفرع
  useEffect(() => {
    if (branches.length && invoiceData.branch) {
      generateAndSetInvoiceNumber(invoiceData.branch);
      generateAndSetEntryNumber(invoiceData.branch);
    }
  }, [branches, invoiceData.branch, generateAndSetInvoiceNumber, generateAndSetEntryNumber]);

  // تعيين أول فرع افتراضياً عند تحميل البيانات
  useEffect(() => {
    if (branches.length && !invoiceData.branch) {
      const firstBranch = branches[0];
      setInvoiceData(prev => ({ ...prev, branch: firstBranch.id }));
    }
  }, [branches, invoiceData.branch]);

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

  // تعيين المندوب الافتراضي بناءً على المستخدم الحالي
  useEffect(() => {
    if (delegates.length && user?.uid && !delegate) {
      const currentUserDelegate = delegates.find(delegateItem => 
        delegateItem.uid === user.uid || 
        delegateItem.email === user.email
      );
      
      if (currentUserDelegate) {
        setDelegate(currentUserDelegate.id);
      }
    }
  }, [delegates, user?.uid, user?.email, delegate]);

  // عند تغيير التبويب لصنف جديد، اجعل الكمية 1
  useEffect(() => {
    if (activeTab === "new") {
      setQuantity("1");
    }
  }, [activeTab]);

  // دالة للحصول على اسم المندوب من ID
  const getDelegateName = (delegateId: string) => {
    const delegate = delegates.find(d => d.id === delegateId);
    return delegate?.name || delegate?.email || delegateId;
  };

  // تعريف نوع العنصر
  interface ItemRecord {
    itemCode: string;
    itemName: string;
    quantity: string;
    unit: string;
    price: string;
    discountPercent: number;
    taxPercent: number;
  }

  // أعمدة الجدول مع تحسين الأداء
  const itemColumns = useMemo(() => [
    { title: 'كود الصنف', dataIndex: 'itemCode', key: 'itemCode', width: 100 },
    { title: 'اسم الصنف', dataIndex: 'itemName', key: 'itemName', width: 150 },
    { title: 'الكمية', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: 'الوحدة', dataIndex: 'unit', key: 'unit', width: 80 },
    { 
      title: 'المخزن', 
      dataIndex: 'warehouse', 
      key: 'warehouse', 
      width: 120, 
      render: () => {
        if (!invoiceData.warehouse) return '-';
        const warehouse = warehouses.find(w => w.id === invoiceData.warehouse);
        return warehouse ? (warehouse.nameAr || warehouse.name || '-') : '-';
      }
    },
    { title: 'السعر', dataIndex: 'price', key: 'price', width: 100, render: (value: string) => Number(value).toFixed(2) },
    { title: 'نسبة الخصم %', dataIndex: 'discountPercent', key: 'discountPercent', width: 100 },
    { 
      title: 'قيمة الخصم', 
      key: 'discountValue', 
      width: 100, 
      render: (_: unknown, record: ItemRecord) => {
        const qty = Number(record.quantity) || 0;
        const price = Number(record.price) || 0;
        const discount = Number(record.discountPercent) || 0;
        return ((qty * price * discount) / 100).toFixed(2);
      } 
    },
    { 
      title: 'الإجمالي بعد الخصم', 
      key: 'afterDiscount', 
      width: 120, 
      render: (_: unknown, record: ItemRecord) => {
        const qty = Number(record.quantity) || 0;
        const price = Number(record.price) || 0;
        const discount = Number(record.discountPercent) || 0;
        return (qty * price * (1 - discount / 100)).toFixed(2);
      } 
    },
    { title: 'نسبة الضريبة %', dataIndex: 'taxPercent', key: 'taxPercent', width: 100 },
    { 
      title: 'قيمة الضريبة', 
      key: 'taxValue', 
      width: 100, 
      render: (_: unknown, record: ItemRecord) => {
        const qty = Number(record.quantity) || 0;
        const price = Number(record.price) || 0;
        const discount = Number(record.discountPercent) || 0;
        const afterDiscount = qty * price * (1 - discount / 100);
        const tax = Number(record.taxPercent) || 0;
        return ((afterDiscount * tax) / 100).toFixed(2);
      } 
    },
    { 
      title: 'الإجمالي', 
      key: 'total', 
      width: 120, 
      render: (_: unknown, record: ItemRecord) => {
        const qty = Number(record.quantity) || 0;
        const price = Number(record.price) || 0;
        const discount = Number(record.discountPercent) || 0;
        const afterDiscount = qty * price * (1 - discount / 100);
        const tax = Number(record.taxPercent) || 0;
        return (afterDiscount + (afterDiscount * tax) / 100).toFixed(2);
      } 
    },
    { 
      title: 'إجراءات', 
      key: 'actions', 
      width: 120, 
      render: (_: unknown, record: ItemRecord, idx: number) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button 
            type="default"
            size="small"
            onClick={() => {
              setItemCode(record.itemCode);
              setItemName(record.itemName);
              setQuantity(record.quantity);
              setUnit(record.unit);
              setPrice(record.price);
              setDiscountPercent(record.discountPercent);
              setTaxPercent(record.taxPercent);
              setActiveTab('new');
              setEditingItemIndex(idx);
            }}
            style={{ color: '#2563eb', borderColor: '#2563eb' }}
          >
            تعديل
          </Button>
          <Button 
            danger 
            size="small" 
            onClick={() => {
              Modal.confirm({
                title: 'تأكيد الحذف',
                content: `هل أنت متأكد من حذف الصنف "${record.itemName}"؟`,
                okText: 'نعم، احذف',
                cancelText: 'إلغاء',
                okType: 'danger',
                onOk: () => {
                  setAddedItems(items => items.filter((_, i) => i !== idx));
                  setEditingItemIndex(null);
                  message.success('تم حذف الصنف بنجاح');
                }
              });
            }}
          >
            حذف
          </Button>
        </div>
      ) 
    }
  ], [invoiceData.warehouse, warehouses]);

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

  // حساب الإجماليات مع دقة في العمليات الحسابية
  const totals = useMemo(() => {
    return addedItems.reduce(
      (acc, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discountPercent) || 0;
        const tax = Number(item.taxPercent) || 0;
        
        // حساب دقيق للمبالغ
        const subtotal = Math.round((qty * price) * 100) / 100;
        const discountValue = Math.round((subtotal * discount / 100) * 100) / 100;
        const afterDiscount = Math.round((subtotal - discountValue) * 100) / 100;
        const taxValue = Math.round((afterDiscount * tax / 100) * 100) / 100;
        
        acc.subtotal = Math.round((acc.subtotal + subtotal) * 100) / 100;
        acc.totalDiscount = Math.round((acc.totalDiscount + discountValue) * 100) / 100;
        acc.afterDiscount = Math.round((acc.afterDiscount + afterDiscount) * 100) / 100;
        acc.totalTax = Math.round((acc.totalTax + taxValue) * 100) / 100;
        acc.finalTotal = Math.round((acc.finalTotal + afterDiscount + taxValue) * 100) / 100;
        
        return acc;
      },
      { subtotal: 0, totalDiscount: 0, afterDiscount: 0, totalTax: 0, finalTotal: 0 }
    );
  }, [addedItems]);

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <Spin size="large" />
            <div className="mt-4 text-center">جاري تحميل البيانات...</div>
          </div>
        </div>
      )}

      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إضافة فاتورة مبيعات</h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة وإنشاء فواتير المبيعات</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
            <FileTextOutlined className="text-purple-600 dark:text-purple-300 w-6 h-6" />
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>
 


      
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "فواتير المبيعات", to: "/stores/sales" },
          { label: "إضافة فاتورة مبيعات" }
        ]}
      />

      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div className="grid grid-cols-4 gap-6 mb-4">

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
            <label style={labelStyle}>رقم الفاتورة</label>
            <Input value={invoiceNumber} disabled placeholder="رقم الفاتورة تلقائي" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم القيد</label>
            <Input value={entryNumber} disabled placeholder="رقم القيد تلقائي" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تاريخ الفاتورة</label>
            <DatePicker value={invoiceDate} onChange={setInvoiceDate} format="YYYY-MM-DD" placeholder="تاريخ الفاتورة" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تاريخ الاستحقاق</label>
            <DatePicker value={refDate} onChange={setRefDate} format="YYYY-MM-DD" placeholder="تاريخ الاستحقاق" style={largeControlStyle} size="large" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">

          <div className="flex flex-col gap-2">
            <label style={labelStyle}>الفرع</label>
            <Select
              value={invoiceData.branch}
              onChange={(value) => setInvoiceData(prev => ({ ...prev, branch: value }))}
              placeholder="اختر الفرع"
              allowClear
              style={largeControlStyle}
              size="large"
             className={styles.noAntBorder}
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
              value={invoiceData.warehouse}
              onChange={(value) => setInvoiceData(prev => ({ ...prev, warehouse: value }))}
              placeholder="اختر المخزن"
              allowClear
              style={largeControlStyle}
              size="large"
              showSearch
              className={styles.noAntBorder}
              
              optionFilterProp="children"
            >
              {warehouses.map(w => (
                <Select.Option key={w.id} value={w.id}>
                  {w.name || w.nameAr || w.nameEn}
                </Select.Option>
              ))}
            </Select>
          </div>
                    <div className="flex flex-col gap-2">
            <label style={labelStyle}>نوع الحركة</label>
            <Select 
              value={movementType || "فاتورة مبيعات"} 
              onChange={setMovementType} 
              placeholder="اختر نوع الحركة" 
              style={largeControlStyle} 
              className={styles.noAntBorder}
              size="large"
              disabled
            >
              <Select.Option value="فاتورة مبيعات">فاتورة مبيعات - Sales Invoice</Select.Option>
              <Select.Option value="فاتورة مبيعات نقدية">فاتورة مبيعات نقدية - Cash Sales</Select.Option>
              <Select.Option value="فاتورة مبيعات آجلة">فاتورة مبيعات آجلة - Credit Sales</Select.Option>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label style={labelStyle}>نوع الحساب</label>
            <Select value={accountType} onChange={setAccountType} placeholder="اختر نوع الحساب" allowClear
             className={styles.noAntBorder}
            style={largeControlStyle} size="large">
              <Select.Option value="عميل">عميل</Select.Option>
              <Select.Option value="عميل محتمل">عميل محتمل</Select.Option>
            </Select>
          </div>

          {/* مسافة فارغة */}
          <div className="flex flex-col gap-2">
            {/* مسافة فارغة */}
          </div>

          {/* مسافة فارغة */}
          <div className="flex flex-col gap-2">
            {/* مسافة فارغة */}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">

          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم الحساب</label>
            <div style={{ display: "flex", gap: 8 }}>
              <Input 
                value={invoiceData.customerNumber} 
                onChange={e => setInvoiceData(prev => ({ ...prev, customerNumber: e.target.value }))} 
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
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4v6h6V4H4zm10 0v6h6V4h-6zM4 14v6h6v-6H4zm10 0v6h6v-6h-6z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                  </button>
                }
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>اسم الحساب</label>
            <Input 
              value={invoiceData.customerName} 
              onChange={e => setInvoiceData(prev => ({ ...prev, customerName: e.target.value }))} 
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
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم الموبايل</label>
            <Input
              value={customers.find(c => c.id === invoiceData.customerNumber)?.mobile || ''}
              placeholder="رقم الموبايل"
              style={largeControlStyle}
              size="large"
              disabled
            />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>البائع</label>
            <Select
              value={delegate}
              onChange={(value) => setDelegate(value)}
              placeholder="اختر البائع"
              style={largeControlStyle}
              size="large"
              className={styles.noAntBorder}
              showSearch
              optionFilterProp="children"
              notFoundContent={delegates.length === 0 ? "لا توجد بيانات مندوبين" : "لا توجد نتائج"}
            >
              {delegates.map(delegateItem => (
                <Select.Option key={delegateItem.id} value={delegateItem.id}>
                  {delegateItem.name || delegateItem.email || delegateItem.id}
                </Select.Option>
              ))}
            </Select>
            {delegates.length === 0 && (
              <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px' }}>
                لم يتم العثور على بيانات المندوبين. 
                <Button 
                  type="link" 
                  size="small" 
                  style={{ padding: 0, height: 'auto', fontSize: '12px' }}
                  onClick={async () => {
                    try {
                      const { addDoc, collection } = await import('firebase/firestore');
                      const newDelegate = {
                        name: user?.displayName || user?.email || 'مندوب افتراضي',
                        email: user?.email || '',
                        uid: user?.uid || '',
                        phone: '',
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        createdBy: user?.uid || ''
                      };
                      
                      const docRef = await addDoc(collection(db, 'delegates'), newDelegate);
                      
                      // تحديث قائمة المندوبين
                      const updatedDelegates = [{
                        id: docRef.id,
                        ...newDelegate
                      }];
                      setDelegates(updatedDelegates);
                      setDelegate(docRef.id);
                      
                      message.success('تم إنشاء مندوب افتراضي بنجاح');
                    } catch (error) {
                      console.error('خطأ في إنشاء المندوب:', error);
                      message.error('حدث خطأ في إنشاء المندوب');
                    }
                  }}
                >
                  إنشاء مندوب افتراضي
                </Button>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>البيان</label>
            <Input.TextArea value={statement} onChange={e => setStatement(e.target.value)} placeholder="البيان" rows={2} style={{ ...largeControlStyle, minHeight: 48 }} />
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
                  setInvoiceData(prev => ({
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



      </div>

      {/* الأصناف */}
      <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">
        <div className="flex items-center mb-4">
          <span className="h-8 w-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold ml-3">ص</span>
          <h2 className="text-xl font-bold text-gray-800">الأصناف</h2>
        </div>
        
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="صنف جديد" key="new">
            {/* رسالة التعديل */}
            {editingItemIndex !== null && (
              <div style={{
                backgroundColor: '#e6f7ff',
                border: '1px solid #91d5ff',
                borderRadius: 8,
                padding: '12px 16px',
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <span style={{ color: '#0958d9', fontSize: 16, fontWeight: 600 }}>
                  📝 جاري تعديل الصنف رقم {editingItemIndex + 1}
                </span>
              </div>
            )}
            
            <div className="flex flex-row flex-wrap gap-3 items-end w-full">
              <div className="flex-1 min-w-[180px] flex flex-col gap-1">
                <label style={labelStyle}>رقم الصنف</label>
                <Input
                  value={itemCode}
                  onChange={e => setItemCode(e.target.value)}
                  placeholder="رقم الصنف"
                  style={{ ...largeControlStyle, width: '100%' }}
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
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4v6h6V4H4zm10 0v6h6V4h-6zM4 14v6h6v-6H4zm10 0v6h6v-6h-6z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    </button>
                  }
                />
              </div>
              <div className="flex-1 min-w-[400px] flex flex-col gap-1">
                <label style={labelStyle}>اسم الصنف</label>
                <Select
                  showSearch
                  value={itemName}
                  onChange={handleItemSelect}
                  placeholder="اختر الصنف"
             className={styles.noAntBorder}
                  style={{ ...largeControlStyle, width: '100%' }}
                  size="large"
                  allowClear
                  filterOption={(input, option) => {
                    const itemName = String(option?.label ?? '').toLowerCase();
                    const selectedItem = items
                      .filter(i => i.type === 'مستوى ثاني')
                      .find(i => i.name === option?.value);
                    const itemCode = String(selectedItem?.itemCode ?? '').toLowerCase();
                    const searchTerm = input.toLowerCase();
                    return itemName.includes(searchTerm) || itemCode.includes(searchTerm);
                  }}
                  options={items
                    .filter(item => item.type === 'مستوى ثاني' && item.name?.trim())
                    .map(item => ({
                      label: item.name,
                      value: item.name,
                      disabled: !!item.tempCodes
                    }))}
                  optionRender={(option) => {
                    const item = items
                      .filter(i => i.type === 'مستوى ثاني')
                      .find(i => i.name === option.value);
                    return (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        opacity: item?.tempCodes ? 0.5 : 1
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600 }}>
                            {item?.name}
                            {item?.tempCodes && (
                              <span style={{ color: '#ff4d4f', fontSize: '12px', marginRight: 8 }}>
                                (إيقاف مؤقت)
                              </span>
                            )}
                          </span>
                          {item?.itemCode && (
                            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                              كود: {item.itemCode}
                            </span>
                          )}
                          {item?.salePrice && (
                            <span style={{ fontSize: '12px', color: '#52c41a' }}>
                              السعر: {item.salePrice} ر.س
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }}
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
              <div className="flex-1 min-w-[80px] flex flex-col gap-1">
                <label style={labelStyle}>الكمية</label>
                <Input 
                  type="number" 
                  min={0.01} 
                  step={0.01}
                  value={quantity} 
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '' || (Number(value) > 0 && Number(value) <= 999999)) {
                      setQuantity(value);
                    }
                  }} 
                  placeholder="الكمية" 
                  style={{...largeControlStyle, width: '100%'}} 
                  size="large" 
                />
              </div>
              <div className="flex-1 min-w-[100px] flex flex-col gap-1">
                <label style={labelStyle}>الوحدة</label>
                <Select
                  showSearch
                  value={unit}
                  onChange={(value) => setUnit(value)}
                  placeholder="الوحدة"
                  allowClear
             className={styles.noAntBorder}
              style={largeControlStyle}
              size="large"
                  options={units.map(unit => ({ label: unit, value: unit }))}
                />
              </div>
              <div className="flex-1 min-w-[90px] flex flex-col gap-1">
                <label style={labelStyle}>السعر</label>
                <Input 
                  type="number" 
                  min={0.01} 
                  step={0.01}
                  value={price} 
                  onChange={e => {
                    const value = e.target.value;
                    if (value === '' || (Number(value) >= 0 && Number(value) <= 999999)) {
                      setPrice(value);
                    }
                  }} 
                  placeholder="السعر" 
                  style={{...largeControlStyle, width: '100%'}} 
                  size="large" 
                />
              </div>
              <div className="flex-1 min-w-[90px] flex flex-col gap-1">
                <label style={labelStyle}>الخصم %</label>
                <Input 
                  type="number" 
                  min={0} 
                  max={100} 
                  step={0.01}
                  value={discountPercent} 
                  onChange={e => {
                    const value = Number(e.target.value);
                    if (value >= 0 && value <= 100) {
                      setDiscountPercent(value);
                    }
                  }} 
                  placeholder="نسبة الخصم %" 
                  style={{...largeControlStyle, width: '100%'}} 
                  size="large" 
                />
              </div>
              <div className="flex-1 min-w-[90px] flex flex-col gap-1">
                <label style={labelStyle}>الضريبة % </label>
                <Input 
                  type="number" 
                  min={0} 
                  max={100} 
                  value={taxPercent} 
                  placeholder={`نسبة الضريبة ${companyData.taxRate || '15'}%`} 
                  style={{...largeControlStyle, width: '100%', backgroundColor: '#f5f5f5'}} 
                  size="large" 
                  disabled 
                  title={`نسبة الضريبة الافتراضية من إعدادات الشركة: ${companyData.taxRate || '15'}%`}
                />
              </div>
              <div className="flex-1 min-w-[120px] flex flex-col gap-1 justify-end">
                <label style={{ visibility: 'hidden', height: 0 }}>إضافة الصنف</label>
                <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <Button 
                    type="primary" 
                    className="bg-blue-600" 
                    style={{ height: 48, fontSize: 16, borderRadius: 8, flex: 1 }} 
                    onClick={handleAddNewItem}
                    icon={editingItemIndex !== null ? <SaveOutlined /> : <PlusOutlined />}
                  >
                    {editingItemIndex !== null ? 'حفظ ' : 'إضافة '}
                  </Button>
                  {editingItemIndex !== null && (
                    <Button 
                      type="default" 
                      style={{ height: 48, fontSize: 16, borderRadius: 8, width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
                      onClick={() => {
                        // إلغاء التعديل وإعادة تعيين الحقول
                        resetFields();
                        setEditingItemIndex(null);
                        message.info('تم إلغاء التعديل');
                      }}
                      icon={<CloseOutlined />}
                      title="إلغاء التعديل"
                    />
                  )}
                </div>
              </div>
            </div>
            {/* جدول الأصناف المضافة */}
            <div className="mt-8">
              {addedItems.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-gray-500 text-lg mb-2">لا توجد أصناف مضافة بعد</div>
                  <div className="text-gray-400 text-sm">قم بإضافة الأصناف أولاً لعرض الجدول والإجماليات</div>
                </div>
              ) : (
                <>
                  <Table
                    dataSource={addedItems}
                    columns={itemColumns}
                    rowKey={(record, idx) => idx?.toString() || '0'}
                    pagination={false}
                    bordered
                    locale={{ emptyText: 'لا توجد أصناف مضافة بعد' }}
                    rowClassName={(record, index) => 
                      editingItemIndex === index ? 'edited-row' : ''
                    }
                  />
                  {/* الإجماليات */}
                  <div style={{
                    marginTop: 24,
                    fontSize: 16,
                    fontWeight: 700,
                    background: '#fff',
                    borderRadius: 16,
                    padding: '18px 32px',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                    maxWidth: 350,
                    marginRight: 'auto',
                    marginLeft: 0,
                    direction: 'rtl',
                    textAlign: 'right',
                    lineHeight: 1.7
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 17 }}>الإجمالي:</span>
                      <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#e53935', fontWeight: 700, fontSize: 17 }}>الخصم:</span>
                      <span style={{ color: '#e53935', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{totals.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#fb8c00', fontWeight: 700, fontSize: 17 }}>الإجمالي بعد الخصم:</span>
                      <span style={{ color: '#fb8c00', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{(totals.subtotal - totals.totalDiscount).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#8e24aa', fontWeight: 700, fontSize: 17 }}>قيمة الضريبة:</span>
                      <span style={{ color: '#8e24aa', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{totals.totalTax.toFixed(2)}</span>
                    </div>
                    <hr style={{ margin: '16px 0', borderTop: '2px solid #e5e7eb' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                      <span style={{ color: '#2e7d32', fontWeight: 900, fontSize: 18 }}>الإجمالي النهائي:</span>
                      <span style={{ color: '#2e7d32', fontWeight: 900, fontSize: 22, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{(totals.subtotal - totals.totalDiscount + totals.totalTax).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
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
                ⚠️ يجب أن يحتوي ملف الإكسل على الأعمدة التالية بالترتيب: رقم كود الصنف، اسم الصنف، الكمية، الوحدة، السعر، نسبة الخصم %
              </div>
              {excelFile && (
                <div style={{color: '#16a34a', fontSize: 14, fontWeight: 500}}>
                  ✅ تم رفع الملف: {excelFile.name}
                </div>
              )}
            </div>

            {/* جدول الأصناف المضافة */}
            <div className="mt-8">
              {addedItems.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-gray-500 text-lg mb-2">لا توجد أصناف مضافة بعد</div>
                  <div className="text-gray-400 text-sm">قم برفع ملف الإكسل أولاً لعرض الجدول والإجماليات</div>
                </div>
              ) : (
                <>
                  <Table
                    dataSource={addedItems}
                    columns={itemColumns}
                    rowKey={(record, idx) => idx?.toString() || '0'}
                    pagination={false}
                    bordered
                    locale={{ emptyText: 'لا توجد أصناف مضافة بعد' }}
                    rowClassName={(record, index) => 
                      editingItemIndex === index ? 'edited-row' : ''
                    }
                  />
                  {/* الإجماليات */}
                  <div style={{
                    marginTop: 24,
                    fontSize: 16,
                    fontWeight: 700,
                    background: '#fff',
                    borderRadius: 16,
                    padding: '18px 32px',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
                    maxWidth: 350,
                    marginRight: 'auto',
                    marginLeft: 0,
                    direction: 'rtl',
                    textAlign: 'right',
                    lineHeight: 1.7
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 17 }}>الإجمالي:</span>
                      <span style={{ color: '#2563eb', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#e53935', fontWeight: 700, fontSize: 17 }}>الخصم:</span>
                      <span style={{ color: '#e53935', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{totals.totalDiscount.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#fb8c00', fontWeight: 700, fontSize: 17 }}>الإجمالي بعد الخصم:</span>
                      <span style={{ color: '#fb8c00', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{(totals.subtotal - totals.totalDiscount).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ color: '#8e24aa', fontWeight: 700, fontSize: 17 }}>قيمة الضريبة:</span>
                      <span style={{ color: '#8e24aa', fontWeight: 700, fontSize: 20, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{totals.totalTax.toFixed(2)}</span>
                    </div>
                    <hr style={{ margin: '16px 0', borderTop: '2px solid #e5e7eb' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
                      <span style={{ color: '#2e7d32', fontWeight: 900, fontSize: 18 }}>الإجمالي النهائي:</span>
                      <span style={{ color: '#2e7d32', fontWeight: 900, fontSize: 22, minWidth: 70, textAlign: 'left', display: 'inline-block' }}>{(totals.subtotal - totals.totalDiscount + totals.totalTax).toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </TabPane>
        </Tabs>

        {/* قسم طريقة الدفع */}
        {addedItems.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden mb-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-lg p-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg font-['Cairo']">
                      معلومات الدفع
                    </h3>
                    <p className="text-blue-100 text-sm font-['Cairo']">
                      اختر طريقة الدفع والحسابات المرتبطة
                    </p>
                  </div>
                </div>
                <div className="bg-white/15 rounded-lg px-4 py-2">
                  <div className="text-blue-100 text-xs font-medium font-['Cairo']">الإجمالي المطلوب</div>
                  <div className="text-white text-lg font-bold font-['Cairo']">
                    {totals.finalTotal.toFixed(2)} ر.س
                  </div>
                </div>
              </div>
            </div>
            
            {/* Content Section */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* طريقة الدفع */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 font-['Cairo'] mb-2">
                    <span className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                        <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                      </svg>
                      طريقة الدفع *
                    </span>
                  </label>
                  <Select 
                    value={paymentMethod} 
                    onChange={(value) => {
                      const isMultiple = value === 'متعدد';
                      setMultiplePaymentMode(isMultiple);
                      setPaymentMethod(value);
                      if (isMultiple) {
                        setMultiplePayment({});
                      }
                    }} 
                    placeholder="اختر طريقة الدفع" 
                    className="w-full font-['Cairo']"
                    size="large"
                    showSearch
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    disabled={paymentMethods.length === 0}
                    notFoundContent={paymentMethods.length === 0 ? "جاري تحميل طرق الدفع..." : "لا توجد نتائج"}
                  >
                    {paymentMethods.map(method => (
                      <Select.Option key={method.id} value={method.value}>
                        <div className="flex items-center gap-2 font-['Cairo']">
                          {method.value === 'نقدي' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                            </svg>
                          )}
                          {method.value === 'متعدد' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-orange-600">
                              <path d="M3 3h18v4H3V3zm0 6h18v2H3V9zm0 4h18v2H3v-2zm0 4h18v4H3v-4z"/>
                            </svg>
                          )}
                          {method.value !== 'نقدي' && method.value !== 'متعدد' && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                            </svg>
                          )}
                          {method.name}
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                {/* عرض الصندوق النقدي للدفع النقدي العادي */}
                {paymentMethod === 'نقدي' && !multiplePaymentMode && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 font-['Cairo'] mb-2">
                      <span className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                          <path d="M10 16V8a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1zm4-6v8a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1zm-8-4v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/>
                        </svg>
                        الصندوق النقدي *
                      </span>
                    </label>
                    <Select
                      value={invoiceData.cashBox || ''}
                      onChange={(value) => {
                        setInvoiceData(prev => ({ ...prev, cashBox: value }));
                      }}
                      placeholder="اختر الصندوق النقدي"
                      className="w-full font-['Cairo']"
                      size="large"
                      allowClear
                      showSearch
                      filterOption={(input, option) =>
                        String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      disabled={cashBoxes.filter(cb => cb.branch === invoiceData.branch).length === 0}
                    >
                      {cashBoxes
                        .filter(cashBox => cashBox.branch === invoiceData.branch)
                        .map(cashBox => (
                          <Select.Option key={cashBox.id} value={cashBox.id || cashBox.nameAr}>
                            <div className="flex items-center gap-2 font-['Cairo']">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                                <path d="M20 6H4c-1.11 0-2 .89-2 2v8c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm0 10H4v-6h16v6z"/>
                              </svg>
                              {cashBox.nameAr}
                            </div>
                          </Select.Option>
                        ))}
                    </Select>
                  </div>
                )}

                {/* حالة الدفع */}
                {paymentMethod && paymentMethod !== 'متعدد' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 font-['Cairo'] mb-2">
                      <span className="flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-purple-600">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        حالة الدفع
                      </span>
                    </label>
                    <Select
                      value={paymentStatus}
                      onChange={setPaymentStatus}
                      placeholder="اختر حالة الدفع"
                      className="w-full font-['Cairo']"
                      size="large"
                    >
                      <Select.Option value="مدفوع">
                        <div className="flex items-center gap-2 font-['Cairo']">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          مدفوع
                        </div>
                      </Select.Option>
                      <Select.Option value="غير مدفوع">
                        <div className="flex items-center gap-2 font-['Cairo']">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          غير مدفوع
                        </div>
                      </Select.Option>
                      <Select.Option value="مدفوع جزئياً">
                        <div className="flex items-center gap-2 font-['Cairo']">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          مدفوع جزئياً
                        </div>
                      </Select.Option>
                    </Select>
                  </div>
                )}
              </div>

              {/* عرض ملخص المبلغ للطرق العادية */}
              {paymentMethod && paymentMethod !== 'متعدد' && (
                <div className="mt-6 bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium font-['Cairo'] mb-1">
                        طريقة الدفع المختارة
                      </div>
                      <div className="text-lg font-bold text-blue-700 font-['Cairo'] flex items-center justify-center gap-2">
                        {paymentMethod === 'نقدي' && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                            <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                          </svg>
                        )}
                        {paymentMethod}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium font-['Cairo'] mb-1">
                        حالة الدفع
                      </div>
                      <div className="flex items-center justify-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          paymentStatus === 'مدفوع' ? 'bg-green-500' :
                          paymentStatus === 'غير مدفوع' ? 'bg-red-500' : 
                          'bg-yellow-500'
                        }`}></div>
                        <span className="text-lg font-bold text-gray-700 font-['Cairo']">
                          {paymentStatus}
                        </span>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-gray-600 font-medium font-['Cairo'] mb-1">
                        إجمالي المبلغ
                      </div>
                      <div className="text-2xl font-bold text-green-700 font-['Cairo']">
                        {totals.finalTotal.toFixed(2)} ر.س
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* قسم الدفع المتعدد */}
        {multiplePaymentMode && (
          <div className="bg-white rounded-xl shadow-lg border-2 border-orange-300 overflow-hidden mb-6">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 rounded-lg p-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M3 3h18v4H3V3zm0 6h18v2H3V9zm0 4h18v2H3v-2zm0 4h18v4H3v-4z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg font-['Cairo']">
                      الدفع المتعدد
                    </h3>
                    <p className="text-orange-100 text-sm font-['Cairo']">
                      توزيع المبلغ على عدة طرق دفع
                    </p>
                  </div>
                </div>
                <div className="bg-white/15 rounded-lg px-4 py-2">
                  <div className="text-orange-100 text-xs font-medium font-['Cairo']">المبلغ الإجمالي</div>
                  <div className="text-white text-lg font-bold font-['Cairo']">
                    {totals.finalTotal.toFixed(2)} ر.س
                  </div>
                </div>
              </div>
            </div>

            {/* Content Section */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* النقدي */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-lg p-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                          <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                        </svg>
                      </div>
                      <span className="text-white font-bold text-sm font-['Cairo']">
                        الدفع النقدي
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 font-['Cairo'] mb-2">
                        الصندوق النقدي
                      </label>
                      <Select
                        value={multiplePayment.cash?.cashBoxId || ''}
                        onChange={(value) => setMultiplePayment({
                          ...multiplePayment,
                          cash: {
                            ...multiplePayment.cash,
                            cashBoxId: value,
                            amount: multiplePayment.cash?.amount || ''
                          }
                        })}
                        disabled={cashBoxes.length === 0}
                        placeholder="اختر الصندوق"
                        className="w-full font-['Cairo']"
                        size="large"
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                          String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {cashBoxes
                          .filter(cashBox => !invoiceData.branch || cashBox.branch === invoiceData.branch)
                          .map(cashBox => (
                            <Select.Option key={cashBox.id} value={cashBox.id || cashBox.nameAr}>
                              <div className="flex items-center gap-2 font-['Cairo']">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-green-600">
                                  <path d="M20 6H4c-1.11 0-2 .89-2 2v8c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm0 10H4v-6h16v6z"/>
                                </svg>
                                {cashBox.nameAr}
                              </div>
                            </Select.Option>
                          ))}
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 font-['Cairo'] mb-2">
                        المبلغ النقدي (ر.س)
                      </label>
                      <Input
                        value={multiplePayment.cash?.amount || ''}
                        onChange={(e) => setMultiplePayment({
                          ...multiplePayment,
                          cash: {
                            ...multiplePayment.cash,
                            cashBoxId: multiplePayment.cash?.cashBoxId || '',
                            amount: e.target.value
                          }
                        })}
                        onFocus={(e) => {
                          if (!e.target.value) {
                            const currentTotal = parseFloat(multiplePayment.bank?.amount || '0') + 
                                                parseFloat(multiplePayment.card?.amount || '0');
                            const remaining = totals.finalTotal - currentTotal;
                            if (remaining > 0) {
                              setMultiplePayment({
                                ...multiplePayment,
                                cash: {
                                  ...multiplePayment.cash,
                                  cashBoxId: multiplePayment.cash?.cashBoxId || '',
                                  amount: remaining.toFixed(2)
                                }
                              });
                            }
                          }
                        }}
                        placeholder="0.00"
                        type="number"
                        min={0}
                        step={0.01}
                        size="large"
                        className="text-center font-bold font-['Cairo']"
                      />
                    </div>
                  </div>
                </div>

                {/* التحويل البنكي */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-lg p-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                          <path d="M5 7h14c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1 .45-1 1s.45 1 1 1zM6 10h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1zM3 13h18c.55 0 1-.45 1-1s-.45-1-1-1H3c-.55 0-1 .45-1 1s.45 1 1 1zM4 16h16c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1zM5 19h14c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1 .45-1 1s.45 1 1 1z"/>
                        </svg>
                      </div>
                      <span className="text-white font-bold text-sm font-['Cairo']">
                        التحويل البنكي
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 font-['Cairo'] mb-2">
                        البنك
                      </label>
                      <Select
                        value={multiplePayment.bank?.bankId || ''}
                        onChange={(value) => setMultiplePayment({
                          ...multiplePayment,
                          bank: {
                            ...multiplePayment.bank,
                            bankId: value,
                            amount: multiplePayment.bank?.amount || ''
                          }
                        })}
                        disabled={banks.length === 0}
                        placeholder="اختر البنك"
                        className="w-full font-['Cairo']"
                        size="large"
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                          String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {banks.map(bank => (
                          <Select.Option key={bank.id} value={bank.id || bank.arabicName}>
                            <div className="flex items-center gap-2 font-['Cairo']">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-600">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                              </svg>
                              {bank.arabicName}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 font-['Cairo'] mb-2">
                        المبلغ البنكي (ر.س)
                      </label>
                      <Input
                        value={multiplePayment.bank?.amount || ''}
                        onChange={(e) => setMultiplePayment({
                          ...multiplePayment,
                          bank: {
                            ...multiplePayment.bank,
                            bankId: multiplePayment.bank?.bankId || '',
                            amount: e.target.value
                          }
                        })}
                        onFocus={(e) => {
                          if (!e.target.value) {
                            const currentTotal = parseFloat(multiplePayment.cash?.amount || '0') + 
                                                parseFloat(multiplePayment.card?.amount || '0');
                            const remaining = totals.finalTotal - currentTotal;
                            if (remaining > 0) {
                              setMultiplePayment({
                                ...multiplePayment,
                                bank: {
                                  ...multiplePayment.bank,
                                  bankId: multiplePayment.bank?.bankId || '',
                                  amount: remaining.toFixed(2)
                                }
                              });
                            }
                          }
                        }}
                        placeholder="0.00"
                        type="number"
                        min={0}
                        step={0.01}
                        size="large"
                        className="text-center font-bold font-['Cairo']"
                      />
                    </div>
                  </div>
                </div>

                {/* بطاقة الشبكة */}
                <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-red-500 to-pink-600 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-lg p-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                          <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                        </svg>
                      </div>
                      <span className="text-white font-bold text-sm font-['Cairo']">
                        بطاقة الشبكة
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 font-['Cairo'] mb-2">
                        بنك الشبكة
                      </label>
                      <Select
                        value={multiplePayment.card?.bankId || ''}
                        onChange={(value) => setMultiplePayment({
                          ...multiplePayment,
                          card: {
                            ...multiplePayment.card,
                            bankId: value,
                            amount: multiplePayment.card?.amount || ''
                          }
                        })}
                        disabled={banks.length === 0}
                        placeholder="اختر البنك"
                        className="w-full font-['Cairo']"
                        size="large"
                        allowClear
                        showSearch
                        filterOption={(input, option) =>
                          String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {banks.map(bank => (
                          <Select.Option key={bank.id} value={bank.id || bank.arabicName}>
                            <div className="flex items-center gap-2 font-['Cairo']">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-red-600">
                                <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                              </svg>
                              {bank.arabicName}
                            </div>
                          </Select.Option>
                        ))}
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 font-['Cairo'] mb-2">
                        مبلغ الشبكة (ر.س)
                      </label>
                      <Input
                        value={multiplePayment.card?.amount || ''}
                        onChange={(e) => setMultiplePayment({
                          ...multiplePayment,
                          card: {
                            ...multiplePayment.card,
                            bankId: multiplePayment.card?.bankId || '',
                            amount: e.target.value
                          }
                        })}
                        onFocus={(e) => {
                          if (!e.target.value) {
                            const currentTotal = parseFloat(multiplePayment.cash?.amount || '0') + 
                                                parseFloat(multiplePayment.bank?.amount || '0');
                            const remaining = totals.finalTotal - currentTotal;
                            if (remaining > 0) {
                              setMultiplePayment({
                                ...multiplePayment,
                                card: {
                                  ...multiplePayment.card,
                                  bankId: multiplePayment.card?.bankId || '',
                                  amount: remaining.toFixed(2)
                                }
                              });
                            }
                          }
                        }}
                        placeholder="0.00"
                        type="number"
                        min={0}
                        step={0.01}
                        size="large"
                        className="text-center font-bold font-['Cairo']"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ملخص الدفع المتعدد */}
              <div className="mt-8 bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-gray-200 rounded-xl p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-center">
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 font-['Cairo']">
                      إجمالي المدفوع
                    </div>
                    <div className="text-2xl font-bold text-blue-700 font-['Cairo']">
                      {(
                        parseFloat(multiplePayment.cash?.amount || '0') +
                        parseFloat(multiplePayment.bank?.amount || '0') +
                        parseFloat(multiplePayment.card?.amount || '0')
                      ).toFixed(2)} ر.س
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 font-['Cairo']">
                      المبلغ المتبقي
                    </div>
                    <div className={`text-2xl font-bold font-['Cairo'] ${
                      (totals.finalTotal - (
                        parseFloat(multiplePayment.cash?.amount || '0') +
                        parseFloat(multiplePayment.bank?.amount || '0') +
                        parseFloat(multiplePayment.card?.amount || '0')
                      )) > 0.01 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {(totals.finalTotal - (
                        parseFloat(multiplePayment.cash?.amount || '0') +
                        parseFloat(multiplePayment.bank?.amount || '0') +
                        parseFloat(multiplePayment.card?.amount || '0')
                      )).toFixed(2)} ر.س
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-600 font-['Cairo']">
                      المبلغ المطلوب
                    </div>
                    <div className="text-2xl font-bold text-purple-700 font-['Cairo']">
                      {totals.finalTotal.toFixed(2)} ر.س
                    </div>
                  </div>

                  <div className={`p-4 rounded-xl ${Math.abs(
                    (parseFloat(multiplePayment.cash?.amount || '0') +
                     parseFloat(multiplePayment.bank?.amount || '0') +
                     parseFloat(multiplePayment.card?.amount || '0')) - totals.finalTotal
                  ) <= 0.01 ? 'bg-green-100 border-2 border-green-300' : 'bg-red-100 border-2 border-red-300'}`}>
                    <div className={`text-sm font-bold font-['Cairo'] flex items-center justify-center gap-2 ${Math.abs(
                      (parseFloat(multiplePayment.cash?.amount || '0') +
                       parseFloat(multiplePayment.bank?.amount || '0') +
                       parseFloat(multiplePayment.card?.amount || '0')) - totals.finalTotal
                    ) <= 0.01 ? 'text-green-700' : 'text-red-700'}`}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        {Math.abs(
                          (parseFloat(multiplePayment.cash?.amount || '0') +
                           parseFloat(multiplePayment.bank?.amount || '0') +
                           parseFloat(multiplePayment.card?.amount || '0')) - totals.finalTotal
                        ) <= 0.01 ? (
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        ) : (
                          <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                        )}
                      </svg>
                      {Math.abs(
                        (parseFloat(multiplePayment.cash?.amount || '0') +
                         parseFloat(multiplePayment.bank?.amount || '0') +
                         parseFloat(multiplePayment.card?.amount || '0')) - totals.finalTotal
                      ) <= 0.01 ? 'الدفع مكتمل' : 'الدفع غير مكتمل'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* أزرار الحفظ والطباعة */}
        <div className="flex flex-col items-center gap-6 mt-8">
          <div className="flex gap-6 justify-center">
            <Button 
              type="primary" 
              size="large" 
              onClick={handleSave}
              loading={saving}
              disabled={saving || !addedItems.length}
              className="h-14 px-8 text-lg font-bold font-['Cairo'] bg-gradient-to-r from-blue-600 to-blue-700 border-0 rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transform hover:scale-105 transition-all duration-200"
              icon={!saving && <SaveOutlined className="text-xl" />}
            >
              {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
            </Button>
            
            <Button
              type="default"
              size="large"
              onClick={handlePrint}
              disabled={saving || !addedItems.length || !isSaved}
              className={`h-14 px-8 text-lg font-bold font-['Cairo'] rounded-xl shadow-lg transform transition-all duration-200 ${
                !isSaved 
                  ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-green-600 to-green-700 text-white border-0 hover:from-green-700 hover:to-green-800 hover:scale-105'
              }`}
              icon={<FileTextOutlined className="text-xl" />}
              title={!isSaved ? 'يجب حفظ الفاتورة أولاً قبل الطباعة' : 'طباعة الفاتورة'}
            >
              طباعة الفاتورة
            </Button>
          </div>
          
          {!isSaved && addedItems.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className="bg-amber-100 rounded-full p-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-amber-600">
                  <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                </svg>
              </div>
              <div className="text-amber-800 font-medium font-['Cairo']">
                <div className="font-bold">تنبيه مهم</div>
                <div className="text-sm">يجب حفظ الفاتورة أولاً لتفعيل زر الطباعة والانتقال لفاتورة جديدة</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddSalesInvoicePage;

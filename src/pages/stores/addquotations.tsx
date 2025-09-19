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
  const controls = useAnimation();
  
  // المتغيرات الجديدة للواجهة المطلوبة
  const [periodRange, setPeriodRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [refDate, setRefDate] = useState<dayjs.Dayjs | null>(null);
  const [movementType, setMovementType] = useState<string | null>("عرض سعر");
  const [accountType, setAccountType] = useState<string | null>("عميل");
  const [sideType, setSideType] = useState<string | null>(null);
  const [sideNumber, setSideNumber] = useState("");
  const [sideName, setSideName] = useState("");
  const [operationClass, setOperationClass] = useState<string | null>(null);
  const [statement, setStatement] = useState("");

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

  // البيانات الأساسية
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [units, setUnits] = useState<string[]>(['قطعة', 'كيلو', 'لتر', 'متر', 'صندوق', 'عبوة']);
  const [companyData, setCompanyData] = useState<CompanyData>({});

  // بيانات عرض السعر
  const [quotationData, setQuotationData] = useState<QuotationData>({
    quotationNumber: '',
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
        message.warning(`تم إيقاف الصنف "${selectedItemName}" مؤقتاً ولا يمكن إضافته لعرض السعر`);
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
    const defaultTaxRate = companyData.taxRate ? parseFloat(companyData.taxRate) : 15;
    setTaxPercent(defaultTaxRate);
  };

  const handleAddNewItem = () => {
    // التحقق من صحة البيانات
    if (!itemCode.trim()) {
      return message.error('يرجى إدخال كود الصنف');
    }
    if (!itemName.trim()) {
      return message.error('يرجى اختيار اسم الصنف');
    }
    if (!quantity || Number(quantity) <= 0) {
      return message.error('يرجى إدخال كمية صحيحة أكبر من صفر');
    }
    if (!price || Number(price) <= 0) {
      return message.error('يرجى إدخال سعر صحيح أكبر من صفر');
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
    // التحقق من صحة البيانات
    if (!quotationData.branch) return message.error('يرجى اختيار الفرع');
    if (!quotationData.warehouse) return message.error('يرجى اختيار المخزن');
    if (!accountType) return message.error('يرجى اختيار نوع الحساب');
    if (!quotationData.customerNumber) return message.error('يرجى إدخال رقم الحساب');
    if (!quotationData.customerName) return message.error('يرجى إدخال اسم الحساب');
    if (!addedItems.length) return message.error('يرجى إضافة الأصناف');

    setSaving(true);
    
    try {
      // حساب الإجماليات
      const totals = addedItems.reduce(
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

      // إعداد بيانات عرض السعر للحفظ
      const quotationToSave = {
        quotationNumber: quotationNumber,
        date: quotationDate.format('YYYY-MM-DD'),
        validUntil: refDate ? refDate.format('YYYY-MM-DD') : null,
        branch: quotationData.branch,
        warehouse: quotationData.warehouse,
        movementType,
        accountType,
        customer: {
          id: quotationData.customerNumber,
          name: quotationData.customerName,
          mobile: customers.find(c => c.id === quotationData.customerNumber)?.mobile || '',
          taxNumber: customers.find(c => c.id === quotationData.customerNumber)?.taxFileNumber || ''
        },
        items: addedItems.map((item, index) => ({
          itemNumber: index + 1,
          itemCode: item.itemCode,
          itemName: item.itemName,
          quantity: Number(item.quantity),
          unit: item.unit,
          price: Number(item.price),
          discountPercent: item.discountPercent,
          discountValue: (Number(item.quantity) * Number(item.price) * item.discountPercent) / 100,
          taxPercent: item.taxPercent,
          taxValue: (Number(item.quantity) * Number(item.price) * (1 - item.discountPercent / 100) * item.taxPercent) / 100,
          total: Number(item.quantity) * Number(item.price) * (1 - item.discountPercent / 100) * (1 + item.taxPercent / 100)
        })),
        totals: {
          subtotal: totals.subtotal,
          totalDiscount: totals.totalDiscount,
          afterDiscount: totals.subtotal - totals.totalDiscount,
          totalTax: totals.totalTax,
          finalTotal: totals.finalTotal
        },
        statement,
        createdBy: user?.uid,
        createdByName: user?.displayName || user?.email,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'draft' // حالة المسودة
      };

      // حفظ في Firebase
      await addDoc(collection(db, 'quotations'), quotationToSave);
      
      message.success('تم حفظ عرض السعر بنجاح');
      
      // إعادة تعيين النموذج
      setAddedItems([]);
      setEditingItemIndex(null); // إعادة تعيين فهرس الصف المعدل
      setQuotationData(prev => ({
        ...prev,
        customerNumber: '',
        customerName: ''
      }));
      setStatement('');
      
      // توليد رقم عرض سعر جديد
      if (quotationData.branch) {
        await generateAndSetQuotationNumber(quotationData.branch);
      }
      
    } catch (error) {
      console.error('خطأ في حفظ عرض السعر:', error);
      message.error('حدث خطأ أثناء حفظ عرض السعر');
    } finally {
      setSaving(false);
    }
  };

  // دالة الطباعة لعرض السعر
  const handlePrint = async () => {
    // التحقق من وجود البيانات المطلوبة
    if (!quotationData.branch) return message.error('يرجى اختيار الفرع');
    if (!quotationData.warehouse) return message.error('يرجى اختيار المخزن');
    if (!quotationData.customerName) return message.error('يرجى إدخال اسم العميل');
    if (!addedItems.length) return message.error('يرجى إضافة الأصناف');

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

    // بيانات عرض السعر
    const quotationTotals = {
      subtotal: addedItems.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        return sum + (qty * price);
      }, 0),
      totalDiscount: addedItems.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discountPercent) || 0;
        return sum + ((qty * price * discount) / 100);
      }, 0),
      totalTax: addedItems.reduce((sum, item) => {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;
        const discount = Number(item.discountPercent) || 0;
        const afterDiscount = qty * price * (1 - discount / 100);
        const tax = Number(item.taxPercent) || 0;
        return sum + ((afterDiscount * tax) / 100);
      }, 0)
    };

    const afterDiscount = quotationTotals.subtotal - quotationTotals.totalDiscount;
    const finalTotal = afterDiscount + quotationTotals.totalTax;

    try {
      // Generate QR code data URL (using qrcode library)
      let qrDataUrl = '';
      try {
        // Dynamically import qrcode library
        const QRCode = (await import('qrcode')).default;
        const qrContent = JSON.stringify({
          quotationNumber: quotationNumber,
          company: currentCompanyData.arabicName,
          date: quotationDate.format('YYYY-MM-DD'),
          total: finalTotal,
          customer: quotationData.customerName
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
          <title>عرض سعر | Quotation</title>
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
                عرض سعر
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
          
          <!-- Info Row Section: Quotation info (right), QR (center), Customer info (left) -->
          <div class="info-row-container">
            <table class="info-row-table right">
              <tr><td class="label">رقم عرض السعر</td><td class="value">${quotationNumber || ''}</td></tr>
              <tr><td class="label">تاريخ عرض السعر</td><td class="value">${quotationDate.format('YYYY-MM-DD') || ''}</td></tr>
              <tr><td class="label">تاريخ الانتهاء</td><td class="value">${refDate ? refDate.format('YYYY-MM-DD') : ''}</td></tr>
              <tr><td class="label">نوع الحركة</td><td class="value">${movementType || ''}</td></tr>
            </table>
            <div class="qr-center">
              <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">
                ${(() => {
                  const branch = branches.find(b => b.id === quotationData.branch);
                  return branch ? (branch.name || branch.id) : (quotationData.branch || '');
                })()}
              </div>
              <div class="qr-code">
                ${qrDataUrl ? `<img src="${qrDataUrl}" alt="QR Code" style="width:80px;height:80px;" />` : 'QR Code'}
              </div>
            </div>
            <table class="info-row-table left">
              <tr><td class="label">اسم العميل</td><td class="value">${quotationData.customerName || ''}</td></tr>
              <tr><td class="label">رقم العميل</td><td class="value">${quotationData.customerNumber || ''}</td></tr>
              <tr><td class="label">نوع الحساب</td><td class="value">${accountType || ''}</td></tr>
              <tr><td class="label">رقم الموبايل</td><td class="value">${(() => {
                const customer = customers.find(c => c.id === quotationData.customerNumber);
                return customer?.mobile || customer?.phone || '';
              })()}</td></tr>
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
              ${addedItems.map((item, idx) => {
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
          
          <!-- Totals Section -->
          <div class="totals-container">
            <table style="border:1.5px solid #000; border-radius:6px; font-size:12px; min-width:300px; max-width:380px; border-collapse:collapse;">
              <tbody>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">إجمالي عرض السعر</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${quotationTotals.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">مبلغ الخصم</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${quotationTotals.totalDiscount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">الإجمالي بعد الخصم</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${afterDiscount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-weight:bold; color:#000; text-align:right; padding:6px 10px; border:1px solid #000; background:#fff;">قيمة الضريبة</td>
                  <td style="text-align:left; font-weight:500; padding:6px 10px; border:1px solid #000; background:#fff;">${quotationTotals.totalTax.toFixed(2)}</td>
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
              <div>اسم العميل: ${quotationData.customerName || ''}</div>
              <div>التوقيع: ___________________</div>
            </div>
            <div class="signature-box">
              <div>المندوب: ${quotationData.delegate || ''}</div>
              <div>التاريخ: ${quotationDate.format('YYYY-MM-DD') || ''}</div>
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

  // رقم عرض السعر تلقائي
  const [quotationNumber, setQuotationNumber] = useState("");

  // دالة توليد رقم عرض سعر جديد بناءً على رقم الفرع والسنة والتسلسل
  const generateQuotationNumberAsync = async (branchId: string, branchesData: Branch[] = []): Promise<string> => {
    const date = new Date();
    const y = date.getFullYear();
    
    // البحث عن رقم الفرع الحقيقي من بيانات الفروع
    const branchObj = branchesData.find(b => b.id === branchId);
    const branchNumber = branchObj?.code || branchObj?.number || branchObj?.branchNumber || '1';
    
    try {
      // جلب عدد عروض الأسعار لنفس الفرع في نفس السنة
      const q = query(
        collection(db, 'quotations'),
        where('branch', '==', branchId)
      );
      const snapshot = await getDocs(q);
      
      // فلترة النتائج في الكود بدلاً من قاعدة البيانات لتجنب مشكلة الفهرس
      const currentYearQuotations = snapshot.docs.filter(doc => {
        const quotationDate = doc.data().date;
        if (!quotationDate) return false;
        const quotationYear = new Date(quotationDate).getFullYear();
        return quotationYear === y;
      });
      
      const count = currentYearQuotations.length + 1;
      const serial = count;
      
      return `QUO-${branchNumber}-${y}-${serial}`;
    } catch (error) {
      console.error('خطأ في توليد رقم عرض السعر:', error);
      // في حالة الخطأ، استخدم رقم عشوائي
      const randomSerial = Math.floor(Math.random() * 1000) + 1;
      return `QUO-${branchNumber}-${y}-${randomSerial}`;
    }
  };

  // دالة توليد وتعيين رقم عرض السعر
  const generateAndSetQuotationNumber = useCallback(async (branchIdValue: string) => {
    const quotationNumber = await generateQuotationNumberAsync(branchIdValue, branches);
    setQuotationNumber(quotationNumber);
    setQuotationData(prev => ({ ...prev, quotationNumber }));
  }, [branches]);

  // تاريخ عرض السعر الافتراضي هو اليوم
  const [quotationDate, setQuotationDate] = useState(dayjs());

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
          setTaxPercent(15);
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
        // إعداد نسبة ضريبة افتراضية في حالة الخطأ
        setTaxPercent(15);
      }
    };
    fetchCompanyData();
  }, []);

  // عند تغيير الفرع، فلترة المخازن واختيار أول مخزن مرتبط وتوليد رقم عرض سعر جديد
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
    
    // توليد رقم عرض سعر جديد عند تغيير الفرع
    if (quotationData.branch && branches.length) {
      generateAndSetQuotationNumber(quotationData.branch);
    }
  }, [quotationData.branch, warehouses, branches.length, generateAndSetQuotationNumber]);

  // توليد رقم عرض سعر تلقائي عند تحميل البيانات أو تغيير الفرع
  useEffect(() => {
    if (branches.length && quotationData.branch) {
      generateAndSetQuotationNumber(quotationData.branch);
    }
  }, [branches, quotationData.branch, generateAndSetQuotationNumber]);

  // تعيين أول فرع افتراضياً عند تحميل البيانات
  useEffect(() => {
    if (branches.length && !quotationData.branch) {
      const firstBranch = branches[0];
      setQuotationData(prev => ({ ...prev, branch: firstBranch.id }));
    }
  }, [branches, quotationData.branch]);

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

  // أعمدة الجدول
  const itemColumns = [
    { title: 'كود الصنف', dataIndex: 'itemCode', key: 'itemCode', width: 100 },
    { title: 'اسم الصنف', dataIndex: 'itemName', key: 'itemName', width: 150 },
    { title: 'الكمية', dataIndex: 'quantity', key: 'quantity', width: 80 },
    { title: 'الوحدة', dataIndex: 'unit', key: 'unit', width: 80 },
    { title: 'المخزن', dataIndex: 'warehouse', key: 'warehouse', width: 120, render: () => quotationData.warehouse ? (warehouses.find(w => w.id === quotationData.warehouse)?.nameAr || warehouses.find(w => w.id === quotationData.warehouse)?.name || '-') : '-' },
    { title: 'السعر', dataIndex: 'price', key: 'price', width: 100 },
    { title: 'نسبة الخصم %', dataIndex: 'discountPercent', key: 'discountPercent', width: 100 },
    { title: 'قيمة الخصم', key: 'discountValue', width: 100, render: (_: unknown, record: ItemRecord) => {
      const qty = Number(record.quantity) || 0;
      const price = Number(record.price) || 0;
      const discount = Number(record.discountPercent) || 0;
      return ((qty * price * discount) / 100).toFixed(2);
    } },
    { title: 'الإجمالي بعد الخصم', key: 'afterDiscount', width: 120, render: (_: unknown, record: ItemRecord) => {
      const qty = Number(record.quantity) || 0;
      const price = Number(record.price) || 0;
      const discount = Number(record.discountPercent) || 0;
      return (qty * price * (1 - discount / 100)).toFixed(2);
    } },
    { title: 'نسبة الضريبة %', dataIndex: 'taxPercent', key: 'taxPercent', width: 100 },
    { title: 'قيمة الضريبة', key: 'taxValue', width: 100, render: (_: unknown, record: ItemRecord) => {
      const qty = Number(record.quantity) || 0;
      const price = Number(record.price) || 0;
      const discount = Number(record.discountPercent) || 0;
      const afterDiscount = qty * price * (1 - discount / 100);
      const tax = Number(record.taxPercent) || 0;
      return ((afterDiscount * tax) / 100).toFixed(2);
    } },
    { title: 'الإجمالي', key: 'total', width: 120, render: (_: unknown, record: ItemRecord) => {
      const qty = Number(record.quantity) || 0;
      const price = Number(record.price) || 0;
      const discount = Number(record.discountPercent) || 0;
      const afterDiscount = qty * price * (1 - discount / 100);
      const tax = Number(record.taxPercent) || 0;
      return (afterDiscount + (afterDiscount * tax) / 100).toFixed(2);
    } },
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
              // تحديد الصنف المحدد للتعديل بدلاً من حذفه
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
                  // إعادة تعيين فهرس الصف المعدل
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

  // حساب الإجماليات
  const totals = addedItems.reduce(
    (acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const discount = Number(item.discountPercent) || 0;
      const tax = Number(item.taxPercent) || 0;
      const subtotal = qty * price;
      const discountValue = (subtotal * discount) / 100;
      const afterDiscount = subtotal - discountValue;
      const taxValue = (afterDiscount * tax) / 100;
      acc.subtotal += subtotal;
      acc.totalDiscount += discountValue;
      acc.afterDiscount += afterDiscount;
      acc.totalTax += taxValue;
      acc.finalTotal += afterDiscount + taxValue;
      return acc;
    },
    { subtotal: 0, totalDiscount: 0, afterDiscount: 0, totalTax: 0, finalTotal: 0 }
  );

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
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إضافة عرض سعر</h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة وعرض عروض الأسعار</p>
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
          { label: "عروض الأسعار", to: "/stores/quotations" },
          { label: "إضافة عرض سعر" }
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
            <label style={labelStyle}>رقم عرض السعر</label>
            <Input value={quotationNumber} disabled placeholder="رقم عرض السعر تلقائي" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تاريخ عرض السعر</label>
            <DatePicker value={quotationDate} onChange={setQuotationDate} format="YYYY-MM-DD" placeholder="تاريخ عرض السعر" style={largeControlStyle} size="large" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>تاريخ الانتهاء</label>
            <DatePicker value={refDate} onChange={setRefDate} format="YYYY-MM-DD" placeholder="تاريخ الانتهاء" style={largeControlStyle} size="large" />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">

          <div className="flex flex-col gap-2">
            <label style={labelStyle}>الفرع</label>
            <Select
              value={quotationData.branch}
              onChange={(value) => setQuotationData(prev => ({ ...prev, branch: value }))}
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
              value={quotationData.warehouse}
              onChange={(value) => setQuotationData(prev => ({ ...prev, warehouse: value }))}
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
            <Select value={movementType} onChange={setMovementType} placeholder="اختر نوع الحركة" allowClear style={largeControlStyle} 
             className={styles.noAntBorder}
            size="large">
              <Select.Option value="عرض سعر">عرض سعر - Quotation</Select.Option>
              <Select.Option value="عرض سعر مبدئي">عرض سعر مبدئي - Preliminary Quote</Select.Option>
              <Select.Option value="عرض سعر نهائي">عرض سعر نهائي - Final Quote</Select.Option>
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
        </div>

        <div className="grid grid-cols-4 gap-6 mb-4">

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
          <div className="flex flex-col gap-2">
            <label style={labelStyle}>رقم الموبايل</label>
            <Input
              value={customers.find(c => c.id === quotationData.customerNumber)?.mobile || ''}
              placeholder="رقم الموبايل"
              style={largeControlStyle}
              size="large"
              disabled
            />
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

        {/* أزرار الحفظ والطباعة */}
        <div className="flex gap-4 mt-8 justify-center">
          <Button 
            type="primary" 
            size="large" 
            onClick={handleSave}
            loading={saving}
            disabled={saving || !addedItems.length}
            style={{
              height: 48,
              fontSize: 18,
              borderRadius: 8,
              padding: '0 32px',
              backgroundColor: '#1890ff',
              borderColor: '#1890ff'
            }}
            icon={!saving && <SaveOutlined />}
          >
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
          <Button
            type="default"
            size="large"
            onClick={handlePrint}
            disabled={saving || !addedItems.length}
            style={{
              height: 48,
              fontSize: 18,
              borderRadius: 8,
              padding: '0 32px',
              backgroundColor: '#fff',
              borderColor: '#1890ff',
              color: '#1890ff',
              boxShadow: '0 1px 6px rgba(0,0,0,0.07)'
            }}
            icon={<FileTextOutlined />}
          >
            طباعة
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddQuotationPage;

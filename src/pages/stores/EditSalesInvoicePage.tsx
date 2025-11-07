import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { SearchOutlined, SaveOutlined, PlusOutlined, UserOutlined, EditOutlined } from '@ant-design/icons';
import { FileText } from 'lucide-react';
import { useAuth } from '@/contexts/useAuth';
import { collection, getDocs, addDoc, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useSearchParams, useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { Button, Input, Select, Table, message, Form, Row, Col, DatePicker, Spin, Modal, Space, Card, Divider } from 'antd';
import Breadcrumb from "../../components/Breadcrumb";
import { db } from '@/lib/firebase';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { FinancialYear } from '@/services/financialYearsService';
import { fetchCashBoxes } from '../../services/cashBoxesService';
import { fetchBankAccounts } from '../../services/bankAccountsService';

// Lazy load heavy components
const ItemSelect = lazy(() => import('@/components/ItemSelect'));
const CustomerSelect = lazy(() => import('@/components/CustomerSelect'));

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
  branch?: string; // هذا هو الحقل الصحيح المستخدم لربط المخزن بالفرع
  documentType?: 'invoice' | 'warehouse';
  invoiceTypes?: string[];
  allowedUsers?: string[];
  allowedBranches?: string[];
  status?: 'active' | 'inactive' | 'suspended';
}

interface PaymentMethod {
  id: string;
  name?: string;
  value?: string;
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

// تعريف نوع العنصر
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

interface InvoiceItem {
  itemNumber: string;
  itemName: string;
  quantity: string;
  unit: string;
  price: string;
  discountPercent: string;
  discountValue: number;
  // تم حذف الخصم الإضافي
  taxPercent: string;
  taxValue: number;
  total: number;
  isNewItem?: boolean; // إضافة خاصية تحديد إذا كان الصنف جديد
}

interface InvoiceData {
  invoiceNumber: string;
  entryNumber: string;
  date: string;
  paymentMethod: string;
  cashBox: string;
  multiplePayment: MultiplePayment;
  branch: string;
  warehouse: string;
  customerNumber: string;
  customerName: string;
  delegate: string;
  priceRule: string;
  commercialRecord: string;
  taxFile: string;
  dueDate?: string; // إضافة تاريخ الاستحقاق
}

interface Totals {
  afterDiscount: number;
  afterTax: number;
  total: number;
  tax: number;
}

// Custom Hook for Sales Data Management
const useSalesData = () => {
  const [loading, setLoading] = useState(false);
  const [fetchingItems, setFetchingItems] = useState(false);
  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cashBoxes, setCashBoxes] = useState<CashBox[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [itemNames, setItemNames] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyData, setCompanyData] = useState<CompanyData>({});

  // Cache for better performance
  const [dataCache, setDataCache] = useState<Map<string, unknown>>(new Map());

  const fetchBasicData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all basic data in parallel
      const [
        delegatesSnapshot,
        branchesSnapshot,
        warehousesSnapshot,
        paymentMethodsSnapshot,
        inventorySnapshot,
        customersSnapshot,
        companySnapshot
      ] = await Promise.all([
        getDocs(collection(db, 'salesRepresentatives')), // تم تصحيح اسم المجموعة
        getDocs(collection(db, 'branches')),
        getDocs(collection(db, 'warehouses')),
        getDocs(collection(db, 'paymentMethods')), // تم تصحيح اسم المجموعة
        getDocs(collection(db, 'inventory_items')), // تم تصحيح اسم المجموعة
        getDocs(collection(db, 'customers')),
        getDocs(collection(db, 'companies')) // تم تصحيح اسم المجموعة
      ]);

      // Fetch cash boxes and banks separately
      const [cashBoxesData, banksData] = await Promise.all([
        fetchCashBoxes(),
        fetchBankAccounts()
      ]);

      // Process data
      setDelegates(delegatesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Delegate[]);
      setBranches(branchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Branch[]);
      setWarehouses(warehousesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Warehouse[]);
      setPaymentMethods(paymentMethodsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PaymentMethod[]);
      setCashBoxes(cashBoxesData as CashBox[]);
      setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[]);
      
      const inventoryData = inventorySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as InventoryItem[];
      const filteredItems = inventoryData.filter(item => item.type === 'مستوى ثاني' && item.name?.trim());
      
      setItemNames(filteredItems);

      if (!companySnapshot.empty) {
        const companyDataDoc = companySnapshot.docs[0].data();
        setCompanyData(companyDataDoc);
      }

      setUnits(['قطعة', 'كيلو', 'جرام', 'لتر', 'متر', 'علبة', 'كرتون', 'حبة']);
      
    } catch (error) {
      console.error('خطأ في جلب البيانات:', error);
      message.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    fetchingItems,
    setFetchingItems,
    delegates,
    branches,
    warehouses,
    paymentMethods,
    cashBoxes,
    units,
    itemNames,
    customers,
    companyData,
    fetchBasicData,
    taxRate: companyData.taxRate || '15'
  };
};

interface Delegate {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  status?: 'active' | 'inactive';
  uid?: string;
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

interface Supplier {
  id: string;
  name: string;
}

interface ItemData {
  id?: string;
  name?: string;
  itemCode?: string;
  salePrice?: number;
  purchasePrice?: number;
  cost?: number;
  unit?: string;
  type?: string;
  parentId?: string;
  tempCodes?: boolean;
  [key: string]: unknown;
}

interface InvoiceRecord {
  key: string;
  invoiceNumber: string;
  entryNumber?: string;
  date: string;
  dueDate?: string; // إضافة تاريخ الاستحقاق
  branch: string; // إضافة الفرع
  itemNumber: string;
  itemName: string;
  mainCategory: string;
  quantity: number;
  price: number;
  total: number;
  discountValue: number;
  discountPercent: number;
  taxValue: number;
  taxPercent: number;
  net: number;
  cost: number;
  profit: number;
  warehouse: string;
  customer: string;
  customerNumber?: string;
  customerName?: string;
  customerPhone: string;
  seller: string;
  delegate?: string;
  paymentMethod: string;
  invoiceType: string;
  priceRule?: string;
  commercialRecord?: string;
  taxFile?: string;
  items?: InvoiceItem[];
  totals?: Totals;
  extraDiscount?: number;
  itemData?: ItemData; // لإظهار بيانات الصنف المؤقتة
}

const initialItem: InvoiceItem = {
  itemNumber: '',
  itemName: '',
  quantity: '',
  unit: 'قطعة',
  price: '',
  discountPercent: '0',
  discountValue: 0,
  // تم حذف الخصم الإضافي
  taxPercent: '15',
  taxValue: 0,
  total: 0,
  isNewItem: false
}


// دالة توليد رقم فاتورة جديد بناءً على رقم الفرع والتاريخ والتسلسل اليومي
async function generateInvoiceNumberAsync(branchId: string, branches: Branch[] = []): Promise<string> {
  const date = new Date();
  const y = date.getFullYear();
  
  // البحث عن رقم الفرع الحقيقي من بيانات الفروع
  const branchObj = branches.find(b => b.id === branchId);
  const branchNumber = branchObj?.code || branchObj?.number || branchObj?.branchNumber || '1';
  
  try {
    // جلب عدد الفواتير لنفس الفرع في نفس السنة - استعلام مبسط
    const { getDocs, collection, query, where } = await import('firebase/firestore');
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
}

function getTodayString(): string {
  return dayjs().format('YYYY-MM-DD');
}

// دالة للحصول على تاريخ صالح ضمن السنة المالية
function getValidDateForFinancialYear(financialYear: FinancialYear | null): string {
  const today = dayjs();
  
  if (!financialYear) {
    return today.format('YYYY-MM-DD');
  }
  
  const startDate = dayjs(financialYear.startDate);
  const endDate = dayjs(financialYear.endDate);
  
  // إذا كان اليوم ضمن السنة المالية، استخدمه
  if (today.isSameOrAfter(startDate, 'day') && today.isSameOrBefore(endDate, 'day')) {
    return today.format('YYYY-MM-DD');
  }
  
  // إذا كان اليوم قبل بداية السنة المالية، استخدم تاريخ البداية
  if (today.isBefore(startDate, 'day')) {
    return startDate.format('YYYY-MM-DD');
  }
  
  // إذا كان اليوم بعد نهاية السنة المالية، استخدم تاريخ النهاية
  return endDate.format('YYYY-MM-DD');
}

// دالة حساب تاريخ الاستحقاق (بعد 12 يوم من تاريخ الفاتورة)
function calculateDueDate(invoiceDate: string): string {
  if (!invoiceDate) return '';
  return dayjs(invoiceDate).add(12, 'day').format('YYYY-MM-DD');
}

const EditSalesInvoice: React.FC = () => {
  // معاملات URL للتعديل
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceNumberParam = searchParams.get('invoice');
  const [isEditMode, setIsEditMode] = useState(false); // تبدأ بـ false
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  console.log('EditSalesInvoice تم تحميلها - invoiceNumberParam:', invoiceNumberParam, 'isEditMode:', isEditMode);

  // حالة الرسائل
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message: string;
    timestamp: Date;
  }>>([]);

  // دالة إضافة رسالة جديدة
  const addNotification = useCallback((type: 'success' | 'error' | 'warning' | 'info', title: string, msg: string) => {
    const newNotification = {
      id: Date.now().toString(),
      type,
      title,
      message: msg,
      timestamp: new Date()
    };
    setNotifications(prev => {
      // إضافة الرسالة الجديدة في المقدمة والاحتفاظ بآخر 4 رسائل فقط
      const updated = [newNotification, ...prev.slice(0, 3)];
      return updated;
    });
    
    // إزالة الرسالة تلقائياً بعد 5 ثواني
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== newNotification.id));
    }, 5000);
  }, []);

  // إنشاء كائن message مخصص
  const customMessage = useMemo(() => ({
    success: (msg: string) => {
      addNotification('success', 'نجح العملية', msg);
      message.success(msg);
    },
    error: (msg: string) => {
      addNotification('error', 'خطأ في العملية', msg);
      message.error(msg);
    },
    warning: (msg: string) => {
      addNotification('warning', 'تحذير', msg);
      message.warning(msg);
    },
    info: (msg: string) => {
      addNotification('info', 'معلومات', msg);
      message.info(msg);
    }
  }), [addNotification]);

  // زر توليد 3000 فاتورة عشوائية
  const generateRandomInvoices = async () => {
    if (!branches.length || !warehouses.length || !paymentMethods.length || !customers.length || !itemNames.length) {
      customMessage.error('يجب توفر بيانات الفروع والمخازن والعملاء والأصناف وطرق الدفع أولاً');
      return;
    }
    const { addDoc, collection } = await import('firebase/firestore');
    const randomFrom = arr => arr[Math.floor(Math.random() * arr.length)];
    const randomDiscount = () => Math.floor(Math.random() * 21); // 0-20%
    const randomQty = () => Math.floor(Math.random() * 10) + 1; // 1-10
    const today = getTodayString();
    setLoading(true);
    try {
      for (let i = 0; i < 3000; i++) {
        const branch = randomFrom(branches);
        const warehouse = randomFrom(warehouses);
        const paymentMethod = randomFrom(paymentMethods);
        const customer = randomFrom(customers);
        const item = randomFrom(itemNames);
        const discountPercent = randomDiscount();
        const quantity = randomQty();
        const price = item.salePrice || 10;
        const subtotal = price * quantity;
        const discountValue = subtotal * (discountPercent / 100);
        const taxableAmount = subtotal - discountValue;
        const taxPercent = 15;
        const taxValue = taxableAmount * (taxPercent / 100);
        const total = subtotal;
        const invoiceNumber = `RND-${branch.id}-${today.replace(/-/g, '')}-${i+1}`;
        const invoiceData = {
          invoiceNumber,
          entryNumber: `EN-${Math.floor(100000 + Math.random() * 900000)}`,
          date: today,
          paymentMethod: paymentMethod.name || paymentMethod.value || paymentMethod,
          branch: branch.id,
          warehouse: warehouse.id,
          customerNumber: customer.phone || customer.phoneNumber || '',
          customerName: customer.nameAr || customer.name || customer.nameEn || '',
          delegate: '',
          priceRule: '',
          commercialRecord: customer.commercialReg || '',
          taxFile: customer.taxFileNumber || customer.taxFile || '',
          items: [
            {
              itemNumber: item.itemCode || '',
              itemName: item.name,
              quantity: String(quantity),
              unit: item.unit || 'قطعة',
              price: String(price),
              discountPercent: String(discountPercent),
              discountValue,
              taxPercent: String(taxPercent),
              taxValue,
              total,
              isNewItem: false
            }
          ],
          totals: {
            afterDiscount: subtotal - discountValue,
            afterTax: taxableAmount + taxValue,
            total: subtotal,
            tax: taxValue
          },
          type: 'ضريبة'
        };
        await addDoc(collection(db, 'sales_invoices'), invoiceData);
      }
      customMessage.success('تم توليد 3000 فاتورة عشوائية بنجاح');
      if (fetchInvoices) {
        fetchInvoices();
      }
    } catch (err) {
      customMessage.error('حدث خطأ أثناء توليد الفواتير');
    } finally {
      setLoading(false);
    }
  };
  // حالة مودال إضافة صنف جديد
  const [showAddItemModal, setShowAddItemModal] = useState(false);

  // قائمة الموردين
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [addItemLoading, setAddItemLoading] = useState(false);

  // جلب الموردين من قاعدة البيانات عند تحميل الصفحة
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const suppliersSnapshot = await getDocs(collection(db, 'suppliers'));
        const suppliersData = suppliersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as { name: string })
        }));
        // فقط الاسم والمعرف
        setSuppliers(suppliersData.map(s => ({ id: s.id, name: s.name })));
      } catch (error) {
        console.error('Error fetching suppliers:', error);
      }
    };
    fetchSuppliers();
  }, []);

  // دالة إضافة صنف جديد
  const handleAddNewItem = async () => {
    if (!addItemForm.name.trim() || !addItemForm.salePrice.trim() || !addItemForm.unit.trim()) return;
    setAddItemLoading(true);
    try {
      // بناء بيانات الصنف الجديد
      const newItemData = {
        name: addItemForm.name.trim(),
        itemCode: addItemForm.itemCode?.trim() || '',
        salePrice: addItemForm.salePrice ? Number(addItemForm.salePrice) : 0,
        discount: addItemForm.discount ? Number(addItemForm.discount) : 0,
        isVatIncluded: !!addItemForm.isVatIncluded,
        tempCodes: !!addItemForm.tempCodes,
        type: 'مستوى ثاني',
        purchasePrice: addItemForm.purchasePrice ? Number(addItemForm.purchasePrice) : 0,
        minOrder: addItemForm.minOrder ? Number(addItemForm.minOrder) : 0,
        allowNegative: !!addItemForm.allowNegative,
        supplier: addItemForm.supplier || '',
        unit: addItemForm.unit || '',
        createdAt: new Date().toISOString()
      };

      // إضافة الصنف إلى قاعدة البيانات
      const docRef = await addDoc(collection(db, 'inventory_items'), newItemData);
      
      // بناء بيانات الصنف مع المعرف الحقيقي
      const newItem: InventoryItem = {
        id: docRef.id,
        ...newItemData
      };

      // تحديث القوائم المحلية فوراً
      // setItemNames((prev: InventoryItem[]) => [...prev, newItem]); // Now handled by hook
      setAllItems((prev: InventoryItem[]) => [...prev, newItem]);
      await fetchBasicData(); // Refresh data from hook
      
      // إغلاق المودال وإعادة تعيين النموذج
      setShowAddItemModal(false);
      setAddItemForm({
        name: '',
        itemCode: '',
        purchasePrice: '',
        salePrice: '',
        minOrder: '',
        discount: '',
        allowNegative: false,
        isVatIncluded: false,
        tempCodes: false,
        supplier: '',
        unit: '',
        type: '',
        parentId: ''
      });
      
      // تحديد الصنف الجديد في القائمة المنسدلة
      setItem({
        ...item,
        itemName: newItem.name,
        itemNumber: newItem.itemCode || '',
        price: String(newItem.salePrice || ''),
        discountPercent: String(newItem.discount || '0'),
        taxPercent: taxRate,
        quantity: '1'
      });
      
      customMessage.success('تمت إضافة الصنف بنجاح وتم تحديد اختياره');
      
    } catch (e) {
      console.error('خطأ في إضافة الصنف:', e);
      message.error('حدث خطأ أثناء إضافة الصنف');
    } finally {
      setAddItemLoading(false);
    }
  };
  // دالة تحديث قائمة العملاء
  const refreshCustomers = async () => {
    try {
      setFetchingItems(true);
      const customersSnap = await getDocs(collection(db, 'customers'));
      const customersData = customersSnap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, taxFile: data.taxFile || '' };
      });
      // setCustomers(customersData); // Now handled by hook
      await fetchBasicData(); // Refresh data from hook
      customMessage.success('تم تحديث قائمة العملاء بنجاح');
    } catch (error) {
      console.error('خطأ في تحديث العملاء:', error);
      message.error('حدث خطأ أثناء تحديث قائمة العملاء');
    } finally {
      setFetchingItems(false);
    }
  };

  // دالة تحديث قائمة الأصناف
  const refreshItems = async () => {
    try {
      setFetchingItems(true);
      const itemsSnap = await getDocs(collection(db, 'inventory_items'));
      const allItemsData = itemsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          itemCode: data.itemCode || '',
          salePrice: data.salePrice || 0,
          discount: data.discount || 0,
          isVatIncluded: data.isVatIncluded || false,
          type: data.type || '',
          tempCodes: data.tempCodes || false,
          allowNegative: data.allowNegative || false
        };
      }).filter(item => item.name);
      
      setAllItems(allItemsData);
      const secondLevelItems = allItemsData.filter(item => item.type === 'مستوى ثاني');
      // setItemNames(secondLevelItems); // Now handled by hook - will be updated via fetchBasicData
      await fetchBasicData(); // Refresh data from hook
      customMessage.success('تم تحديث قائمة الأصناف بنجاح');
    } catch (error) {
      console.error('خطأ في تحديث الأصناف:', error);
      message.error('حدث خطأ أثناء تحديث قائمة الأصناف');
    } finally {
      setFetchingItems(false);
    }
  };

  // --- Add Customer Modal State (fix: must be inside component, before return) ---
  const businessTypes = ["شركة", "مؤسسة", "فرد"];
  const initialAddCustomer = {
    nameAr: '',
    phone: '',
    businessType: '',
    commercialReg: '',
    taxFileNumber: ''
  };
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [addCustomerForm, setAddCustomerForm] = useState(initialAddCustomer);
  const [addCustomerLoading, setAddCustomerLoading] = useState(false);
  const handleAddCustomerChange = (field, value) => {
    setAddCustomerForm(prev => ({ ...prev, [field]: value }));
  };
  const handleAddCustomer = async () => {
    if (!addCustomerForm.nameAr || !addCustomerForm.phone || !addCustomerForm.businessType) {
      message.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }
    if ((addCustomerForm.businessType === 'شركة' || addCustomerForm.businessType === 'مؤسسة') && (!addCustomerForm.commercialReg || !addCustomerForm.taxFileNumber)) {
      message.error('يرجى ملء السجل التجاري والملف الضريبي');
      return;
    }
    setAddCustomerLoading(true);
    try {
      const maxNum = customers
        .map(c => {
          const match = /^c-(\d{4})$/.exec(c.id);
          return match ? parseInt(match[1], 10) : 0;
        })
        .reduce((a, b) => Math.max(a, b), 0);
      const nextNum = maxNum + 1;
      const newId = `c-${nextNum.toString().padStart(4, '0')}`;
      const docData = {
        id: newId,
        nameAr: addCustomerForm.nameAr,
        phone: addCustomerForm.phone,
        businessType: addCustomerForm.businessType,
        commercialReg: addCustomerForm.businessType === 'فرد' ? '' : addCustomerForm.commercialReg,
        taxFileNumber: addCustomerForm.businessType === 'فرد' ? '' : addCustomerForm.taxFileNumber,
        status: 'نشط',
        createdAt: new Date().toISOString(),
      };
      
      const docRef = await addDoc(collection(db, 'customers'), docData);
      
      // بناء بيانات العميل الجديد مع المعرف الحقيقي
      const newCustomer = {
        id: docRef.id,
        ...docData,
        taxFile: docData.taxFileNumber || ''
      };
      
      // تحديث قائمة العملاء فوراً
      // setCustomers(prev => [...prev, newCustomer]); // Now handled by hook
      await fetchBasicData(); // Refresh data from hook
      
      // تحديد العميل الجديد في الفاتورة
      setInvoiceData(prev => ({
        ...prev,
        customerName: newCustomer.nameAr,
        customerNumber: newCustomer.phone || '',
        commercialRecord: newCustomer.commercialReg || '',
        taxFile: newCustomer.taxFile || ''
      }));
      
      customMessage.success('تم إضافة العميل بنجاح وتم تحديد اختياره في الفاتورة!');
      setShowAddCustomerModal(false);
      setAddCustomerForm(initialAddCustomer);
      
    } catch (err) {
      console.error('خطأ في إضافة العميل:', err);
      message.error('حدث خطأ أثناء إضافة العميل');
    } finally {
      setAddCustomerLoading(false);
    }
  };
interface CompanyData {
  arabicName?: string;
  englishName?: string;
  logoUrl?: string;
  commercialRegistration?: string;
  taxFile?: string;
  registrationDate?: string;
  issuingAuthority?: string;
  companyType?: string;
  activityType?: string;
  nationality?: string;
  city?: string;
  region?: string;
  street?: string;
  district?: string;
  buildingNumber?: string;
  postalCode?: string;
  countryCode?: string;
  phone?: string;
  mobile?: string;
  fiscalYear?: string;
  taxRate?: string;
  website?: string;
}

  // دالة تصدير سجل الفواتير إلى ملف Excel
  const exportInvoicesToExcel = () => {
    if (!invoices.length) {
      message.info('لا يوجد بيانات للتصدير');
      return;
    }
    // تجهيز البيانات
    const data = invoices.map(inv => {
      // البحث عن اسم المخزن بناءً على id
      let warehouseName = inv.warehouse;
      if (warehouses && Array.isArray(warehouses)) {
        const found = warehouses.find(w => w.id === inv.warehouse);
        if (found) warehouseName = found.name || found.id;
      }
      // البحث عن اسم الفرع بناءً على id
      let branchName = inv.branch;
      if (branches && Array.isArray(branches)) {
        const foundBranch = branches.find(b => b.id === inv.branch);
        if (foundBranch) branchName = foundBranch.name || foundBranch.id;
      }
      return {
        'رقم الفاتورة': inv.invoiceNumber,
        'التاريخ': inv.date,
        'الفرع': branchName,
        'كود الصنف': inv.itemNumber,
        'اسم الصنف': inv.itemName,
        'المجموعة الرئيسية': inv.firstLevelCategory || '',
        'المستوى الأول': inv.mainCategory || '',
        'الكمية': inv.quantity,
        'السعر': inv.price,
        'الإجمالي': inv.total,
        'قيمة الخصم': inv.discountValue,
        '% الخصم': inv.discountPercent,
        'قيمة الضريبة': inv.taxValue,
        '% الضريبة': inv.taxPercent,
        'الصافي': inv.net,
        'التكلفة': inv.cost,
        'ربح الصنف': inv.profit,
        'المخزن': warehouseName,
        'العميل': inv.customer,
        'تليفون العميل': inv.customerPhone,
        'البائع': getDelegateName(inv.seller),
        'طريقة الدفع': inv.paymentMethod,
        'نوع الفاتورة': inv.invoiceType
      };
    });

    // بيانات الشركة (يمكنك التعديل)
    const companyInfo = ['شركة حساب عربي', 'الهاتف: 01000000000', 'العنوان: القاهرة - مصر'];
    const companyTitle = 'سجل فواتير المبيعات';
    const userName = (user?.displayName || user?.name || user?.email || '');
    const exportDate = new Date().toLocaleString('ar-EG');

    // إجماليات
    const totalsRow = {
      'رقم الفاتورة': 'الإجماليات',
      'التاريخ': '',
      'الفرع': '',
      'كود الصنف': '',
      'اسم الصنف': '',
      'المجموعة الرئيسية': '',
      'المستوى الأول': '',
      'الكمية': data.reduce((sum, r) => sum + Number(r['الكمية'] || 0), 0),
      'السعر': '',
      'الإجمالي': data.reduce((sum, r) => sum + Number(r['الإجمالي'] || 0), 0),
      'قيمة الخصم': data.reduce((sum, r) => sum + Number(r['قيمة الخصم'] || 0), 0),
      '% الخصم': '',
      'قيمة الضريبة': data.reduce((sum, r) => sum + Number(r['قيمة الضريبة'] || 0), 0),
      '% الضريبة': '',
      'الصافي': data.reduce((sum, r) => sum + Number(r['الصافي'] || 0), 0),
      'التكلفة': data.reduce((sum, r) => sum + Number(r['التكلفة'] || 0), 0),
      'ربح الصنف': data.reduce((sum, r) => sum + Number(r['ربح الصنف'] || 0), 0),
      'المخزن': '',
      'العميل': '',
      'تليفون العميل': '',
      'البائع': '',
      'طريقة الدفع': '',
      'نوع الفاتورة': ''
    };

    // Excel export function (temporarily disabled for performance optimization)
    message.info('وظيفة التصدير إلى Excel سيتم تفعيلها قريباً');
    return;
    
    // TODO: Re-implement Excel export with better performance
    /*
    // Simple CSV export as fallback
    const csvContent = "data:text/csv;charset=utf-8," 
      + data.map(row => Object.values(row).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `invoices_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    */

    /*
    // تنسيق العنوان الرئيسي
    const titleCell = ws[XLSX.utils.encode_cell({ r: 0, c: 0 })];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '305496' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
    // تنسيق بيانات الشركة
    const infoCell = ws[XLSX.utils.encode_cell({ r: 1, c: 0 })];
    if (infoCell) {
      infoCell.s = {
        font: { bold: true, sz: 12, color: { rgb: '305496' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
    // تنسيق صف العناوين
    const headerRow = 3; // الصف الرابع (A4)
    for (let c = 0; c < colCount; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: headerRow, c })];
      if (cell) {
        cell.s = {
          font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '4472C4' } },
          alignment: { horizontal: 'center', vertical: 'center' },
          border: {
            top: { style: 'thin', color: { rgb: 'AAAAAA' } },
            bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
            left: { style: 'thin', color: { rgb: 'AAAAAA' } },
            right: { style: 'thin', color: { rgb: 'AAAAAA' } }
          }
        };
      }
    }
    // تنسيق الأرقام وتوسيط الأعمدة وإضافة حدود
    const rowCount = data.length;
    for (let r = headerRow + 1; r <= headerRow + rowCount + 1; r++) {
      for (let c = 0; c < colCount; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell) {
          // تنسيق الأرقام لبعض الأعمدة
          if ([6,7,8,9,10,11,12,13,14,15,16].includes(c)) {
            cell.z = '#,##0.00';
          }
          // إبراز الصافي والربح في صف الإجماليات
          if (r === headerRow + rowCount + 1 && (c === 13 || c === 15)) {
            cell.s = {
              font: { bold: true, sz: 13, color: { rgb: 'FFFFFF' } },
              fill: { fgColor: { rgb: c === 13 ? '70AD47' : 'FFC000' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'AAAAAA' } },
                bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
                left: { style: 'thin', color: { rgb: 'AAAAAA' } },
                right: { style: 'thin', color: { rgb: 'AAAAAA' } }
              }
            };
          } else {
            cell.s = {
              alignment: { horizontal: 'center', vertical: 'center' },
              border: {
                top: { style: 'thin', color: { rgb: 'AAAAAA' } },
                bottom: { style: 'thin', color: { rgb: 'AAAAAA' } },
                left: { style: 'thin', color: { rgb: 'AAAAAA' } },
                right: { style: 'thin', color: { rgb: 'AAAAAA' } }
              }
            };
          }
        }
      }
    }
    // ترويسة التصدير
    const footerCell = ws[XLSX.utils.encode_cell({ r: data.length + 6, c: 0 })];
    if (footerCell) {
      footerCell.s = {
        font: { italic: true, sz: 11, color: { rgb: '888888' } },
        alignment: { horizontal: 'right', vertical: 'center' }
      };
    }
    // ضبط عرض الأعمدة تلقائيًا حسب المحتوى
    ws['!cols'] = Object.keys(data[0]).map((k, i) => {
      const maxLen = Math.max(
        k.length,
        ...data.map(row => String(row[k] ?? '').length),
        String(totalsRow[k] ?? '').length
      );
      return { wch: Math.min(Math.max(maxLen + 2, 12), 30) };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'سجل الفواتير');
    XLSX.writeFile(wb, `سجل_الفواتير_${new Date().toISOString().slice(0,10)}.xlsx`);
    */
  };
  const { user } = useAuth();

  // دالة فلترة المخازن بناءً على الشروط المطلوبة
  const filterWarehousesForSales = (warehouses: Warehouse[], selectedBranch: string = '') => {
    return warehouses.filter(warehouse => {
      // التحقق من حالة المخزن (يجب أن يكون نشط)
      if (warehouse.status && warehouse.status !== 'active') {
        return false;
      }

      // التحقق من نوع الاستخدام (يجب أن يكون فاتورة أو غير محدد)
      if (warehouse.documentType && warehouse.documentType !== 'invoice') {
        return false;
      }

      // التحقق من أنواع الفواتير (يجب أن تحتوي على مبيعات أو الكل أو غير محددة)
      if (warehouse.invoiceTypes && warehouse.invoiceTypes.length > 0) {
        const hasValidInvoiceType = warehouse.invoiceTypes.includes('sales') || 
                                  warehouse.invoiceTypes.includes('all');
        if (!hasValidInvoiceType) {
          return false;
        }
      }

      // التحقق من المستخدمين المسموح لهم
      if (warehouse.allowedUsers && warehouse.allowedUsers.length > 0 && user?.uid) {
        if (!warehouse.allowedUsers.includes(user.uid)) {
          return false;
        }
      }

      // التحقق من الفروع المسموح بها (إذا تم تحديد فرع)
      if (selectedBranch && warehouse.allowedBranches && warehouse.allowedBranches.length > 0) {
        if (!warehouse.allowedBranches.includes(selectedBranch)) {
          return false;
        }
      }

      return true;
    });
  };

  const [invoiceType, setInvoiceType] = useState<'ضريبة مبسطة' | 'ضريبة'>('ضريبة مبسطة');
  const [warehouseMode, setWarehouseMode] = useState<'single' | 'multiple'>('single');
  const [multiplePaymentMode, setMultiplePaymentMode] = useState<boolean>(false);
  const [branchCode, setBranchCode] = useState<string>('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    invoiceNumber: '',
    entryNumber: generateEntryNumber(),
    date: getTodayString(),
    paymentMethod: '',
    cashBox: '',
    multiplePayment: {},
    branch: '',
    warehouse: '',
    customerNumber: '',
    customerName: '',
    delegate: '', // سيتم تعيين المندوب المناسب في useEffect
    priceRule: '',
    commercialRecord: '',
    taxFile: '',
    dueDate: '' // سيتم حسابه لاحقاً
  });

  // مراقبة تغيير حالة invoiceData
  useEffect(() => {
    console.log('invoiceData تم تحديثها:', invoiceData);
  }, [invoiceData]);

  // توليد رقم فاتورة جديد عند كل إعادة تعيين أو تغيير الفرع
  // دالة توليد رقم قيد تلقائي
  function generateEntryNumber() {
    // رقم عشوائي بين 100000 و 999999
    return 'EN-' + Math.floor(100000 + Math.random() * 900000);
  }

  const generateAndSetInvoiceNumber = async (branchIdValue: string) => {
    const invoiceNumber = await generateInvoiceNumberAsync(branchIdValue, branches);
    setInvoiceData(prev => ({ ...prev, invoiceNumber, entryNumber: generateEntryNumber() }));
  };

  // توليد رقم فاتورة عند تحميل الصفحة لأول مرة إذا كان رقم الفرع موجود
  useEffect(() => {
    if (branchCode) {
      generateAndSetInvoiceNumber(branchCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchCode]);
  
  // استخدام hook السنة المالية
  const { 
    currentFinancialYear, 
    validateDate, 
    getDateValidationMessage, 
    getMinDate, 
    getMaxDate,
    isWithinFinancialYear 
  } = useFinancialYear();
  
  // استخدام custom hook للبيانات المحسنة
  const {
    loading: dataLoading,
    fetchingItems,
    setFetchingItems,
    delegates,
    branches,
    warehouses,
    paymentMethods,
    cashBoxes,
    units,
    itemNames,
    customers,
    companyData,
    fetchBasicData,
    taxRate
  } = useSalesData();
  
  // Additional state variables not in hook
  const [banks, setBanks] = useState<Bank[]>([]);
  const [priceRules, setPriceRules] = useState<string[]>([]);
  const [allItems, setAllItems] = useState<InventoryItem[]>([]); // جميع الأصناف للاستخدام في النماذج
  const [loading, setLoading] = useState<boolean>(false);
  const [item, setItem] = useState<InvoiceItem & { warehouseId?: string }>(initialItem);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // مراقبة تغيير حالة الأصناف وتحديث الإجماليات تلقائياً
  useEffect(() => {
    console.log('items تم تحديثها:', items);
    // تحديث الإجماليات عند تغيير الأصناف
    if (items.length > 0) {
      updateTotals(items);
    } else {
      // إعادة تعيين الإجماليات إلى الصفر عند عدم وجود أصناف
      setTotals({
        afterDiscount: 0,
        afterTax: 0,
        total: 0,
        tax: 0
      });
    }
  }, [items]);

  const [totals, setTotals] = useState<Totals>({
    afterDiscount: 0,
    afterTax: 0,
    total: 0,
    tax: 0
  });

  const [priceType, setPriceType] = useState<'سعر البيع' | 'آخر سعر العميل'>('سعر البيع');
  const [invoices, setInvoices] = useState<(InvoiceRecord & { firstLevelCategory?: string })[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
interface FirebaseInvoiceItem {
  itemNumber?: string;
  itemName?: string;
  quantity?: string | number;
  price?: string | number;
  total?: string | number;
  discountValue?: string | number;
  discountPercent?: string | number;
  taxValue?: string | number;
  taxPercent?: string | number;
  cost?: string | number;
  [key: string]: unknown;
}

interface SavedInvoice {
  invoiceNumber: string;
  entryNumber: string;
  date: string;
  paymentMethod: string;
  cashBox?: string;
  multiplePayment?: MultiplePayment;
  branch: string;
  warehouse: string;
  customerNumber: string;
  customerName: string;
  delegate: string;
  priceRule: string;
  commercialRecord: string;
  taxFile: string;
  items: InvoiceItem[];
  totals: Totals;
  type: string;
  createdAt: string;
  source: string;
  dueDate?: string;
  customerAddress?: string;
  [key: string]: unknown;
}

  // حالة المودال بعد الحفظ
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [lastSavedInvoice, setLastSavedInvoice] = useState<SavedInvoice | null>(null);

  // حالة تتبع الصنف المحدد للتعديل
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // دالة للتحقق من حالة الإيقاف المؤقت للصنف
  const checkItemTempStatus = (itemName: string): boolean => {
    const item = itemNames.find(i => i.name === itemName);
    return item ? !!item.tempCodes : false;
  };

  const [itemStocks, setItemStocks] = useState<{[key: string]: number}>({});
  const [loadingStocks, setLoadingStocks] = useState(false);

  // دالة للتحقق من صحة التاريخ وإظهار التحذير
  const handleDateValidation = useCallback((date: string | dayjs.Dayjs, fieldName: string) => {
    if (!date) return true;
    
    const isValid = validateDate(date);
    if (!isValid && currentFinancialYear) {
      const errorMessage = getDateValidationMessage(date);
      customMessage.warning(
        `${fieldName}: ${errorMessage}. السنة المالية المحددة من ${currentFinancialYear.startDate} إلى ${currentFinancialYear.endDate}`
      );
      return false;
    }
    return true;
  }, [validateDate, getDateValidationMessage, currentFinancialYear, customMessage]);

  // دالة لحساب تاريخ الاستحقاق مع التحقق من السنة المالية
  const calculateDueDate = useCallback((invoiceDate: string): string => {
    if (!invoiceDate) return '';
    
    // حساب تاريخ الاستحقاق بعد 30 يوم من تاريخ الفاتورة
    const dueDate = dayjs(invoiceDate).add(30, 'day');
    
    // التحقق من أن تاريخ الاستحقاق ضمن السنة المالية
    if (currentFinancialYear) {
      const maxDate = dayjs(currentFinancialYear.endDate);
      if (dueDate.isAfter(maxDate)) {
        // إذا كان تاريخ الاستحقاق المحسوب خارج السنة المالية، استخدم آخر يوم في السنة المالية
        return maxDate.format('YYYY-MM-DD');
      }
    }
    
    return dueDate.format('YYYY-MM-DD');
  }, [currentFinancialYear]);

  // دالة لفلترة التواريخ المسموحة في DatePicker
  const disabledDate = useCallback((current: dayjs.Dayjs) => {
    if (!currentFinancialYear) return false;
    
    const startDate = dayjs(currentFinancialYear.startDate);
    const endDate = dayjs(currentFinancialYear.endDate);
    
    return current.isBefore(startDate, 'day') || current.isAfter(endDate, 'day');
  }, [currentFinancialYear]);

  // تحديث التاريخ الافتراضي عند تغيير السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      const validDate = getValidDateForFinancialYear(currentFinancialYear);
      setInvoiceData(prev => ({
        ...prev,
        date: validDate,
        dueDate: calculateDueDate(validDate)
      }));
    }
  }, [currentFinancialYear, calculateDueDate]);

  // دالة لجلب رصيد صنف واحد في مخزن محدد (للاستخدام في حالة المخازن المتعددة)
  const fetchSingleItemStock = async (itemName: string, warehouseId: string): Promise<number> => {
    if (!itemName || !warehouseId) return 0;
    
    try {
      const stock = await checkStockAvailability(itemName, warehouseId);
      // تحديث الرصيد في الحالة
      setItemStocks(prev => ({
        ...prev,
        [`${itemName}-${warehouseId}`]: stock
      }));
      return stock;
    } catch (error) {
      console.error('خطأ في جلب رصيد الصنف:', error);
      return 0;
    }
  };

  // دالة لجلب أرصدة جميع الأصناف في المخزن المحدد
  const fetchItemStocks = useCallback(async (warehouseId: string) => {
    if (!warehouseId || itemNames.length === 0) return;
    
    setLoadingStocks(true);
    const stocks: {[key: string]: number} = {};
    
    try {
      // جلب الأرصدة لجميع الأصناف بشكل متوازي
      const stockPromises = itemNames.map(async (item) => {
        const stock = await checkStockAvailability(item.name, warehouseId);
        stocks[item.name] = stock;
      });
      
      await Promise.all(stockPromises);
      setItemStocks(stocks);
    } catch (error) {
      console.error('خطأ في جلب الأرصدة:', error);
    } finally {
      setLoadingStocks(false);
    }
  }, [itemNames]);

  // تحديث الأرصدة عند تغيير المخزن أو الأصناف
  useEffect(() => {
    if (warehouseMode === 'single' && invoiceData.warehouse) {
      fetchItemStocks(invoiceData.warehouse);
    }
  }, [invoiceData.warehouse, itemNames, warehouseMode, fetchItemStocks]);

  // دالة فحص المخزون المتاح
  const checkStockAvailability = async (itemName: string, warehouseId: string): Promise<number> => {
    try {
      // جلب فواتير المشتريات (وارد)
      const purchasesSnap = await getDocs(collection(db, "purchases_invoices"));
      const allPurchases = purchasesSnap.docs.map(doc => doc.data());
      
      // جلب فواتير المبيعات (منصرف)
      const salesSnap = await getDocs(collection(db, "sales_invoices"));
      const allSales = salesSnap.docs.map(doc => doc.data());
      
      // جلب مرتجعات المبيعات (وارد)
      const salesReturnsSnap = await getDocs(collection(db, "sales_returns"));
      const allSalesReturns = salesReturnsSnap.docs.map(doc => doc.data());
      
      let totalIncoming = 0;
      let totalOutgoing = 0;
      
      // حساب الوارد من المشتريات
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allPurchases.forEach((purchase: any) => {
        if (Array.isArray(purchase.items)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          purchase.items.forEach((item: any) => {
            if ((item.itemName === itemName) && 
                ((purchase.warehouse === warehouseId) || (item.warehouseId === warehouseId))) {
              totalIncoming += Number(item.quantity) || 0;
            }
          });
        }
      });
      
      // حساب الوارد من مرتجعات المبيعات
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allSalesReturns.forEach((returnDoc: any) => {
        if (Array.isArray(returnDoc.items)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          returnDoc.items.forEach((item: any) => {
            const returnWarehouse = item.warehouseId || item.warehouse || returnDoc.warehouse;
            if ((item.itemName === itemName) && (returnWarehouse === warehouseId)) {
              const returnedQty = typeof item.returnedQty !== 'undefined' ? Number(item.returnedQty) : 0;
              totalIncoming += returnedQty;
            }
          });
        }
      });
      
      // حساب المنصرف من المبيعات
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allSales.forEach((sale: any) => {
        if (Array.isArray(sale.items)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sale.items.forEach((item: any) => {
            if ((item.itemName === itemName) && 
                ((sale.warehouse === warehouseId) || (item.warehouseId === warehouseId))) {
              totalOutgoing += Number(item.quantity) || 0;
            }
          });
        }
      });
      
      return totalIncoming - totalOutgoing;
    } catch (error) {
      console.error('خطأ في فحص المخزون:', error);
      return 0;
    }
  };

  // جلب الفواتير من Firebase
  const fetchInvoices = async () => {
    try {
      setInvoicesLoading(true);
      const invoicesSnap = await getDocs(collection(db, 'sales_invoices'));
      const invoicesData: (InvoiceRecord & { firstLevelCategory?: string })[] = [];
      // جلب الأصناف لتعريف المستويات
      let inventoryItems: ItemData[] = [];
      try {
        const itemsSnap = await getDocs(collection(db, 'inventory_items'));
        inventoryItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch {
        // Handle error silently
      }
      
      invoicesSnap.forEach(doc => {
        const data = doc.data();
        if (Array.isArray(data.items)) {
          data.items.forEach((item: FirebaseInvoiceItem) => {
            // البحث عن الصنف لجلب المستويات
            const foundItem = inventoryItems.find(i => i.name === item.itemName);
            // البحث عن اسم الصنف الرئيسي (الأب) واسمه الأعلى (الجد) إذا كان هناك parentId
            let parentName = '';
            let grandParentName = '';
            if (foundItem && foundItem.parentId) {
              const parentItem = inventoryItems.find(i => i.id === foundItem.parentId || i.id === String(foundItem.parentId));
              parentName = parentItem?.name || '';
              if (parentItem && parentItem.parentId) {
                const grandParentItem = inventoryItems.find(i => i.id === parentItem.parentId || i.id === String(parentItem.parentId));
                grandParentName = grandParentItem?.name || '';
              }
            }
            invoicesData.push({
              key: doc.id + '-' + item.itemNumber,
              invoiceNumber: data.invoiceNumber || 'N/A',
              date: data.date || '',
              dueDate: data.dueDate || calculateDueDate(data.date || ''), // إضافة تاريخ الاستحقاق
              branch: data.branch || '',
              itemNumber: item.itemNumber || 'N/A',
              itemName: item.itemName || '',
              mainCategory: parentName,
              firstLevelCategory: grandParentName,
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0,
              total: Number(item.total) || 0,
              discountValue: Number(item.discountValue) || 0,
              discountPercent: Number(item.discountPercent) || 0,
              taxValue: Number(item.taxValue) || 0,
              taxPercent: Number(item.taxPercent) || 0,
              net: (Number(item.total) - Number(item.discountValue) + Number(item.taxValue)) || 0,
              cost: Number(item.cost) || 0,
              profit: (Number(item.total) - Number(item.discountValue) - Number(item.cost)) || 0,
              warehouse: data.warehouse || '',
              customer: data.customerName || '',
              customerPhone: data.customerNumber || '',
              seller: data.delegate || '',
              paymentMethod: data.paymentMethod || '',
              invoiceType: data.type || '',
              itemData: foundItem || {}
            });
          });
        }
      });
      setInvoices(invoicesData);
    } catch (err) {
      console.error('Error fetching invoices:', err);
      message.error('تعذر تحميل سجل الفواتير');
    } finally {
      setInvoicesLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // جلب نسبة الضريبة من إعدادات الشركة (companies)
  useEffect(() => {
    const fetchTaxRate = async () => {
      try {
        const companiesSnap = await getDocs(collection(db, 'companies'));
        if (!companiesSnap.empty) {
          const companyDataFromDb = companiesSnap.docs[0].data();
          if (companyDataFromDb.taxRate) {
            const newTaxRate = String(companyDataFromDb.taxRate);
            // setTaxRate(newTaxRate); // Now handled by hook via companyData
            // تحديث الصنف الحالي بنسبة الضريبة الجديدة
            setItem(prev => ({ ...prev, taxPercent: newTaxRate }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch tax rate from company settings:', err);
      }
    };
    fetchTaxRate();
  }, []);

  // تحديث الصنف عند تحميل الصفحة بنسبة الضريبة
  useEffect(() => {
    setItem(prev => ({ ...prev, taxPercent: taxRate }));
  }, [taxRate]);

  // تشخيص بيانات الفروع
  useEffect(() => {
    console.log('تشخيص الفروع:');
    console.log('عدد الفروع المحملة:', branches.length);
    console.log('بيانات الفروع:', branches.map(b => ({ id: b.id, name: b.name })));
    console.log('الفرع المحدد حالياً:', invoiceData.branch);
  }, [branches, invoiceData.branch]);

  const handleInvoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvoiceData({ ...invoiceData, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    if (invoiceType !== 'ضريبة') {
      setInvoiceData(prev => ({ ...prev, commercialRecord: '', taxFile: '' }));
    }
  }, [invoiceType]);

  const handleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setItem({ ...item, [e.target.name]: e.target.value });
  };

  const fetchLastCustomerPrice = async (customerName: string, itemName: string) => {
    try {
      const salesSnap = await getDocs(collection(db, 'sales_invoices'));
      const filtered = salesSnap.docs
        .map(doc => doc.data())
        .filter(inv => inv.customerName === customerName && Array.isArray(inv.items))
        .flatMap(inv => inv.items.filter((it: FirebaseInvoiceItem) => it.itemName === itemName))
        .sort((a: FirebaseInvoiceItem, b: FirebaseInvoiceItem) => new Date(String(b.date || '')).getTime() - new Date(String(a.date || '')).getTime());
      if (filtered.length > 0) {
        return filtered[0].price;
      }
    } catch (err) {
      // ignore error
    }
    return '';
  };

  const calculateItemValues = (item: InvoiceItem) => {
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.price) || 0);
    const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent) || 0));
    // استخدام نسبة الضريبة من إعدادات الشركة
    const taxPercent = Math.max(0, Number(taxRate) || 0);
    
    const subtotal = price * quantity;
    const discountValue = subtotal * (discountPercent / 100);
    const taxableAmount = subtotal - discountValue;
    const taxValue = taxableAmount * (taxPercent / 100);
    
    return {
      discountValue: parseFloat(discountValue.toFixed(2)),
      taxValue: parseFloat(taxValue.toFixed(2)),
      total: parseFloat(subtotal.toFixed(2))
    };
  };

  const addItem = async () => {
    if (!item.itemName || !item.quantity || !item.price) {
      message.info('يجب إدخال اسم الصنف، الكمية والسعر');
      return;
    }

    if (isNaN(Number(item.quantity)) || isNaN(Number(item.price))) {
      message.info('يجب أن تكون الكمية والسعر أرقاماً صحيحة');
      return;
    }

    if (warehouseMode === 'multiple' && !item.warehouseId) {
      message.info('يرجى اختيار المخزن لهذا الصنف');
      return;
    }

    // Prevent adding items with tempCodes (إيقاف مؤقت) by name or code
    const possibleItems = itemNames.filter(i => i.name === item.itemName || i.itemCode === item.itemNumber);
    if (possibleItems.length === 0) {
      message.info('الصنف غير موجود في قائمة الأصناف!');
      return;
    }
    const stoppedItem = possibleItems.find(i => i.tempCodes === true || String(i.tempCodes).toLowerCase() === 'true');
    if (stoppedItem) {
      console.warn('[SALES] محاولة إضافة صنف موقف مؤقت:', {
        itemName: item.itemName,
        itemNumber: item.itemNumber,
        stoppedItem
      });
      customMessage.warning(`الصنف "${stoppedItem.name}" موقوف مؤقتاً ولا يمكن إضافته للفاتورة`);
      return;
    }

    const selected = possibleItems[0];
    
    // فحص المخزون والسماح بالسالب
    if (!selected.allowNegative) {
      // فحص الكمية المتاحة في المخزون
      const requestedQuantity = Number(item.quantity);
      const warehouseToCheck = warehouseMode === 'multiple' ? item.warehouseId : invoiceData.warehouse;
      
      // فحص المخزون الفعلي
      const availableStock = await checkStockAvailability(item.itemName, warehouseToCheck || '');
      
      if (requestedQuantity > availableStock) {
        customMessage.warning(`الكمية المطلوبة (${requestedQuantity}) أكبر من المتاح في المخزون (${availableStock}) والصنف لا يسمح بالسالب`);
        return;
      }
    }
    
    const { discountValue, taxValue, total } = calculateItemValues(item);
    const mainCategory = selected?.type || '';
    // إذا كان يوجد cost في بيانات الصنف
    const cost = selected && 'cost' in selected && typeof selected.cost !== 'undefined' ? Number(selected.cost) : 0;

    const newItem: InvoiceItem & { warehouseId?: string; mainCategory?: string; cost?: number } = {
      ...item,
      itemNumber: item.itemNumber || 'N/A',
      taxPercent: taxRate, // استخدام نسبة الضريبة من إعدادات الشركة
      discountValue,
      taxValue,
      total,
      mainCategory,
      cost
    };

    let newItems: InvoiceItem[];
    
    // التحقق من أننا في وضع التعديل أم الإضافة
    if (editingItemIndex !== null) {
      // في وضع التعديل - نحديث الصنف الموجود
      newItems = [...items];
      newItems[editingItemIndex] = newItem;
      setEditingItemIndex(null); // إعادة تعيين حالة التعديل
      customMessage.success('تم تحديث الصنف بنجاح');
    } else {
      // في وضع الإضافة - نضيف صنف جديد
      newItems = [...items, newItem];
      customMessage.success('تم إضافة الصنف بنجاح');
    }
    
    setItems(newItems);
    setItem(initialItem);
    updateTotals(newItems);
  };

  // تحديث الإجماليات مع جمع الضريبة
  const updateTotals = (itemsList: InvoiceItem[]) => {
    let totalTax = 0;
    const calculated = itemsList.reduce((acc, item) => {
      // حساب الإجمالي الأساسي للسطر (السعر × الكمية)
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const subtotal = quantity * price;
      
      const discount = item.discountValue || 0;
      const tax = item.taxValue || 0;
      totalTax += tax;
      
      const afterDiscount = subtotal - discount;
      const finalLineTotal = afterDiscount + tax;
      
      return {
        afterDiscount: acc.afterDiscount + afterDiscount,
        afterTax: acc.afterTax + finalLineTotal,
        total: acc.total + subtotal // الإجمالي قبل الخصم والضريبة
      };
    }, { afterDiscount: 0, afterTax: 0, total: 0 });
    setTotals({
      afterDiscount: parseFloat(calculated.afterDiscount.toFixed(2)),
      afterTax: parseFloat(calculated.afterTax.toFixed(2)),
      total: parseFloat(calculated.total.toFixed(2)),
      tax: parseFloat(totalTax.toFixed(2))
    });
  };

  const handleSave = async () => {
    if (items.length === 0) {
      customMessage.error('لا يمكن حفظ فاتورة بدون أصناف');
      return;
    }
    
    // التحقق من صحة التواريخ
    if (invoiceData.date && !validateDate(invoiceData.date)) {
      customMessage.error(`تاريخ الفاتورة خارج نطاق السنة المالية. ${getDateValidationMessage(invoiceData.date)}`);
      return;
    }
    
    if (invoiceData.dueDate && !validateDate(invoiceData.dueDate)) {
      customMessage.error(`تاريخ الاستحقاق خارج نطاق السنة المالية. ${getDateValidationMessage(invoiceData.dueDate)}`);
      return;
    }
    
    // التحقق من الصندوق النقدي إذا كانت طريقة الدفع نقدي
    if (invoiceData.paymentMethod === 'نقدي' && !invoiceData.cashBox) {
      message.error('يجب اختيار الصندوق النقدي عند اختيار الدفع النقدي');
      return;
    }
    
    // التحقق من الدفع المتعدد
    if (multiplePaymentMode) {
      const cashAmount = parseFloat(invoiceData.multiplePayment.cash?.amount || '0');
      const bankAmount = parseFloat(invoiceData.multiplePayment.bank?.amount || '0');
      const cardAmount = parseFloat(invoiceData.multiplePayment.card?.amount || '0');
      const totalPayment = cashAmount + bankAmount + cardAmount;
      const invoiceTotal = totals.afterTax;
      
      if (Math.abs(totalPayment - invoiceTotal) > 0.01) {
        message.error(`مجموع المبالغ (${totalPayment.toFixed(2)}) لا يساوي إجمالي الفاتورة (${invoiceTotal.toFixed(2)})`);
        return;
      }
      
      if (totalPayment === 0) {
        message.error('يجب إدخال مبلغ واحد على الأقل في الدفع المتعدد');
        return;
      }
    }
    
    setLoading(true);
    // حذف الحقول الفارغة من بيانات الفاتورة
    const cleanInvoiceData = Object.fromEntries(
      Object.entries(invoiceData).filter(([_, v]) => v !== '' && v !== undefined && v !== null)
    );
    // توحيد اسم طريقة الدفع مع قائمة طرق الدفع
    let paymentMethodName = cleanInvoiceData.paymentMethod;
    const paymentNames = paymentMethods.map(m => m.name || m.id);
    if (!paymentNames.includes(paymentMethodName)) {
      // إذا لم تكن القيمة موجودة، اختر أول طريقة دفع كافتراضي أو اتركها فارغة
      paymentMethodName = paymentNames[0] || '';
    }
    const invoice: Partial<SavedInvoice> & { createdAt: string; source: string } = {
      ...cleanInvoiceData,
      paymentMethod: paymentMethodName,
      items,
      totals: {
        ...totals
      },
      type: invoiceType,
      createdAt: new Date().toISOString(),
      source: 'sales'
    };

    // Add multiplePayment only if multiplePaymentMode is true
    if (multiplePaymentMode && invoiceData.multiplePayment) {
      invoice.multiplePayment = invoiceData.multiplePayment;
    }
    try {
      if (isEditMode && editingInvoiceId) {
        // تحديث الفاتورة الموجودة
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'sales_invoices', editingInvoiceId), {
          ...invoice,
          updatedAt: new Date().toISOString()
        });
        customMessage.success('تم تحديث الفاتورة بنجاح!');
        
        // العودة إلى صفحة التقارير بعد التحديث
        setTimeout(() => {
          navigate('/reports/invoice');
        }, 1500);
        
      } else {
        // إنشاء فاتورة جديدة
        const { addDoc, collection } = await import('firebase/firestore');
        await addDoc(collection(db, 'sales_invoices'), invoice);
        customMessage.success('تم حفظ الفاتورة بنجاح!');
        
        // إعادة تعيين النموذج للفاتورة الجديدة
        setItems([]);
        setTotals({ afterDiscount: 0, afterTax: 0, total: 0, tax: 0 });
        setMultiplePaymentMode(false);
        // توليد رقم فاتورة جديد بعد الحفظ
        if (branchCode) {
          generateAndSetInvoiceNumber(branchCode);
        } else {
          const newDate = getTodayString();
          setInvoiceData(prev => ({
            ...prev,
            invoiceNumber: '',
            entryNumber: generateEntryNumber(),
            date: newDate,
            paymentMethod: '',
            cashBox: '',
            multiplePayment: {},
            branch: '',
            warehouse: '',
            customerNumber: '',
            customerName: '',
            delegate: '',
            priceRule: '',
            commercialRecord: '',
            taxFile: '',
            dueDate: calculateDueDate(newDate) // إضافة تاريخ الاستحقاق عند الإعادة تعيين
          }));
        }
        // تحديث سجل الفواتير
        await fetchInvoices();
        // حفظ بيانات الفاتورة الأخيرة للمودال
        setLastSavedInvoice(invoice as SavedInvoice);
        setShowPrintModal(true);
      }
      
      // تحديث الأرصدة بعد الحفظ/التحديث
      if (warehouseMode === 'single' && invoiceData.warehouse) {
        await fetchItemStocks(invoiceData.warehouse);
      } else if (warehouseMode === 'multiple') {
        // في حالة المخازن المتعددة، تحديث رصيد كل صنف في مخزنه
        for (const savedItem of items) {
          const itemWithWarehouse = savedItem as InvoiceItem & { warehouseId?: string };
          if (itemWithWarehouse.warehouseId && itemWithWarehouse.itemName) {
            await fetchSingleItemStock(itemWithWarehouse.itemName, itemWithWarehouse.warehouseId);
          }
        }
      }
    } catch (err) {
      console.error('Error saving invoice:', err);
      message.error(err.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const itemColumns = [
    { 
      title: 'كود الصنف', 
      dataIndex: 'itemNumber',
      width: 100,
      align: 'center' as const
    },
    { 
      title: 'اسم الصنف', 
      dataIndex: 'itemName',
      width: 150
    },
    { 
      title: 'الكمية', 
      dataIndex: 'quantity',
      width: 80,
      align: 'center' as const
    },
    { 
      title: 'الوحدة', 
      dataIndex: 'unit',
      width: 80,
      align: 'center' as const
    },
    // إظهار عمود المخزن فقط إذا كان وضع المخزن multiple
    {
      title: 'المخزن',
      dataIndex: 'warehouseId',
      width: 120,
      align: 'center' as const,
      render: (_: string | undefined, record: InvoiceItem & { warehouseId?: string }) => {
        const warehouseId = record.warehouseId || invoiceData.warehouse;
        if (!warehouseId) return '';
        const warehouse = warehouses.find(w => w.id === warehouseId);
        return warehouse ? warehouse.nameAr || warehouse.name || warehouse.id : warehouseId;
      }
    },
    { 
      title: 'السعر', 
      dataIndex: 'price',
      width: 100,
      align: 'center' as const,
      render: (text: string) => `${parseFloat(text).toFixed(2)}`
    },
    { 
      title: '% الخصم', 
      dataIndex: 'discountPercent',
      width: 80,
      align: 'center' as const
    },
    
    { 
      title: 'قيمة الخصم', 
      dataIndex: 'discountValue',
      width: 100,
      align: 'center' as const,
      render: (text: number) => `${text.toFixed(2)}`
    },
    { 
      title: 'الإجمالي بعد الخصم', 
      key: 'netAfterDiscount',
      width: 110,
      align: 'center' as const,
      render: (_: unknown, record: InvoiceItem) => {
        const subtotal = Number(record.price) * Number(record.quantity);
        const discountValue = subtotal * Number(record.discountPercent) / 100;
        return (subtotal - discountValue).toFixed(2);
      }
    },
    { 
      title: '% الضريبة', 
      dataIndex: 'taxPercent',
      width: 80,
      align: 'center' as const
    },
    { 
      title: 'قيمة الضريبة', 
      dataIndex: 'taxValue',
      width: 100,
      align: 'center' as const,
      render: (text: number) => `${text.toFixed(2)}`
    },
    { 
      title: 'الإجمالي', 
      dataIndex: 'total',
      width: 100,
      align: 'center' as const,
      // الإجمالي النهائي = (السعر * الكمية - قيمة الخصم) + قيمة الضريبة
      render: (_: unknown, record: InvoiceItem) => {
        const quantity = Number(record.quantity) || 0;
        const price = Number(record.price) || 0;
        const discountPercent = Number(record.discountPercent) || 0;
        const subtotal = price * quantity;
        const discountValue = subtotal * discountPercent / 100;
        const taxableAmount = subtotal - discountValue;
        const taxPercent = Number(record.taxPercent) || 0;
        const taxValue = taxableAmount * taxPercent / 100;
        const finalTotal = taxableAmount + taxValue;
        return finalTotal.toFixed(2);
      }
    },
    {
      title: 'إجراءات',
      width: 140,
      align: 'center' as const,
      render: (_: unknown, record: InvoiceItem, index: number) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button
            type="text"
            size="small"
            onClick={() => handleEditItem(record, index)}
            style={{
              color: '#1890ff',
              transition: 'transform 0.2s',
            }}
            icon={
              <span style={{ display: 'inline-block', transition: 'transform 0.2s' }} className="action-icon-edit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1890ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19.5 3 21l1.5-4L16.5 3.5z"/></svg>
              </span>
            }
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
          />
          {(
            <Button
              type="text"
              size="small"
              danger
              onClick={() => {
                const newItems = items.filter((_, i) => i !== index);
                setItems(newItems);
                updateTotals(newItems);
              }}
              style={{
                transition: 'transform 0.2s',
              }}
              icon={
                <span style={{ display: 'inline-block', transition: 'transform 0.2s' }} className="action-icon-delete">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4d4f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                </span>
              }
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = 'scale(1)'}
            />
          )}
        </div>
      )
    }
  ];

  // دالة تعبئة بيانات الصنف عند التعديل
  const handleEditItem = (record: InvoiceItem, index: number) => {
    setItem({
      ...record,
      taxPercent: taxRate // استخدام نسبة الضريبة من إعدادات الشركة
    });
    // تحديد الصنف المحدد للتعديل بدلاً من حذفه
    setEditingItemIndex(index);
  };

  const handleEditInvoice = (record: InvoiceRecord & { firstLevelCategory?: string }) => {
    // تعبئة بيانات الفاتورة المختارة في النموذج
    setInvoiceData({
      ...invoiceData,
      ...record,
      delegate: record.delegate || record.seller || '',
      branch: record.branch || '',
      warehouse: record.warehouse || '',
      customerNumber: record.customerNumber || '',
      customerName: record.customerName || record.customer || '',
      priceRule: record.priceRule || '',
      commercialRecord: record.commercialRecord || '',
      taxFile: record.taxFile || '',
      dueDate: record.dueDate || calculateDueDate(record.date || '') // إضافة تاريخ الاستحقاق أو حسابه من التاريخ
    });
    setItems(record.items || []);
    setTotals(record.totals || totals);
    setLastSavedInvoice(record as unknown as SavedInvoice);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteInvoice = async (record: InvoiceRecord & { firstLevelCategory?: string; id?: string }) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    setInvoicesLoading(true);
    try {
      // حذف الفاتورة من قاعدة البيانات (Firebase أو أي مصدر آخر)
      // مثال: await deleteInvoiceById(record.id)
      // إذا كنت تستخدم Firebase:
      if (record.id) {
        const { deleteDoc, doc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await deleteDoc(doc(db, 'salesInvoices', record.id));
        setInvoices(prev => prev.filter(inv => inv.key !== record.key));
      } else {
        setInvoices(prev => prev.filter(inv => inv.invoiceNumber !== record.invoiceNumber));
      }
    } catch (err) {
      alert('حدث خطأ أثناء الحذف');
    } finally {
      setInvoicesLoading(false);
    }
  };

  const invoiceColumns = [
    {
      title: 'رقم الفاتورة',
      dataIndex: 'invoiceNumber',
      key: 'invoiceNumber',
      width: 150,
      fixed: 'left' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.invoiceNumber.localeCompare(b.invoiceNumber)
    },
    {
      title: 'التاريخ',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: 'تاريخ الاستحقاق',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => {
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return dateA - dateB;
      },
      render: (dueDate: string) => dueDate ? dayjs(dueDate).format('YYYY-MM-DD') : ''
    },
    {
      title: 'الفرع',
      dataIndex: 'branch',
      key: 'branch',
      width: 120,
      render: (branchId: string) => {
        const branch = branches.find(b => b.id === branchId);
        return branch ? (branch.name || branch.id) : branchId;
      }
    },
    {
      title: 'كود الصنف',
      dataIndex: 'itemNumber',
      key: 'itemNumber',
      width: 100,
      align: 'center' as const
    },
    {
      title: 'اسم الصنف',
      dataIndex: 'itemName',
      key: 'itemName',
      width: 150
    },
    {
      title: 'المجموعة الرئيسية',
      dataIndex: 'firstLevelCategory',
      key: 'firstLevelCategory',
      width: 150,
      render: (value: string) => value || ''
    },
    {
      title: 'المستوى الأول',
      dataIndex: 'mainCategory',
      key: 'mainCategory',
      width: 150,
      render: (value: string) => value || ''
    },
    {
      title: 'الكمية',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.quantity - b.quantity,
      render: (quantity: number) => Math.round(quantity).toString()
    },
    {
      title: 'السعر',
      dataIndex: 'price',
      key: 'price',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.price - b.price,
      render: (price: number) => price.toFixed(2)
    },
    {
      title: 'الإجمالي',
      dataIndex: 'total',
      key: 'total',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.total - b.total,
      render: (total: number) => total.toFixed(2)
    },
    {
      title: 'قيمة الخصم',
      dataIndex: 'discountValue',
      key: 'discountValue',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.discountValue - b.discountValue,
      render: (discount: number) => discount.toFixed(2)
    },
    {
      title: '% الخصم',
      dataIndex: 'discountPercent',
      key: 'discountPercent',
      width: 80,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.discountPercent - b.discountPercent,
      render: (percent: number) => percent.toFixed(2)
    },
    {
      title: 'قيمة الضريبة',
      dataIndex: 'taxValue',
      key: 'taxValue',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.taxValue - b.taxValue,
      render: (tax: number) => tax.toFixed(2)
    },
    {
      title: '% الضريبة',
      dataIndex: 'taxPercent',
      key: 'taxPercent',
      width: 80,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.taxPercent - b.taxPercent,
      render: (percent: number) => percent.toFixed(2)
    },
    {
      title: 'الصافي',
      dataIndex: 'net',
      key: 'net',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.net - b.net,
      render: (net: number) => net.toFixed(2)
    },
    {
      title: 'التكلفة',
      dataIndex: 'cost',
      key: 'cost',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.cost - b.cost,
      render: (cost: number) => cost.toFixed(2)
    },
    {
      title: 'ربح الصنف',
      dataIndex: 'profit',
      key: 'profit',
      width: 100,
      align: 'center' as const,
      sorter: (a: InvoiceRecord, b: InvoiceRecord) => a.profit - b.profit,
      render: (profit: number) => profit.toFixed(2)
    },
    {
      title: 'المخزن',
      dataIndex: 'warehouse',
      key: 'warehouse',
      width: 120
    ,
      render: (warehouseId: string) => {
        const warehouse = warehouses.find(w => w.id === warehouseId);
        return warehouse ? (warehouse.nameAr || warehouse.name || warehouse.id) : warehouseId;
      }
    },
    {
      title: 'العميل',
      dataIndex: 'customer',
      key: 'customer',
      width: 150
    },
    {
      title: 'تليفون العميل',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 120
    },
    {
      title: 'البائع',
      dataIndex: 'seller',
      key: 'seller',
      width: 150,
      render: (seller: string) => getDelegateName(seller)
    },
    {
      title: 'طريقة الدفع',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120
    },
    {
      title: 'نوع الفاتورة',
      dataIndex: 'invoiceType',
      key: 'invoiceType',
      width: 120,
      render: (type: string) => type === 'ضريبة' ? 'ضريبة' : 'ضريبة مبسطة'
    },
    // ...existing code...
    {
      title: 'إجراءات',
      key: 'actions',
      width: 120,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_: unknown, record: InvoiceRecord & { firstLevelCategory?: string }) => (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Button
            danger
            size="small"
            onClick={() => handleDeleteInvoice(record)}
            style={{ fontWeight: 600 }}
          >
            حذف
          </Button>
        </div>
      )
    },
  ];

  // تعريف الدالة خارج useEffect
  const fetchLists = useCallback(async () => {
    try {
      setFetchingItems(true);
      // Use the optimized hook's fetch function instead of manual state setting
      await fetchBasicData();
      
      // جلب الفروع
      const branchesSnap = await getDocs(collection(db, 'branches'));
      // setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Now handled by hook
      // جلب طرق الدفع
      const paymentSnap = await getDocs(collection(db, 'paymentMethods'));
      // setPaymentMethods(paymentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Now handled by hook
      // جلب الصناديق النقدية
      const cashBoxesData = await fetchCashBoxes();
      // setCashBoxes(cashBoxesData); // Now handled by hook
      // جلب البنوك
      const banksData = await fetchBankAccounts();
      setBanks(banksData);
      // جلب العملاء من صفحة العملاء (collection: 'customers')
      const customersSnap = await getDocs(collection(db, 'customers'));
      // setCustomers(customersSnap.docs.map(doc => { // Now handled by hook
      //   const data = doc.data();
      //   return { id: doc.id, ...data, taxFile: data.taxFile || '' };
      // }));
      // جلب المخازن
      const warehousesSnap = await getDocs(collection(db, 'warehouses'));
      // setWarehouses(warehousesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))); // Now handled by hook
      // جلب البائعين النشطين فقط
      console.log('جاري تحميل المندوبين من قاعدة البيانات...');
      const delegatesQuery = query(
        collection(db, 'salesRepresentatives'),
        where('status', '==', 'active')
      );
      const delegatesSnap = await getDocs(delegatesQuery);
      const delegatesData = delegatesSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      console.log('تم تحميل المندوبين بنجاح:', delegatesData.length, 'مندوب');
      console.log('قائمة المندوبين:', delegatesData.map(d => ({ id: d.id, data: d })));
      // setDelegates(delegatesData); // Now handled by hook
      // قوائم ثابتة
      // setUnits(['قطعة', 'كرتونة', 'كيلو', 'جرام', 'لتر', 'متر', 'علبة']); // Now handled by hook
      setPriceRules(['السعر العادي', 'سعر الجملة', 'سعر التخفيض']);
      // جلب الأصناف
      const itemsSnap = await getDocs(collection(db, 'inventory_items'));
      const allItemsData = itemsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          itemCode: data.itemCode || '',
          salePrice: data.salePrice || 0,
          discount: data.discount || 0,
          isVatIncluded: data.isVatIncluded || false,
          type: data.type || '',
          tempCodes: data.tempCodes || false,
          allowNegative: data.allowNegative || false
        };
      }).filter(item => item.name);
      
      // حفظ جميع الأصناف للاستخدام في النماذج
      setAllItems(allItemsData);
      
      // فلترة أصناف المستوى الثاني للعرض في قائمة المبيعات (مع الموقوفة مؤقتاً للإشارة)
      const secondLevelItems = allItemsData.filter(item => item.type === 'مستوى ثاني');
      // setItemNames(secondLevelItems); // Now handled by hook via fetchBasicData
    } catch (err) {
      console.error('Error fetching lists:', err);
      customMessage.error('تعذر تحميل القوائم من قاعدة البيانات');
    } finally {
      setFetchingItems(false);
    }
  }, [setFetchingItems, customMessage, fetchBasicData]);
  
  // دالة تحميل الفاتورة للتعديل
  const loadInvoiceForEdit = useCallback(async (invoiceNumber: string) => {
    console.log('بدء تحميل الفاتورة:', invoiceNumber);
    setFetchingItems(true);
    try {
      // البحث عن الفاتورة في مجموعة sales_invoices
      const salesQuery = query(
        collection(db, 'sales_invoices'),
        where('invoiceNumber', '==', invoiceNumber)
      );
      console.log('تنفيذ الاستعلام...');
      const salesSnapshot = await getDocs(salesQuery);
      console.log('عدد النتائج:', salesSnapshot.docs.length);
      
      if (!salesSnapshot.empty) {
        const invoiceDoc = salesSnapshot.docs[0];
        const invoiceData = invoiceDoc.data();
        console.log('بيانات الفاتورة المحملة:', invoiceData);
        console.log('جميع مفاتيح البيانات:', Object.keys(invoiceData));
        setEditingInvoiceId(invoiceDoc.id);
        
        // تحميل بيانات الفاتورة
        const newInvoiceData = {
          invoiceNumber: invoiceData.invoiceNumber || '',
          entryNumber: invoiceData.entryNumber || '',
          date: invoiceData.date || dayjs().format('YYYY-MM-DD'),
          dueDate: invoiceData.dueDate || '',
          paymentMethod: invoiceData.paymentMethod || '',
          cashBox: invoiceData.cashBox || '',
          multiplePayment: invoiceData.multiplePayment || {
            enabled: false,
            payments: []
          },
          branch: invoiceData.branch || '',
          warehouse: invoiceData.warehouse || '',
          customerNumber: invoiceData.customerPhone || invoiceData.customerNumber || invoiceData.phone || invoiceData.mobile || '',
          customerName: invoiceData.customer || invoiceData.customerName || '',
          delegate: invoiceData.delegate || invoiceData.seller || '',
          priceRule: invoiceData.priceRule || 'بيع',
          commercialRecord: invoiceData.commercialRecord || invoiceData.commercialReg || '',
          taxFile: invoiceData.taxFile || invoiceData.taxFileNumber || ''
        };
        console.log('بيانات الفاتورة المعدلة:', newInvoiceData);
        setInvoiceData(newInvoiceData);
        
        // تحميل الأصناف
        console.log('تحميل الأصناف...', invoiceData.items);
        if (invoiceData.items && Array.isArray(invoiceData.items)) {
          const loadedItems = invoiceData.items.map((item: {
            itemNumber?: string;
            itemName?: string;
            quantity?: number | string;
            unit?: string;
            price?: number | string;
            discountPercent?: number | string;
            discountValue?: number;
            taxPercent?: number | string;
            taxValue?: number;
            total?: number;
          }, index: number) => ({
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            quantity: String(item.quantity || '1'),
            unit: item.unit || 'قطعة',
            price: String(item.price || '0'),
            discountPercent: String(item.discountPercent || '0'),
            discountValue: Number(item.discountValue || 0),
            taxPercent: String(item.taxPercent || '0'),
            taxValue: Number(item.taxValue || 0),
            total: Number(item.total || 0),
            isNewItem: false
          }));
          console.log('الأصناف المحملة:', loadedItems);
          setItems(loadedItems);
          // تحديث الإجماليات بعد تحميل الأصناف
          updateTotals(loadedItems);
        } else {
          console.log('لا توجد أصناف في الفاتورة');
          // إعادة تعيين الإجماليات إلى الصفر عند عدم وجود أصناف
          setTotals({
            afterDiscount: 0,
            afterTax: 0,
            total: 0,
            tax: 0
          });
        }
        
        // تحديث العنوان ليشير إلى وضع التعديل
        setIsEditMode(true);
        customMessage.success(`تم تحميل الفاتورة رقم ${invoiceNumber} للتعديل`);
        
      } else {
        customMessage.error(`لم يتم العثور على الفاتورة رقم ${invoiceNumber}`);
        navigate('/reports/invoice');
      }
      
    } catch (error) {
      console.error('خطأ في تحميل الفاتورة:', error);
      customMessage.error('حدث خطأ أثناء تحميل الفاتورة');
      navigate('/reports/invoice');
    } finally {
      setFetchingItems(false);
    }
  }, [customMessage, navigate, setFetchingItems, setItems, setInvoiceData, setEditingInvoiceId, setIsEditMode]);
  
  useEffect(() => {
    fetchLists();
  }, [fetchLists]);
  
  // تحميل الفاتورة للتعديل عند وجود معامل في URL
  useEffect(() => {
    console.log('useEffect للتحميل - invoiceNumberParam:', invoiceNumberParam, 'isEditMode:', isEditMode);
    if (invoiceNumberParam) {
      console.log('شرط التحميل محقق، بدء التحميل...');
      setIsEditMode(true);
      loadInvoiceForEdit(invoiceNumberParam);
    } else {
      console.log('شرط التحميل غير محقق');
    }
  }, [invoiceNumberParam, isEditMode, loadInvoiceForEdit]);

  // تحديد المندوب الافتراضي بناءً على المستخدم الحالي
  useEffect(() => {
    console.log('useEffect للمندوب الافتراضي - المندوبين:', delegates.length, 'المستخدم UID:', user?.uid, 'المندوب الحالي:', invoiceData.delegate, 'isEditMode:', isEditMode);
    // لا تعيد تعيين المندوب في وضع التعديل
    if (delegates.length > 0 && user?.uid && !invoiceData.delegate && !isEditMode) {
      // البحث عن المندوب المطابق للمستخدم الحالي
      const currentUserDelegate = delegates.find(delegate => delegate.uid === user.uid);
      if (currentUserDelegate) {
        console.log('تم العثور على المندوب المطابق للمستخدم:', currentUserDelegate.name);
        setInvoiceData(prev => ({
          ...prev,
          delegate: currentUserDelegate.id
        }));
      } else {
        // في حالة عدم العثور على مندوب مطابق، اختر أول مندوب نشط
        const firstActiveDelegate = delegates.find(delegate => delegate.status === 'active');
        if (firstActiveDelegate) {
          console.log('تم اختيار أول مندوب نشط:', firstActiveDelegate.name);
          setInvoiceData(prev => ({
            ...prev,
            delegate: firstActiveDelegate.id
          }));
        } else {
          console.log('لم يتم العثور على أي مندوب نشط');
        }
      }
    }
  }, [delegates, user?.uid, invoiceData.delegate, isEditMode]);

  // دالة للحصول على اسم المندوب من ID
  const getDelegateName = (delegateId: string) => {
    if (!delegateId) return '';
    const delegate = delegates.find(d => d.id === delegateId);
    const name = delegate?.name || delegate?.email || delegateId;
    console.log('البحث عن مندوب بـ ID:', delegateId, 'النتيجة:', name);
    return name;
  };

  // حساب الإجماليات باستخدام useMemo لتحسين الأداء
  const totalsDisplay = useMemo(() => ({
    total: totals.total.toFixed(2),
    discount: (totals.total - totals.afterDiscount).toFixed(2),
    afterDiscount: totals.afterDiscount.toFixed(2),
    tax: totals.tax.toFixed(2), // الضريبة الفعلية
    net: totals.afterTax.toFixed(2) // الصافي = الاجمالي بعد الخصم + الضريبة
  }), [totals]);

  // حالة إظهار/إخفاء جدول سجل الفواتير
  const [showInvoicesTable, setShowInvoicesTable] = useState(false);

  // حالة مودال البحث عن عميل
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchText, setCustomerSearchText] = useState('');
  
  // حالة مودال الإضافة السريعة للعميل
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const [quickCustomerForm, setQuickCustomerForm] = useState({
    nameAr: '',
    phone: ''
  });

  // تصفية العملاء حسب البحث
  const filteredCustomers = useMemo(() => {
    if (!customerSearchText) return customers;
    const search = customerSearchText.toLowerCase();
    return customers.filter(c =>
      (c.nameAr && c.nameAr.toLowerCase().includes(search)) ||
      (c.nameEn && c.nameEn.toLowerCase().includes(search)) ||
      (c.phone && c.phone.toLowerCase().includes(search)) ||
      (c.mobile && c.mobile.toLowerCase().includes(search)) ||
      (c.phoneNumber && c.phoneNumber.toLowerCase().includes(search)) ||
      (c.commercialReg && c.commercialReg.toLowerCase().includes(search)) ||
      (c.taxFile && c.taxFile.toLowerCase().includes(search))
    );
  }, [customerSearchText, customers]);

  // دالة طباعة الفاتورة
const handlePrint = () => {
    // جلب بيانات الشركة من الإعدادات
    (async () => {
      let companyData: CompanyData = {
        arabicName: '',
        englishName: '',
        logoUrl: '',
        commercialRegistration: '',
        taxFile: '',
        registrationDate: '',
        issuingAuthority: '',
        companyType: '',
        activityType: '',
        nationality: '',
        city: '',
        region: '',
        street: '',
        district: '',
        buildingNumber: '',
        postalCode: '',
        countryCode: '',
        phone: '',
        mobile: '',
        fiscalYear: '',
        taxRate: '',
        website: '',
      };
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const companiesSnap = await getDocs(collection(db, 'companies'));
        if (!companiesSnap.empty) {
          companyData = { ...companyData, ...companiesSnap.docs[0].data() };
        }
      } catch {
        // Ignore error silently
      }

      const invoice = lastSavedInvoice;
      if (!invoice) {
        message.error('لا توجد فاتورة للطباعة');
        return;
      }

      // Generate QR code data URL (using qrcode library)
      let qrDataUrl = '';
      try {
        // Dynamically import qrcode library
        const QRCode = (await import('qrcode')).default;
        // You can customize the QR content as needed (e.g., invoice number, company, total, date)
        const qrContent = JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          company: companyData.arabicName,
          date: invoice.date,
          total: invoice.totals?.afterTax
        });
        qrDataUrl = await QRCode.toDataURL(qrContent, { width: 120, margin: 1 });
      } catch (e) {
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
      
      // إضافة محتوى الفاتورة
      printContainer.innerHTML = `
        <html>
        <head>
          <title>فاتورة ضريبية | Tax Invoice</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 10mm; }
            @media print {
              body { margin: 0; padding: 5mm; }
              * { -webkit-print-color-adjust: exact; color-adjust: exact; }
            }
            body {
              font-family: 'Tajawal', sans-serif;
              direction: rtl;
              padding: 5mm;
              color: #000;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 5mm;
              border-bottom: 1px solid #000;
              padding-bottom: 3mm;
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
              font-size: 13px;
              font-weight: 500;
              line-height: 1.5;
            }
            .company-info-en {
              text-align: left;
              font-family: Arial, sans-serif;
              direction: ltr;
              font-size: 12px;
              font-weight: 500;
              line-height: 1.5;
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
              margin-bottom: 10px;
              gap: 16px;
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
            .invoice-title { text-align: center; font-size: 16px; font-weight: bold; margin: 5mm 0; border: 1px solid #000; padding: 2mm; background-color: #f3f3f3; }
            .customer-info { margin-bottom: 5mm; border: 1px solid #ddd; padding: 3mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; font-size: 11px; }
            th, td { border: 1px solid #000; padding: 2mm; text-align: center; }
            th {
              background-color: #305496;
              color: #fff;
              font-weight: bold;
              font-size: 12.5px;
              letter-spacing: 0.5px;
            }
            .totals { margin-top: 5mm; border-top: 1px solid #000; padding-top: 3mm; font-weight: bold; }
            .policy { font-size: 10px; border: 1px solid #ddd; padding: 3mm; }
            .policy-title { font-weight: bold; margin-bottom: 2mm; }
            .signature { margin-top: 5mm; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 3mm; }
            .footer { margin-top: 5mm; text-align: center; font-size: 10px; }
            .totals-policy-row {
              display: flex;
              flex-direction: row;
              flex-wrap: nowrap !important;
              justify-content: flex-end;
              align-items: flex-start;
              gap: 24px;
              margin-top: 5mm;
            }
            @media print {
              .totals-policy-row {
                display: flex !important;
                flex-direction: row !important;
                flex-wrap: nowrap !important;
                justify-content: flex-end !important;
                align-items: flex-start !important;
                gap: 24px !important;
                margin-top: 5mm !important;
              }
              .policy { margin-top: 0 !important; }
            }
          </style>
        </head>
        <body>
          <!-- Header Section: Arabic (right), Logo (center), English (left) -->
          <div class="header">
            <div class="header-section company-info-ar">
              <div>${companyData.arabicName || ''}</div>
              <div>${companyData.companyType || ''}</div>
              <div>السجل التجاري: ${companyData.commercialRegistration || ''}</div>
              <div>الملف الضريبي: ${companyData.taxFile || ''}</div>
              <div>العنوان: ${companyData.city || ''} ${companyData.region || ''} ${companyData.street || ''} ${companyData.district || ''} ${companyData.buildingNumber || ''}</div>
              <div>الرمز البريدي: ${companyData.postalCode || ''}</div>
              <div>الهاتف: ${companyData.phone || ''}</div>
              <div>الجوال: ${companyData.mobile || ''}</div>
            </div>
            <div class="header-section center">
              <img src="${companyData.logoUrl || 'https://via.placeholder.com/100x50?text=Company+Logo'}" class="logo" alt="Company Logo">
              <div style="text-align: center;  font-size: 12px; margin-top: 8px; padding: 4px 8px; border-radius: 4px;">
                ${invoiceType || 'فاتورة مبيعات'}
              </div>
            </div>
            <div class="header-section company-info-en">
              <div>${companyData.englishName || ''}</div>
              <div>${companyData.companyType || ''}</div>
              <div>Commercial Reg.: ${companyData.commercialRegistration || ''}</div>
              <div>Tax File: ${companyData.taxFile || ''}</div>
              <div>Address: ${companyData.city || ''} ${companyData.region || ''} ${companyData.street || ''} ${companyData.district || ''} ${companyData.buildingNumber || ''}</div>
              <div>Postal Code: ${companyData.postalCode || ''}</div>
              <div>Phone: ${companyData.phone || ''}</div>
              <div>Mobile: ${companyData.mobile || ''}</div>
            </div>
          </div>
          <!-- Info Row Section: Invoice info (right), QR (center), Customer info (left) -->
          <div class="info-row-container">
            <table class="info-row-table right">
              <tr><td class="label">طريقة الدفع</td><td class="value">${invoice.paymentMethod || ''}</td></tr>
              <tr><td class="label">رقم الفاتورة</td><td class="value">${invoice.invoiceNumber || ''}</td></tr>
              <tr><td class="label">تاريخ الفاتورة</td><td class="value">${invoice.date || ''}</td></tr>
              <tr><td class="label">تاريخ الاستحقاق</td><td class="value">${invoice.dueDate || ''}</td></tr>
            </table>
            <div class="qr-center">
              <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">
                ${(() => {
                  const branch = (typeof branches !== 'undefined' && Array.isArray(branches))
                    ? branches.find(b => b.id === invoice.branch)
                    : null;
                  return branch ? (branch.name || branch.id) : (invoice.branch || '');
                })()}
              </div>
              <div class="qr-code">
                <img src="${qrDataUrl}" alt="QR Code" style="width:80px;height:80px;" /><br>
               </div>
            </div>
            <table class="info-row-table left">
              <tr><td class="label">اسم العميل</td><td class="value">${invoice.customerName || ''}</td></tr>
              <tr><td class="label">رقم الجوال</td><td class="value">${invoice.customerNumber || ''}</td></tr>
              <tr><td class="label">م.ض</td><td class="value">${invoice.taxFile || ''}</td></tr>
              <tr><td class="label">عنوان العميل</td><td class="value">${invoice.customerAddress || ''}</td></tr>
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
                <th>السعر</th>
                <th>نسبة الخصم %</th>
                <th>مبلغ الخصم</th>
                <th>الإجمالي قبل الضريبة</th>
                <th>قيمة الضريبة</th>
                <th>الإجمالي شامل الضريبة</th>
                <th>المخزن</th>
              </tr>
            </thead>
            <tbody>
              ${(invoice.items || []).map((it: InvoiceItem & { warehouseId?: string }, idx: number) => {
                const subtotal = Number(it.price) * Number(it.quantity);
                const discountValue = Number(it.discountValue) || 0;
                const taxValue = Number(it.taxValue) || 0;
                const afterDiscount = subtotal - discountValue;
                const net = afterDiscount + taxValue;
                const warehouseId = it.warehouseId || invoice.warehouse;
                const warehouseObj = Array.isArray(warehouses) ? warehouses.find(w => w.id === warehouseId) : null;
                const warehouseName = warehouseObj ? (warehouseObj.nameAr || warehouseObj.name || warehouseObj.id) : (warehouseId || '');
                return `<tr>
                  <td>${idx + 1}</td>
                  <td>${it.itemNumber || ''}</td>
                  <td>${it.itemName || ''}</td>
                  <td>${it.quantity || ''}</td>
                  <td>${Number(it.price).toFixed(2)}</td>
                  <td>${it.discountPercent || '0'}</td>
                  <td>${discountValue.toFixed(2)}</td>
                  <td>${afterDiscount.toFixed(2)}</td>
                  <td>${taxValue.toFixed(2)}</td>
                  <td>${net.toFixed(2)}</td>
                  <td>${warehouseName}</td>
                </tr>`;
              }).join('')}
            </tbody>
            <!-- Summary Row -->
            <tfoot>
              <tr style="background:#f3f3f3; font-weight:bold;">
                <td colspan="6" style="text-align:right; font-weight:bold; color:#000;">الإجماليات:</td>
                <td style="color:#dc2626; font-weight:bold;">
                  ${(() => {
                    // إجمالي الخصم
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it: InvoiceItem) => { total += Number(it.discountValue) || 0; });
                    return total.toFixed(2);
                  })()}
                </td>
                <td style="color:#ea580c; font-weight:bold;">
                  ${(() => {
                    // إجمالي قبل الضريبة
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it: InvoiceItem) => {
                      const subtotal = Number(it.price) * Number(it.quantity);
                      const discountValue = Number(it.discountValue) || 0;
                      total += subtotal - discountValue;
                    });
                    return total.toFixed(2);
                  })()}
                </td>
                <td style="color:#9333ea; font-weight:bold;">
                  ${(() => {
                    // إجمالي الضريبة
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it: InvoiceItem) => { total += Number(it.taxValue) || 0; });
                    return total.toFixed(2);
                  })()}
                </td>
                <td style="color:#059669; font-weight:bold;">
                  ${(() => {
                    // إجمالي النهائي
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it: InvoiceItem) => {
                      const subtotal = Number(it.price) * Number(it.quantity);
                      const discountValue = Number(it.discountValue) || 0;
                      const taxValue = Number(it.taxValue) || 0;
                      total += (subtotal - discountValue + taxValue);
                    });
                    return total.toFixed(2);
                  })()}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
          <!-- Totals and Policies Section side by side -->
          <div class="totals-policy-row">
           <div style="flex: 1 1 340px; min-width: 260px; max-width: 600px;">
              <div class="policy">
                <div class="policy-title">سياسة الاستبدال والاسترجاع:</div>
                <div>1- يستوجب أن يكون المنتج بحالته الأصلية بدون أي استعمال وبكامل اكسسواراته وبالتعبئة الأصلية.</div>
                <div>2- البضاعة المباعة ترد أو تستبدل خلال ثلاثة أيام من تاريخ استلام العميل للمنتج مع إحضار أصل الفاتورة وتكون البضاعة بحالة سليمة ومغلقة.</div>
                <div>3- يتحمل العميل قيمة التوصيل في حال إرجاع الفاتورة ويتم إعادة المبلغ خلال 3 أيام عمل.</div>
                <div>4- ${companyData.arabicName || 'الشركة'} غير مسؤولة عن تسليم البضاعة بعد 10 أيام من تاريخ الفاتورة.</div>
                <div class="policy-title" style="margin-top: 3mm;">سياسة التوصيل:</div>
                <div>1- توصيل الطلبات من 5 أيام إلى 10 أيام عمل.</div>
                <div>2- الحد المسموح به للتوصيل هو الدور الأرضي كحد أقصى، وفي حال رغبة العميل بالتوصيل لأعلى من الحد المسموح به، يتم ذلك بواسطة العميل.</div>
                <div>3- يتم التوصيل حسب جدول المواعيد المحدد من ${companyData.arabicName || 'الشركة'}، كما أن ${companyData.arabicName || 'الشركة'} غير مسؤولة عن أي أضرار ناتجه بسبب التأخير او تأجيل موعد التوصيل.</div>
                <div>4- يستوجب فحص المنتج أثناء استلامه مع التوقيع باستلامه، وعدم الفحص يسقط حق العميل في المطالبة بالاسترجاع او الاستبدال في حال وجود كسر.</div>
                <div>5- لايوجد لدينا تركيب الضمان هو ضمان ${companyData.arabicName || 'الشركة'}، كما أن الضمان لا يشمل سوء الاستخدام الناتج من العميل.</div>
              </div>
            </div>
            <div style="flex: 0 0 320px; max-width: 340px; min-width: 220px;">
              <table style="border:1.5px solid #000; border-radius:6px; font-size:13px; min-width:220px; max-width:320px; margin-left:0; margin-right:0; border-collapse:collapse; box-shadow:none; width:100%;">
                <tbody>
                  <tr>
                    <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">إجمالى الفاتورة</td>
                    <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${invoice.totals?.total?.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">مبلغ الخصم</td>
                    <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${(invoice.totals?.total - invoice.totals?.afterDiscount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">الاجمالى بعد الخصم</td>
                    <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${invoice.totals?.afterDiscount?.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">الضريبة (${invoice.items && invoice.items[0] ? (invoice.items[0].taxPercent || 0) : 0}%)</td>
                    <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${(invoice.totals?.afterTax - invoice.totals?.afterDiscount).toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">الاجمالى النهايي</td>
                    <td style="text-align:left; font-weight:700; border:1px solid #000; background:#fff;">${invoice.totals?.afterTax?.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
              <!-- Payment Method Table -->
              <table style="border:1.5px solid #000; border-radius:6px; font-size:13px; min-width:220px; max-width:320px; margin-left:0; margin-right:0; margin-top:10px; border-collapse:collapse; box-shadow:none; width:100%;">
                <thead>
                  <tr>
                    <td colspan="2" style="font-weight:bold; color:#fff; text-align:center; padding:7px 12px; border:1px solid #000; background:#305496;">تفاصيل طريقة الدفع</td>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    if (invoice.paymentMethod === 'متعدد' && invoice.multiplePayment) {
                      let paymentRows = '';
                      const multiplePayment = invoice.multiplePayment;
                      
                      // النقدي
                      if (multiplePayment.cash && parseFloat(multiplePayment.cash.amount || '0') > 0) {
                        const cashBoxId = multiplePayment.cash.cashBoxId || '';
                        // البحث عن اسم الصندوق من قائمة الصناديق
                        const cashBoxObj = Array.isArray(cashBoxes) ? cashBoxes.find(cb => cb.id === cashBoxId) : null;
                        const cashBoxName = cashBoxObj ? cashBoxObj.nameAr : cashBoxId;
                        paymentRows += `
                          <tr>
                            <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">نقدي${cashBoxName ? ' - ' + cashBoxName : ''}</td>
                            <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${parseFloat(multiplePayment.cash.amount || '0').toFixed(2)}</td>
                          </tr>`;
                      }
                      
                      // البنك
                      if (multiplePayment.bank && parseFloat(multiplePayment.bank.amount || '0') > 0) {
                        const bankId = multiplePayment.bank.bankId || '';
                        // البحث عن اسم البنك من قائمة البنوك
                        const bankObj = Array.isArray(banks) ? banks.find(b => b.id === bankId) : null;
                        const bankName = bankObj ? bankObj.arabicName : bankId;
                        paymentRows += `
                          <tr>
                            <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">تحويل بنكي${bankName ? ' - ' + bankName : ''}</td>
                            <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${parseFloat(multiplePayment.bank.amount || '0').toFixed(2)}</td>
                          </tr>`;
                      }
                      
                      // الشبكة
                      if (multiplePayment.card && parseFloat(multiplePayment.card.amount || '0') > 0) {
                        const cardBankId = multiplePayment.card.bankId || '';
                        // البحث عن اسم البنك من قائمة البنوك
                        const cardBankObj = Array.isArray(banks) ? banks.find(b => b.id === cardBankId) : null;
                        const cardBankName = cardBankObj ? cardBankObj.arabicName : cardBankId;
                        paymentRows += `
                          <tr>
                            <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">شبكة${cardBankName ? ' - ' + cardBankName : ''}</td>
                            <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${parseFloat(multiplePayment.card.amount || '0').toFixed(2)}</td>
                          </tr>`;
                      }
                      
                      return paymentRows || `
                        <tr>
                          <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">لا توجد بيانات</td>
                          <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">0.00</td>
                        </tr>`;
                    } else {
                      // طريقة دفع واحدة
                      let paymentLabel = invoice.paymentMethod || 'غير محدد';
                      
                      // إضافة اسم الصندوق النقدي إذا كانت طريقة الدفع نقدي
                      if (invoice.paymentMethod === 'نقدي' && invoice.cashBox) {
                        // البحث عن اسم الصندوق من قائمة الصناديق
                        const cashBoxObj = Array.isArray(cashBoxes) ? cashBoxes.find(cb => cb.id === invoice.cashBox || cb.nameAr === invoice.cashBox) : null;
                        const cashBoxName = cashBoxObj ? cashBoxObj.nameAr : invoice.cashBox;
                        paymentLabel = `نقدي - ${cashBoxName}`;
                      }
                      
                      return `
                        <tr>
                          <td style="font-weight:bold; color:#000; text-align:right; padding:7px 12px; border:1px solid #000; background:#fff;">${paymentLabel}</td>
                          <td style="text-align:left; font-weight:500; border:1px solid #000; background:#fff;">${invoice.totals?.afterTax?.toFixed(2) || '0.00'}</td>
                        </tr>`;
                    }
                  })()}
                </tbody>
              </table>
            </div>
           
          </div>
          <!-- Signature Section -->
          <div class="signature">
            <div class="signature-box">
              <div>اسم العميل: ${invoice.customerName || ''}</div>
              <div>التوقيع: ___________________</div>
            </div>
            <div class="signature-box" style="position:relative;">
              <div>البائع: ${getDelegateName(invoice.delegate || '')}</div>
              <div>التاريخ: ${invoice.date || ''}</div>
              <!-- Decorative Stamp -->
              <div style="
                margin-top:18px;
                display:flex;
                justify-content:center;
                align-items:center;
                width:160px;
                height:60px;
                border:2.5px dashed #888;
                border-radius:50%;
                box-shadow:0 2px 8px 0 rgba(0,0,0,0.08);
                opacity:0.85;
                background: repeating-linear-gradient(135deg, #f8f8f8 0 8px, #fff 8px 16px);
                font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
                font-size:15px;
                font-weight:bold;
                color:#222;
                letter-spacing:1px;
                text-align:center;
                position:absolute;
                left:50%;
                transform:translateX(-50%);
                bottom:-80px;
                z-index:2;
              ">
                <div style="width:100%;">
                  <div style="font-size:16px; font-weight:700;">${companyData.arabicName || 'الشركة'}</div>
                  <div style="font-size:13px; font-weight:500; margin-top:2px;">${companyData.phone ? 'هاتف: ' + companyData.phone : ''}</div>
                </div>
              </div>
            </div>
          </div>
          <!-- Footer -->
          <div class="footer">
            ${companyData.website ? `لزيارة متجرنا الإلكتروني / Visit our e-shop: ${companyData.website}` : ''}
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
          }
        }
      `;
      document.head.appendChild(printStyleElement);

      // تأخير قليل للتأكد من تحميل المحتوى
      setTimeout(() => {
        try {
          // بدء عملية الطباعة
          window.print();
        } catch (error) {
          message.error('حدث خطأ أثناء الطباعة');
          console.error('Print error:', error);
        } finally {
          // تنظيف العناصر المؤقتة
          setTimeout(() => {
            if (printContainer.parentNode) {
              printContainer.parentNode.removeChild(printContainer);
            }
            if (printStyleElement.parentNode) {
              printStyleElement.parentNode.removeChild(printStyleElement);
            }
          }, 1000);
        }
      }, 100);
    })();
};

  // ref for item name select
  const itemNameSelectRef = React.useRef<React.ComponentRef<typeof Select>>(null);

  // الحالة الأولية لنموذج إضافة صنف جديد
  const [addItemForm, setAddItemForm] = useState({
    name: '',
    itemCode: '',
    purchasePrice: '',
    salePrice: '',
    minOrder: '',
    discount: '',
    allowNegative: false,
    isVatIncluded: false,
    tempCodes: false,
    supplier: '',
    unit: '',
    type: '', // مهم لظهور اختيار المستوى الأول
    parentId: '' // مهم لربط المستوى الأول
  });

  const handleAddItem = async () => {
    // التحقق من وجود مخازن متاحة للمبيعات
    const availableWarehouses = filterWarehousesForSales(warehouses, invoiceData.branch);
    if (availableWarehouses.length === 0) {
      if (typeof message !== 'undefined' && message.warning) {
        message.warning('لا توجد مخازن متاحة للمبيعات. يرجى التحقق من صلاحيات المخازن.');
      } else {
        alert('لا توجد مخازن متاحة للمبيعات');
      }
      return;
    }

    // لا تضف إذا لم يتم اختيار اسم صنف
    if (!item.itemName) {
      if (typeof message !== 'undefined' && message.info) {
        message.info('يرجى اختيار اسم الصنف أولاً');
      } else {
        alert('يرجى اختيار اسم الصنف أولاً');
      }
      return;
    }
    await addItem();
    // إعادة تعيين الصنف مع الضريبة الثابتة من الإعدادات
    setItem({
      ...initialItem,
      taxPercent: taxRate,
      quantity: '1'
    });
    // إعادة تعيين حالة التعديل
    setEditingItemIndex(null);
    setTimeout(() => {
      itemNameSelectRef.current?.focus?.();
    }, 100); // تأخير بسيط لضمان إعادة التهيئة
  };

  return (
    <div className="p-2 sm:p-6 w-full max-w-none">
      {/* إضافة الأنماط للرسائل الاحترافية */}
      <style>{`
        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes progressBar {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
        
        .notification-container {
          animation: slideInRight 0.3s ease-out;
        }
        
        .notification-container:hover .progress-bar {
          animation-play-state: paused;
        }
      `}</style>

      {/* منطقة عرض الرسائل الاحترافية */}
      {notifications.length > 0 && (
        <div style={{ 
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 9999,
          maxWidth: 400,
          direction: 'rtl'
        }}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="notification-container"
              style={{
                marginBottom: 12,
                padding: '16px 20px',
                borderRadius: 12,
                background: notification.type === 'success' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' :
                          notification.type === 'error' ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' :
                          notification.type === 'warning' ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' :
                          'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer'
              }}
            >
              {/* خط التقدم */}
              <div
                className="progress-bar"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: 3,
                  background: 'rgba(255,255,255,0.5)',
                  animation: 'progressBar 5s linear forwards',
                  borderRadius: '0 0 12px 12px'
                }}
              />
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                {/* أيقونة */}
                <div style={{
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  borderRadius: '50%',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 32,
                  height: 32
                }}>
                  {notification.type === 'success' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  )}
                  {notification.type === 'error' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/>
                    </svg>
                  )}
                  {notification.type === 'warning' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                    </svg>
                  )}
                  {notification.type === 'info' && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                  )}
                </div>
                
                {/* المحتوى */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 4,
                    fontFamily: 'Cairo, sans-serif'
                  }}>
                    {notification.title}
                  </div>
                  <div style={{
                    fontSize: 13,
                    lineHeight: 1.4,
                    fontFamily: 'Cairo, sans-serif',
                    opacity: 0.95
                  }}>
                    {notification.message}
                  </div>
                  <div style={{
                    fontSize: 11,
                    marginTop: 6,
                    opacity: 0.8,
                    fontFamily: 'Cairo, sans-serif'
                  }}>
                    {notification.timestamp.toLocaleTimeString('ar-SA', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>

                {/* زر الإغلاق */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setNotifications(prev => prev.filter(n => n.id !== notification.id));
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'white',
                    fontSize: 14,
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
        <div className="flex items-center">
          {isEditMode ? (
            <EditOutlined className="h-8 w-8 text-orange-600 ml-3" />
          ) : (
            <FileText className="h-8 w-8 text-blue-600 ml-3" />
          )}
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode ? `تعديل فاتورة مبيعات رقم ${invoiceData.invoiceNumber}` : 'فاتورة مبيعات جديدة'}
          </h1>
        </div>
        <p className="text-gray-600 mt-2">
          {isEditMode ? 'تعديل بيانات فاتورة المبيعات' : 'إنشاء فاتورة مبيعات جديدة'}
        </p>
        <div className={`absolute bottom-0 left-0 w-full h-1 ${isEditMode ? 'bg-gradient-to-r from-orange-400 to-red-500' : 'bg-gradient-to-r from-blue-400 to-purple-500'}`}></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "تقارير الفواتير", to: "/reports/invoice" },
          { label: isEditMode ? `تعديل فاتورة ${invoiceData.invoiceNumber}` : "فاتورة مبيعات جديدة" }
        ]}
      />
      <Spin spinning={fetchingItems}>
        {/* مودال الطباعة بعد الحفظ */}

        <Card 
          title={
            <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 rounded-lg">
              <Select
                value={invoiceType}
                style={{ minWidth: 170, height: 38 }}
                onChange={setInvoiceType}
                size="middle"
                placeholder="نوع الفاتورة"
                disabled={!!invoiceData.branch}
                options={[
                  { label: 'ضريبة مبسطة', value: 'ضريبة مبسطة' },
                  { label: 'ضريبة', value: 'ضريبة' }
                ]}
              />

              <Select
                value={warehouseMode}
                style={{ minWidth: 170, height: 38 }}
                onChange={setWarehouseMode}
                size="middle"
                placeholder="نظام المخزن"
                disabled={!!invoiceData.branch}
                options={[
                  { label: 'مخزن واحد', value: 'single' },
                  { label: 'مخازن متعددة', value: 'multiple' }
                ]}
              />

              <Select
                value={priceType}
                style={{ minWidth: 170, height: 38, fontFamily: 'sans-serif' }}
                onChange={async (value) => {
                  setPriceType(value);
                  if (value === 'آخر سعر العميل' && item.itemName && invoiceData.customerName) {
                    try {
                      const lastPrice = await fetchLastCustomerPrice(invoiceData.customerName, item.itemName);
                      if (lastPrice) {
                        setItem(prev => ({ ...prev, price: String(lastPrice) }));
                        customMessage.success('تم تطبيق آخر سعر للعميل بنجاح');
                      }
                    } catch (error) {
                      console.error('فشل في جلب آخر سعر:', error);
                      message.error('حدث خطأ أثناء جلب آخر سعر للعميل');
                    }
                  } else if (value === 'سعر البيع' && item.itemName) {
                    const selected = itemNames.find(i => i.name === item.itemName);
                    setItem(prev => ({
                      ...prev,
                      price: selected?.salePrice ? String(selected.salePrice) : ''
                    }));
                  }
                }}
                size="middle"
                placeholder="نوع السعر"
                options={[
                  { label: 'سعر البيع', value: 'سعر البيع' },
                  { label: 'آخر سعر العميل', value: 'آخر سعر العميل' }
                ]}
              />
            </div>
          }
          className="shadow-md"
        >
          {/* معلومات الفاتورة الأساسية */}
          <Divider orientation="left" style={{ fontFamily: 'Cairo, sans-serif', marginBottom: 16 }}>
            المعلومات الأساسية
          </Divider>
          
          {/* رسالة معلوماتية عن السنة المالية */}
          {currentFinancialYear && (
            <div style={{ marginBottom: 16 }}>
              <Card 
                size="small" 
                style={{ 
                  // background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                  // border: '1px solid #2196f3',
                  // borderRadius: 8
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12,
                  padding: '4px 0'
                }}>
                  <div style={{
                    backgroundColor: '#2196f3',
                    borderRadius: '50%',
                    padding: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                      <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      fontWeight: 600, 
                      color: '#1565c0',
                      fontSize: '13px',
                      fontFamily: 'Cairo, sans-serif'
                    }}>
                      السنة المالية النشطة: {currentFinancialYear.year}
                    </div>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#1976d2',
                      fontFamily: 'Cairo, sans-serif',
                      lineHeight: 1.3,
                      marginTop: 2
                    }}>
                      يمكن إدخال التواريخ فقط من {currentFinancialYear.startDate} إلى {currentFinancialYear.endDate}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
          
          <Row gutter={16} className="mb-4">
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="رقم الفاتورة">
                <Input
                  value={invoiceData.invoiceNumber || ''}
                  placeholder="رقم الفاتورة"
                  disabled
                />
   
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="رقم القيد">
                <Input 
                  name="entryNumber"
                  value={invoiceData.entryNumber}
                  disabled
                  placeholder="رقم القيد" 
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="التاريخ">
                <DatePicker
                  style={{ width: '100%' }}
                  value={invoiceData.date ? dayjs(invoiceData.date) : null}
                  onChange={(date, dateString) => {
                    const newDate = Array.isArray(dateString) ? dateString[0] : dateString as string;
                    
                    // التحقق من صحة التاريخ
                    if (newDate && !handleDateValidation(newDate, 'تاريخ الفاتورة')) {
                      return; // لا تحديث التاريخ إذا كان خارج النطاق
                    }
                    
                    setInvoiceData({
                      ...invoiceData, 
                      date: newDate,
                      dueDate: calculateDueDate(newDate) // حساب تاريخ الاستحقاق تلقائياً
                    });
                  }}
                  format="YYYY-MM-DD"
                  placeholder="التاريخ"
                  disabledDate={disabledDate}
                  status={invoiceData.date && !validateDate(invoiceData.date) ? 'error' : undefined}
                />
                {invoiceData.date && !validateDate(invoiceData.date) && (
                  <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                    {getDateValidationMessage(invoiceData.date)}
                  </div>
                )}
              </Form.Item>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Form.Item label="تاريخ الاستحقاق">
                <DatePicker
                  style={{ width: '100%' }}
                  value={invoiceData.dueDate ? dayjs(invoiceData.dueDate) : null}
                  onChange={(date, dateString) => {
                    const newDueDate = Array.isArray(dateString) ? dateString[0] : dateString as string;
                    
                    // التحقق من صحة التاريخ
                    if (newDueDate && !handleDateValidation(newDueDate, 'تاريخ الاستحقاق')) {
                      return; // لا تحديث التاريخ إذا كان خارج النطاق
                    }
                    
                    setInvoiceData({
                      ...invoiceData, 
                      dueDate: newDueDate
                    });
                  }}
                  format="YYYY-MM-DD"
                  placeholder="تاريخ الاستحقاق"
                  disabledDate={disabledDate}
                  status={invoiceData.dueDate && !validateDate(invoiceData.dueDate) ? 'error' : undefined}
                />
                {invoiceData.dueDate && !validateDate(invoiceData.dueDate) && (
                  <div style={{ color: '#ff4d4f', fontSize: '12px', marginTop: '4px' }}>
                    {getDateValidationMessage(invoiceData.dueDate)}
                  </div>
                )}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16} className="mb-4">
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="البائع">
                <Select
                  showSearch
                  value={invoiceData.delegate}
                  onChange={value => {
                    console.log('تم اختيار مندوب جديد:', value);
                    setInvoiceData({ ...invoiceData, delegate: value });
                  }}
                  placeholder="اختر البائع"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={(() => {
                    const options = delegates?.map(d => ({ 
                      label: d.name || d.email || d.id, 
                      value: d.id 
                    })) || [];
                    console.log('خيارات dropdown البائع:', options);
                    return options;
                  })()}
                  allowClear
                />
              </Form.Item>
            </Col>
          </Row>

          {/* معلومات الفرع والمخزن */}
          <Divider orientation="left" style={{ fontFamily: 'Cairo, sans-serif', marginBottom: 16 }}>
            معلومات الفرع والمخزن
          </Divider>
          <Row gutter={16} className="mb-4">
            <Col xs={24} sm={12} md={12}>
              <Form.Item label="الفرع">
                <Select
                  showSearch
                  value={invoiceData.branch}
                  onChange={async (value) => {
                    try {
                      setBranchCode('');
                      // لا تولد رقم فاتورة جديد في وضع التعديل
                      const invoiceNumber = isEditMode ? invoiceData.invoiceNumber : await generateInvoiceNumberAsync(value, branches);
                      
                      // البحث عن المخزن المرتبط بالفرع المحدد من المخازن المفلترة
                      const filteredWarehouses = filterWarehousesForSales(warehouses, value);
                      const linkedWarehouse = filteredWarehouses.find(warehouse => warehouse.branch === value);
                      const selectedWarehouse = linkedWarehouse ? linkedWarehouse.id : '';
                      
                      // رسالة تشخيصية للمطور
                      console.log('الفرع المحدد:', value, 'isEditMode:', isEditMode);
                      console.log('المخازن المفلترة:', filteredWarehouses.map(w => ({ id: w.id, name: w.nameAr || w.name, branch: w.branch })));
                      console.log('المخزن المرتبط:', linkedWarehouse);
                      console.log('معرف المخزن المحدد:', selectedWarehouse);
                      
                      setInvoiceData(prev => ({
                        ...prev,
                        branch: value,
                        warehouse: selectedWarehouse,
                        invoiceNumber
                      }));
                      
                      // إعادة تعيين المخزن في الـ item أيضاً في حالة المخازن المتعددة
                      setItem(prev => ({
                        ...prev,
                        warehouseId: selectedWarehouse
                      }));
                      
                      // إظهار رسالة إعلامية إذا تم اختيار مخزن تلقائياً
                      if (linkedWarehouse) {
                        message.info(`تم اختيار المخزن "${linkedWarehouse.nameAr || linkedWarehouse.name}" المرتبط بالفرع تلقائياً`);
                      } else {
                        message.warning('لا يوجد مخزن مرتبط بهذا الفرع، يرجى اختيار المخزن يدوياً');
                      }
                    } catch (error) {
                      console.error('خطأ في اختيار الفرع:', error);
                      message.error('حدث خطأ أثناء اختيار الفرع');
                    }
                  }}
                  disabled={branches.length === 0}
                  placeholder="اختر الفرع"
                  style={{ fontFamily: 'Cairo, sans-serif' }}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  options={branches.filter(branch => branch && branch.id).map(branch => ({ 
                    label: branch.name || branch.id, 
                    value: branch.id 
                  }))}
                  notFoundContent={branches.length === 0 ? "جاري تحميل الفروع..." : "لا توجد فروع متاحة"}
                />
              </Form.Item>
            </Col>
            {warehouseMode !== 'multiple' && (
              <Col xs={24} sm={12} md={12}>
                <Form.Item label="المخزن">
                  <Select
                    showSearch
                    value={invoiceData.warehouse}
                    onChange={(value) => setInvoiceData({...invoiceData, warehouse: value})}
                    disabled={filterWarehousesForSales(warehouses, invoiceData.branch).length === 0}
                    placeholder="اختر المخزن"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={filterWarehousesForSales(warehouses, invoiceData.branch)
                      .sort((a, b) => {
                        // ترتيب المخازن: المرتبطة بالفرع أولاً
                        const aLinked = a.branch === invoiceData.branch;
                        const bLinked = b.branch === invoiceData.branch;
                        if (aLinked && !bLinked) return -1;
                        if (!aLinked && bLinked) return 1;
                        return 0;
                      })
                      .map(warehouse => {
                        const isLinkedToBranch = warehouse.branch === invoiceData.branch;
                        return {
                          label: (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ 
                                color: isLinkedToBranch ? '#52c41a' : '#666',
                                fontWeight: isLinkedToBranch ? 'bold' : 'normal'
                              }}>
                                {warehouse.nameAr || warehouse.name || warehouse.id}
                              </span>
                              {isLinkedToBranch && (
                                <span style={{ 
                                  color: '#52c41a', 
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  marginRight: '8px'
                                }}>
                                  ✓ مرتبط
                                </span>
                              )}
                            </div>
                          ),
                          value: warehouse.id
                        };
                      })}
                  />
                  {/* رسالة إعلامية عند عدم وجود مخازن متاحة */}
                  {filterWarehousesForSales(warehouses, invoiceData.branch).length === 0 && warehouses.length > 0 && (
                    <div style={{ 
                      marginTop: 8, 
                      padding: 8, 
                      backgroundColor: '#fff2e8', 
                      border: '1px solid #ffcc02', 
                      borderRadius: 4,
                      fontSize: '12px',
                      color: '#d46b08'
                    }}>
                      لا توجد مخازن متاحة للمبيعات. قد يكون السبب:
                      <ul style={{ margin: '4px 0', paddingRight: 16 }}>
                        <li>عدم وجود صلاحية للمستخدم الحالي</li>
                        <li>المخزن غير مخصص لفواتير المبيعات</li>
                        <li>المخزن غير مرتبط بالفرع المحدد</li>
                      </ul>
                    </div>
                  )}
                </Form.Item>
              </Col>
            )}
          </Row>

          {/* معلومات العميل */}
          <Divider orientation="left" style={{ fontFamily: 'Cairo, sans-serif', marginBottom: 16 }}>
            معلومات العميل
          </Divider>
          <Row gutter={16} className="mb-4">
            <Col xs={24} sm={18} md={18}>
              <Form.Item label="اسم العميل">
                <Space.Compact style={{ display: 'flex', width: '100%' }}>
                  <Select
                    showSearch
                    value={invoiceData.customerName}
                    placeholder="اسم العميل"
                    onChange={(value) => {
                      const selected = customers.find(c => c.nameAr === value);
                      setInvoiceData({
                        ...invoiceData,
                        customerName: value || '',
                        customerNumber: selected ? (selected.phone || selected.mobile || selected.phoneNumber || '') : '',
                        commercialRecord: selected ? (selected.commercialReg || '') : '',
                        taxFile: selected ? (selected.taxFileNumber || selected.taxFile || '') : ''
                      });
                    }}
                    style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 500, fontSize: 16, flex: 1 }}
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    allowClear
                    options={customers.map(customer => ({ 
                      label: customer.nameAr, 
                      value: customer.nameAr 
                    }))}
                  />
                                  <Button
                    type="default"
                    icon={
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 4v6h6V4H4zm10 0v6h6V4h-6zM4 14v6h6v-6H4zm10 0v6h6v-6h-6z" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                    }
                    style={{ 
                      minWidth: 40,
                      borderLeft: 0,
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0
                    }}
                    onClick={() => setShowQuickAddCustomer(true)}
                    title="إضافة سريعة"
                  />
                  <Button
                    type="default"
                    icon={<SearchOutlined />}
                    style={{ 
                      minWidth: 40,
                      
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0
                    }}
                    onClick={() => setShowCustomerSearch(true)}
                    title="البحث عن عميل"
                  />
  
                </Space.Compact>
              </Form.Item>
            </Col>
            <Col xs={24} sm={6} md={6}>
              <Form.Item label="رقم العميل">
                <Input
                  id="customerNumber"
                  value={invoiceData.customerNumber}
                  placeholder="رقم العميل"
                  disabled
                />
              </Form.Item>
            </Col>
          </Row>



          {/* معلومات الضريبة (للفاتورة الضريبية فقط) */}
          {invoiceType === 'ضريبة' && (
            <>
              <Divider orientation="left" style={{ fontFamily: 'Cairo, sans-serif', marginBottom: 16 }}>
                المعلومات الضريبية
              </Divider>
              <Row gutter={16} className="mb-4">
                <Col xs={24} sm={12} md={12}>
                  <Form.Item label="السجل التجاري">
                    <Input
                      id="commercialRecord"
                      value={invoiceData.commercialRecord}
                      placeholder="السجل التجاري"
                      disabled
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12} md={12}>
                  <Form.Item label="الملف الضريبي">
                    <Input
                      id="taxFile"
                      value={invoiceData.taxFile}
                      placeholder="الملف الضريبي"
                      disabled
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* منطقة عرض الرسائل والتنبيهات */}
          <div style={{ marginBottom: 24 }}>
            <Card 
              size="small" 
              style={{ 
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                border: '1px solid #dee2e6',
                borderRadius: 8
              }}
            >
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                padding: '8px 0'
              }}>
                <div style={{
                  backgroundColor: '#0ea5e9',
                  borderRadius: '50%',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    color: '#495057',
                    marginBottom: 4,
                    fontFamily: 'Cairo, sans-serif'
                  }}>
                    حالة الفاتورة الحالية
                  </div>
                  <div style={{ 
                    fontSize: 13, 
                    color: '#6c757d',
                    fontFamily: 'Cairo, sans-serif',
                    lineHeight: 1.4
                  }}>
                    {!invoiceData.branch && (
                      <span style={{ color: '#dc3545', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                        </svg>
                        يرجى اختيار الفرع أولاً
                      </span>
                    )}
                    {invoiceData.branch && !invoiceData.customerName && (
                      <span style={{ color: '#fd7e14', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                        </svg>
                        يرجى اختيار العميل
                      </span>
                    )}
                    {warehouseMode !== 'multiple' && invoiceData.branch && !invoiceData.warehouse && (
                      <span style={{ color: '#fd7e14', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                        </svg>
                        يرجى اختيار المخزن
                      </span>
                    )}
                    {invoiceData.branch && invoiceData.customerName && 
                     (warehouseMode === 'multiple' || invoiceData.warehouse) && (
                      <span style={{ color: '#198754', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        يمكنك الآن إضافة الأصناف
                      </span>
                    )}
                    {items.length > 0 && (
                      <span style={{ color: '#0d6efd', fontWeight: 500, marginLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7v10c0 5.55 3.84 9.74 9 10.95 5.16-1.21 9-5.4 9-10.95V7L12 2z"/>
                          <path d="M10 14l-3-3 1.41-1.41L10 11.17l5.59-5.58L17 7l-7 7z" fill="white"/>
                        </svg>
                        تم إضافة {items.length} صنف | الإجمالي: {totals.afterTax.toFixed(2)} ر.س - يرجى .
                      </span>
                    )}
                    {items.length > 0 && invoiceData.paymentMethod && (
                      <span style={{ color: '#198754', fontWeight: 500, marginLeft: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                        تم اختيار طريقة الدفع - الفاتورة جاهزة للحفظ
                      </span>
                    )}
                    {multiplePaymentMode && items.length > 0 && (
                      <span style={{ 
                        color: Math.abs(
                          (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                        ) > 0.01 ? '#dc2626' : '#059669', 
                        fontWeight: 500, 
                        marginLeft: 16, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 6 
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          {Math.abs(
                            (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                             parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                             parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                          ) > 0.01 ? (
                            <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                          ) : (
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                          )}
                        </svg>
                        المتبقي: {(totals.afterTax - (
                          parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                          parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                          parseFloat(invoiceData.multiplePayment.card?.amount || '0')
                        )).toFixed(2)} ر.س
                        {Math.abs(
                          (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                        ) > 0.01 && ' - يجب أن يكون 0.00 للحفظ'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          <Divider orientation="left" style={{ fontFamily: 'Cairo, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>إضافة أصناف المبيعات</span>
              {editingItemIndex !== null && (
                <span style={{
                  background: 'linear-gradient(135deg, #ffc107 0%, #ffca2c 100%)',
                  color: '#000',
                  padding: '4px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  boxShadow: '0 2px 4px rgba(255, 193, 7, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  جاري تعديل الصنف رقم {editingItemIndex + 1}
                </span>
              )}
            </div>
          </Divider>




          {/* Item Entry */}
          <Row gutter={16} className="mb-4">
            <Col xs={24} sm={12} md={4}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>كود الصنف</div>
              <Input
                value={item.itemNumber}
                placeholder="كود الصنف"
                disabled
              />
            </Col>
            <Col xs={24} sm={12} md={7}>

              <div style={{ width: '100%' }}>
                <div style={{ marginBottom: 0, fontWeight: 500 }}>اسم الصنف</div>
                <Space.Compact style={{ display: 'flex', width: '100%' }}>
                  <Select
                    ref={itemNameSelectRef}
                    showSearch
                    value={item.itemName}
                    placeholder="اسم الصنف"
                    style={{ flex: 1, fontFamily: 'Cairo, sans-serif' }}
                    optionLabelProp="label"
                    onChange={async (value) => {
                      const selected = itemNames.find(i => i.name === value);
                      
                      // فحص إذا كان الصنف موقوف مؤقتاً
                      if (selected && selected.tempCodes) {
                        customMessage.warning(`تم إيقاف الصنف "${value}" مؤقتاً ولا يمكن إضافته للفاتورة`);
                        // إعادة تعيين اختيار الصنف
                        setItem({
                          ...item,
                          itemName: '',
                          itemNumber: '',
                          price: '',
                          discountPercent: '0',
                          quantity: '1'
                        });
                        return;
                      }
                      
                      let price = selected && selected.salePrice ? String(selected.salePrice) : '';
                      if (priceType === 'آخر سعر العميل' && invoiceData.customerName) {
                        const lastPrice = await fetchLastCustomerPrice(invoiceData.customerName, value);
                        if (lastPrice) price = String(lastPrice);
                      }
                      
                      setItem({
                        ...item,
                        itemName: value,
                        itemNumber: selected ? (selected.itemCode || '') : '',
                        price,
                        discountPercent: selected && selected.discount ? String(selected.discount) : '0',
                        taxPercent: taxRate, // استخدام نسبة الضريبة من إعدادات الشركة دائماً
                        quantity: '1'
                      });
                      
                      // جلب رصيد الصنف في حالة المخازن المتعددة والمخزن محدد
                      if (warehouseMode === 'multiple' && item.warehouseId && value) {
                        await fetchSingleItemStock(value, item.warehouseId);
                      }
                      
                      // إظهار رسالة معلوماتية عن الرصيد المتاح
                      const currentWarehouse = warehouseMode === 'single' ? invoiceData.warehouse : item.warehouseId;
                      if (currentWarehouse) {
                        let currentStock;
                        if (warehouseMode === 'single') {
                          currentStock = itemStocks[value];
                        } else {
                          // جلب الرصيد فورياً في حالة المخازن المتعددة
                          currentStock = await checkStockAvailability(value, currentWarehouse);
                          // تحديث الحالة
                          setItemStocks(prev => ({
                            ...prev,
                            [`${value}-${currentWarehouse}`]: currentStock
                          }));
                        }
                        
                        if (currentStock !== undefined) {
                          if (currentStock > 0) {
                            message.info(`الرصيد المتاح: ${currentStock}`, 2);
                          } else if (currentStock === 0) {
                            message.warning(`تحذير: الصنف غير متوفر في المخزون`, 3);
                          } else {
                            message.warning(`تحذير: الرصيد سالب: ${Math.abs(currentStock)}`, 3);
                          }
                        }
                      }
                    }}
                    filterOption={(input, option) => {
                      const itemName = String(option?.value ?? '').toLowerCase();
                      const selectedItem = itemNames.find(i => i.name === option?.value);
                      const itemCode = String(selectedItem?.itemCode ?? '').toLowerCase();
                      const searchTerm = input.toLowerCase();
                      return itemName.includes(searchTerm) || itemCode.includes(searchTerm);
                    }}
                    allowClear
                  >
                    {itemNames.map((i, index) => {
                      const currentWarehouse = warehouseMode === 'single' ? invoiceData.warehouse : item.warehouseId;
                      const stockKey = warehouseMode === 'single' ? i.name : `${i.name}-${currentWarehouse}`;
                      const stock = currentWarehouse ? itemStocks[stockKey] : undefined;
                      
                      return (
                        <Select.Option 
                          key={i.id || `${i.name}-${index}`} 
                          value={i.name}
                          label={i.name}
                          disabled={!!i.tempCodes}
                          style={{
                            color: i.tempCodes ? '#ff4d4f' : 'inherit',
                            backgroundColor: i.tempCodes ? '#fff2f0' : 'inherit'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
<span style={{ fontWeight: 600 }}>
  {i.name}
  {i.tempCodes ? (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle', marginLeft: 2 }}>
        <circle cx="12" cy="12" r="10" stroke="#ff4d4f" strokeWidth="2" fill="#fff2f0" />
        <path d="M8 12h8" stroke="#ff4d4f" strokeWidth="2" strokeLinecap="round" />
      </svg>
      (إيقاف مؤقت)
    </span>
  ) : ''}
</span>
                              {i.itemCode && (
                                <span style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                                  كود: {i.itemCode}
                                  {i.allowNegative && (
                                    <span style={{ 
                                      marginLeft: 8, 
                                      color: '#52c41a', 
                                      fontWeight: 'bold',
                                      fontSize: '11px',
                                      backgroundColor: '#f6ffed',
                                      padding: '1px 4px',
                                      borderRadius: '2px',
                                      border: '1px solid #b7eb8f'
                                    }}>
                                      ✓ سالب
                                    </span>
                                  )}
                                  {i.allowNegative === false && (
                                    <span style={{ 
                                      marginLeft: 8, 
                                      color: '#ff4d4f', 
                                      fontWeight: 'bold',
                                      fontSize: '11px',
                                      backgroundColor: '#fff2f0',
                                      padding: '1px 4px',
                                      borderRadius: '2px',
                                      border: '1px solid #ffccc7'
                                    }}>
                                      ✗ سالب
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                            {currentWarehouse && (
                              <span 
                                style={{ 
                                  color: stock !== undefined ? 
                                    (stock > 0 ? '#52c41a' : stock === 0 ? '#faad14' : '#ff4d4f') : 
                                    '#1890ff',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  marginRight: '8px'
                                }}
                              >
                                {stock !== undefined ? 
                                  (stock > 0 ? `متوفر: ${stock}` : stock === 0 ? 'غير متوفر' : `سالب: ${Math.abs(stock)}`) :
                                  (loadingStocks ? 'جاري التحميل...' : 'اختر المخزن')
                                }
                              </span>
                            )}
                          </div>
                        </Select.Option>
                      );
                    })}
                  </Select>
                  <Button
                    type="default"
                    size="middle"
                    style={{ 
                      
                      borderTopLeftRadius: 0,
                      borderBottomLeftRadius: 0,
                      backgroundColor: '#ffffff',
                      borderColor: '#d1d5db',
                      display: 'flex',
                      
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 40
                    }}
                    onClick={() => setShowAddItemModal(true)}
                    title="إضافة صنف جديد"
                  >
                    <svg width="16"  height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 4v6h6V4H4zm10 0v6h6V4h-6zM4 14v6h6v-6H4zm10 0v6h6v-6h-6z" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </Button>
                </Space.Compact>
                {/* مودال إضافة صنف جديد */}
<Modal
  open={showAddItemModal}
  onCancel={() => setShowAddItemModal(false)}
  footer={null}
  title={
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Cairo', fontWeight: 700 }}>
      <span style={{ background: '#e0e7ef', borderRadius: '50%', padding: 8, boxShadow: '0 2px 8px #e0e7ef' }}>
        <svg width="24" height="24" fill="#305496" viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm1 3v4h4v2h-4v4h-2v-4H7v-2h4V5h2z"/></svg>
      </span>
      إضافة صنف جديد
    </div>
  }
  width={750}
  styles={{ 
    body: { 
      background: 'linear-gradient(135deg, #f8fafc 80%, #e0e7ef 100%)', 
      borderRadius: 16, 
      padding: 28, 
      boxShadow: '0 8px 32px #b6c2d655' 
    } 
  }}
  style={{ top: 60 }}
  destroyOnHidden
>
  <div style={{ marginBottom: 16 }}>
    <div style={{ 
      marginBottom: 12, 
      padding: 8, 
      background: '#e0e7ef', 
      borderRadius: 8, 
      textAlign: 'center', 
      fontWeight: 500, 
      color: '#305496', 
      fontFamily: 'Cairo', 
      fontSize: 15 
    }}>
      يرجى تعبئة بيانات الصنف بدقة
    </div>
  </div>
  <Form
    layout="vertical"
    onFinish={() => {
      // التحقق من الحقول الإجبارية
      if (!addItemForm.parentId) {
        message.error('يرجى اختيار المستوى الأول');
        return;
      }
      if (!addItemForm.name) {
        message.error('يرجى إدخال اسم الصنف');
        return;
      }
      if (!addItemForm.itemCode) {
        message.error('يرجى إدخال كود الصنف');
        return;
      }
      if (!addItemForm.salePrice) {
        message.error('يرجى إدخال سعر البيع');
        return;
      }
      if (!addItemForm.purchasePrice) {
        message.error('يرجى إدخال سعر الشراء');
        return;
      }
      if (!addItemForm.unit) {
        message.error('يرجى اختيار الوحدة');
        return;
      }
      
      if (addItemForm.tempCodes && message && message.warning) {
        message.warning('تم إيقاف هذا الصنف مؤقتًا.');
      }
      handleAddNewItem();
    }}
    style={{ fontFamily: 'Cairo' }}
    initialValues={addItemForm}
  >
  <Row gutter={16}>
    <Col span={8}>
      <Form.Item label="نوع الصنف" required>
        <Input value="مستوى ثاني" disabled style={{ color: '#888', background: '#f3f4f6', fontWeight: 500, fontSize: 15, borderRadius: 6 }} />
      </Form.Item>
    </Col>
    <Col span={8}>
      {allItems && allItems.filter(i => i.type === 'مستوى أول').length > 0 && (
        <Form.Item 
          label={<span style={{ color: '#ff4d4f' }}>المستوى الأول *</span>} 
          required
          rules={[{ required: true, message: 'يرجى اختيار المستوى الأول' }]}
        >
          <Select
            value={addItemForm.parentId || ''}
            onChange={v => setAddItemForm(f => ({ ...f, parentId: v }))}
            placeholder="اختر المستوى الأول"
            style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
          >
            {allItems.filter(i => i.type === 'مستوى أول').map(i => (
              <Select.Option key={i.id || i.name} value={i.id}>{i.name}</Select.Option>
            ))}
          </Select>
        </Form.Item>
      )}
    </Col>
    <Col span={8}>
      <Form.Item 
        label={<span style={{ color: '#ff4d4f' }}>اسم الصنف *</span>} 
        required
        rules={[{ required: true, message: 'يرجى إدخال اسم الصنف' }]}
      >
        <Input
          value={addItemForm.name || ''}
          onChange={e => setAddItemForm(f => ({ ...f, name: e.target.value }))}
          placeholder="اسم الصنف"
          autoFocus
          style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
        />
      </Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={8}>
      <Form.Item 
        label={<span style={{ color: '#ff4d4f' }}>كود الصنف *</span>} 
        required
        rules={[{ required: true, message: 'يرجى إدخال كود الصنف' }]}
      >
        <Input
          value={addItemForm.itemCode || ''}
          onChange={e => setAddItemForm(f => ({ ...f, itemCode: e.target.value }))}
          placeholder="كود الصنف"
          style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
        />
      </Form.Item>
    </Col>
    <Col span={8}>
      <Form.Item 
        label={<span style={{ color: '#ff4d4f' }}>سعر الشراء *</span>} 
        required
        rules={[{ required: true, message: 'يرجى إدخال سعر الشراء' }]}
      >
        <Input
          value={addItemForm.purchasePrice || ''}
          onChange={e => setAddItemForm(f => ({ ...f, purchasePrice: e.target.value }))}
          placeholder="سعر الشراء"
          type="number"
          min={0}
          style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
        />
      </Form.Item>
    </Col>
    <Col span={8}>
      <Form.Item 
        label={<span style={{ color: '#ff4d4f' }}>سعر البيع *</span>} 
        required
        rules={[{ required: true, message: 'يرجى إدخال سعر البيع' }]}
      >
        <Input
          value={addItemForm.salePrice || ''}
          onChange={e => setAddItemForm(f => ({ ...f, salePrice: e.target.value }))}
          placeholder="سعر البيع"
          type="number"
          min={0}
          style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
        />
      </Form.Item>
    </Col>
  </Row>
  <Row gutter={16}>
    <Col span={8}>
      <Form.Item label="الحد الأدنى للطلب">
        <Input
          value={addItemForm.minOrder || ''}
          onChange={e => setAddItemForm(f => ({ ...f, minOrder: e.target.value }))}
          placeholder="الحد الأدنى للطلب"
          type="number"
          min={0}
          style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
        />
      </Form.Item>
    </Col>
    <Col span={8}>
      <Form.Item label="نسبة الخصم">
        <Input
          value={addItemForm.discount || ''}
          onChange={e => setAddItemForm(f => ({ ...f, discount: e.target.value }))}
          placeholder="نسبة الخصم"
          type="number"
          min={0}
          max={100}
          style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
        />
      </Form.Item>
    </Col>
    <Col span="8">
      {/* Empty for alignment or add more fields here if needed */}
    </Col>
  </Row>
    <Form.Item>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ fontWeight: 500, marginBottom: 0, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!addItemForm.allowNegative}
            onChange={e => setAddItemForm(f => ({ ...f, allowNegative: e.target.checked }))}
            style={{ marginLeft: 6 }}
          />
          السماح بالسالب
        </label>
        <label style={{ fontWeight: 500, marginBottom: 0, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!addItemForm.isVatIncluded}
            onChange={e => setAddItemForm(f => ({ ...f, isVatIncluded: e.target.checked }))}
            style={{ marginLeft: 6 }}
          />
          شامل الضريبة
        </label>
        <label style={{ fontWeight: 500, marginBottom: 0, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!addItemForm.tempCodes}
            onChange={e => setAddItemForm(f => ({ ...f, tempCodes: e.target.checked }))}
            style={{ marginLeft: 6 }}
          />
          إيقاف مؤقت
        </label>
      </div>
    </Form.Item>

    <Form.Item label="المورد">
      <Select
        value={addItemForm.supplier || ''}
        onChange={v => setAddItemForm(f => ({ ...f, supplier: v }))}
        placeholder="اختر المورد"
        style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
      >
        {suppliers && suppliers.map(s => (
          <Select.Option key={s.id} value={s.name}>{s.name}</Select.Option>
        ))}
      </Select>
    </Form.Item>
    <Form.Item 
      label={<span style={{ color: '#ff4d4f' }}>الوحدة *</span>} 
      required
      rules={[{ required: true, message: 'يرجى اختيار الوحدة' }]}
    >
      <Select
        value={addItemForm.unit || ''}
        onChange={v => setAddItemForm(f => ({ ...f, unit: v }))}
        placeholder="اختر الوحدة"
        style={{ fontWeight: 500, fontSize: 15, borderRadius: 6 }}
      >
        {units.map(unit => (
          <Select.Option key={unit} value={unit}>{unit}</Select.Option>
        ))}
      </Select>
    </Form.Item>
    <Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        loading={addItemLoading}
        style={{ 
          width: '100%', 
          fontWeight: 700, 
          fontSize: 16, 
          borderRadius: 8, 
          height: 44, 
          boxShadow: '0 2px 8px #e0e7ef' 
        }}
      >
        إضافة
      </Button>
    </Form.Item>
  </Form>
</Modal>
              </div>
            </Col>
            {warehouseMode === 'multiple' && (
              <Col xs={24} sm={12} md={4}>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>المخزن</div>
                <Select
                  showSearch
                  value={item.warehouseId}
                  placeholder="اختر المخزن"
                  style={{ width: '100%', fontFamily: 'Cairo, sans-serif' }}
                  onChange={async (value) => {
                    setItem({ ...item, warehouseId: value });
                    // في حالة المخازن المتعددة، جلب رصيد الصنف الحالي في المخزن الجديد
                    if (item.itemName && value) {
                      await fetchSingleItemStock(item.itemName, value);
                    }
                  }}
                  options={filterWarehousesForSales(warehouses, invoiceData.branch)
                    .sort((a, b) => {
                      // ترتيب المخازن: المرتبطة بالفرع أولاً
                      const aLinked = a.branch === invoiceData.branch;
                      const bLinked = b.branch === invoiceData.branch;
                      if (aLinked && !bLinked) return -1;
                      if (!aLinked && bLinked) return 1;
                      return 0;
                    })
                    .map(warehouse => {
                      const isLinkedToBranch = warehouse.branch === invoiceData.branch;
                      return {
                        label: (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ 
                              color: isLinkedToBranch ? '#52c41a' : '#666',
                              fontWeight: isLinkedToBranch ? 'bold' : 'normal'
                            }}>
                              {warehouse.nameAr || warehouse.name || warehouse.id}
                            </span>
                            {isLinkedToBranch && (
                              <span style={{ 
                                color: '#52c41a', 
                                fontSize: '12px',
                                fontWeight: 'bold',
                                marginRight: '8px'
                              }}>
                                ✓ مرتبط
                              </span>
                            )}
                          </div>
                        ),
                        value: warehouse.id
                      };
                    })}
                  filterOption={(input, option) =>
                    String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                />
                {/* رسالة إعلامية عند عدم وجود مخازن متاحة في وضع المخازن المتعددة */}
                {filterWarehousesForSales(warehouses, invoiceData.branch).length === 0 && warehouses.length > 0 && (
                  <div style={{ 
                    marginTop: 4, 
                    padding: 6, 
                    backgroundColor: '#fff2e8', 
                    border: '1px solid #ffcc02', 
                    borderRadius: 4,
                    fontSize: '11px',
                    color: '#d46b08'
                  }}>
                    لا توجد مخازن متاحة للمبيعات
                  </div>
                )}
              </Col>
            )}
            <Col xs={24} sm={12} md={2}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>الكمية</div>
              <Input
                name="quantity"
                value={item.quantity}
                onChange={handleItemChange}
                placeholder={(() => {
                  if (!item.itemName) return "الكمية";
                  const currentWarehouse = warehouseMode === 'single' ? invoiceData.warehouse : item.warehouseId;
                  if (!currentWarehouse) return "اختر المخزن";
                  const stockKey = warehouseMode === 'single' ? item.itemName : `${item.itemName}-${currentWarehouse}`;
                  const stock = itemStocks[stockKey];
                  return stock !== undefined ? `متاح: ${stock}` : "جاري تحميل الرصيد...";
                })()}
                type="number"
                min={1}
                style={{  
                  paddingLeft: 6, 
                  paddingRight: 6, 
                  fontSize: 15,
                  borderColor: (() => {
                    if (!item.itemName) return undefined;
                    const currentWarehouse = warehouseMode === 'single' ? invoiceData.warehouse : item.warehouseId;
                    if (!currentWarehouse) return undefined;
                    const stockKey = warehouseMode === 'single' ? item.itemName : `${item.itemName}-${currentWarehouse}`;
                    const stock = itemStocks[stockKey];
                    if (stock !== undefined && stock <= 0) return '#ff4d4f';
                    return undefined;
                  })()
                }}
              />
            </Col>
            <Col xs={24} sm={12} md={3}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>الوحدة</div>
              <Select
                showSearch
                value={item.unit}
                onChange={(value) => setItem({...item, unit: value})}
                style={{ width: '100%', fontFamily: 'Cairo, sans-serif' }}
                placeholder="الوحدة"
                options={units.map(unit => ({ 
                  label: unit, 
                  value: unit 
                }))}
              />
            </Col>
            <Col xs={24} sm={12} md={2}>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>السعر</div>
              <Input 
                name="price"
                value={item.price} 
                onChange={handleItemChange} 
                placeholder="السعر" 
                type="number" 
                min={0}
                step={0.01}
              />
            </Col>
          <Col xs={24} sm={12} md={2}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>% الخصم</div>
            <Input
              name="discountPercent"
              value={item.discountPercent}
              onChange={handleItemChange}
              placeholder="% الخصم"
              style={{ fontFamily: 'Cairo', paddingLeft: 4, paddingRight: 4, fontSize: 15 }}
              type="number"
              min={0}
              max={100}
            />
          </Col>
          <Col xs={24} sm={12} md={2}>
            <div style={{ marginBottom: 4, fontWeight: 500 }}>% الضريبة</div>
            <Input 
              name="taxPercent"
              value={taxRate} 
              placeholder="% الضريبة" 
              style={{ fontFamily: 'Cairo',  paddingLeft: 4, paddingRight: 4, fontSize: 15, backgroundColor: '#f5f5f5' }}
              type="number" 
              min={0}
              disabled
              readOnly
            />
          </Col>
          <Col xs={24} sm={12} md={1}>
            <div style={{ marginBottom: 4, fontWeight: 500, visibility: 'hidden' }}>
              {editingItemIndex !== null ? 'تحديث' : 'إضافة'}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <Button 
                type="primary"
                onClick={handleAddItem}
                disabled={
                  !invoiceData.branch ||
                  (warehouseMode !== 'multiple' && !invoiceData.warehouse) ||
                  !invoiceData.customerName ||
                  filterWarehousesForSales(warehouses, invoiceData.branch).length === 0
                }
                style={{
                  backgroundColor: editingItemIndex !== null ? '#52c41a' : '#1890ff',
                  borderColor: editingItemIndex !== null ? '#52c41a' : '#1890ff',
                  minWidth: editingItemIndex !== null ? 'auto' : '40px'
                }}
                title={editingItemIndex !== null ? 'تحديث الصنف المحدد' : 'إضافة صنف جديد'}
                icon={
                  editingItemIndex !== null ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m4-4H8" />
                    </svg>
                  )
                }
              >
                {editingItemIndex !== null ? 'تحديث' : ''}
              </Button>
              {editingItemIndex !== null && (
                <Button 
                  type="default"
                  onClick={() => {
                    setEditingItemIndex(null);
                    setItem({
                      ...initialItem,
                      taxPercent: taxRate,
                      quantity: '1'
                    });
                    customMessage.info('تم إلغاء التعديل');
                  }}
                  style={{
                    backgroundColor: '#ff4d4f',
                    borderColor: '#ff4d4f',
                    color: '#fff'
                  }}
                  title="إلغاء التعديل"
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  }
                />
              )}
            </div>
          </Col>
          </Row>

          {/* Items Table */}
          <div className="mb-4">
            <style>{`
              .custom-items-table .ant-table-thead > tr > th {
                background: #2463eb8c !important;
                color: #fff !important;
                font-weight: bold;
              }
              
              .editing-item-row {
                background: linear-gradient(135deg, #fef3cd 0%, #fff4cc 100%) !important;
                border: 2px solid #ffc107 !important;
                box-shadow: 0 2px 8px rgba(255, 193, 7, 0.3) !important;
              }
              
              .editing-item-row:hover {
                background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%) !important;
              }
              
              .editing-item-row td {
                border-color: #ffc107 !important;
                position: relative;
              }
              
              .editing-item-row td:first-child::before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 4px;
                background: #ffc107;
              }
            `}</style>
            <Table 
              className="custom-items-table"
              columns={itemColumns} 
              dataSource={items} 
              pagination={false} 
              rowKey={(record) => `${record.itemNumber}-${record.itemName}-${record.quantity}-${record.price}`}
              bordered
              scroll={{ x: true }}
              size="middle"
              rowClassName={(record, index) => 
                editingItemIndex === index ? 'editing-item-row' : ''
              }
            />
          </div>


          {/* Totals */}
          <Row gutter={16} justify="end" style={{ marginBottom: 16 }}>
            <Col xs={24} sm={12} md={8} lg={6}>
              <Card 
                size="small" 
                title={
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    fontFamily: 'Cairo, sans-serif',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#1f2937'
                  }}>
                    <div style={{
                      backgroundColor: '#059669',
                      borderRadius: '6px',
                      padding: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>

                    </div>
                    إجماليات الفاتورة
                  </div>
                }
                style={{
                  border: '2px solid #e5e7eb',
                  borderRadius: '12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: '4px 0'
                }}>
                  <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '14px', fontFamily: 'Cairo, sans-serif' }}>الإجمالي:</span>
                  <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '15px', fontFamily: 'Cairo, sans-serif' }}>{totals.total.toFixed(2)} ر.س</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: '4px 0'
                }}>
                  <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '14px', fontFamily: 'Cairo, sans-serif' }}>الخصم:</span>
                  <span style={{ fontWeight: 700, color: '#dc2626', fontSize: '15px', fontFamily: 'Cairo, sans-serif' }}>{(totals.total - totals.afterDiscount).toFixed(2)} ر.س</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: '4px 0'
                }}>
                  <span style={{ color: '#ea580c', fontWeight: 600, fontSize: '14px', fontFamily: 'Cairo, sans-serif' }}>الإجمالي بعد الخصم:</span>
                  <span style={{ fontWeight: 700, color: '#ea580c', fontSize: '15px', fontFamily: 'Cairo, sans-serif' }}>{totals.afterDiscount.toFixed(2)} ر.س</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: 8,
                  padding: '4px 0'
                }}>
                  <span style={{ color: '#9333ea', fontWeight: 600, fontSize: '14px', fontFamily: 'Cairo, sans-serif' }}>قيمة الضريبة:</span>
                  <span style={{ fontWeight: 700, color: '#9333ea', fontSize: '15px', fontFamily: 'Cairo, sans-serif' }}>{totals.tax.toFixed(2)} ر.س</span>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: '#f0fdf4',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <span style={{ color: '#059669', fontWeight: 700, fontSize: '16px', fontFamily: 'Cairo, sans-serif' }}>الإجمالي النهائي:</span>
                  <span style={{ fontWeight: 700, fontSize: '18px', color: '#059669', fontFamily: 'Cairo, sans-serif' }}>{totals.afterTax.toFixed(2)} ر.س</span>
                </div>
              </Card>
            </Col>
          </Row>

          {/* معلومات الدفع */}
          <Divider orientation="left" style={{ fontFamily: 'Cairo, sans-serif', marginBottom: 24, fontSize: '16px', fontWeight: 600 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                backgroundColor: '#1f2937',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                  <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                </svg>
              </div>
              <span style={{ color: '#1f2937', fontWeight: 600, fontSize: '16px' }}>معلومات الدفع</span>
            </div>
          </Divider>
          
          {/* بطاقة طريقة الدفع الرئيسية */}
          <Card 
            style={{ 
              marginBottom: 24,
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
            }}
          >
            <div style={{ 
              padding: '16px 20px',
              borderBottom: '1px solid #f3f4f6',
              marginBottom: '20px'
            }}>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: 600, 
                color: '#374151',
                fontFamily: 'Cairo, sans-serif',
                marginBottom: '4px'
              }}>
                اختيار طريقة الدفع
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: '#6b7280',
                fontFamily: 'Cairo, sans-serif'
              }}>
                يرجى تحديد الطريقة المناسبة لدفع قيمة الفاتورة
              </div>
            </div>
            
            <Row gutter={[24, 16]} align="middle">
              <Col xs={24} sm={12} md={8}>
                <div style={{ marginBottom: '8px' }}>
                  <label style={{ 
                    fontSize: '13px', 
                    fontWeight: 500, 
                    color: '#374151',
                    fontFamily: 'Cairo, sans-serif',
                    display: 'block',
                    marginBottom: '6px'
                  }}>
                    طريقة الدفع *
                  </label>
                  <Select
                    showSearch
                    value={invoiceData.paymentMethod}
                    onChange={(value) => {
                      const isMultiple = value === 'متعدد';
                      setMultiplePaymentMode(isMultiple);
                      setInvoiceData({
                        ...invoiceData, 
                        paymentMethod: value,
                        cashBox: value === 'نقدي' ? invoiceData.cashBox : '',
                        multiplePayment: isMultiple ? invoiceData.multiplePayment : {}
                      });
                    }}
                    disabled={paymentMethods.length === 0}
                    placeholder="اختر طريقة الدفع"
                    style={{ 
                      width: '100%',
                      fontFamily: 'Cairo, sans-serif'
                    }}
                    size="large"
                    filterOption={(input, option) =>
                      String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                      ...paymentMethods.map(method => ({
                        label: method.name || method.id,
                        value: method.name || method.id
                      })),
                    ]}
                  />
                </div>
              </Col>
              
              {/* عرض الصندوق النقدي للدفع النقدي */}
              {invoiceData.paymentMethod === 'نقدي' && (
                <Col xs={24} sm={12} md={8}>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ 
                      fontSize: '13px', 
                      fontWeight: 500, 
                      color: '#374151',
                      fontFamily: 'Cairo, sans-serif',
                      display: 'block',
                      marginBottom: '6px'
                    }}>
                      الصندوق النقدي *
                    </label>
                    <Select
                      showSearch
                      value={invoiceData.cashBox}
                      onChange={(value) => setInvoiceData({...invoiceData, cashBox: value})}
                      disabled={cashBoxes.length === 0}
                      placeholder="اختر الصندوق النقدي"
                      style={{ 
                        width: '100%',
                        fontFamily: 'Cairo, sans-serif'
                      }}
                      size="large"
                      filterOption={(input, option) =>
                        String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={cashBoxes
                        .filter(cashBox => !invoiceData.branch || cashBox.branch === invoiceData.branch)
                        .map(cashBox => ({
                          label: cashBox.nameAr,
                          value: cashBox.id || cashBox.nameAr
                        }))}
                    />
                  </div>
                </Col>
              )}
              
              {/* عرض إجمالي المبلغ للطرق العادية */}
              {invoiceData.paymentMethod && invoiceData.paymentMethod !== 'متعدد' && (
                <Col xs={24} sm={12} md={8}>
                  <div style={{ 
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '16px',
                    textAlign: 'center'
                  }}>
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#64748b',
                      fontWeight: 500,
                      marginBottom: '4px',
                      fontFamily: 'Cairo, sans-serif'
                    }}>
                      إجمالي المبلغ
                    </div>
                    <div style={{ 
                      fontSize: '20px', 
                      fontWeight: 700,
                      color: '#1e293b',
                      fontFamily: 'Cairo, sans-serif'
                    }}>
                      {totals.afterTax.toFixed(2)} ر.س
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </Card>

          
          {/* قسم الدفع المتعدد */}
          {multiplePaymentMode && (
            <Card 
              style={{ 
                marginBottom: 24,
                border: '2px solid #f59e0b',
                borderRadius: '12px',
                overflow: 'hidden'
              }}
            >
              {/* عنوان القسم */}
              <div style={{ 
                backgroundColor: '#f59e0b',
                margin: '-1px -1px 20px -1px',
                padding: '16px 20px',
                color: 'white'
              }}>
                <Row align="middle" justify="space-between">
                  <Col>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '8px',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <path d="M3 3h18v4H3V3zm0 6h18v2H3V9zm0 4h18v2H3v-2zm0 4h18v4H3v-4z"/>
                        </svg>
                      </div>
                      <div>
                        <div style={{ 
                          fontSize: '16px', 
                          fontWeight: 700,
                          fontFamily: 'Cairo, sans-serif'
                        }}>
                          الدفع المتعدد
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          opacity: 0.9,
                          fontFamily: 'Cairo, sans-serif'
                        }}>
                          توزيع المبلغ على عدة طرق دفع
                        </div>
                      </div>
                    </div>
                  </Col>
                  <Col>
                    <div style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '11px', opacity: 0.9, marginBottom: '2px' }}>المبلغ الإجمالي</div>
                      <div style={{ fontSize: '16px', fontWeight: 700 }}>
                        {totals.afterTax.toFixed(2)} ر.س
                      </div>
                    </div>
                  </Col>
                </Row>
              </div>

              {/* جدول طرق الدفع */}
              <div style={{ padding: '0 20px 20px 20px' }}>
                <Row gutter={[20, 20]}>
                  {/* النقدي */}
                  <Col xs={24} lg={8}>
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        backgroundColor: '#f9fafb',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 10
                        }}>
                          <div style={{
                            backgroundColor: '#059669',
                            borderRadius: '6px',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
                            </svg>
                          </div>
                          <span style={{ 
                            fontWeight: 600, 
                            color: '#374151',
                            fontFamily: 'Cairo, sans-serif',
                            fontSize: '14px'
                          }}>
                            الدفع النقدي
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontWeight: 500,
                            display: 'block',
                            marginBottom: '6px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            الصندوق النقدي
                          </label>
                          <Select
                            showSearch
                            value={invoiceData.multiplePayment.cash?.cashBoxId || ''}
                            onChange={(value) => setInvoiceData({
                              ...invoiceData, 
                              multiplePayment: {
                                ...invoiceData.multiplePayment,
                                cash: {
                                  ...invoiceData.multiplePayment.cash,
                                  cashBoxId: value,
                                  amount: invoiceData.multiplePayment.cash?.amount || ''
                                }
                              }
                            })}
                            disabled={cashBoxes.length === 0}
                            placeholder="اختر الصندوق"
                            style={{ width: '100%', fontFamily: 'Cairo, sans-serif' }}
                            filterOption={(input, option) =>
                              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={cashBoxes
                              .filter(cashBox => !invoiceData.branch || cashBox.branch === invoiceData.branch)
                              .map(cashBox => ({
                                label: cashBox.nameAr,
                                value: cashBox.id || cashBox.nameAr
                              }))}
                            allowClear
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontWeight: 500,
                            display: 'block',
                            marginBottom: '6px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            المبلغ النقدي (ر.س)
                          </label>
                          <Input
                            value={invoiceData.multiplePayment.cash?.amount || ''}
                            onChange={(e) => setInvoiceData({
                              ...invoiceData, 
                              multiplePayment: {
                                ...invoiceData.multiplePayment,
                                cash: {
                                  ...invoiceData.multiplePayment.cash,
                                  cashBoxId: invoiceData.multiplePayment.cash?.cashBoxId || '',
                                  amount: e.target.value
                                }
                              }
                            })}
                            onFocus={(e) => {
                              if (!e.target.value) {
                                const currentTotal = parseFloat(invoiceData.multiplePayment.bank?.amount || '0') + 
                                                    parseFloat(invoiceData.multiplePayment.card?.amount || '0');
                                const remaining = totals.afterTax - currentTotal;
                                if (remaining > 0) {
                                  setInvoiceData({
                                    ...invoiceData, 
                                    multiplePayment: {
                                      ...invoiceData.multiplePayment,
                                      cash: {
                                        ...invoiceData.multiplePayment.cash,
                                        cashBoxId: invoiceData.multiplePayment.cash?.cashBoxId || '',
                                        amount: remaining.toFixed(2)
                                      }
                                    }
                                  });
                                }
                              }
                            }}
                            placeholder="0.00"
                            type="number"
                            min={0}
                            step={0.01}
                            disabled={!invoiceData.multiplePayment.cash?.cashBoxId}
                            style={{ textAlign: 'center', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </div>
                  </Col>

                  {/* البنك */}
                  <Col xs={24} lg={8}>
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        backgroundColor: '#f9fafb',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 10
                        }}>
                          <div style={{
                            backgroundColor: '#2563eb',
                            borderRadius: '6px',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M5 7h14c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1 .45-1 1s.45 1 1 1zM6 10h12c.55 0 1-.45 1-1s-.45-1-1-1H6c-.55 0-1 .45-1 1s.45 1 1 1zM3 13h18c.55 0 1-.45 1-1s-.45-1-1-1H3c-.55 0-1 .45-1 1s.45 1 1 1zM4 16h16c.55 0 1-.45 1-1s-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1zM5 19h14c.55 0 1-.45 1-1s-.45-1-1-1H5c-.55 0-1 .45-1 1s.45 1 1 1z"/>
                            </svg>
                          </div>
                          <span style={{ 
                            fontWeight: 600, 
                            color: '#374151',
                            fontFamily: 'Cairo, sans-serif',
                            fontSize: '14px'
                          }}>
                            التحويل البنكي
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontWeight: 500,
                            display: 'block',
                            marginBottom: '6px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            البنك
                          </label>
                          <Select
                            showSearch
                            value={invoiceData.multiplePayment.bank?.bankId || ''}
                            onChange={(value) => setInvoiceData({
                              ...invoiceData, 
                              multiplePayment: {
                                ...invoiceData.multiplePayment,
                                bank: {
                                  ...invoiceData.multiplePayment.bank,
                                  bankId: value,
                                  amount: invoiceData.multiplePayment.bank?.amount || ''
                                }
                              }
                            })}
                            disabled={banks.length === 0}
                            placeholder="اختر البنك"
                            style={{ width: '100%', fontFamily: 'Cairo, sans-serif' }}
                            filterOption={(input, option) =>
                              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={banks.map(bank => ({
                              label: bank.arabicName,
                              value: bank.id || bank.arabicName
                            }))}
                            allowClear
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontWeight: 500,
                            display: 'block',
                            marginBottom: '6px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            المبلغ البنكي (ر.س)
                          </label>
                          <Input
                            value={invoiceData.multiplePayment.bank?.amount || ''}
                            onChange={(e) => setInvoiceData({
                              ...invoiceData, 
                              multiplePayment: {
                                ...invoiceData.multiplePayment,
                                bank: {
                                  ...invoiceData.multiplePayment.bank,
                                  bankId: invoiceData.multiplePayment.bank?.bankId || '',
                                  amount: e.target.value
                                }
                              }
                            })}
                            onFocus={(e) => {
                              if (!e.target.value) {
                                const currentTotal = parseFloat(invoiceData.multiplePayment.cash?.amount || '0') + 
                                                    parseFloat(invoiceData.multiplePayment.card?.amount || '0');
                                const remaining = totals.afterTax - currentTotal;
                                if (remaining > 0) {
                                  setInvoiceData({
                                    ...invoiceData, 
                                    multiplePayment: {
                                      ...invoiceData.multiplePayment,
                                      bank: {
                                        ...invoiceData.multiplePayment.bank,
                                        bankId: invoiceData.multiplePayment.bank?.bankId || '',
                                        amount: remaining.toFixed(2)
                                      }
                                    }
                                  });
                                }
                              }
                            }}
                            placeholder="0.00"
                            type="number"
                            min={0}
                            step={0.01}
                            disabled={!invoiceData.multiplePayment.bank?.bankId}
                            style={{ textAlign: 'center', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </div>
                  </Col>

                  {/* الشبكة */}
                  <Col xs={24} lg={8}>
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        backgroundColor: '#f9fafb',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb'
                      }}>
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 10
                        }}>
                          <div style={{
                            backgroundColor: '#dc2626',
                            borderRadius: '6px',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
                            </svg>
                          </div>
                          <span style={{ 
                            fontWeight: 600, 
                            color: '#374151',
                            fontFamily: 'Cairo, sans-serif',
                            fontSize: '14px'
                          }}>
                            بطاقة الشبكة
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <label style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontWeight: 500,
                            display: 'block',
                            marginBottom: '6px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            بنك الشبكة
                          </label>
                          <Select
                            showSearch
                            value={invoiceData.multiplePayment.card?.bankId || ''}
                            onChange={(value) => setInvoiceData({
                              ...invoiceData, 
                              multiplePayment: {
                                ...invoiceData.multiplePayment,
                                card: {
                                  ...invoiceData.multiplePayment.card,
                                  bankId: value,
                                  amount: invoiceData.multiplePayment.card?.amount || ''
                                }
                              }
                            })}
                            disabled={banks.length === 0}
                            placeholder="اختر البنك"
                            style={{ width: '100%', fontFamily: 'Cairo, sans-serif' }}
                            filterOption={(input, option) =>
                              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={banks.map(bank => ({
                              label: bank.arabicName,
                              value: bank.id || bank.arabicName
                            }))}
                            allowClear
                          />
                        </div>
                        
                        <div>
                          <label style={{ 
                            fontSize: '12px', 
                            color: '#6b7280',
                            fontWeight: 500,
                            display: 'block',
                            marginBottom: '6px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            مبلغ الشبكة (ر.س)
                          </label>
                          <Input
                            value={invoiceData.multiplePayment.card?.amount || ''}
                            onChange={(e) => setInvoiceData({
                              ...invoiceData, 
                              multiplePayment: {
                                ...invoiceData.multiplePayment,
                                card: {
                                  ...invoiceData.multiplePayment.card,
                                  bankId: invoiceData.multiplePayment.card?.bankId || '',
                                  amount: e.target.value
                                }
                              }
                            })}
                            onFocus={(e) => {
                              if (!e.target.value) {
                                const currentTotal = parseFloat(invoiceData.multiplePayment.cash?.amount || '0') + 
                                                    parseFloat(invoiceData.multiplePayment.bank?.amount || '0');
                                const remaining = totals.afterTax - currentTotal;
                                if (remaining > 0) {
                                  setInvoiceData({
                                    ...invoiceData, 
                                    multiplePayment: {
                                      ...invoiceData.multiplePayment,
                                      card: {
                                        ...invoiceData.multiplePayment.card,
                                        bankId: invoiceData.multiplePayment.card?.bankId || '',
                                        amount: remaining.toFixed(2)
                                      }
                                    }
                                  });
                                }
                              }
                            }}
                            placeholder="0.00"
                            type="number"
                            min={0}
                            step={0.01}
                            disabled={!invoiceData.multiplePayment.card?.bankId}
                            style={{ textAlign: 'center', fontWeight: 600 }}
                          />
                        </div>
                      </div>
                    </div>
                  </Col>
                </Row>

                {/* ملخص الدفع المتعدد */}
                <div style={{ 
                  marginTop: '24px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px'
                }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} sm={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontWeight: 500,
                          marginBottom: '4px',
                          fontFamily: 'Cairo, sans-serif'
                        }}>
                          إجمالي المدفوع
                        </div>
                        <div style={{ 
                          fontSize: '18px', 
                          fontWeight: 700,
                          color: '#1f2937',
                          fontFamily: 'Cairo, sans-serif'
                        }}>
                          {(
                            parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                            parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                            parseFloat(invoiceData.multiplePayment.card?.amount || '0')
                          ).toFixed(2)} ر.س
                        </div>
                      </div>
                    </Col>
                    <Col xs={24} sm={8}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          fontWeight: 500,
                          marginBottom: '4px',
                          fontFamily: 'Cairo, sans-serif'
                        }}>
                          المبلغ المتبقي
                        </div>
                        <div style={{ 
                          fontSize: '18px', 
                          fontWeight: 700,
                          color: (totals.afterTax - (
                            parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                            parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                            parseFloat(invoiceData.multiplePayment.card?.amount || '0')
                          )) > 0.01 ? '#dc2626' : '#059669',
                          fontFamily: 'Cairo, sans-serif'
                        }}>
                          {(totals.afterTax - (
                            parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                            parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                            parseFloat(invoiceData.multiplePayment.card?.amount || '0')
                          )).toFixed(2)} ر.س
                        </div>
                      </div>
                    </Col>
                    <Col xs={24} sm={8}>
                      <div style={{ 
                        textAlign: 'center',
                        padding: '12px 16px',
                        borderRadius: '6px',
                        backgroundColor: Math.abs(
                          (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                        ) <= 0.01 ? '#dcfce7' : '#fef2f2',
                        border: Math.abs(
                          (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                        ) <= 0.01 ? '1px solid #16a34a' : '1px solid #dc2626'
                      }}>
                        <div style={{ 
                          fontSize: '13px', 
                          fontWeight: 600,
                          color: Math.abs(
                            (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                             parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                             parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                          ) <= 0.01 ? '#15803d' : '#dc2626',
                          fontFamily: 'Cairo, sans-serif',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6
                        }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            {Math.abs(
                              (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                               parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                               parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                            ) <= 0.01 ? (
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                            ) : (
                              <path d="M12 2L1 21h22L12 2zm0 3.5L19.53 19H4.47L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
                            )}
                          </svg>
                          {Math.abs(
                            (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                             parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                             parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                          ) <= 0.01 ? 'الدفع مكتمل' : 'الدفع غير مكتمل'}
                        </div>
                        {Math.abs(
                          (parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                           parseFloat(invoiceData.multiplePayment.card?.amount || '0')) - totals.afterTax
                        ) > 0.01 && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#dc2626',
                            marginTop: '4px',
                            fontFamily: 'Cairo, sans-serif'
                          }}>
                            يجب أن يكون المتبقي 0.00 لحفظ الفاتورة
                          </div>
                        )}
                      </div>
                    </Col>
                  </Row>
                </div>
              </div>
            </Card>
          )}



          {/* Save Button */}
          <Row justify="center" gutter={12}>
            {isEditMode && (
              <Col>
                <Button 
                  type="default" 
                  size="large" 
                  onClick={() => navigate('/reports/invoice')}
                  style={{ width: 150, backgroundColor: '#6b7280', borderColor: '#6b7280', color: '#fff' }}
                >
                  إلغاء
                </Button>
              </Col>
            )}
            <Col>
              <Button 
                type="primary" 
                size="large" 
                icon={isEditMode ? <EditOutlined /> : <SaveOutlined />} 
                onClick={async () => {
                  if (Number(totalsDisplay.net) <= 0) {
                    if (typeof message !== 'undefined' && message.error) {
                      message.error('لا يمكن حفظ الفاتورة إذا كان الإجمالي النهائي صفر أو أقل');
                    } else {
                      alert('لا يمكن حفظ الفاتورة إذا كان الإجمالي النهائي صفر أو أقل');
                    }
                    return;
                  }
                  if (!invoiceData.paymentMethod) {
                    if (typeof message !== 'undefined' && message.error) {
                      message.error('يرجى اختيار طريقة الدفع أولاً');
                    } else {
                      alert('يرجى اختيار طريقة الدفع أولاً');
                    }
                    return;
                  }
                  if (invoiceData.paymentMethod === 'نقدي' && !invoiceData.cashBox) {
                    if (typeof message !== 'undefined' && message.error) {
                      message.error('يرجى اختيار الصندوق النقدي');
                    } else {
                      alert('يرجى اختيار الصندوق النقدي');
                    }
                    return;
                  }
                  if (multiplePaymentMode && (!invoiceData.multiplePayment.cash?.cashBoxId && !invoiceData.multiplePayment.bank?.bankId && !invoiceData.multiplePayment.card?.bankId)) {
                    if (typeof message !== 'undefined' && message.error) {
                      message.error('يرجى اختيار وسائل الدفع للدفع المتعدد');
                    } else {
                      alert('يرجى اختيار وسائل الدفع للدفع المتعدد');
                    }
                    return;
                  }
                  
                  // التحقق من أن المتبقي يساوي 0.00 في حالة الدفع المتعدد
                  if (multiplePaymentMode) {
                    const totalPayments = parseFloat(invoiceData.multiplePayment.cash?.amount || '0') +
                                         parseFloat(invoiceData.multiplePayment.bank?.amount || '0') +
                                         parseFloat(invoiceData.multiplePayment.card?.amount || '0');
                    const remaining = totals.afterTax - totalPayments;
                    
                    if (Math.abs(remaining) > 0.01) {
                      if (typeof message !== 'undefined' && message.error) {
                        message.error(`لا يمكن حفظ الفاتورة. المتبقي يجب أن يكون 0.00 (المتبقي الحالي: ${remaining.toFixed(2)})`);
                      } else {
                        alert(`لا يمكن حفظ الفاتورة. المتبقي يجب أن يكون 0.00 (المتبقي الحالي: ${remaining.toFixed(2)})`);
                      }
                      return;
                    }
                  }
                  
                  await handleSave();
                  // تحديث الأصناف بعد الحفظ مباشرة
                  if (typeof fetchLists === 'function') {
                    await fetchLists();
                  }
                  // بعد الحفظ: توليد رقم فاتورة جديد للفاتورة التالية
                  const newInvoiceNumber = await generateInvoiceNumberAsync(invoiceData.branch, branches);
                  setInvoiceData(prev => ({
                    ...prev,
                    invoiceNumber: newInvoiceNumber
                  }));
                }}
                style={{ width: 150, backgroundColor: '#60a5fa', borderColor: '#60a5fa', color: '#fff' }}
                loading={loading}
                disabled={items.length === 0}
              >
                {isEditMode ? 'تحديث الفاتورة' : 'حفظ الفاتورة'}
              </Button>
            </Col>
            <Col>
              <Button
                type="default"
                size="large"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18H5a2 2 0 01-2-2V7a2 2 0 012-2h14a2 2 0 012 2v9a2 2 0 01-2 2h-1" />
                    <rect x="6" y="14" width="12" height="8" rx="2" />
                  </svg>
                }
                onClick={handlePrint}
                disabled={loading || !lastSavedInvoice}
                style={{ width: 150, backgroundColor: '#60a5fa', borderColor: '#60a5fa', color: '#fff' }}
              >
                طباعة الفاتورة
              </Button>
            </Col>
            <Col>
              <Button
                type="default"
                size="large"
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h8M8 12h8M8 18h8M4 6h.01M4 12h.01M4 18h.01" />
                  </svg>
                }
                onClick={() => {/* TODO: implement print entry logic */}}
                disabled={loading}
                style={{ width: 150, backgroundColor: '#60a5fa', borderColor: '#60a5fa', color: '#fff' }}
              >
                طباعة القيد
              </Button>
            </Col>
          </Row>

          {/* سجل الفواتير تمت إزالته بناءً على طلب المستخدم */}
        </Card>
      </Spin>

      {/* مودال البحث عن العميل الرسمي */}
      <Modal
        open={showCustomerSearch}
        onCancel={() => {
          setShowCustomerSearch(false);
          setCustomerSearchText('');
        }}
        footer={null}
        title={
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            fontFamily: 'Cairo', 
            fontWeight: 600,
            padding: '16px 0',
            borderBottom: '1px solid #e5e7eb',
            margin: '-24px -24px 20px -24px',
            paddingLeft: 24,
            paddingRight: 24
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                background: '#f8fafc', 
                borderRadius: '8px', 
                padding: 8,
                border: '1px solid #e2e8f0'
              }}>
                <SearchOutlined style={{ color: '#475569', fontSize: 16 }} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1e293b' }}>البحث في قاعدة بيانات العملاء</div>
                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginTop: 2 }}>
                  العثور على العميل المطلوب من خلال معايير البحث المختلفة
                </div>
              </div>
            </div>
            <div style={{ 
              background: '#f1f5f9', 
              borderRadius: '6px', 
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: '#475569',
              border: '1px solid #e2e8f0'
            }}>
              {filteredCustomers.length} نتيجة
            </div>
          </div>
        }
        width={800}
        styles={{ 
          body: { 
            background: '#ffffff', 
            padding: 0
          } 
        }}
        style={{ top: 60 }}
        destroyOnClose
        className="formal-search-modal"
      >
        {/* إضافة الأنماط الرسمية */}
        <style>{`
          .formal-search-modal .ant-modal-content {
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
            border: 1px solid #e5e7eb;
          }
          .formal-search-modal .ant-modal-header {
            border: none;
            padding: 0;
          }
          .formal-search-modal .ant-modal-body {
            padding: 0;
          }
          .formal-search-input {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            margin: 20px 24px;
            padding: 0;
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
          }
          .formal-customer-card {
            border-bottom: 1px solid #f1f5f9;
            padding: 16px 24px;
            background: white;
            cursor: pointer;
            transition: background-color 0.15s ease;
          }
          .formal-customer-card:hover {
            background: #f8fafc;
          }
          .formal-customer-card:last-child {
            border-bottom: none;
          }
          .customer-info-grid {
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 16px;
            align-items: center;
          }
          .customer-initial {
            width: 40px;
            height: 40px;
            border-radius: 6px;
            background: #f1f5f9;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #475569;
            font-weight: 600;
            font-size: 14px;
            border: 1px solid #e2e8f0;
          }
          .customer-details {
            min-width: 0;
          }
          .customer-name {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
            margin: 0 0 4px 0;
            font-family: 'Cairo', sans-serif;
          }
          .customer-contact {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-top: 4px;
          }
          .contact-item {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            color: #64748b;
          }
          .contact-icon {
            width: 12px;
            height: 12px;
            fill: #94a3b8;
          }
          .select-button {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 500;
            color: #475569;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .select-button:hover {
            background: #f1f5f9;
            border-color: #cbd5e1;
            color: #334155;
          }
          .search-stats {
            background: #f8fafc;
            border-bottom: 1px solid #e5e7eb;
            padding: 12px 24px;
            font-size: 12px;
            color: #64748b;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .empty-state {
            text-align: center;
            padding: 60px 24px;
            color: #64748b;
          }
          .empty-icon {
            width: 48px;
            height: 48px;
            background: #f1f5f9;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            border: 1px solid #e2e8f0;
          }
        `}</style>

        {/* حقل البحث الرسمي */}
        <div className="formal-search-input">
          <Input
            placeholder="البحث في العملاء (الاسم، رقم الهاتف، السجل التجاري، الملف الضريبي)"
            size="large"
            value={customerSearchText}
            onChange={(e) => setCustomerSearchText(e.target.value)}
            style={{ 
              fontFamily: 'Cairo', 
              fontSize: 14,
              border: 'none',
              boxShadow: 'none',
              padding: '12px 16px'
            }}
            prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
            suffix={
              customerSearchText && (
                <Button
                  type="text"
                  size="small"
                  icon={
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#94a3b8">
                      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                  }
                  onClick={() => setCustomerSearchText('')}
                  style={{ padding: '4px', height: 'auto' }}
                />
              )
            }
          />
        </div>

        {/* إحصائيات البحث */}
        <div className="search-stats">
          <div>
            إجمالي العملاء: <strong>{customers.length}</strong> | 
            نتائج البحث: <strong>{filteredCustomers.length}</strong> | 
            عملاء الشركات: <strong>{customers.filter(c => c.commercialReg).length}</strong>
          </div>
          {customerSearchText && (
            <div>
              البحث عن: "<strong>{customerSearchText}</strong>"
            </div>
          )}
        </div>

        {/* قائمة النتائج */}
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {filteredCustomers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <SearchOutlined style={{ fontSize: 20, color: '#94a3b8' }} />
              </div>
              <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: '#374151' }}>
                {customerSearchText ? 'لا توجد نتائج مطابقة للبحث' : 'ابدأ في كتابة اسم العميل للبحث'}
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>
                {customerSearchText ? 
                  'تأكد من صحة الإملاء أو جرب كلمات بحث أخرى' : 
                  'يمكنك البحث بالاسم أو رقم الهاتف أو السجل التجاري'
                }
              </div>
            </div>
          ) : (
            filteredCustomers.map((customer, index) => (
              <div
                key={customer.id || index}
                className="formal-customer-card"
                onClick={() => {
                  setInvoiceData({
                    ...invoiceData,
                    customerName: customer.nameAr || customer.name || customer.nameEn || '',
                    customerNumber: customer.phone || customer.mobile || customer.phoneNumber || '',
                    commercialRecord: customer.commercialReg || '',
                    taxFile: customer.taxFileNumber || customer.taxFile || ''
                  });
                  setShowCustomerSearch(false);
                  setCustomerSearchText('');
                  message.success('تم اختيار العميل بنجاح');
                }}
              >
                <div className="customer-info-grid">
                  {/* الحرف الأول */}
                  <div className="customer-initial">
                    {(customer.nameAr || customer.name || 'ع').charAt(0)}
                  </div>
                  
                  {/* تفاصيل العميل */}
                  <div className="customer-details">
                    <h4 className="customer-name">
                      {customer.nameAr || customer.name || customer.nameEn || 'غير محدد'}
                    </h4>
                    {customer.nameEn && customer.nameEn !== customer.nameAr && (
                      <div style={{ 
                        fontSize: 12, 
                        color: '#9ca3af',
                        fontFamily: 'Arial, sans-serif',
                        marginBottom: 8
                      }}>
                        {customer.nameEn}
                      </div>
                    )}
                    
                    <div className="customer-contact">
                      {(customer.phone || customer.mobile || customer.phoneNumber) && (
                        <div className="contact-item">
                          <svg className="contact-icon" viewBox="0 0 24 24">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                          </svg>
                          <span>{customer.phone || customer.mobile || customer.phoneNumber}</span>
                        </div>
                      )}
                      
                      {customer.commercialReg && (
                        <div className="contact-item">
                          <svg className="contact-icon" viewBox="0 0 24 24">
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          <span>س.ت: {customer.commercialReg}</span>
                        </div>
                      )}
                      
                      {(customer.taxFileNumber || customer.taxFile) && (
                        <div className="contact-item">
                          <svg className="contact-icon" viewBox="0 0 24 24">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                          <span>م.ض: {customer.taxFileNumber || customer.taxFile}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* زر الاختيار */}
                  <button
                    className="select-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setInvoiceData({
                        ...invoiceData,
                        customerName: customer.nameAr || customer.name || customer.nameEn || '',
                        customerNumber: customer.phone || customer.mobile || customer.phoneNumber || '',
                        commercialRecord: customer.commercialReg || '',
                        taxFile: customer.taxFileNumber || customer.taxFile || ''
                      });
                      setShowCustomerSearch(false);
                      setCustomerSearchText('');
                      message.success('تم اختيار العميل بنجاح');
                    }}
                  >
                    اختيار
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* مودال الإضافة السريعة للعميل */}
      <Modal
        open={showQuickAddCustomer}
        onCancel={() => {
          setShowQuickAddCustomer(false);
          setQuickCustomerForm({ nameAr: '', phone: '' });
        }}
        footer={null}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Cairo', fontWeight: 700 }}>
            <span style={{ background: '#f0f9ff', borderRadius: '50%', padding: 8, boxShadow: '0 2px 8px #e0e7ef' }}>
              <PlusOutlined style={{ color: '#52c41a' }} />
            </span>
            إضافة عميل سريع
          </div>
        }
        width={500}
        styles={{ 
          body: { 
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
            borderRadius: 16, 
            padding: 24, 
            boxShadow: '0 8px 32px rgba(34, 197, 94, 0.15)' 
          } 
        }}
        style={{ top: 120 }}
        destroyOnClose
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ 
            marginBottom: 12, 
            padding: 12, 
            background: 'rgba(34, 197, 94, 0.1)', 
            borderRadius: 8, 
            textAlign: 'center', 
            fontWeight: 500, 
            color: '#16a34a', 
            fontFamily: 'Cairo', 
            fontSize: 14,
            border: '1px solid rgba(34, 197, 94, 0.2)'
          }}>
            ⚡ إضافة سريعة - الحقول الأساسية فقط
          </div>
        </div>

        <Form
          layout="vertical"
          style={{ fontFamily: 'Cairo' }}
          onFinish={async () => {
            if (!quickCustomerForm.nameAr.trim()) {
              message.error('يرجى إدخال اسم العميل');
              return;
            }
            if (!quickCustomerForm.phone.trim()) {
              message.error('يرجى إدخال رقم الهاتف');
              return;
            }

            try {
              // حفظ العميل في قاعدة البيانات
              const maxNum = customers
                .map(c => {
                  const match = /^c-(\d{4})$/.exec(c.id);
                  return match ? parseInt(match[1], 10) : 0;
                })
                .reduce((a, b) => Math.max(a, b), 0);
              const nextNum = maxNum + 1;
              const newId = `c-${nextNum.toString().padStart(4, '0')}`;
              
              const docData = {
                id: newId,
                nameAr: quickCustomerForm.nameAr.trim(),
                phone: quickCustomerForm.phone.trim(),
                businessType: 'فرد', // افتراضي للإضافة السريعة
                commercialReg: '',
                taxFileNumber: '',
                status: 'نشط',
                createdAt: new Date().toISOString(),
              };
              
              const docRef = await addDoc(collection(db, 'customers'), docData);
              
              // بناء بيانات العميل الجديد
              const newCustomer = {
                id: docRef.id,
                ...docData,
                taxFile: ''
              };

              // تحديث قائمة العملاء المحلية
              // setCustomers(prev => [...prev, newCustomer]); // Now handled by hook
              await fetchBasicData(); // Refresh data from hook

              // تحديد العميل الجديد في الفاتورة
              setInvoiceData({
                ...invoiceData,
                customerName: newCustomer.nameAr,
                customerNumber: newCustomer.phone,
                commercialRecord: '',
                taxFile: ''
              });

              customMessage.success('تم إضافة العميل بنجاح وتم تحديد اختياره في الفاتورة!');
              setShowQuickAddCustomer(false);
              setQuickCustomerForm({ nameAr: '', phone: '' });
              
            } catch (error) {
              console.error('خطأ في إضافة العميل:', error);
              message.error('حدث خطأ أثناء إضافة العميل');
            }
          }}
        >
          <Form.Item
            label="اسم العميل"
            required
            style={{ marginBottom: 16 }}
          >
            <Input
              value={quickCustomerForm.nameAr}
              onChange={(e) => setQuickCustomerForm({
                ...quickCustomerForm,
                nameAr: e.target.value
              })}
              placeholder="اسم العميل باللغة العربية"
              style={{ 
                fontFamily: 'Cairo', 
                fontSize: 15,
                height: 40
              }}
              prefix={
                <UserOutlined style={{ color: '#52c41a' }} />
              }
            />
          </Form.Item>

          <Form.Item
            label="رقم الهاتف"
            required
            style={{ marginBottom: 20 }}
          >
            <Input
              value={quickCustomerForm.phone}
              onChange={(e) => setQuickCustomerForm({
                ...quickCustomerForm,
                phone: e.target.value
              })}
              placeholder="رقم الهاتف أو الجوال"
              style={{ 
                fontFamily: 'Cairo', 
                fontSize: 15,
                height: 40
              }}
              prefix={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#52c41a">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              }
            />
          </Form.Item>

          <div style={{ 
            background: 'rgba(34, 197, 94, 0.05)', 
            padding: 12, 
            borderRadius: 8, 
            marginBottom: 20,
            border: '1px solid rgba(34, 197, 94, 0.2)'
          }}>
            <div style={{ 
              fontSize: 13, 
              color: '#16a34a', 
              fontFamily: 'Cairo',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#16a34a">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              سيتم إضافة العميل واختياره تلقائياً في الفاتورة
            </div>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => {
                  setShowQuickAddCustomer(false);
                  setQuickCustomerForm({ nameAr: '', phone: '' });
                }}
                style={{ 
                  fontFamily: 'Cairo',
                  minWidth: 80,
                  height: 38
                }}
              >
                إلغاء
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{ 
                  fontFamily: 'Cairo',
                  minWidth: 100,
                  fontWeight: 600,
                  height: 38,
                  backgroundColor: '#52c41a',
                  borderColor: '#52c41a'
                }}
                icon={<PlusOutlined />}
              >
                إضافة واختيار
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

    </div>);
};

export default EditSalesInvoice;

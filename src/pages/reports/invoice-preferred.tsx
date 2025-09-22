
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link } from 'react-router-dom';
import { getDocs, query, collection } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { DatePicker, Input, Select, Table, Button, Pagination, Modal, Tag, Card, Spin, Space, message } from "antd";
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { SearchOutlined, PrinterOutlined, FileExcelOutlined, EyeOutlined, DownOutlined, UpOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import styles from './ReceiptVoucher.module.css';

import { useFinancialYear } from '@/hooks/useFinancialYear';
import dayjs from 'dayjs';

const { Option } = Select;


interface WarehouseOption {
  id: string;
  name: string;
}

interface PaymentMethodOption {
  id: string;
  name: string;
}

interface SalesRepAccount {
  id: string;
  name: string;
  number: string;
  mobile: string;
  category?: string;
  type?: string;
}

interface InvoiceRecord {
  key: string;
  id?: string;
  invoiceNumber: string;
  entryNumber?: string;
  date: string;
  branch: string;
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
  customerPhone: string;
  customerMobile?: string;
  seller: string;
  paymentMethod: string;
  invoiceType: string;
  isReturn: boolean;
  extraDiscount?: number;
  itemData?: any;
  createdAt?: any;
  unit?: string;
}



const InvoicePreferred: React.FC = () => {
  const [timeFilter, setTimeFilter] = useState<string>("");
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchId, setBranchId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[]>([]);
  const [seller, setSeller] = useState<string>("");
  const [salesRepAccounts, setSalesRepAccounts] = useState<{ id: string; name: string; number: string; mobile?: string }[]>([]);

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
  const labelStyle = { fontSize: 18, fontWeight: 500, marginBottom: 2, display: 'block' };
  
  useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'paymentMethods'));
        const options = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.id }));
        setPaymentMethods(options);
        console.log('Payment methods loaded:', options.length);
      } catch {
        setPaymentMethods([]);
      }
    };
    fetchPaymentMethods();
  }, []);
  
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'warehouses'));
        const options = snap.docs.map(doc => ({ id: doc.id, name: doc.data().nameAr || doc.data().name || doc.data().nameEn || doc.id }));
        setWarehouses(options);
        console.log('Warehouses loaded:', options.length, options);
      } catch {
        setWarehouses([]);
      }
    };
    fetchWarehouses();
  }, []);
  
  useEffect(() => {
    const fetchSalesReps = async () => {
      try {
        const { db } = await import('@/lib/firebase');
        const { getDocs, collection } = await import('firebase/firestore');
        const snap = await getDocs(collection(db, 'accounts'));
        const reps = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as SalesRepAccount))
          .filter(acc => acc.category === 'مبيعات' || acc.type === 'مبيعات')
          .map(acc => ({
            id: acc.id,
            name: acc.name || acc.id,
            number: acc.number || acc.id,
            mobile: acc.mobile || ''
          }));
        setSalesRepAccounts(reps);
        console.log('Sales reps loaded:', reps.length, reps);
      } catch {
        setSalesRepAccounts([]);
      }
    };
    fetchSalesReps();
  }, []);
  const [dateFrom, setDateFrom] = useState<dayjs.Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<dayjs.Dayjs | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhoneFilter, setCustomerPhoneFilter] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [itemNumberFilter, setItemNumberFilter] = useState<string>("");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<string>("");
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  // سنستخدم نوع جديد يمثل كل صنف في الفاتورة
  interface InvoiceItemRow extends InvoiceRecord {
    unit?: string;
    totalAfterDiscount?: number;
  }
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceItemRow[]>([]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(30); // عدد الصفوف في كل صفحة

  // السنة المالية من السياق
  const { currentFinancialYear } = useFinancialYear();

  // دالة لفلترة التواريخ المسموحة في DatePicker حسب السنة المالية
  const disabledDate = (current: dayjs.Dayjs) => {
    if (!currentFinancialYear) return false;
    
    const startDate = dayjs(currentFinancialYear.startDate);
    const endDate = dayjs(currentFinancialYear.endDate);
    
    return current.isBefore(startDate, 'day') || current.isAfter(endDate, 'day');
  };

  // تعيين التواريخ الافتراضية حسب السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      setDateFrom(dayjs(currentFinancialYear.startDate));
      setDateTo(dayjs(currentFinancialYear.endDate));
    }
  }, [currentFinancialYear]);
  useEffect(() => {
    fetchBranches().then(data => {
      setBranches(data);
      setBranchesLoading(false);
    });
  }, []);
  
  // تعديل: جعل fetchInvoices تقبل فلاتر كوسائط (للاستخدام عند البحث فقط)
  const fetchInvoices = async (filtersParams?: {
    branchId?: string;
    invoiceNumber?: string;
    dateFrom?: dayjs.Dayjs | null;
    dateTo?: dayjs.Dayjs | null;
    warehouseId?: string;
    customerName?: string;
    customerPhone?: string;
    itemName?: string;
    itemNumber?: string;
  }) => {
    console.log('DEBUG - fetchInvoices called', filtersParams);
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      // جلب جميع الأصناف
      let inventoryItems: any[] = [];
      try {
        const itemsSnap = await getDocs(collection(db, 'inventory_items'));
        inventoryItems = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (e) {
        console.log('DEBUG - error fetching inventory_items:', e);
      }
      let q;
      const filters: any[] = [];
      const params = filtersParams || {};
      if (params.branchId) filters.push(where('branch', '==', params.branchId));
      if (params.invoiceNumber) filters.push(where('invoiceNumber', '==', params.invoiceNumber));
      if (params.dateFrom) filters.push(where('date', '>=', dayjs(params.dateFrom).format('YYYY-MM-DD')));
      if (params.dateTo) filters.push(where('date', '<=', dayjs(params.dateTo).format('YYYY-MM-DD')));
      if (params.warehouseId) filters.push(where('warehouse', '==', params.warehouseId));
      if (filters.length > 0) {
        const { query: qFn } = await import('firebase/firestore');
        q = qFn(collection(db, 'sales_invoices'), ...filters);
      } else {
        q = collection(db, 'sales_invoices');
      }
      // لا يمكن عمل تصفية مباشرة على الحقول غير المفهرسة أو الفرعية، سنستخدم الفلاتر بعد الجلب
      const snapshot = await getDocs(q);
      const salesRecords: InvoiceRecord[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        const invoiceNumber = data.invoiceNumber || '';
        const date = data.date || '';
        const branch = data.branch || '';
        const customer = data.customerName || data.customer || '';
        const seller = data.delegate || data.seller || '';
        const paymentMethod = data.paymentMethod || '';
        const invoiceType = data.type || '';
        console.log('DEBUG - Processing invoice:', doc.id, 'seller from data:', seller, 'data.delegate:', data.delegate, 'data.seller:', data.seller);
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((item: any, idx: number) => {
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          const quantity = Number(item.quantity) || 0;
          
          // حساب الإجمالي الأساسي
          const total = price * quantity;
          
          // حساب قيمة الخصم - إما من القيمة المحفوظة أو من النسبة
          let discountValue = Number(item.discountValue) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          
          // إذا لم تكن قيمة الخصم محفوظة، احسبها من النسبة
          if (!item.discountValue && discountPercent > 0) {
            discountValue = (total * discountPercent) / 100;
          }
          
          // حساب المبلغ بعد الخصم
          const totalAfterDiscount = total - discountValue;
          
          // حساب قيمة الضريبة - إما من القيمة المحفوظة أو من النسبة
          let taxValue = Number(item.taxValue) || 0;
          const taxPercent = Number(item.taxPercent) || 0;
          
          // إذا لم تكن قيمة الضريبة محفوظة، احسبها من النسبة على المبلغ بعد الخصم
          if (!item.taxValue && taxPercent > 0) {
            taxValue = (totalAfterDiscount * taxPercent) / 100;
          }
          
          // حساب الصافي النهائي - استخدم القيمة المحفوظة أو احسبها
          const net = Number(item.net) || (totalAfterDiscount + taxValue);
          
          const profit = (price - cost) * quantity;
          
          // إضافة console.log للتحقق من صحة الحسابات
          console.log('Sales Invoice Calculation:', {
            itemName: item.itemName,
            price,
            quantity,
            total,
            discountPercent,
            discountValue,
            totalAfterDiscount,
            taxPercent,
            taxValue,
            net,
            profit
          });
          
          // التحقق من صحة الحسابات
          const calculatedTotal = price * quantity;
          const calculatedDiscountValue = discountPercent > 0 ? (calculatedTotal * discountPercent) / 100 : 0;
          const calculatedAfterDiscount = calculatedTotal - (item.discountValue || calculatedDiscountValue);
          const calculatedTaxValue = taxPercent > 0 ? (calculatedAfterDiscount * taxPercent) / 100 : 0;
          const calculatedNet = calculatedAfterDiscount + (item.taxValue || calculatedTaxValue);
          
          if (Math.abs(total - calculatedTotal) > 0.01) {
            console.warn('Total mismatch:', { stored: total, calculated: calculatedTotal, item: item.itemName });
          }
          if (Math.abs(net - calculatedNet) > 0.01) {
            console.warn('Net mismatch:', { stored: net, calculated: calculatedNet, item: item.itemName });
          }
          // استخراج رقم العميل من جميع الحقول المحتملة مع التأكد من أنها سترينج
          const customerPhone =
            (typeof item.customerPhone === 'string' && item.customerPhone.trim() !== '' && item.customerPhone) ||
            (typeof item.customerMobile === 'string' && item.customerMobile.trim() !== '' && item.customerMobile) ||
            (typeof item.customerNumber === 'string' && item.customerNumber.trim() !== '' && item.customerNumber) ||
            (typeof item.phone === 'string' && item.phone.trim() !== '' && item.phone) ||
            (typeof item.mobile === 'string' && item.mobile.trim() !== '' && item.mobile) ||
            (typeof item.phoneNumber === 'string' && item.phoneNumber.trim() !== '' && item.phoneNumber) ||
            (typeof data.customerPhone === 'string' && data.customerPhone.trim() !== '' && data.customerPhone) ||
            (typeof data.customerMobile === 'string' && data.customerMobile.trim() !== '' && data.customerMobile) ||
            (typeof data.customerNumber === 'string' && data.customerNumber.trim() !== '' && data.customerNumber) ||
            (typeof data.phone === 'string' && data.phone.trim() !== '' && data.phone) ||
            (typeof data.mobile === 'string' && data.mobile.trim() !== '' && data.mobile) ||
            (typeof data.phoneNumber === 'string' && data.phoneNumber.trim() !== '' && data.phoneNumber) ||
            '';
          // جلب اسم الفئة الرئيسية (الأب) من inventory_items
          let parentName = '';
          const foundItem = inventoryItems.find(i => i.name === item.itemName);
          if (foundItem && foundItem.parentId) {
            const parentItem = inventoryItems.find(i => i.id === foundItem.parentId || i.id === String(foundItem.parentId));
            parentName = parentItem?.name || '';
          }
          salesRecords.push({
            key: doc.id + '-' + idx,
            invoiceNumber,
            date,
            branch,
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            mainCategory: parentName,
            quantity,
            price,
            total,
            discountValue,
            discountPercent,
            taxValue,
            taxPercent,
            net,
            cost,
            profit,
            warehouse: item.warehouseId || data.warehouse || '',
            customer,
            customerPhone,
            seller,
            paymentMethod,
            invoiceType: invoiceType || 'فاتورة',
            isReturn: false,
            extraDiscount: item.extraDiscount,
            itemData: item,
            createdAt: data.createdAt || undefined
          });
          console.log('DEBUG - Pushed salesRecord with seller:', seller, 'for item:', item.itemName);
        });
      });
      let qReturn;
      const filtersReturn: any[] = [];
      if (params.branchId) filtersReturn.push(where('branch', '==', params.branchId));
      if (params.invoiceNumber) filtersReturn.push(where('invoiceNumber', '==', params.invoiceNumber));
      if (params.dateFrom) filtersReturn.push(where('date', '>=', dayjs(params.dateFrom).format('YYYY-MM-DD')));
      if (params.dateTo) filtersReturn.push(where('date', '<=', dayjs(params.dateTo).format('YYYY-MM-DD')));
      if (params.warehouseId) filtersReturn.push(where('warehouse', '==', params.warehouseId));
      if (filtersReturn.length > 0) {
        const { query: qFn } = await import('firebase/firestore');
        qReturn = qFn(collection(db, 'sales_returns'), ...filtersReturn);
      } else {
        qReturn = collection(db, 'sales_returns');
      }
      const snapshotReturn = await getDocs(qReturn);
      const returnRecords: InvoiceRecord[] = [];
      snapshotReturn.forEach(doc => {
      const data = doc.data() as any;
        // استخدم رقم المرتجع بدلاً من رقم الفاتورة في المرتجع
        const referenceNumber = data.referenceNumber || '';
        const invoiceNumber = referenceNumber || data.invoiceNumber || '';
        const date = data.date || '';
        const branch = typeof data.branch === 'string' ? data.branch : '';
        const customer = data.customerName || data.customer || '';
        const customerPhone = data.customerPhone || '';
        const seller = data.seller || '';
        const paymentMethod = data.paymentMethod || '';
        const invoiceType = 'مرتجع';
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((item: any, idx: number) => {
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          const quantity = Number(item.returnedQty) || 0; // للمرتجعات نستخدم returnedQty
          
          // حساب الإجمالي الأساسي (موجب لأن هذا هو المبلغ الأساسي)
          const total = price * quantity;
          
          // حساب قيمة الخصم - للمرتجعات تكون موجبة (لأننا نحتاج لطرحها من الإجمالي)
          let discountValue = Math.abs(Number(item.discountValue)) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          
          // إذا لم تكن قيمة الخصم محفوظة، احسبها من النسبة
          if (!item.discountValue && discountPercent > 0) {
            discountValue = (total * discountPercent) / 100;
          }
          
          // حساب المبلغ بعد الخصم
          const totalAfterDiscount = total - discountValue;
          
          // حساب قيمة الضريبة - للمرتجعات تكون موجبة (لأننا نحتاج لإضافتها)
          let taxValue = Math.abs(Number(item.taxValue)) || 0;
          const taxPercent = Number(item.taxPercent) || 0;
          
          // إذا لم تكن قيمة الضريبة محفوظة، احسبها من النسبة على المبلغ بعد الخصم
          if (!item.taxValue && taxPercent > 0) {
            taxValue = (totalAfterDiscount * taxPercent) / 100;
          }
          
          // حساب الصافي النهائي - للمرتجعات يكون سالب (لأنه مرتجع)
          const netBeforeSign = totalAfterDiscount + taxValue;
          const net = -Math.abs(Number(item.net) || netBeforeSign);
          
          // الربح للمرتجعات يكون سالب
          const profit = -Math.abs((price - cost) * quantity);
          
          // إضافة console.log للتحقق من صحة الحسابات للمرتجعات
          console.log('Return Calculation:', {
            itemName: item.itemName,
            price,
            quantity,
            total,
            discountPercent,
            discountValue: -discountValue,
            totalAfterDiscount,
            taxPercent,
            taxValue: -taxValue,
            net,
            profit
          });
          // استخراج رقم العميل من جميع الحقول المحتملة مع التأكد من أنها سترينج
          const customerPhone =
            (typeof item.customerPhone === 'string' && item.customerPhone.trim() !== '' && item.customerPhone) ||
            (typeof item.customerMobile === 'string' && item.customerMobile.trim() !== '' && item.customerMobile) ||
            (typeof item.customerNumber === 'string' && item.customerNumber.trim() !== '' && item.customerNumber) ||
            (typeof item.phone === 'string' && item.phone.trim() !== '' && item.phone) ||
            (typeof item.mobile === 'string' && item.mobile.trim() !== '' && item.mobile) ||
            (typeof item.phoneNumber === 'string' && item.phoneNumber.trim() !== '' && item.phoneNumber) ||
            (typeof data.customerPhone === 'string' && data.customerPhone.trim() !== '' && data.customerPhone) ||
            (typeof data.customerMobile === 'string' && data.customerMobile.trim() !== '' && data.customerMobile) ||
            (typeof data.customerNumber === 'string' && data.customerNumber.trim() !== '' && data.customerNumber) ||
            (typeof data.phone === 'string' && data.phone.trim() !== '' && data.phone) ||
            (typeof data.mobile === 'string' && data.mobile.trim() !== '' && data.mobile) ||
            (typeof data.phoneNumber === 'string' && data.phoneNumber.trim() !== '' && data.phoneNumber) ||
            '';
          // جلب اسم الفئة الرئيسية (الأب) من inventory_items إذا لم تكن موجودة
          let parentName = item.mainCategory || '';
          if (!parentName && inventoryItems && item.itemName) {
            const foundItem = inventoryItems.find(i => i.name === item.itemName);
            if (foundItem && foundItem.parentId) {
              const parentItem = inventoryItems.find(i => i.id === foundItem.parentId || i.id === String(foundItem.parentId));
              parentName = parentItem?.name || '';
            }
          }
          returnRecords.push({
            key: 'return-' + doc.id + '-' + idx,
            invoiceNumber, // سيحمل رقم المرتجع في حالة المرتجع
            date,
            branch,
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            mainCategory: parentName,
            quantity: -quantity, // الكمية سالبة للمرتجعات
            price,
            total: -total, // الإجمالي سالب للمرتجعات
            discountValue: -discountValue, // قيمة الخصم سالبة للمرتجعات
            discountPercent,
            taxValue: -taxValue, // قيمة الضريبة سالبة للمرتجعات
            taxPercent,
            net,
            cost,
            profit,
            warehouse: item.warehouseId || data.warehouse || '',
            customer,
            customerPhone,
            seller,
            paymentMethod,
            invoiceType,
            isReturn: true,
            extraDiscount: undefined,
            itemData: item,
            createdAt: data.createdAt || undefined
          });
        });
      });
      // بدلاً من التجميع، اعرض كل الأصناف مباشرة
      const all = [...salesRecords, ...returnRecords];
      
      console.log(`DEBUG - Fetched ${salesRecords.length} sales records and ${returnRecords.length} return records`);
      
      // تصفية إضافية بعد الجلب
      let filteredAll = all;
      if (params.customerName) {
        filteredAll = filteredAll.filter(inv =>
          inv.customer && inv.customer.toLowerCase().includes(params.customerName.toLowerCase())
        );
      }
      if (params.customerPhone) {
        filteredAll = filteredAll.filter(inv =>
          inv.customerPhone && inv.customerPhone.toLowerCase().includes(params.customerPhone.toLowerCase())
        );
      }
      if (params.itemName) {
        filteredAll = filteredAll.filter(inv =>
          inv.itemName && inv.itemName.toLowerCase().includes(params.itemName.toLowerCase())
        );
      }
      if (params.itemNumber) {
        filteredAll = filteredAll.filter(inv =>
          inv.itemNumber && inv.itemNumber.toLowerCase().includes(params.itemNumber.toLowerCase())
        );
      }
      setInvoices(filteredAll);
      console.log('DEBUG - setInvoices called with:', filteredAll);
      
      // إحصائيات سريعة للتحقق من صحة البيانات
      const totalSalesItems = salesRecords.length;
      const totalReturnItems = returnRecords.length;
      const totalValue = filteredAll.reduce((sum, item) => sum + (item.net || 0), 0);
      
      console.log('Data Summary:', {
        totalSalesItems,
        totalReturnItems,
        totalItems: filteredAll.length,
        totalValue: totalValue.toFixed(2)
      });
      
      // Debug: طباعة النتائج النهائية في الكونسول
      console.log('DEBUG - Final result array:', filteredAll);
    } catch (err) {
      setInvoices([]);
      console.log('DEBUG - fetchInvoices error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // جلب كل البيانات عند تحميل الصفحة فقط (بدون فلاتر)
  useEffect(() => {
    fetchInvoices();
  }, []);

  // عند تغيير invoices (بعد الجلب)، اعرض كل البيانات مباشرة في الجدول
  useEffect(() => {
    // لكل فاتورة، إذا كان فيها أصناف (itemData.items)، أنشئ صف لكل صنف
    const allRows: InvoiceItemRow[] = [];
    invoices.forEach(inv => {
      if (inv.itemData && Array.isArray(inv.itemData.items)) {
        inv.itemData.items.forEach((item: any) => {
          const price = Number(item.price) || 0;
          const quantity = Number(item.quantity) || Number(item.returnedQty) || 0;
          
          // حساب الخصم والضرائب بطريقة صحيحة
          let discountValue = Number(item.discountValue) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          
          // إذا لم تكن قيمة الخصم محفوظة، احسبها من النسبة
          if (!item.discountValue && discountPercent > 0) {
            discountValue = (price * quantity * discountPercent) / 100;
          }
          
          // للمرتجعات، تأكد من أن الخصم سالب
          if (inv.isReturn) {
            discountValue = -Math.abs(discountValue);
          }
          
          const totalAfterDiscount = (price * quantity) - Math.abs(discountValue);
          
          let taxValue = Number(item.taxValue) || 0;
          const taxPercent = Number(item.taxPercent) || 0;
          
          // إذا لم تكن قيمة الضريبة محفوظة، احسبها من النسبة
          if (!item.taxValue && taxPercent > 0) {
            taxValue = (totalAfterDiscount * taxPercent) / 100;
          }
          
          // للمرتجعات، تأكد من أن الضريبة سالبة
          if (inv.isReturn) {
            taxValue = -Math.abs(taxValue);
          }
          
          const net = Number(item.net) || (inv.isReturn ? 
            -(totalAfterDiscount + Math.abs(taxValue)) : 
            (totalAfterDiscount + Math.abs(taxValue))
          );
          
          allRows.push({
            ...inv,
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            mainCategory: inv.mainCategory || '',
            quantity: inv.isReturn ? -Math.abs(quantity) : quantity,
            price,
            discountValue,
            discountPercent,
            taxValue,
            taxPercent,
            net,
            unit: item.unit || inv.unit || (inv.itemData && inv.itemData.unit) || '',
            createdAt: item.createdAt || inv.createdAt,
            warehouse: item.warehouseId || inv.warehouse,
            totalAfterDiscount: inv.isReturn ? 
              -(totalAfterDiscount > 0 ? totalAfterDiscount : 0) : 
              (totalAfterDiscount > 0 ? totalAfterDiscount : 0),
            itemData: item,
          });
        });
      } else {
        allRows.push(inv);
      }
    });
    setFilteredInvoices(allRows);
  }, [invoices]);
  // دالة تعرض البيانات المفلترة للعرض فقط حسب الفلاتر الإضافية - محسنة بـ useMemo
  const filteredRows = useMemo(() => {
    // إذا لم يتم اختيار أي فلتر، أرجع كل البيانات
    if (!invoiceTypeFilter && !paymentMethod && !seller) {
      return filteredInvoices;
    }
    let filtered = filteredInvoices;
    if (invoiceTypeFilter) {
      if (invoiceTypeFilter === 'فاتورة') {
        filtered = filtered.filter(inv => !inv.isReturn);
      } else if (invoiceTypeFilter === 'مرتجع') {
        filtered = filtered.filter(inv => inv.isReturn);
      } else {
        filtered = filtered.filter(inv => inv.invoiceType === invoiceTypeFilter);
      }
    }
    if (paymentMethod) {
      filtered = filtered.filter(inv => inv.paymentMethod === paymentMethod);
    }
    if (seller) {
      filtered = filtered.filter(inv => inv.seller === seller);
    }
    return filtered;
  }, [filteredInvoices, invoiceTypeFilter, paymentMethod, seller]);

  // دالة للحصول على البيانات المقسمة على صفحات - محسنة بـ useMemo
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage, pageSize]);

  // حساب إجمالي عدد الصفحات - محسنة بـ useMemo
  const totalPages = useMemo(() => {
    return Math.ceil(filteredRows.length / pageSize);
  }, [filteredRows.length, pageSize]);

  // دالة للتوافق مع الكود القديم
  const getFilteredRows = () => filteredRows;
  const getPaginatedRows = () => paginatedRows;
  const getTotalPages = () => totalPages;

  // إعادة تعيين الصفحة الحالية إلى 1 عند تغيير الفلاتر
  useEffect(() => {
    setCurrentPage(1);
  }, [invoiceTypeFilter, paymentMethod, seller, filteredInvoices]);
  // عند الضغط على زر البحث: جلب البيانات مع الفلاتر
  const handleSearch = () => {
    fetchInvoices({
      branchId,
      invoiceNumber,
      dateFrom,
      dateTo,
      warehouseId,
      customerName,
      customerPhone: customerPhoneFilter,
      itemName,
      itemNumber: itemNumberFilter
    }).then(() => {
      // بعد جلب النتائج، إذا كان هناك اسم عميل محدد ونتيجة واحدة فقط، ضع رقم العميل تلقائياً
      if (customerName && Array.isArray(invoices)) {
        const filtered = invoices.filter(inv => inv.customer && inv.customer === customerName);
        if (filtered.length === 1 && filtered[0].customerPhone) {
          setCustomerPhoneFilter(filtered[0].customerPhone);
        }
      }
    });
  };
  
  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  };

  // دالة لجلب اسم المخزن من القائمة
  const getWarehouseName = (warehouseId: string) => {
    if (!warehouseId || warehouseId.trim() === '') return 'غير محدد';
    const warehouse = warehouses.find(w => w.id === warehouseId);
    const result = warehouse ? warehouse.name : warehouseId;
    console.log('getWarehouseName:', warehouseId, '->', result, 'warehouses count:', warehouses.length);
    return result;
  };

  // دالة لجلب اسم البائع من القائمة
  const getSalesRepName = (salesRepId: string) => {
    // إذا كان salesRepId فارغ أو undefined، أرجع قيمة افتراضية
    if (!salesRepId || salesRepId.trim() === '') return 'غير محدد';
    
    // ابحث في قائمة حسابات البائعين أولاً
    const foundRep = salesRepAccounts.find(rep => 
      rep.id === salesRepId || 
      rep.name === salesRepId || 
      rep.name.toLowerCase().includes(salesRepId.toLowerCase()) ||
      salesRepId.toLowerCase().includes(rep.name.toLowerCase()) ||
      rep.number === salesRepId
    );
    
    if (foundRep) {
      console.log('getSalesRepName found in salesRepAccounts:', salesRepId, '->', foundRep.name);
      return foundRep.name;
    }
    
    // في حالة عدم العثور عليه في الحسابات، ابحث في البائعين الموجودين في الفواتير
    const uniqueSellers = Array.from(new Set(invoices.map(inv => inv.seller).filter(s => !!s && s !== '')));
    const foundSeller = uniqueSellers.find(seller => 
      seller === salesRepId || 
      seller.toLowerCase().includes(salesRepId.toLowerCase()) || 
      salesRepId.toLowerCase().includes(seller.toLowerCase())
    );
    
    const result = foundSeller || salesRepId;
    console.log('getSalesRepName:', salesRepId, '->', result, 'salesRepAccounts count:', salesRepAccounts.length);
    return result;
  };
  const handleExport = async () => {
    let ExcelJS = (window as any).ExcelJS;
    if (!ExcelJS) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
        script.onload = () => {
          ExcelJS = (window as any).ExcelJS;
          resolve(null);
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
      ExcelJS = (window as any).ExcelJS;
    }

    // استخدام نفس البيانات المعروضة في الجدول
    const tableData = getFilteredRows();

    const exportData = tableData.map(row => {
      const parseTime = (val: unknown) => {
        if (!val) return '';
        if (typeof val === 'object' && val !== null && 'seconds' in val) {
          return dayjs((val as { seconds: number }).seconds * 1000).format('YYYY-MM-DD HH:mm:ss');
        }
        if (typeof val === 'string') {
          const d = dayjs(val);
          if (d.isValid()) return d.format('YYYY-MM-DD HH:mm:ss');
        }
        return '';
      };

      // استخدم البيانات المحسوبة بالفعل من الصف بدلاً من إعادة الحساب
      const quantity = row.quantity || 0;
      const price = row.price || 0;
      const discountValue = row.discountValue || 0;
      const discountPercent = row.discountPercent || 0;
      const taxValue = row.taxValue || 0;
      const taxPercent = row.taxPercent || 0;
      const net = row.net || 0;
      
      // حساب الإجمالي بعد الخصم من البيانات الموجودة
      const totalAfterDiscount = row.totalAfterDiscount || ((price * Math.abs(quantity)) - Math.abs(discountValue));

      return [
        row.invoiceNumber || '',
        row.date ? dayjs(row.date).format('YYYY-MM-DD') : '',
        row.invoiceType || '',
        row.itemNumber || '',
        row.itemName || '',
        row.mainCategory || '',
        quantity,
        row.unit || 'قطعة',
        Number(price).toFixed(2),
        Number(discountPercent).toFixed(2) + '%',
        Number(discountValue).toFixed(2),
        Number(totalAfterDiscount).toFixed(2),
        Number(taxValue).toFixed(2),
        Number(net).toFixed(2),
        row.customer || '',
        (row.customerPhone && row.customerPhone.trim() !== '' ? row.customerPhone : 'غير متوفر'),
        parseTime(row.createdAt) || (row.date ? dayjs(row.date).format('YYYY-MM-DD HH:mm:ss') : ''),
        Number(taxPercent).toFixed(2) + '%',
        'ر.س',
        getWarehouseName(row.warehouse) || '',
        getBranchName(row.branch) || '',
        row.paymentMethod || '-'
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الفواتير التفصيلي');
    
    // تحديد الأعمدة بنفس ترتيب الجدول
    sheet.columns = [
      { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 20 },
      { header: 'تاريخ الفاتورة', key: 'date', width: 15 },
      { header: 'نوع الفاتورة', key: 'type', width: 12 },
      { header: 'كود الصنف', key: 'itemNumber', width: 20 },
      { header: 'اسم الصنف', key: 'itemName', width: 50 },
      { header: 'الفئة', key: 'mainCategory', width: 15 },
      { header: 'الكمية', key: 'quantity', width: 10 },
      { header: 'الوحدة', key: 'unit', width: 10 },
      { header: 'سعر الوحدة', key: 'price', width: 12 },
      { header: 'نسبة الخصم', key: 'discountPercent', width: 12 },
      { header: 'قيمة الخصم', key: 'discountValue', width: 14 },
      { header: 'الإجمالي بعد الخصم', key: 'totalAfterDiscount', width: 18 },
      { header: 'قيمة الضريبة', key: 'taxValue', width: 16 },
      { header: 'الصافي', key: 'net', width: 12 },
      { header: 'اسم العميل', key: 'customer', width: 45 },
      { header: 'رقم العميل', key: 'customerPhone', width: 18 },
      { header: 'وقت الإنشاء', key: 'createdAt', width: 18 },
      { header: 'نسبة الضريبة', key: 'taxPercent', width: 12 },
      { header: 'العملة', key: 'currency', width: 12 },
      { header: 'المخزن', key: 'warehouse', width: 15 },
      { header: 'الفرع', key: 'branch', width: 15 },
      { header: 'طريقة الدفع', key: 'paymentMethod', width: 15 }
    ];
    
    sheet.addRows(exportData);

    // إضافة صف الإجماليات
    if (exportData.length > 0) {
      // حساب الإجماليات
      let totalQuantity = 0;
      let totalDiscount = 0;
      let totalAfterDiscount = 0;
      let totalTax = 0;
      let totalNet = 0;

      tableData.forEach((row) => {
        // استخدم البيانات المحسوبة بالفعل
        totalQuantity += row.quantity || 0;
        totalDiscount += row.discountValue || 0;
        totalAfterDiscount += row.totalAfterDiscount || 0;
        totalTax += row.taxValue || 0;
        totalNet += row.net || 0;
      });

      // إضافة صف فارغ قبل الإجماليات
      sheet.addRow([]);
      
      // إضافة صف الإجماليات
      const summaryRow = sheet.addRow([
        'الإجماليات',
        '',
        '',
        '',
        '',
        '',
        totalQuantity.toLocaleString(),
        '',
        '',
        '',
        totalDiscount.toFixed(2),
        totalAfterDiscount.toFixed(2),
        totalTax.toFixed(2),
        totalNet.toFixed(2),
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);

      // تنسيق صف الإجماليات
      summaryRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FF000000' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFEB3B' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thick', color: { argb: 'FF000000' } },
          bottom: { style: 'thick', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        };
      });
    }
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF305496' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDDEBF7' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      };
    });
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        };
        if (i % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F9FC' }
          };
        }
      });
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_الفواتير_التفصيلي_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };


  // مودال عرض تفاصيل الفاتورة
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // بيانات الشركة
  const [companyData, setCompanyData] = useState<any>({});
  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const { db } = await import('@/lib/firebase');
        const { query, collection, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, "companies"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setCompanyData({ ...docData.data() });
        }
      } catch (e) {
        // يمكن إضافة toast هنا إذا أردت
        console.error("Error fetching company for print: ", e);
      }
    };
    fetchCompany();
  }, []);

  // دالة طباعة جدول التقرير
  const handlePrint = () => {
    // تأكد من تحميل بيانات الشركة قبل الطباعة
    if (!companyData || !companyData.arabicName) {
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast.error('لم يتم تحميل بيانات الشركة بعد، يرجى المحاولة بعد لحظات');
      } else {
        alert('لم يتم تحميل بيانات الشركة بعد، يرجى المحاولة بعد لحظات');
      }
      return;
    }

    // استخدام نفس البيانات المعروضة في الجدول
    const tableData = getFilteredRows();

    // حساب الإجماليات من بيانات الجدول
    let totalQuantity = 0;
    let totalDiscount = 0;
    let totalAfterDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;
    let totalAmount = 0;

      tableData.forEach((row) => {
        const sign = row.invoiceType === 'مرتجع' ? -1 : 1;
        totalQuantity += sign * (row.quantity || 0);
        const subtotal = (row.price || 0) * (row.quantity || 0);
        totalAmount += sign * subtotal;
        totalDiscount += (row.discountValue || 0); // القيمة تحتوي على الإشارة الصحيحة بالفعل
        totalAfterDiscount += sign * (subtotal - Math.abs(row.discountValue || 0));
        totalTax += (row.taxValue || 0); // القيمة تحتوي على الإشارة الصحيحة بالفعل
        totalNet += (row.net || 0); // القيمة تحتوي على الإشارة الصحيحة بالفعل
      });    const printWindow = window.open('', '', 'width=1400,height=900');
    printWindow?.document.write(`
       <html>
    <head>
      <title>طباعة تقرير التفصيلي</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
        @page { 
          size: A4 landscape; 
          margin: 15mm; 
        }
        body { 
          font-family: 'Tajawal', Arial, sans-serif; 
          direction: rtl; 
          padding: 10px; 
          font-size: 11px;
          line-height: 1.3;
          margin: 0;
        }
        .company-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 15px;
          border-bottom: 1px solid #000;
          padding-bottom: 10px;
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
          width: 100px;
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
        .header {
          text-align: center;
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .header h1 {
          color: #000;
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        .header p {
          color: #000;
          margin: 3px 0 0 0;
          font-size: 12px;
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-bottom: 20px;
          font-size: 10px;
        }
        th, td { 
          border: 1px solid #d1d5db; 
          padding: 4px 2px; 
          text-align: center;
          vertical-align: middle;
          font-size: 9px;
        }
        th { 
          background-color: #bbbbbc !important;
          color: #fff;
          font-weight: 600;
          font-size: 9px;
          padding: 6px 4px;
        }
        tbody tr:nth-child(even) {
          background-color: #f5f5f5;
        }
        tbody tr:hover {
          background-color: #e5e5e5;
        }

        .return-invoice {
          color: #000;
          font-weight: 600;
        }
        .normal-invoice {
          color: #000;
          font-weight: 600;
        }
        .print-date {
          text-align: left;
          margin-top: 15px;
          font-size: 9px;
          color: #000;
        }
        /* Hide totals footer on all pages except the last one */
        .print-last-page-only {
          display: none;
        }
        /* جدول الإجماليات المنفصل */
        .totals-container {
          margin-top: 20px;
          display: flex;
          justify-content: flex-start;
          direction: rtl;
        }
        .totals-table {
          width: 300px;
          font-size: 12px;
          border-radius: 8px;
          overflow: hidden;
        }
        .totals-table th {
          background-color: #000;
          color: #fff;
          padding: 10px;
          text-align: center;
          font-size: 14px;
        }
        .totals-table .total-label {
          background-color: #f8f9fa;
          padding: 8px 12px;
          text-align: right;
          width: 60%;
        }
        .totals-table .total-value {
          background-color: #fff;
          padding: 8px 12px;
          text-align: left;
          width: 40%;
        }
        .totals-table .final-total .total-label {
          background-color: #e9ecef;
          color: #000;
        }
        .totals-table .final-total .total-value {
          background-color: #f1f3f4;
          color: #000;
          font-size: 13px;
        }
        @media print {
          body { margin: 0; padding: 10px; }
          .no-print { display: none; }
          /* Show totals footer only on the last page */
          .print-last-page-only {
            display: block;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Force the totals to appear at the bottom of the last page */
          table {
            page-break-inside: auto;
          }
          tbody {
            page-break-inside: auto;
          }
          .print-last-page-only {
            page-break-before: avoid;
            break-before: avoid;
          }
        }
      </style>
    </head>
    <body>
      <!-- Company Header Section -->
      <div class="company-header">
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
      
      <div class="header">
        <h1>تقرير فواتير المبيعات التفصيلي</h1>
        <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
        ${dateFrom && dateTo ? `
        <div style="margin-top: 10px; font-size: 14px;  color: #333;">
          الفترة: من ${dateFrom.format('DD/MM/YYYY')} إلى ${dateTo.format('DD/MM/YYYY')}
        </div>
        ` : ''}
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 70px;">رقم الفاتورة</th>
            <th style="width: 70px;">التاريخ</th>
            <th style="width: 70px;">نوع الفاتورة</th>
            <th style="width: 80px;">كود الصنف</th>
            <th style="width: 120px;">اسم الصنف</th>
            <th style="width: 80px;">الفئة</th>
            <th style="width: 50px;">الكمية</th>
            <th style="width: 50px;">الوحدة</th>
            <th style="width: 60px;">سعر الوحدة</th>
            <th style="width: 70px;">قيمة الخصم</th>
            <th style="width: 80px;">بعد الخصم</th>
            <th style="width: 70px;">قيمة الضريبة</th>
            <th style="width: 70px;">الصافي</th>
            <th style="width: 120px;">اسم العميل</th>
            <th style="width: 80px;">رقم العميل</th>
            <th style="width: 80px;">وقت الإنشاء</th>
            <th style="width: 65px;">الفرع</th>
            <th style="width: 65px;">المخزن</th>
            <th style="width: 70px;">طريقة الدفع</th>
          </tr>
        </thead>
        <tbody>
          ${tableData.map(row => {
            const sign = row.invoiceType === 'مرتجع' ? -1 : 1;
            const subtotal = (row.price || 0) * (row.quantity || 0);
            const afterDiscount = subtotal - (row.discountValue || 0);
            
            const parseTime = (val) => {
              if (!val) return '';
              if (typeof val === 'object' && val.seconds) {
                return new Date(val.seconds * 1000).toLocaleTimeString('ar-SA');
              }
              if (typeof val === 'string') {
                const d = new Date(val);
                if (!isNaN(d.getTime())) return d.toLocaleTimeString('ar-SA');
              }
              return '';
            };

            return '<tr>' +
              '<td>' + (row.invoiceNumber || '-') + '</td>' +
              '<td>' + (row.date ? new Date(row.date).toLocaleDateString('ar-SA') : '') + '</td>' +
              '<td class="' + (row.invoiceType === 'مرتجع' ? 'return-invoice' : 'normal-invoice') + '">' + (row.invoiceType || 'فاتورة') + '</td>' +
              '<td>' + (row.itemNumber || '-') + '</td>' +
              '<td>' + (row.itemName || '-') + '</td>' +
              '<td>' + (row.mainCategory || '-') + '</td>' +
              '<td>' + (sign * (row.quantity || 0)).toLocaleString() + '</td>' +
              '<td>قطعة</td>' +
              '<td>' + Number(row.price || 0) + '</td>' +
              '<td>' + (row.discountValue || 0).toFixed(2) + '</td>' +
              '<td>' + (sign * afterDiscount).toFixed(2) + '</td>' +
              '<td>' + (row.taxValue || 0).toFixed(2) + '</td>' +
              '<td>' + (row.net || 0).toFixed(2) + '</td>' +
              '<td>' + (row.customer || '-') + '</td>' +
              '<td>' + (row.customerPhone && row.customerPhone.trim() !== '' ? row.customerPhone : 'غير متوفر') + '</td>' +
              '<td>' + (parseTime(row.createdAt) || (row.date ? new Date(row.date).toLocaleTimeString('ar-SA') : '')) + '</td>' +
              '<td>' + (row.branch ? getBranchName(row.branch) : '-') + '</td>' +
              '<td>' + (row.warehouse ? getWarehouseName(row.warehouse) : '-') + '</td>' +
              '<td>' + (row.paymentMethod || '-') + '</td>' +
              '</tr>';
          }).join('')}
        </tbody>
      </table>
      
      <!-- جدول الإجماليات المنفصل -->
      <div class="print-last-page-only totals-container">
        <table class="totals-table">
          <thead>
            <tr>
              <th colspan="2">الإجماليات النهائية</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="total-label">إجمالي المبلغ:</td>
              <td class="total-value">${totalAmount.toLocaleString()} ر.س</td>
            </tr>
            <tr>
              <td class="total-label">إجمالي الخصم:</td>
              <td class="total-value">${totalDiscount.toLocaleString()} ر.س</td>
            </tr>
            <tr>
              <td class="total-label">المبلغ بعد الخصم:</td>
              <td class="total-value">${totalAfterDiscount.toLocaleString()} ر.س</td>
            </tr>
            <tr>
              <td class="total-label">إجمالي الضرائب:</td>
              <td class="total-value">${totalTax.toLocaleString()} ر.س</td>
            </tr>
            <tr class="final-total">
              <td class="total-label">الإجمالي النهائي:</td>
              <td class="total-value">${totalNet.toLocaleString()} ر.س</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div class="print-date">
        تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}
      </div>
      
      <!-- Signature Section at the end of the page -->
      <div style="
        margin-top: 50px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 0 20px;
        page-break-inside: avoid;
      ">
        <div style="
          flex: 1;
          text-align: right;
          font-size: 14px;
          font-weight: 500;
        ">
          <div style="margin-bottom: 8px;">المسؤول المالي: ___________________</div>
          <div>التوقيع: ___________________</div>
        </div>
        <div style="
          flex: 1;
          text-align: center;
          position: relative;
        ">
          <!-- Decorative Company Stamp -->
          <div style="
            margin-top: 10px;
            display: flex;
            justify-content: center;
            align-items: center;
            width: 180px;
            height: 70px;
            border: 3px dashed #000;
            border-radius: 50%;
            box-shadow: 0 3px 10px 0 rgba(0,0,0,0.12);
            opacity: 0.9;
            background: repeating-linear-gradient(135deg, #f8f8f8 0 10px, #fff 10px 20px);
            font-family: 'Tajawal', Arial, sans-serif;
            font-size: 16px;
            font-weight: bold;
            color: #000;
            letter-spacing: 1px;
            text-align: center;
            margin-left: auto;
            margin-right: auto;
            z-index: 2;
          ">
            <div style="width: 100%;">
              <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${companyData.arabicName || 'الشركة'}</div>
              <div style="font-size: 14px; font-weight: 500; margin-top: 4px; line-height: 1.1;">${companyData.phone ? 'هاتف: ' + companyData.phone : ''}</div>
            </div>
          </div>
        </div>
        <div style="
          flex: 1;
          text-align: left;
          font-size: 14px;
          font-weight: 500;
        ">
          <div style="margin-bottom: 8px;">مدير المبيعات: ___________________</div>
          <div>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
      </div>
    </body>
    </html>
      `);
    printWindow?.document.close();
    printWindow?.focus();
    setTimeout(() => { printWindow?.print(); printWindow?.close(); }, 700);
  };
  return (
    <>
      <Helmet>
        <title>تقرير فواتير المبيعات التفصيلي | ERP90 Dashboard</title>
        <meta name="description" content="تقرير فواتير المبيعات، عرض وطباعة فواتير العملاء، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, عملاء, ضريبة, طباعة, Sales, Invoice, Report, Tax, Customer" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
 
        {/* العنوان الرئيسي */}
        <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="flex items-center">
            <FileTextOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600 ml-1 sm:ml-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">تقرير فواتير المبيعات التفصيلي</h1>
          </div>
          <p className="text-xs sm:text-base text-gray-600 mt-2">إدارة وعرض تقارير فواتير المبيعات التفصيلي</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "تقرير الفواتير التفصيلي" }
        ]}
      />
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
            <span style={labelStyle}>رقم الفاتورة</span>
            <Input 
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="ادخل رقم الفاتورة"
              style={largeControlStyle}
              size="large"
              allowClear
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
                            className={styles.noAntBorder}
              
              optionFilterProp="label"
              allowClear
              showSearch
              loading={branchesLoading}
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {branches.map(branch => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>اسم العميل</span>
            <Select
              showSearch
              value={customerName || undefined}
              onChange={value => {
                setCustomerName(value);
                // عند اختيار اسم العميل، ابحث عن أول رقم هاتف مطابق واملأه تلقائياً
                if (value) {
                  const found = invoices.find(inv => inv.customer === value && inv.customerPhone && inv.customerPhone.trim() !== '');
                  if (found) {
                    setCustomerPhoneFilter(found.customerPhone);
                  } else {
                    setCustomerPhoneFilter('');
                  }
                } else {
                  setCustomerPhoneFilter('');
                }
              }}
              placeholder="اختر اسم العميل"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              optionFilterProp="label"
                            className={styles.noAntBorder}
              
              allowClear
              filterOption={(input, option) => (option?.children as string)?.toLowerCase().includes(input.toLowerCase())}
            >
              <Option value="">الكل</Option>
              {Array.from(new Set(invoices.map(inv => inv.customer).filter(s => !!s && s !== ''))).map(s => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>رقم العميل</span>
            <Select
              showSearch
              value={customerPhoneFilter || undefined}
              onChange={value => {
                setCustomerPhoneFilter(value);
                // عند اختيار رقم العميل، ابحث عن أول اسم عميل مطابق واملأه تلقائياً
                if (value) {
                  const found = invoices.find(inv => inv.customerPhone === value && inv.customer && inv.customer.trim() !== '');
                  if (found) {
                    setCustomerName(found.customer);
                  } else {
                    setCustomerName('');
                  }
                } else {
                  setCustomerName('');
                }
              }}
              placeholder="اختر رقم العميل"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              optionFilterProp="label"
                            className={styles.noAntBorder}
              
              allowClear
              filterOption={(input, option) => (option?.children as string)?.toLowerCase().includes(input.toLowerCase())}
            >
              <Option value="">الكل</Option>
              {Array.from(new Set(invoices.map(inv => inv.customerPhone).filter(s => !!s && s !== ''))).map(s => (
                <Option key={s} value={s}>{s}</Option>
              ))}
            </Select>
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>الوقت</span>
            <Input
              value={timeFilter || ''}
              onChange={e => setTimeFilter(e.target.value)}
              placeholder="hh:mm:ss"
              style={largeControlStyle}
              size="large"
              allowClear
            />
          </div>
        </div>
        
        <AnimatePresence>
          {showMore && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                <div className="flex flex-col">
                  <span style={labelStyle}>المخزن</span>
                  <Select
                    value={warehouseId || undefined}
                    onChange={setWarehouseId}
                    placeholder="اختر المخزن"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    optionFilterProp="label"
                                  className={styles.noAntBorder}
                    
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {warehouses.map(w => (
                      <Option key={w.id} value={w.id}>{w.name}</Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>طريقة الدفع</span>
                  <Select
                    value={paymentMethod || undefined}
                    onChange={setPaymentMethod}
                    placeholder="اختر طريقة الدفع"
                                  className={styles.noAntBorder}
                    
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    optionFilterProp="label"
                    allowClear
                  >
                    {paymentMethods.map(m => (
                      <Option key={m.id} value={m.name}>{m.name}</Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>نوع الفاتورة</span>
                  <Select
                    value={invoiceTypeFilter}
                    onChange={v => setInvoiceTypeFilter(v)}
                    placeholder="اختر نوع الفاتورة"
                    style={{ width: '100%', ...largeControlStyle }}
                    className={styles.noAntBorder}
                    size="large"
                    allowClear
                  >
                    <Option value="">الكل</Option>
                    
                    <Option value="فاتورة">فاتورة</Option>
                    <Option value="مرتجع">مرتجع</Option>
                  </Select>
                </div>
                

                
                <div className="flex flex-col">
                  <span style={labelStyle}>اسم الصنف</span>
                  <Input 
                    value={itemName}
                    onChange={e => setItemName(e.target.value)}
                    placeholder="ادخل اسم الصنف"
                    style={largeControlStyle}
                    size="large"
                    allowClear
                  />
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>رقم الصنف</span>
                  <Input 
                    value={itemNumberFilter}
                    onChange={e => setItemNumberFilter(e.target.value)}
                    placeholder="ادخل رقم الصنف"
                    style={largeControlStyle}
                    size="large"
                    allowClear
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:justify-between">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              type="primary" 
              onClick={handleSearch}
              loading={isLoading}
              size="large"
              className="bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700"
              icon={<SearchOutlined />}
            >
              بحث
            </Button>
            
            <Button 
              onClick={() => setShowMore(!showMore)}
              size="large"
              icon={showMore ? <UpOutlined /> : <DownOutlined />}
            >
              {showMore ? 'إخفاء الخيارات' : 'خيارات أكثر'}
            </Button>
          </div>
          

        </div>
      </motion.div>

      {/* الجدول */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="bg-white p-4 rounded-lg shadow-sm border border-emerald-100 relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-emerald-600" />
            <h3 className="text-lg font-semibold text-gray-700">نتائج البحث</h3>
            <Tag color="emerald" className="text-sm">
              {getFilteredRows().length} نتيجة
            </Tag>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={getFilteredRows().length === 0}
              className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
              size="large"
            >
              تصدير إكسل
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
              onClick={handlePrint}
              disabled={getFilteredRows().length === 0}
            >
              طباعة
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <>

            
            <Table  
              style={{ direction: 'rtl' }}
              columns={[
                {
                  title: 'رقم الفاتورة',
                  dataIndex: 'invoiceNumber',
                  key: 'invoiceNumber',
                  minWidth: 130,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => a.invoiceNumber.localeCompare(b.invoiceNumber),
                  render: (text: string, record: InvoiceItemRow) => (
                    record.invoiceType === 'مرتجع' && record.id ? (
                      <Link
                        to={`/edit/edit-return/${record.id}`}
                        className="text-red-700 underline hover:text-red-900"
                      >
                        {text}
                      </Link>
                    ) : (
                      <Link
                        to={`/stores/edit-sales-invoice?invoice=${encodeURIComponent(text)}`}
                        className="text-blue-700 underline hover:text-blue-900"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {text}
                      </Link>
                    )
                  ),
                },
                {
                  title: 'تاريخ الفاتورة',
                  dataIndex: 'date',
                  key: 'date',
                  minWidth: 120,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
                  render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '',
                },
                {
                  title: 'نوع الفاتورة',
                  dataIndex: 'invoiceType',
                  key: 'invoiceType',
                  minWidth: 120,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => a.invoiceType.localeCompare(b.invoiceType),
                  render: (type: string) => (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      type === 'مرتجع' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {type}
                    </span>
                  ),
                },
                {
                  title: 'كود الصنف',
                  dataIndex: 'itemNumber',
                  key: 'itemNumber',
                  minWidth: 120,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.itemNumber || '').localeCompare(b.itemNumber || ''),
                },
                {
                  title: 'اسم الصنف',
                  dataIndex: 'itemName',
                  key: 'itemName',
                  minWidth: 190,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.itemName || '').localeCompare(b.itemName || ''),
                },
                {
                  title: 'الفئة',
                  dataIndex: 'mainCategory',
                  key: 'mainCategory',
                  minWidth: 140,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.mainCategory || '').localeCompare(b.mainCategory || ''),
                },
                {
                  title: 'الكمية',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  minWidth: 100,
                  render: (quantity: number, record: InvoiceItemRow) => {
                    // الكمية تحتوي بالفعل على الإشارة الصحيحة
                    return `${(quantity || 0).toLocaleString()}`;
                  },
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.quantity || 0) - (b.quantity || 0),
                },
                {
                  title: 'الوحدة',
                  dataIndex: 'unit',
                  key: 'unit',
                  minWidth: 80,
                  render: () => 'قطعة',
                },
                {
                  title: 'سعر الوحدة',
                  dataIndex: 'price',
                  key: 'price',
                  minWidth: 120,
                  render: (price: number) => `${Number(price || 0)}`,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.price || 0) - (b.price || 0),
                },
                {
                  title: 'نسبة الخصم',
                  dataIndex: 'discountPercent',
                  key: 'discountPercent',
                  minWidth: 100,
                  render: (discountPercent: number) => `${Number(discountPercent || 0).toFixed(2)}%`,
                },
                {
                  title: 'قيمة الخصم',
                  dataIndex: 'discountValue',
                  key: 'discountValue',
                  minWidth: 120,
                  render: (discountValue: number, record: InvoiceItemRow) => {
                    return `${(discountValue || 0).toFixed(2)}`;
                  },
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.discountValue || 0) - (b.discountValue || 0),
                },
                {
                  title: 'الإجمالي بعد الخصم',
                  key: 'afterDiscount',
                  minWidth: 140,
                  render: (record: InvoiceItemRow) => {
                    // استخدم القيمة المحسوبة بالفعل
                    return `${(record.totalAfterDiscount || 0).toFixed(2)}`;
                  },
                },
                {
                  title: 'قيمة الضريبة ',
                  dataIndex: 'taxValue',
                  key: 'taxValue',
                  minWidth: 160,
                  render: (tax: number, record: InvoiceItemRow) => {
                    return `${(tax || 0).toFixed(2)}`;
                  },
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.taxValue || 0) - (b.taxValue || 0),
                },
                {
                  title: 'الصافي',
                  dataIndex: 'net',
                  key: 'net',
                  minWidth: 140,
                  render: (net: number, record: InvoiceItemRow) => {
                    return `${(net || 0).toFixed(2)}`;
                  },
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.net || 0) - (b.net || 0),
                },
                {
                  title: 'اسم العميل',
                  dataIndex: 'customer',
                  key: 'customer',
                  minWidth: 190,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => (a.customer || '').localeCompare(b.customer || ''),
                },
                {
                  title: 'رقم العميل',
                  dataIndex: 'customerPhone',
                  key: 'customerPhone',
                  minWidth: 120,
                  render: (phone: string) => phone && phone.trim() !== '' ? phone : 'غير متوفر',
                },
                {
                  title: 'وقت الإنشاء',
                  key: 'time',
                  minWidth: 160,
                  render: (record: InvoiceItemRow) => {
                    const parseTime = (val: unknown) => {
                      if (!val) return '';
                      if (typeof val === 'object' && val !== null && 'seconds' in val) {
                        return dayjs((val as { seconds: number }).seconds * 1000).format('YYYY-MM-DD HH:mm:ss');
                      }
                      if (typeof val === 'string') {
                        const d = dayjs(val);
                        if (d.isValid()) return d.format('YYYY-MM-DD HH:mm:ss');
                      }
                      return '';
                    };
                    return parseTime(record.createdAt) || (record.date ? dayjs(record.date).format('YYYY-MM-DD HH:mm:ss') : '');
                  },
                },
                {
                  title: 'نسبة الضريبة',
                  dataIndex: 'taxPercent',
                  key: 'taxPercent',
                  minWidth: 120,
                  render: (taxPercent: number) => `${Number(taxPercent || 15).toFixed(2)}%`,
                },
                {
                  title: 'العملة',
                  key: 'currency',
                  minWidth: 80,
                  render: () => 'ر.س',
                },
                {
                  title: 'المخزن',
                  dataIndex: 'warehouse',
                  key: 'warehouse',
                  minWidth: 120,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => getWarehouseName(a.warehouse).localeCompare(getWarehouseName(b.warehouse)),
                  render: (warehouse: string) => {
                    const warehouseName = getWarehouseName(warehouse);
                    console.log('Rendering warehouse:', warehouse, '->', warehouseName);
                    return warehouseName;
                  },
                },
                {
                  title: 'الفرع',
                  dataIndex: 'branch',
                  key: 'branch',
                  minWidth: 120,
                  sorter: (a: InvoiceItemRow, b: InvoiceItemRow) => getBranchName(a.branch).localeCompare(getBranchName(b.branch)),
                  render: (branch: string) => getBranchName(branch),
                },
                {
                  title: 'طريقة الدفع',
                  dataIndex: 'paymentMethod',
                  key: 'paymentMethod',
                  minWidth: 120,
                  render: (method: string) => method || '-',
                },
               
       
              ]}
              dataSource={getFilteredRows()}
              rowKey="key"
              pagination={{
                current: currentPage,
                pageSize: pageSize,
                total: getFilteredRows().length,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} من ${total} عنصر`,
                pageSizeOptions: ['10', '20', '50', '100'],
                onChange: (page) => {
                  setCurrentPage(page);
                },
                position: ['bottomCenter'],
                className: 'mt-4'
              }}
              loading={isLoading}
              scroll={{ x: 1400 }}
              size="small"
              bordered
              className="[&_.ant-table-thead_>_tr_>_th]:bg-gray-400 [&_.ant-table-thead_>_tr_>_th]:text-white [&_.ant-table-thead_>_tr_>_th]:border-gray-400 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
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
              summary={() => {
                if (getFilteredRows().length === 0) return null;
                
                // حساب الإجماليات
                const allRows = getFilteredRows();
                let totalQuantity = 0;
                let totalAmount = 0;
                let totalDiscount = 0;
                let totalAfterDiscount = 0;
                let totalTax = 0;
                let totalNet = 0;

                allRows.forEach((row: InvoiceItemRow) => {
                  const sign = row.invoiceType === 'مرتجع' ? -1 : 1;
                  totalQuantity += sign * (row.quantity || 0);
                  const subtotal = (row.price || 0) * (row.quantity || 0);
                  totalAmount += sign * subtotal;
                  totalDiscount += (row.discountValue || 0); // القيمة تحتوي على الإشارة الصحيحة بالفعل
                  totalAfterDiscount += sign * (subtotal - Math.abs(row.discountValue || 0));
                  totalTax += (row.taxValue || 0); // القيمة تحتوي على الإشارة الصحيحة بالفعل
                  totalNet += (row.net || 0); // القيمة تحتوي على الإشارة الصحيحة بالفعل
                });

                return (
                  <Table.Summary fixed>
                    <Table.Summary.Row className="">
                      <Table.Summary.Cell index={0} className=" font-bold">الإجماليات</Table.Summary.Cell>
                      <Table.Summary.Cell index={1}></Table.Summary.Cell>
                      <Table.Summary.Cell index={2}></Table.Summary.Cell>
                      <Table.Summary.Cell index={3}></Table.Summary.Cell>
                      <Table.Summary.Cell index={4}></Table.Summary.Cell>
                      <Table.Summary.Cell index={5}></Table.Summary.Cell>
                      <Table.Summary.Cell index={6} className=" font-bold">
                        {totalQuantity.toLocaleString()}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7}></Table.Summary.Cell>
                      <Table.Summary.Cell index={8}></Table.Summary.Cell>
                      <Table.Summary.Cell index={9}></Table.Summary.Cell>
                      <Table.Summary.Cell index={10} className=" font-bold text-red-600">
                        {totalDiscount.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={11} className=" font-bold text-blue-600">
                        {totalAfterDiscount.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={12} className=" font-bold text-orange-600">
                        {totalTax.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={13} className=" font-bold text-green-600">
                        {totalNet.toFixed(2)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={14}></Table.Summary.Cell>
                      <Table.Summary.Cell index={15}></Table.Summary.Cell>
                      <Table.Summary.Cell index={16}></Table.Summary.Cell>
                      <Table.Summary.Cell index={17}></Table.Summary.Cell>
                      <Table.Summary.Cell index={18}></Table.Summary.Cell>
                      <Table.Summary.Cell index={19}></Table.Summary.Cell>
                      <Table.Summary.Cell index={20}></Table.Summary.Cell>
                      <Table.Summary.Cell index={21}></Table.Summary.Cell>
                      <Table.Summary.Cell index={22}></Table.Summary.Cell>
                      <Table.Summary.Cell index={23}></Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                );
              }}
            />
          </>
        )}
      </motion.div>

      {/* مودال تفاصيل الفاتورة */}
      {showInvoiceModal && selectedInvoice && (
        <Modal
          title="تفاصيل الفاتورة"
          open={showInvoiceModal}
          onCancel={() => setShowInvoiceModal(false)}
          width={1000}
          footer={[
            <Button key="close" onClick={() => setShowInvoiceModal(false)}>
              إغلاق
            </Button>,
            <Button key="print" type="primary" onClick={handlePrint}>
              طباعة
            </Button>
          ]}
        >
          <div ref={printRef} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">رقم الفاتورة:</label>
                <p className="text-base">{selectedInvoice.invoiceNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">التاريخ:</label>
                <p className="text-base">{selectedInvoice.date}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">العميل:</label>
                <p className="text-base">{selectedInvoice.customer}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">رقم العميل:</label>
                <p className="text-base">{selectedInvoice.customerPhone}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-600">المخزن:</label>
                <p className="text-base">{getWarehouseName(selectedInvoice.warehouse)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">طريقة الدفع:</label>
                <p className="text-base">{selectedInvoice.paymentMethod}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">نوع الفاتورة:</label>
                <p className="text-base">{selectedInvoice.invoiceType}</p>
              </div>
            </div>
            
            <div className="mt-6">
              <h4 className="text-lg font-semibold mb-4">تفاصيل الأصناف</h4>
              <table className="w-full border-collapse border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-center">كود الصنف</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">اسم الصنف</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">الكمية</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">السعر</th>
                    <th className="border border-gray-300 px-4 py-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2 text-center">{selectedInvoice.itemNumber}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{selectedInvoice.itemName}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{selectedInvoice.quantity}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{selectedInvoice.price?.toFixed(2)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{selectedInvoice.net?.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
    </>
  );
};

export default InvoicePreferred;
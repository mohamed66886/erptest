import React, { useState, useEffect, useRef, useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, query, collection, where, WhereFilterOp, Query, CollectionReference } from "firebase/firestore";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { DatePicker, Input, Select, Button, Table, Pagination, Calendar } from "antd";
import { SearchOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import dayjs from 'dayjs';
import styles from './ReceiptVoucher.module.css';
import { Select as AntdSelect } from 'antd';
import { useSidebar } from "@/hooks/useSidebar";
const { Option } = Select;


interface WarehouseOption {
  id: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
}

interface GroupedInvoice extends InvoiceRecord {
  _rows: InvoiceRecord[];
}

interface PaymentMethodOption {
  id: string;
  name: string;
}

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds?: number;
}

interface InvoiceItemData {
  itemNumber?: string;
  itemName?: string;
  price?: number;
  quantity?: number;
  discountValue?: number;
  discountPercent?: number;
  taxValue?: number;
  taxPercent?: number;
  extraDiscount?: number;
  customerPhone?: string;
  customerMobile?: string;
  customerNumber?: string;
  phone?: string;
  mobile?: string;
  phoneNumber?: string;
  warehouseId?: string;
  returnedQty?: number;
  cost?: number;
  mainCategory?: string;
  unit?: string;
  items?: InvoiceItemData[];
  net?: number;
  createdAt?: FirestoreTimestamp;
}

interface InvoiceRecord {
  key: string;
  id?: string; // معرف الفاتورة أو المرتجع
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
  itemData?: InvoiceItemData;
  createdAt?: FirestoreTimestamp;
  unit?: string;
}



const Invoice: React.FC = () => {
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

  // السنة المالية من السياق العام
  const { currentFinancialYear, setCurrentFinancialYear, activeYears } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
  }, [currentFinancialYear]);

  const handleFiscalYearChange = (value: string) => {
    setFiscalYear(value);
    if (activeYears && setCurrentFinancialYear) {
      const selectedYear = activeYears.find(y => y.year.toString() === value);
      if (selectedYear) {
        setCurrentFinancialYear(selectedYear);
      }
    }
  };
  const navigate = useNavigate();
  const { setCurrentSection } = useSidebar();
  const controls = useAnimation();

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
        const options = snap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          nameAr: doc.data().nameAr || '',
          nameEn: doc.data().nameEn || ''
        }));
        setWarehouses(options);
      } catch {
        setWarehouses([]);
      }
    };
    fetchWarehouses();
  }, []);
  
  
  useEffect(() => {
    const fetchSalesReps = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // جلب من جدول accounts (المندوبين)
        const accountsSnap = await getDocs(collection(db, 'accounts'));
        const accountsReps = accountsSnap.docs
          .map(doc => ({
            id: doc.id,
            name: doc.data().nameAr || doc.data().name || '',
            number: doc.data().accountNumber || '',
            mobile: doc.data().customerData?.mobile || doc.data().customerData?.phone || ''
          }))
          .filter(acc => acc.name && acc.number && (acc.name.includes('مندوب') || acc.name.includes('بائع') || acc.name.includes('مبيعات')));
        
        // جلب من جدول salesRepresentatives أيضاً
        const salesRepsSnap = await getDocs(collection(db, 'salesRepresentatives'));
        const salesReps = salesRepsSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || '',
          number: doc.data().number || doc.id,
          mobile: doc.data().mobile || doc.data().phone || ''
        }));
        
        // دمج القوائم وإزالة المكرر
        const allReps = [...accountsReps, ...salesReps];
        const uniqueReps = allReps.filter((rep, index, self) => 
          index === self.findIndex(r => r.name === rep.name || r.id === rep.id)
        );
        
        setSalesRepAccounts(uniqueReps);
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
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setDateFrom(start);
      setDateTo(end);
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
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      // جلب جميع الأصناف
      interface InventoryItem {
        id: string;
        name?: string;
        parentId?: string;
        [key: string]: unknown;
      }
      const inventoryItems: InventoryItem[] = [];
      try {
        const itemsSnap = await getDocs(collection(db, 'inventory_items'));
        inventoryItems.push(...itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        // Error fetching inventory items
      }
      let q: Query<any, any> | CollectionReference<any, any> = collection(db, 'sales_invoices');
      const filters: [string, WhereFilterOp, unknown][] = [];
      const params = filtersParams || {};
      if (params.branchId) filters.push(['branch', '==', params.branchId]);
      // لا نستخدم where('==') للبحث الجزئي، نجلب كل الفواتير ثم نفلتر
      if (params.dateFrom) filters.push(['date', '>=', dayjs(params.dateFrom).format('YYYY-MM-DD')]);
      if (params.dateTo) filters.push(['date', '<=', dayjs(params.dateTo).format('YYYY-MM-DD')]);
      if (params.warehouseId) filters.push(['warehouse', '==', params.warehouseId]);
      
      if (filters.length > 0) {
        const { query: qFn } = await import('firebase/firestore');
        const whereConditions = filters.map(f => where(...f));
        q = qFn(q, ...whereConditions) as Query<any, any>;
      }
      // لا يمكن عمل تصفية مباشرة على الحقول غير المفهرسة أو الفرعية، سنستخدم الفلاتر بعد الجلب
      const snapshot = await getDocs(q);
      const salesRecords: InvoiceRecord[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const invoiceId = doc.id; // معرف الفاتورة من Firestore
        const invoiceNumber = data.invoiceNumber || '';
        // إذا كان هناك رقم فاتورة للبحث، نفلتر هنا بالمطابقة الجزئية
        if (params.invoiceNumber && !invoiceNumber.toLowerCase().includes(params.invoiceNumber.toLowerCase())) {
          return;
        }
        const entryNumber = data.entryNumber || '';
        const date = data.date || '';
        const branch = data.branch || '';
        const customer = data.customerName || data.customer || '';
        const seller = data.delegate || data.seller || '';
        const paymentMethod = data.paymentMethod || '';
        const invoiceType = data.type || '';
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((item: InvoiceItemData, idx: number) => {
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          const quantity = Number(item.quantity) || 0;
          // حساب الإجمالي الصحيح (السعر × الكمية)
          const subtotal = price * quantity;
          const discountValue = Number(item.discountValue) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          const taxValue = Number(item.taxValue) || 0;
          const taxPercent = Number(item.taxPercent) || 0;
          // حساب الصافي بعد الخصم والضريبة
          const afterDiscount = subtotal - discountValue;
          const net = afterDiscount + taxValue;
          const profit = (price - cost) * quantity;
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
            id: invoiceId, // إضافة معرف الفاتورة
            invoiceNumber,
            entryNumber,
            date,
            branch,
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            mainCategory: parentName,
            quantity,
            price,
            total: subtotal, // استخدام subtotal بدلاً من total
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
        });
      });
      let qReturn = collection(db, 'sales_returns');
      const filtersReturn: [string, WhereFilterOp, unknown][] = [];
      if (params.branchId) filtersReturn.push(['branch', '==', params.branchId]);
      if (params.invoiceNumber) filtersReturn.push(['invoiceNumber', '==', params.invoiceNumber]);
      if (params.dateFrom) filtersReturn.push(['date', '>=', dayjs(params.dateFrom).format('YYYY-MM-DD')]);
      if (params.dateTo) filtersReturn.push(['date', '<=', dayjs(params.dateTo).format('YYYY-MM-DD')]);
      if (params.warehouseId) filtersReturn.push(['warehouse', '==', params.warehouseId]);
      if (filtersReturn.length > 0) {
        const { query: qFn } = await import('firebase/firestore');
        const whereConditions = filtersReturn.map(f => where(...f));
        qReturn = qFn(qReturn, ...whereConditions) as any;
      }
      const snapshotReturn = await getDocs(qReturn);
      const returnRecords: InvoiceRecord[] = [];
      snapshotReturn.forEach(doc => {
      const data = doc.data();
        const returnId = doc.id;
        const referenceNumber = data.referenceNumber || '';
        const invoiceNumber = referenceNumber || data.invoiceNumber || '';
        const entryNumber = data.entryNumber || '';
        const date = data.date || '';
        const branch = typeof doc.data().branch === 'string' ? doc.data().branch : '';
        const customer = data.customerName || data.customer || '';
        const customerPhone = data.customerPhone || '';
        const seller = data.seller || '';
        const paymentMethod = data.paymentMethod || '';
        const invoiceType = 'مرتجع';
        const items = Array.isArray(data.items) ? data.items : [];
        items.forEach((item: InvoiceItemData, idx: number) => {
          const price = Number(item.price) || 0;
          const cost = Number(item.cost) || 0;
          const quantity = Number(item.returnedQty) || 0;
          const subtotal = price * quantity;
          const discountValue = Number(item.discountValue) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          const taxValue = Number(item.taxValue) || 0;
          const taxPercent = Number(item.taxPercent) || 0;
          const afterDiscount = subtotal - discountValue;
          const net = afterDiscount + taxValue;
          const profit = (price - cost) * quantity * -1; 
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
            id: returnId, // استخدام معرف المرتجع الصحيح
            invoiceNumber, // سيحمل رقم المرتجع في حالة المرتجع
            entryNumber,
            date,
            branch,
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            mainCategory: parentName,
            quantity,
            price,
            total: subtotal, // استخدام subtotal بدلاً من total
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
      setFilteredInvoices(all);
    } catch (err) {
      setInvoices([]);
      console.error('Error fetching invoices:', err);
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
        inv.itemData.items.forEach((item: InvoiceItemData) => {
          const price = Number(item.price) || 0;
          const quantity = Number(item.quantity) || Number(item.returnedQty) || 0;
          const discountValue = Number(item.discountValue) || 0;
          const totalAfterDiscount = (price * quantity) - discountValue;
          allRows.push({
            ...inv,
            itemNumber: item.itemNumber || '',
            itemName: item.itemName || '',
            mainCategory: inv.mainCategory || '',
            quantity,
            price,
            discountValue,
            discountPercent: Number(item.discountPercent) || 0,
            taxValue: Number(item.taxValue) || 0,
            taxPercent: Number(item.taxPercent) || 0,
            net: Number(item.net) || 0,
            unit: item.unit || inv.unit || (inv.itemData && inv.itemData.unit) || '',
            createdAt: item.createdAt || inv.createdAt,
            warehouse: item.warehouseId || inv.warehouse,
            totalAfterDiscount: totalAfterDiscount < 0 ? 0 : totalAfterDiscount,
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
    if (!invoiceTypeFilter && !paymentMethod && !seller && !invoiceNumber) {
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
    // تفعيل فلتر رقم الفاتورة
    if (invoiceNumber && invoiceNumber.trim() !== "") {
      filtered = filtered.filter(inv =>
        inv.invoiceNumber && inv.invoiceNumber.toString().toLowerCase().includes(invoiceNumber.toLowerCase())
      );
    }
    return filtered;
  }, [filteredInvoices, invoiceTypeFilter, paymentMethod, seller, invoiceNumber]);

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
    }).then((result) => {
      // بعد جلب النتائج، إذا كان هناك اسم عميل محدد ونتيجة واحدة فقط، ضع رقم العميل تلقائياً
      // نستخدم النتائج الجديدة مباشرة
      if (customerName && Array.isArray(result)) {
        const filtered = result.filter(inv => inv.customer && inv.customer === customerName);
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

    // الحصول على البيانات المفلترة كما تظهر في الجدول
    const filteredData = getFilteredRows();
    
    // تجميع البيانات حسب الفاتورة مثل ما يظهر في الطباعة
    const groupedData = Object.values(
      filteredData.reduce((acc, inv) => {
        const key = inv.invoiceNumber + '-' + inv.invoiceType;
        if (!acc[key]) {
          acc[key] = { ...inv, _rows: [] };
        }
        acc[key]._rows.push(inv);
        return acc;
      }, {})
    );

    const exportData = groupedData.map(invoice => {
      const invoiceRows = (invoice as any)?._rows || [];
      const totalAmount = invoiceRows.reduce((sum, row) => sum + ((Number(row.price) || 0) * (Number(row.quantity) || 0)), 0);
      const totalDiscount = invoiceRows.reduce((sum, row) => sum + (Number(row.discountValue) || 0), 0);
      const afterDiscount = totalAmount - totalDiscount;
      const totalTax = invoiceRows.reduce((sum, row) => sum + (Number(row.taxValue) || 0), 0);
      const net = Number((invoice as any)?.net) || totalAmount - totalDiscount + totalTax;
      const sign = (invoice as any)?.invoiceType === 'مرتجع' ? -1 : 1;
      
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

      return [
        (invoice as any)?.invoiceNumber || '-',
        (invoice as any)?.entryNumber || (invoice as any)?.id || '-',
        (invoice as any)?.date ? new Date((invoice as any).date).toLocaleDateString('ar-SA') : '',
        (invoice as any)?.customerPhone && (invoice as any).customerPhone.trim() !== '' ? (invoice as any).customerPhone : 'غير متوفر',
        (invoice as any)?.customer || '',
        getBranchName((invoice as any)?.branch) || '-',
        (sign * totalAmount).toFixed(2),
        (sign * totalDiscount).toFixed(2),
        (sign * afterDiscount).toFixed(2),
        (sign * totalTax).toFixed(2),
        (sign * net).toFixed(2),
        (invoice as any)?.invoiceType || '-',
        getWarehouseName((invoice as any)?.warehouse) || '-',
        (invoice as any)?.paymentMethod || '-',
        getSalesRepName((invoice as any)?.seller) || '-',
        parseTime((invoice as any)?.createdAt) || ((invoice as any)?.date ? new Date((invoice as any).date).toLocaleTimeString('ar-SA') : ''),
        'ريال سعودي'
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الفواتير');

    sheet.columns = [
      { header: 'رقم الفاتورة', key: 'invoiceNumber', width: 20 },
      { header: 'رقم القيد', key: 'entryNumber', width: 20 },
      { header: 'التاريخ', key: 'date', width: 15 },
      { header: 'رقم العميل', key: 'customerPhone', width: 18 },
      { header: 'اسم العميل', key: 'customer', width: 45 },
      { header: 'الفرع', key: 'branch', width: 20 },
      { header: 'الإجمالي', key: 'totalAmount', width: 15 },
      { header: 'الخصم', key: 'discount', width: 15 },
      { header: 'بعد الخصم', key: 'afterDiscount', width: 15 },
      { header: 'الضرائب', key: 'tax', width: 15 },
      { header: 'الإجمالي النهائي', key: 'finalTotal', width: 18 },
      { header: 'نوع الفاتورة', key: 'invoiceType', width: 20 },
      { header: 'المخزن', key: 'warehouse', width: 20 },
      { header: 'طريقة الدفع', key: 'paymentMethod', width: 20 },
      { header: 'البائع', key: 'seller', width: 25 },
      { header: 'الوقت', key: 'time', width: 15 },
      { header: 'العملة', key: 'currency', width: 12 }
    ];

    sheet.addRows(exportData);

    // تنسيق الهيدر
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF000000' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } },
      };
    });

    // تنسيق الصفوف
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
        if (i % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }
      });
    }

    // إضافة التجميد والفلتر
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
    a.download = `تقرير_الفواتير_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };
  // دالة لجلب اسم المخزن من القائمة
  const getWarehouseName = (warehouseId: string) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? (warehouse.nameAr || warehouse.name || warehouse.nameEn || warehouseId) : warehouseId;
  };

  // دالة لجلب اسم البائع من القائمة
  const getSalesRepName = (salesRepId: string) => {
    // إذا كان salesRepId فارغ أو undefined، أرجع قيمة افتراضية
    if (!salesRepId || salesRepId.trim() === '') return 'غير محدد';
    
    // ابحث في قائمة حسابات البائعين أولاً
    const foundRep = salesRepAccounts.find(rep => 
      rep.id === salesRepId || // البحث بالـ ID
      rep.name === salesRepId || // البحث بالاسم الكامل
      rep.name.toLowerCase().includes(salesRepId.toLowerCase()) ||
      salesRepId.toLowerCase().includes(rep.name.toLowerCase()) ||
      rep.number === salesRepId // البحث برقم الحساب
    );
    
    if (foundRep) {
      return foundRep.name;
    }
    
    // في حالة عدم العثور عليه في الحسابات، ابحث في البائعين الموجودين في الفواتير
    const uniqueSellers = Array.from(new Set(invoices.map(inv => inv.seller).filter(s => !!s && s !== '')));
    const foundSeller = uniqueSellers.find(seller => 
      seller === salesRepId || // مطابقة كاملة
      seller.toLowerCase().includes(salesRepId.toLowerCase()) || 
      salesRepId.toLowerCase().includes(seller.toLowerCase())
    );
    
    return foundSeller || salesRepId;
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
// أعلى الكومبوننت
const handlePrintTable = () => {
  // البحث عن الجدول باستخدام Ant Design table class
  const table = document.querySelector('.ant-table-tbody') || document.querySelector('table');
  if (!table) {
    alert('لم يتم العثور على جدول البيانات');
    return;
  }

  // إنشاء جدول جديد للطباعة
  const filteredData = getFilteredRows();
  const groupedData = Object.values(
    filteredData.reduce((acc, inv) => {
      const key = inv.invoiceNumber + '-' + inv.invoiceType;
      if (!acc[key]) {
        acc[key] = { ...inv, _rows: [] };
      }
      acc[key]._rows.push(inv);
      return acc;
    }, {})
  );

  // حساب الإجماليات
  let totalAmount = 0;
  let totalDiscount = 0;
  let totalAfterDiscount = 0;
  let totalTax = 0;
  let totalNet = 0;

  groupedData.forEach((invoice) => {
    const sign = invoice.invoiceType === 'مرتجع' ? -1 : 1;
    
    const invoiceTotal = invoice._rows.reduce((sum, row) => {
      return sum + ((Number(row.price) || 0) * (Number(row.quantity) || 0));
    }, 0);
    
    const invoiceDiscount = invoice._rows.reduce((sum, row) => {
      return sum + (Number(row.discountValue) || 0);
    }, 0);
    
    const invoiceTax = invoice._rows.reduce((sum, row) => {
      return sum + (Number(row.taxValue) || 0);
    }, 0);
    
    const invoiceNet = invoice._rows.reduce((sum, row) => {
      return sum + (Number(row.net) || 0);
    }, 0);

    totalAmount += sign * invoiceTotal;
    totalDiscount += sign * invoiceDiscount;
    totalAfterDiscount += sign * (invoiceTotal - invoiceDiscount);
    totalTax += sign * invoiceTax;
    totalNet += sign * invoiceNet;
  });

  // إنشاء HTML للطباعة
  const printWindow = window.open('', '', 'width=1400,height=900');
  printWindow?.document.write(`
    <html>
    <head>
      <title>طباعة تقرير الفواتير</title>
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
          border-collapse: collapse;
          font-size: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid #000;
        }
        .totals-table th {
          background-color: #000;
          color: #fff;
          padding: 10px;
          text-align: center;
          font-weight: bold;
          font-size: 14px;
        }
        .totals-table .total-label {
          background-color: #f8f9fa;
          padding: 8px 12px;
          text-align: right;
          font-weight: 600;
          border-bottom: 1px solid #ddd;
          width: 60%;
        }
        .totals-table .total-value {
          background-color: #fff;
          padding: 8px 12px;
          text-align: left;
          font-weight: 500;
          border-bottom: 1px solid #ddd;
          width: 40%;
        }
        .totals-table .final-total .total-label {
          background-color: #e9ecef;
          font-weight: bold;
          color: #000;
        }
        .totals-table .final-total .total-value {
          background-color: #f1f3f4;
          font-weight: bold;
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
=        <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
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
            <th style="width: 70px;">رقم القيد</th>
            <th style="width: 70px;">التاريخ</th>
            <th style="width: 75px;">رقم العميل</th>
            <th style="width: 100px;">اسم العميل</th>
            <th style="width: 65px;">الفرع</th>
            <th style="width: 70px;">الإجمالي</th>
            <th style="width: 60px;">الخصم</th>
            <th style="width: 75px;">بعد الخصم</th>
            <th style="width: 60px;">الضرائب</th>
            <th style="width: 70px;">الإجمالي النهائي</th>
            <th style="width: 70px;">نوع الفاتورة</th>
            <th style="width: 65px;">المخزن</th>
            <th style="width: 70px;">طريقة الدفع</th>
            <th style="width: 65px;">البائع</th>
            <th style="width: 60px;">الوقت</th>
          </tr>
        </thead>
        <tbody>
          ${groupedData.map(invoice => {
            const invoiceRows = (invoice as any)?._rows || [];
            const totalAmount = invoiceRows.reduce((sum, row) => sum + ((Number(row.price) || 0) * (Number(row.quantity) || 0)), 0);
            const totalDiscount = invoiceRows.reduce((sum, row) => sum + (Number(row.discountValue) || 0), 0);
            const afterDiscount = totalAmount - totalDiscount;
            const totalTax = invoiceRows.reduce((sum, row) => sum + (Number(row.taxValue) || 0), 0);
            const net = Number((invoice as any)?.net) || totalAmount - totalDiscount + totalTax;
            const sign = (invoice as any)?.invoiceType === 'مرتجع' ? -1 : 1;
            
            // حساب الأسماء مسبقاً مع معالجة safe
            const branchName = (invoice as any)?.branch ? getBranchName((invoice as any).branch) : '-';
            const warehouseName = (invoice as any)?.warehouse ? getWarehouseName((invoice as any).warehouse) : '-';
            const salesRepName = (invoice as any)?.seller ? getSalesRepName((invoice as any).seller) : '-';
            
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
              '<td>' + ((invoice as any)?.invoiceNumber || '-') + '</td>' +
              '<td>' + ((invoice as any)?.entryNumber || (invoice as any)?.id || '-') + '</td>' +
              '<td>' + ((invoice as any)?.date ? new Date((invoice as any).date).toLocaleDateString('en-GB') : '') + '</td>' +
              '<td>' + ((invoice as any)?.customerPhone && (invoice as any).customerPhone.trim() !== '' ? (invoice as any).customerPhone : 'غير متوفر') + '</td>' +
              '<td>' + ((invoice as any)?.customer || '') + '</td>' +
              '<td>' + branchName + '</td>' +
              '<td>' + (sign * totalAmount).toLocaleString() + '</td>' +
              '<td>' + (sign * totalDiscount).toLocaleString() + '</td>' +
              '<td>' + (sign * afterDiscount).toLocaleString() + '</td>' +
              '<td>' + (sign * totalTax).toLocaleString() + '</td>' +
              '<td>' + (sign * net).toLocaleString() + '</td>' +
              '<td class="' + ((invoice as any)?.invoiceType === 'مرتجع' ? 'return-invoice' : 'normal-invoice') + '">' + ((invoice as any)?.invoiceType || '-') + '</td>' +
              '<td>' + warehouseName + '</td>' +
              '<td>' + ((invoice as any)?.paymentMethod || '-') + '</td>' +
              '<td>' + salesRepName + '</td>' +
              '<td>' + (parseTime((invoice as any)?.createdAt) || ((invoice as any)?.date ? new Date((invoice as any).date).toLocaleTimeString('en-GB') : '')) + '</td>' +
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
              <td class="total-value">${totalAmount.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="total-label">إجمالي الخصم:</td>
              <td class="total-value">${totalDiscount.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="total-label">المبلغ بعد الخصم:</td>
              <td class="total-value">${afterDiscount.toLocaleString()}</td>
            </tr>
            <tr>
              <td class="total-label">إجمالي الضرائب:</td>
              <td class="total-value">${totalTax.toLocaleString()}</td>
            </tr>
            <tr class="final-total">
              <td class="total-label">الإجمالي النهائي:</td>
              <td class="total-value">${totalNet.toLocaleString()}</td>
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
  setTimeout(() => { 
    printWindow?.print(); 
    printWindow?.close(); 
  }, 1000);
};
  // دالة طباعة محتوى المودال فقط
  const handlePrint = () => {
    // Professional print template
    if (!selectedInvoice) return;
    // تجهيز بيانات الفاتورة للطباعة بشكل صحيح
    let invoice = { ...selectedInvoice };
    // إذا كان هناك itemData.items (كما في جدول التقارير)، استخدمها للطباعة
    if (selectedInvoice && selectedInvoice.itemData && Array.isArray(selectedInvoice.itemData.items)) {
      invoice.items = selectedInvoice.itemData.items;
    } else if (selectedInvoice && Array.isArray(selectedInvoice.items)) {
      invoice.items = selectedInvoice.items;
    } else if (selectedInvoice && selectedInvoice.itemData && typeof selectedInvoice.itemData === 'object') {
      // إذا كان المستخدم ضغط على صف صنف واحد (itemData مفرد)
      invoice.items = [selectedInvoice.itemData];
    } else {
      invoice.items = [];
    }
    // تجهيز بيانات العميل للطباعة
    invoice.customerName = selectedInvoice.customerName || selectedInvoice.customer || '';
    invoice.customerNumber = selectedInvoice.customerPhone || selectedInvoice.customerMobile || selectedInvoice.customerNumber || selectedInvoice.phone || selectedInvoice.mobile || selectedInvoice.phoneNumber || '';
    invoice.taxFile = selectedInvoice.taxFile || companyData.taxFile || '';
    invoice.customerAddress = selectedInvoice.customerAddress || '';
    // تجهيز اسم البائع للطباعة
    invoice.delegate = selectedInvoice.delegate || selectedInvoice.seller || selectedInvoice.salesman || '';

    // حساب الإجماليات إذا لم تكن موجودة أو ناقصة
    if (!invoice.totals || typeof invoice.totals !== 'object') {
      invoice.totals = {};
    }
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    // إجمالي قبل الخصم
    let total = 0;
    // إجمالي الخصم
    let totalDiscount = 0;
    // إجمالي بعد الخصم
    let afterDiscount = 0;
    // إجمالي الضريبة
    let totalTax = 0;
    // الإجمالي النهائي
    let afterTax = 0;
    items.forEach((it) => {
      const price = Number(it.price) || 0;
      const quantity = Number(it.quantity) || 0;
      const discountValue = Number(it.discountValue) || 0;
      const taxValue = Number(it.taxValue) || 0;
      const subtotal = price * quantity;
      total += subtotal;
      totalDiscount += discountValue;
      totalTax += taxValue;
      afterDiscount += (subtotal - discountValue);
      afterTax += (subtotal - discountValue + taxValue);
    });
    // إذا لم تكن القيم موجودة في totals، احسبها
    invoice.totals.total = typeof invoice.totals.total === 'number' && !isNaN(invoice.totals.total) ? invoice.totals.total : total;
    invoice.totals.afterDiscount = typeof invoice.totals.afterDiscount === 'number' && !isNaN(invoice.totals.afterDiscount) ? invoice.totals.afterDiscount : afterDiscount;
    invoice.totals.afterTax = typeof invoice.totals.afterTax === 'number' && !isNaN(invoice.totals.afterTax) ? invoice.totals.afterTax : afterTax;
    invoice.totals.totalDiscount = typeof invoice.totals.totalDiscount === 'number' && !isNaN(invoice.totals.totalDiscount) ? invoice.totals.totalDiscount : totalDiscount;
    invoice.totals.totalTax = typeof invoice.totals.totalTax === 'number' && !isNaN(invoice.totals.totalTax) ? invoice.totals.totalTax : totalTax;
    // تأكد من تحميل بيانات الشركة قبل الطباعة
    if (!companyData || !companyData.arabicName) {
      if (typeof window !== 'undefined' && (window as any).toast) {
        (window as any).toast.error('لم يتم تحميل بيانات الشركة بعد، يرجى المحاولة بعد لحظات');
      } else {
        alert('لم يتم تحميل بيانات الشركة بعد، يرجى المحاولة بعد لحظات');
      }
      return;
    }
    let qrDataUrl = '';
    if (typeof window !== 'undefined' && (window as any).generateInvoiceQR) {
      try { qrDataUrl = (window as any).generateInvoiceQR(invoice); } catch { qrDataUrl = ''; }
    } else {
      qrDataUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=' + encodeURIComponent(invoice.invoiceNumber || '');
    }
    const printWindow = window.open('', '', 'width=900,height=1200');
    printWindow?.document.write(`
        <html>
        <head>
          <title>تقرير فواتير المبيعات | Sales Invoice Report</title>
          <meta name="description" content="تقرير فواتير المبيعات، عرض وطباعة فواتير العملاء، ERP90 Dashboard">
          <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, عملاء, ضريبة, طباعة, Sales, Invoice, Report, Tax, Customer">
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 10mm; }
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
              background-color: #000;
              color: #fff;
              font-weight: bold;
              font-size: 12.5px;
              letter-spacing: 0.5px;
            }
            .totals { margin-top: 5mm; border-top: 1px solid #000; padding-top: 3mm; font-weight: bold; }
            .policy { font-size: 10px; border: 1px solid #ddd; padding: 3mm; /*margin-top: 5mm;*/ }
            .policy-title { font-weight: bold; margin-bottom: 2mm; }
            .signature { margin-top: 5mm; display: flex; justify-content: space-between; }
            .signature-box { width: 45%; border-top: 1px solid #000; padding-top: 3mm; }
            .footer { margin-top: 5mm; text-align: center; font-size: 10px; }
            /* Ensure totals and policy are always side by side on print */
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
              ${(invoice.items || []).map((it, idx) => {
                const subtotal = Number(it.price) * Number(it.quantity);
                const discountValue = Number(it.discountValue) || 0;
                const taxValue = Number(it.taxValue) || 0;
                const afterDiscount = subtotal - discountValue;
                const net = afterDiscount + taxValue;
                const warehouseId = it.warehouseId || invoice.warehouse;
                const warehouseObj = Array.isArray(warehouses) ? warehouses.find((w: any) => w.id === warehouseId) : null;
                const warehouseName = warehouseObj ? (warehouseObj.name || warehouseObj.id) : (warehouseId || '');
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
              <tr style="background:#f0f0f0; font-weight:bold;">
                <td colspan="6" style="text-align:right; font-weight:bold; color:#000;">الإجماليات:</td>
                <td style="color:#000; font-weight:bold;">
                  ${(() => {
                    // إجمالي الخصم
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it) => { total += Number(it.discountValue) || 0; });
                    return total.toFixed(2);
                  })()}
                </td>
                <td style="color:#000; font-weight:bold;">
                  ${(() => {
                    // إجمالي قبل الضريبة
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it) => {
                      const subtotal = Number(it.price) * Number(it.quantity);
                      const discountValue = Number(it.discountValue) || 0;
                      total += subtotal - discountValue;
                    });
                    return total.toFixed(2);
                  })()}
                </td>
                <td style="color:#000; font-weight:bold;">
                  ${(() => {
                    // إجمالي الضريبة
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it) => { total += Number(it.taxValue) || 0; });
                    return total.toFixed(2);
                  })()}
                </td>
                <td style="color:#000; font-weight:bold;">
                  ${(() => {
                    // إجمالي النهائي
                    if (!invoice.items) return '0.00';
                    let total = 0;
                    invoice.items.forEach((it) => {
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
            </div>
           
          </div>
          <!-- Signature Section -->
          <div class="signature">
            <div class="signature-box">
              <div>اسم العميل: ${invoice.customerName || ''}</div>
              <div>التوقيع: ___________________</div>
            </div>
            <div class="signature-box" style="position:relative;">
              <div>البائع: ${invoice.delegate || ''}</div>
              <div>التاريخ: ${invoice.date || ''}</div>
              <!-- Decorative Stamp -->
              <div style="
                margin-top:18px;
                display:flex;
                justify-content:center;
                align-items:center;
                width:160px;
                height:60px;
                border:2.5px dashed #000;
                border-radius:50%;
                box-shadow:0 2px 8px 0 rgba(0,0,0,0.08);
                opacity:0.85;
                background: repeating-linear-gradient(135deg, #f8f8f8 0 8px, #fff 8px 16px);
                font-family: 'Cairo', 'Tajawal', Arial, sans-serif;
                font-size:15px;
                font-weight:bold;
                color:#000;
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
      `);
    printWindow?.document.close();
    printWindow?.focus();
    setTimeout(() => { printWindow?.print(); printWindow?.close(); }, 700);
  };
  return (
    <>
      <Helmet>
        <title>تقرير فواتير المبيعات | ERP90 Dashboard</title>
        <meta name="description" content="تقرير فواتير المبيعات، عرض وطباعة فواتير العملاء، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, عملاء, ضريبة, طباعة, Sales, Invoice, Report, Tax, Customer" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
 


      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <FileTextOutlined className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">تقرير فواتير المبيعات</h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة وعرض تقارير فواتير المبيعات</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
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
       <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>

      </div>
 


      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "تقرير الفواتير " }
        ]}
      />
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
        
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
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
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
              className={styles.noAntBorder}
              optionFilterProp="label"
              allowClear
              filterOption={(input, option) => (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())}
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
              className={styles.noAntBorder}
              optionFilterProp="label"
              allowClear
              filterOption={(input, option) => (option?.children ?? '').toString().toLowerCase().includes(input.toLowerCase())}
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
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {warehouses.map(w => (
                      <Option key={w.id} value={w.id}>{w.nameAr || w.name || w.nameEn || w.id}</Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>طريقة الدفع</span>
                  <Select
                    value={paymentMethod || undefined}
                    onChange={setPaymentMethod}
                    placeholder="اختر طريقة الدفع"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
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
                    size="large"
                    className={styles.noAntBorder}
                    allowClear
                  >
                    <Option value="">الكل</Option>
                    <Option value="فاتورة">فاتورة</Option>
                    <Option value="مرتجع">مرتجع</Option>
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>البائع</span>
                  <Select
                    value={seller || undefined}
                    onChange={setSeller}
                    placeholder="اختر البائع"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {/* أولاً عرض البائعين من حسابات المندوبين */}
                    {salesRepAccounts.map(rep => (
                      <Option key={rep.id} value={rep.name}>{rep.name}</Option>
                    ))}
                    {/* ثم عرض البائعين الإضافيين الموجودين في الفواتير والغير موجودين في الحسابات */}
                    {Array.from(new Set(invoices.map(inv => inv.seller).filter(s => {
                      if (!s || s === '') return false;
                      // تحقق من عدم وجود هذا البائع في حسابات المندوبين
                      return !salesRepAccounts.some(rep => 
                        rep.name.toLowerCase().includes(s.toLowerCase()) ||
                        s.toLowerCase().includes(rep.name.toLowerCase())
                      );
                    }))).map(s => (
                      <Option key={s} value={s}>{s}</Option>
                    ))}
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex items-center gap-4 mt-4">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isLoading}
            className="bg-blue-400 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
            size="large"
          >
            {isLoading ? "جاري البحث..." : "بحث"}
          </Button>
          <span className="text-gray-500 text-sm">
            نتائج البحث: {
              Object.keys(
                getFilteredRows().reduce((acc, inv) => {
                  const key = inv.invoiceNumber + '-' + inv.invoiceType;
                  acc[key] = true;
                  return acc;
                }, {})
              ).length
            } - عرض الصفحة {currentPage} من {getTotalPages()}
          </span>
        </div>
<motion.div
  whileHover={{ scale: 1.05 }}
  className="absolute left-4 top-4 flex items-center gap-2 cursor-pointer text-blue-600 select-none"
  onClick={() => setShowMore((prev) => !prev)}
>
  <span className="text-sm font-medium">{showMore ? "إخفاء الخيارات الإضافية" : "عرض خيارات أكثر"}</span>
  <motion.svg
    animate={{ rotate: showMore ? 180 : 0 }}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2.5}
    stroke="currentColor"
    className="w-4 h-4 transition-transform"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </motion.svg>
  {/* زر إضافة فاتورة جديدة */}
  <Button
    type="primary"
    className="bg-green-500 text-white hover:bg-green-700 ml-2"
    size="middle"
    icon={
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    }
    onClick={() => navigate('/management/sale')
    

    }
  >
    إضافة فاتورة جديدة
  </Button>
</motion.div>
      </motion.div>

      {/* نتائج البحث */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm overflow-x-auto relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
        
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            نتائج البحث ({Object.keys(
              getFilteredRows().reduce((acc, inv) => {
                const key = inv.invoiceNumber + '-' + inv.invoiceType;
                acc[key] = true;
                return acc;
              }, {})
            ).length} فاتورة)
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={filteredInvoices.length === 0}
              className="bg-blue-400 hover:bg-green-700"
              size="large"
            >
              تصدير إكسل
            </Button>
            <Button
              type="primary"
              className="bg-blue-100 text-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
                onClick={handlePrintTable}
            >
              طباعة
            </Button>
          </div>
        </div>

        <Table  
        style={{ direction: 'rtl' 

        }}
          columns={[
            {
              title: 'رقم الفاتورة',
              dataIndex: 'invoiceNumber',
              key: 'invoiceNumber',
              minWidth: 130,
              sorter: (a: any, b: any) => a.invoiceNumber.localeCompare(b.invoiceNumber),
              render: (text: string, record: any) => (
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
              title: 'رقم القيد',
              dataIndex: 'entryNumber',
              key: 'entryNumber',
              minWidth: 120,
              render: (text: string, record: any) => record.entryNumber || record.id || '-',
              sorter: (a: any, b: any) => (a.entryNumber || a.id || '').localeCompare(b.entryNumber || b.id || ''),
            },
            {
              title: 'التاريخ',
              dataIndex: 'date',
              key: 'date',
              minWidth: 120,
              sorter: (a: any, b: any) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf(),
              render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '',
            },
            {
              title: 'رقم العميل',
              dataIndex: 'customerPhone',
              key: 'customerPhone',
              minWidth: 120,
              render: (phone: string) => phone && phone.trim() !== '' ? phone : 'غير متوفر',
            },
            {
              title: 'اسم العميل',
              dataIndex: 'customer',
              key: 'customer',
              minWidth: 190,
              sorter: (a: any, b: any) => (a.customer || '').localeCompare(b.customer || ''),
            },
            {
              title: 'الفرع',
              dataIndex: 'branch',
              key: 'branch',
              minWidth: 120,
              sorter: (a: any, b: any) => getBranchName(a.branch).localeCompare(getBranchName(b.branch)),
              render: (branch: string) => getBranchName(branch),
            },
            {
              title: 'الإجمالي',
              key: 'amount',
              minWidth: 120,
              render: (record: any) => {
                // حساب الإجمالي للفاتورة قبل الضريبة والخصم
                const invoiceRows = getFilteredRows().filter(
                  (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                );
                const totalAmount = invoiceRows.reduce((sum: number, row: any) => {
                  // حساب السعر × الكمية لكل صنف
                  const lineTotal = (Number(row.price) || 0) * (Number(row.quantity) || 0);
                  return sum + lineTotal;
                }, 0);
                const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                return `${(sign * totalAmount).toLocaleString()}`;
              },
              sorter: (a: any, b: any) => {
                // حساب الإجمالي للمقارنة في الترتيب
                const getInvoiceTotal = (record: any) => {
                  const invoiceRows = getFilteredRows().filter(
                    (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                  );
                  return invoiceRows.reduce((sum: number, row: any) => {
                    const lineTotal = (Number(row.price) || 0) * (Number(row.quantity) || 0);
                    return sum + lineTotal;
                  }, 0);
                };
                return getInvoiceTotal(a) - getInvoiceTotal(b);
              },
            },
            {
              title: 'الخصم',
              key: 'discountValue',
              minWidth: 100,
              render: (record: any) => {
                // حساب إجمالي الخصم للفاتورة
                const invoiceRows = getFilteredRows().filter(
                  (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                );
                const totalDiscount = invoiceRows.reduce((sum: number, row: any) => {
                  return sum + (Number(row.discountValue) || 0);
                }, 0);
                const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                return `${(sign * totalDiscount).toLocaleString()}`;
              },
              sorter: (a: any, b: any) => {
                const getTotalDiscount = (record: any) => {
                  const invoiceRows = getFilteredRows().filter(
                    (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                  );
                  return invoiceRows.reduce((sum: number, row: any) => {
                    return sum + (Number(row.discountValue) || 0);
                  }, 0);
                };
                return getTotalDiscount(a) - getTotalDiscount(b);
              },
            },
            {
              title: 'الإجمالي بعد الخصم',
              key: 'totalAfterDiscount',
              minWidth: 170,
              render: (record: any) => {
                const invoiceRows = getFilteredRows().filter(
                  (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                );
                const totalAmount = invoiceRows.reduce((sum: number, row: any) => {
                  return sum + ((Number(row.price) || 0) * (Number(row.quantity) || 0));
                }, 0);
                const totalDiscount = invoiceRows.reduce((sum: number, row: any) => {
                  return sum + (Number(row.discountValue) || 0);
                }, 0);
                const afterDiscount = totalAmount - totalDiscount;
                const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                return `${(sign * afterDiscount).toLocaleString()}`;
              },
              sorter: (a: any, b: any) => {
                const getAfterDiscount = (record: any) => {
                  const invoiceRows = getFilteredRows().filter(
                    (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                  );
                  const totalAmount = invoiceRows.reduce((sum: number, row: any) => {
                    return sum + ((Number(row.price) || 0) * (Number(row.quantity) || 0));
                  }, 0);
                  const totalDiscount = invoiceRows.reduce((sum: number, row: any) => {
                    return sum + (Number(row.discountValue) || 0);
                  }, 0);
                  return totalAmount - totalDiscount;
                };
                return getAfterDiscount(a) - getAfterDiscount(b);
              },
            },
            {
              title: 'الضرائب',
              key: 'taxValue',
              minWidth: 100,
              render: (record: any) => {
                // حساب إجمالي الضرائب للفاتورة
                const invoiceRows = getFilteredRows().filter(
                  (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                );
                const totalTax = invoiceRows.reduce((sum: number, row: any) => {
                  return sum + (Number(row.taxValue) || 0);
                }, 0);
                const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                return `${(sign * totalTax).toLocaleString()}`;
              },
              sorter: (a: any, b: any) => {
                const getTotalTax = (record: any) => {
                  const invoiceRows = getFilteredRows().filter(
                    (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                  );
                  return invoiceRows.reduce((sum: number, row: any) => {
                    return sum + (Number(row.taxValue) || 0);
                  }, 0);
                };
                return getTotalTax(a) - getTotalTax(b);
              },
            },
            {
              title: 'الإجمالي النهائي',
              key: 'net',
              minWidth: 140,
              render: (record: any) => {
                // حساب الإجمالي النهائي للفاتورة (الإجمالي - الخصم + الضريبة)
                const invoiceRows = getFilteredRows().filter(
                  (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                );
                const totalAmount = invoiceRows.reduce((sum: number, row: any) => {
                  const lineTotal = (Number(row.price) || 0) * (Number(row.quantity) || 0);
                  return sum + lineTotal;
                }, 0);
                const totalDiscount = invoiceRows.reduce((sum: number, row: any) => {
                  return sum + (Number(row.discountValue) || 0);
                }, 0);
                const totalTax = invoiceRows.reduce((sum: number, row: any) => {
                  return sum + (Number(row.taxValue) || 0);
                }, 0);
                const net = totalAmount - totalDiscount + totalTax;
                const sign = record.invoiceType === 'مرتجع' ? -1 : 1;
                return `${(sign * net).toLocaleString()}`;
              },
              sorter: (a: any, b: any) => {
                const getNetTotal = (record: any) => {
                  const invoiceRows = getFilteredRows().filter(
                    (row: any) => row.invoiceNumber === record.invoiceNumber && row.invoiceType === record.invoiceType
                  );
                  const totalAmount = invoiceRows.reduce((sum: number, row: any) => {
                    const lineTotal = (Number(row.price) || 0) * (Number(row.quantity) || 0);
                    return sum + lineTotal;
                  }, 0);
                  const totalDiscount = invoiceRows.reduce((sum: number, row: any) => {
                    return sum + (Number(row.discountValue) || 0);
                  }, 0);
                  const totalTax = invoiceRows.reduce((sum: number, row: any) => {
                    return sum + (Number(row.taxValue) || 0);
                  }, 0);
                  return totalAmount - totalDiscount + totalTax;
                };
                return getNetTotal(a) - getNetTotal(b);
              },
            },
            {
              title: 'نوع الفاتورة',
              dataIndex: 'invoiceType',
              key: 'invoiceType',
              minWidth: 120,
              sorter: (a: any, b: any) => a.invoiceType.localeCompare(b.invoiceType),
              render: (type: string) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  type === 'مرتجع' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }`}>
                  {type}
                </span>
              ),
            },
            {
              title: 'المخزن',
              dataIndex: 'warehouse',
              key: 'warehouse',
              minWidth: 120,
              sorter: (a: any, b: any) => getWarehouseName(a.warehouse).localeCompare(getWarehouseName(b.warehouse)),
              render: (warehouse: string) => getWarehouseName(warehouse),
            },
            {
              title: 'طريقة الدفع',
              dataIndex: 'paymentMethod',
              key: 'paymentMethod',
              minWidth: 120,
              render: (method: string) => method || '-',
            },
            {
              title: 'البائع',
              dataIndex: 'seller',
              key: 'seller',
              minWidth: 120,
              sorter: (a: any, b: any) => getSalesRepName(a.seller).localeCompare(getSalesRepName(b.seller)),
              render: (seller: string) => getSalesRepName(seller),
            },
            {
              title: 'الوقت',
              key: 'time',
              minWidth: 100,
              render: (record: any) => {
                const parseTime = (val: any) => {
                  if (!val) return '';
                  if (typeof val === 'object' && val.seconds) {
                    return dayjs(val.seconds * 1000).format('hh:mm:ss A');
                  }
                  if (typeof val === 'string') {
                    const d = dayjs(val);
                    if (d.isValid()) return d.format('hh:mm:ss A');
                  }
                  return '';
                };
                return parseTime(record.createdAt) || (record.date ? dayjs(record.date).format('hh:mm:ss A') : '');
              },
            },

          ]}
          dataSource={(() => {
            // تجميع البيانات حسب رقم الفاتورة ونوعها لعرض فاتورة واحدة لكل صف
            const grouped = Object.values(
              getPaginatedRows().reduce((acc, inv) => {
                const key = inv.invoiceNumber + '-' + inv.invoiceType;
                if (!acc[key]) {
                  // إنشاء سجل موحد للفاتورة بأول صنف
                  acc[key] = {
                    ...inv,
                    key: key,
                    id: inv.id, // التأكد من وجود المعرف
                    _rows: [] // للاحتفاظ بجميع الأصناف للاستخدام في الحسابات
                  };
                }
                acc[key]._rows.push(inv);
                return acc;
              }, {} as Record<string, GroupedInvoice>)
            );
            return grouped;
          })()}
          rowKey="key"
          pagination={false}
          loading={isLoading}
          scroll={{ x: 1200 }}
          size="small"
          bordered
          className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-blue-900 [&_.ant-table-thead_>_tr_>_th]:border-blue-300 [&_.ant-table-thead_>_tr_>_th]:font-semibold [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
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
            let totalAmount = 0;
            let totalDiscount = 0;
            let totalAfterDiscount = 0;
            let totalTax = 0;
            let totalNet = 0;

            // تجميع البيانات حسب الفاتورة لتجنب التكرار
            const groupedInvoices = Object.values(
              allRows.reduce((acc: Record<string, {invoiceType: string, rows: any[]}>, row: any) => {
                const key = row.invoiceNumber + '-' + row.invoiceType;
                if (!acc[key]) {
                  acc[key] = {
                    invoiceType: row.invoiceType,
                    rows: []
                  };
                }
                acc[key].rows.push(row);
                return acc;
              }, {})
            );

            groupedInvoices.forEach((invoice) => {
              const sign = invoice.invoiceType === 'مرتجع' ? -1 : 1;
              
              // حساب إجمالي الفاتورة
              const invoiceTotal = invoice.rows.reduce((sum: number, row: any) => {
                return sum + ((Number(row.price) || 0) * (Number(row.quantity) || 0));
              }, 0);
              
              // حساب إجمالي الخصم
              const invoiceDiscount = invoice.rows.reduce((sum: number, row: any) => {
                return sum + (Number(row.discountValue) || 0);
              }, 0);
              
              // حساب إجمالي الضريبة
              const invoiceTax = invoice.rows.reduce((sum: number, row: any) => {
                return sum + (Number(row.taxValue) || 0);
              }, 0);
              
              // حساب الصافي
              const invoiceNet = invoice.rows.reduce((sum: number, row: any) => {
                return sum + (Number(row.net) || 0);
              }, 0);

              totalAmount += sign * invoiceTotal;
              totalDiscount += sign * invoiceDiscount;
              totalAfterDiscount += sign * (invoiceTotal - invoiceDiscount);
              totalTax += sign * invoiceTax;
              totalNet += sign * invoiceNet;
            });

            return (
              <Table.Summary fixed>
                <Table.Summary.Row className=" ">
                  <Table.Summary.Cell index={0} className="text-center ">الإجماليات</Table.Summary.Cell>
                  <Table.Summary.Cell index={1}></Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}></Table.Summary.Cell>
                  <Table.Summary.Cell index={4}></Table.Summary.Cell>
                  <Table.Summary.Cell index={5}></Table.Summary.Cell>
                  <Table.Summary.Cell index={6} className="">
                    {totalAmount.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} className="">
                    {totalDiscount.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} className="">
                    {totalAfterDiscount.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} className="">
                    {totalTax.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={10} className="">
                    {totalNet.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={11}></Table.Summary.Cell>
                  <Table.Summary.Cell index={13}></Table.Summary.Cell>
                  <Table.Summary.Cell index={14}></Table.Summary.Cell>
                  <Table.Summary.Cell index={15}></Table.Summary.Cell>
                  <Table.Summary.Cell index={16}></Table.Summary.Cell>
                  <Table.Summary.Cell index={17}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />

        {/* Pagination */}
        {getFilteredRows().length > 0 && (
          <div className="flex justify-center mt-4">
            <Pagination
              current={currentPage}
              total={getFilteredRows().length}
              pageSize={pageSize}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total, range) => 
                `${range[0]}-${range[1]} من ${total} نتيجة`
              }
              className="bg-white [&_.ant-pagination-item-active]:border-emerald-600"
            />
          </div>
        )}
      </motion.div>
    {/* مودال تفاصيل الفاتورة */}
{
  showInvoiceModal && selectedInvoice && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
      {/* Modal Container with Slide-in Animation */}
      <div 
        className="bg-white rounded-xl shadow-2xl p-8 max-w-[95vw] w-[950px] md:w-[1150px] lg:w-[1300px] mx-2 md:mx-8 relative"
        style={{ fontFamily: "Tajawal", maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button with Hover Animation */}
        <button
          className="absolute left-4 top-4 text-gray-500 hover:text-red-600 text-2xl font-bold transition-colors duration-200 transform hover:scale-110"
          onClick={() => setShowInvoiceModal(false)}
          title="إغلاق"
        >
          ×
        </button>
        
        {/* Modal Content - جميع الحقول مقفولة للعرض فقط */}
        <div ref={printRef} className="space-y-6">
          {/* Header with Fade-in Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h2 className="text-2xl font-bold text-blue-800 mb-1">تفاصيل الفاتورة</h2>
            <div className="h-1 w-20 bg-blue-500 rounded-full"></div>
          </motion.div>
          {/* معلومات الفاتورة - حقول إدخال قابلة للتعديل */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">رقم الفاتورة</label>
              <input type="text" className="bg-gray-100 rounded px-3 py-2 text-gray-800" value={selectedInvoice.invoiceNumber} readOnly />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">رقم القيد</label>
              <input type="text" className="bg-gray-100 rounded px-3 py-2 text-gray-800" value={selectedInvoice.entryNumber || '-'} readOnly />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">تاريخ الفاتورة</label>
              <input type="text" className="bg-gray-100 rounded px-3 py-2 text-gray-800" value={dayjs(selectedInvoice.date).format("YYYY-MM-DD")} readOnly />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">نوع الفاتورة</label>
              <div className="bg-gray-100 rounded px-3 py-2">
                <Select value={selectedInvoice.invoiceType} disabled style={{ width: '100%' }}>
                  <Select.Option value="مبيعات">مبيعات</Select.Option>
                  <Select.Option value="مرتجع">مرتجع</Select.Option>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">اسم العميل</label>
              <div className="bg-gray-100 rounded px-3 py-2">
                <Select showSearch value={selectedInvoice.customer} disabled style={{ width: '100%' }}>
                  {Array.from(new Set(filteredInvoices.map(inv => inv.customer).filter(s => !!s && s !== ''))).map(s => (
                    <Select.Option key={s} value={s}>{s}</Select.Option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">رقم العميل</label>
              <input type="text" className="bg-gray-100 rounded px-3 py-2 text-gray-800" value={selectedInvoice.customerPhone || "غير متوفر"} readOnly />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">المخزن</label>
              <div className="bg-gray-100 rounded px-3 py-2">
                <Select value={selectedInvoice.warehouse} disabled style={{ width: '100%' }}>
                  {warehouses.map(w => (
                    <Select.Option key={w.id} value={w.id}>{w.name}</Select.Option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">البائع</label>
              <div className="bg-gray-100 rounded px-3 py-2">
                <Select value={selectedInvoice.seller} disabled style={{ width: '100%' }}>
                  {Array.from(new Set(filteredInvoices.map(inv => inv.seller).filter(s => !!s && s !== ''))).map(s => (
                    <Select.Option key={s} value={s}>{getSalesRepName(s)}</Select.Option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm text-gray-600">طريقة الدفع</label>
              <div className="bg-gray-100 rounded px-3 py-2">
                <Select value={selectedInvoice.paymentMethod} disabled style={{ width: '100%' }}>
                  {Array.from(new Set(filteredInvoices.map(inv => inv.paymentMethod).filter(s => !!s && s !== ''))).map(s => (
                    <Select.Option key={s} value={s}>{s}</Select.Option>
                  ))}
                </Select>
              </div>
            </div>
          </motion.div>
          
          {/* Invoice Information Grid */}
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">رقم الفاتورة:</span>
              <span className="text-gray-800">{selectedInvoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">رقم القيد:</span>
              <span className="text-gray-800">{selectedInvoice.entryNumber || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">تاريخ الفاتورة:</span>
              <span className="text-gray-800">{dayjs(selectedInvoice.date).format("YYYY-MM-DD")}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">نوع الفاتورة:</span>
              <span className="text-gray-800">{selectedInvoice.invoiceType}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">اسم العميل:</span>
              <span className="text-gray-800">{selectedInvoice.customer}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">رقم العميل:</span>
              <span className="text-gray-800">{selectedInvoice.customerPhone || "غير متوفر"}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">المخزن:</span>
              <span className="text-gray-800">{getWarehouseName(selectedInvoice.warehouse)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">البائع:</span>
              <span className="text-gray-800">{getSalesRepName(selectedInvoice.seller)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-gray-600">طريقة الدفع:</span>
              <span className="text-gray-800">{selectedInvoice.paymentMethod || "-"}</span>
            </div>
          </motion.div>
          
          {/* Items Table with Staggered Animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-blue-50">
                  <motion.tr
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="bg-emerald-100"
                  >
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">كود الصنف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">اسم الصنف</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">الفئة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">الكمية</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">الوحدة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">سعر الوحدة</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">الخصم</th>
                  </motion.tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices
                    .filter(
                      (row) =>
                        row.invoiceNumber === selectedInvoice.invoiceNumber &&
                        row.invoiceType === selectedInvoice.invoiceType
                    )
                    .map((row, idx) => {
                      const price = Number(row.price) || 0;
                      const quantity = Number(row.quantity) || 0;
                      const discountValue = Number(row.discountValue) || 0;
                      const discountPercent = Number(row.discountPercent) || 0;
                      const totalAfterDiscount =
                        typeof row.totalAfterDiscount !== "undefined"
                          ? row.totalAfterDiscount
                          : price * quantity - discountValue;
                      const taxValue = Number(row.taxValue) || 0;
                      const net = Number(row.net) || 0;
                      const sign = row.invoiceType === "مرتجع" ? -1 : 1;
                      
                      return (
                        <motion.tr
                          key={idx}
                          className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 + idx * 0.05 }}
                          whileHover={{ scale: 1.01, backgroundColor: "rgba(59, 130, 246, 0.05)" }}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.itemNumber || ""}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{row.itemName || ""}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.mainCategory || ""}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{quantity}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{row.unit || ""}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{price.toFixed(2)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            <div className="flex flex-col">
                              <span>{discountPercent}%</span>
                              <span className="text-red-500">{(sign * discountValue).toFixed(2)}</span>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </motion.div>
          
          {/* Totals Summary with Slide-up Animation */}
          <motion.div
            className="flex flex-col items-end"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
              {(() => {
                const allRows = filteredInvoices.filter(
                  (row) =>
                    row.invoiceNumber === selectedInvoice.invoiceNumber &&
                    row.invoiceType === selectedInvoice.invoiceType
                );
                
                let total = 0,
                  totalDiscount = 0,
                  afterDiscount = 0,
                  totalTax = 0,
                  finalTotal = 0;
                
                allRows.forEach((row) => {
                  const sign = row.invoiceType === "مرتجع" ? -1 : 1;
                  const price = Number(row.price) || 0;
                  const quantity = Number(row.quantity) || 0;
                  const discountValue = Number(row.discountValue) || 0;
                  const taxValue = Number(row.taxValue) || 0;
                  const subtotal = price * quantity;
                  const totalAfterDiscount =
                    typeof row.totalAfterDiscount !== "undefined"
                      ? row.totalAfterDiscount
                      : subtotal - discountValue;
                  
                  total += sign * subtotal;
                  totalDiscount += sign * discountValue;
                  afterDiscount += sign * (totalAfterDiscount < 0 ? 0 : totalAfterDiscount);
                  totalTax += sign * taxValue;
                  finalTotal += sign * ((totalAfterDiscount < 0 ? 0 : totalAfterDiscount) + taxValue);
                });
                
                return (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="font-semibold">الإجمالي:</span>
                      <span>{total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span className="font-semibold">الخصم:</span>
                      <span>-{totalDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">بعد الخصم:</span>
                      <span>{afterDiscount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">الضريبة:</span>
                      <span>{totalTax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-gray-200 font-bold text-lg text-blue-700">
                      <span>الإجمالي النهائي:</span>
                      <span>{finalTotal.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
          
          {/* Additional Info with Fade Animation */}
          <motion.div
            className="flex flex-wrap justify-between text-sm text-gray-600 mt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            <div className="flex items-center space-x-2">
              <span className="font-semibold">وقت الإنشاء:</span>
              <span>
                {(() => {
                  const parseTime = (val: { seconds?: number } | string | undefined | null) => {
                    if (!val) return "";
                    if (typeof val === "object" && val.seconds) {
                      return dayjs(val.seconds * 1000).format("hh:mm:ss A");
                    }
                    if (typeof val === "string") {
                      const d = dayjs(val);
                      if (d.isValid()) return d.format("hh:mm:ss A");
                    }
                    return "";
                  };
                  return (
                    parseTime(selectedInvoice.createdAt) ||
                    (selectedInvoice.date
                      ? dayjs(selectedInvoice.date).format("hh:mm:ss A")
                      : "")
                  );
                })()}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">نسبة الضريبة:</span>
              <span>{selectedInvoice.taxPercent}%</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold">العملة:</span>
              <span>ريال سعودي</span>
            </div>
          </motion.div>
        </div>
        
        {/* Action Buttons with Staggered Animation */}
        <motion.div 
          className="flex justify-end space-x-3 mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <motion.button
            className="px-6 py-2 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition-colors duration-200 flex items-center"
            onClick={() => {/* TODO: handleEditInvoice */}}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1 0v14m-7-7h14" />
            </svg>
            تعديل
          </motion.button>
          <motion.button
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors duration-200 flex items-center"
            onClick={handlePrint}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            طباعة
          </motion.button>
          <motion.button
            className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg shadow-md hover:bg-gray-300 transition-colors duration-200 flex items-center"
            onClick={() => setShowInvoiceModal(false)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            إغلاق
          </motion.button>
        </motion.div>
      </div>
    </div>
  )
}
    </div>
    </>
  );
};

export default Invoice;

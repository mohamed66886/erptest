import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Helmet } from "react-helmet";
import { Link, useNavigate } from 'react-router-dom';
import { getDocs, query, collection, where, WhereFilterOp, Query, CollectionReference, doc, updateDoc } from "firebase/firestore";
import { motion, AnimatePresence, useAnimation } from "framer-motion";
import { DatePicker, Input, Select, Button, Table, Pagination, Calendar, message, Modal, Switch } from "antd";
import { SearchOutlined, DownloadOutlined, FileTextOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import dayjs from 'dayjs';
import { Select as AntdSelect } from 'antd';
import { useSidebar } from "@/hooks/useSidebar";
import { db } from '@/lib/firebase';
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



const InstallationOrders: React.FC = () => {
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

  // بيانات المستخدم الحالي من localStorage
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    fullName: string;
    position: string;
    branchId?: string;
    branchName?: string;
    warehouseId?: string;
    warehouseName?: string;
    permissions?: string[];
  } | null>(null);

  // السنة المالية من السياق العام
  const { currentFinancialYear, setCurrentFinancialYear, activeYears } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
  }, [currentFinancialYear]);

  // تحميل بيانات المستخدم الحالي من localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        console.log('👤 Current User in Orders:', user);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }, []);

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

  // واجهة طلبات التركيب
  interface InstallationOrder {
    id: string;
    fullInvoiceNumber: string;
    invoiceNumberPart: string;
    branchId: string;
    branchName: string;
    branchBalance: number;
    customerName: string;
    customerPhone: string;
    districtId: string;
    districtName: string;
    regionId: string;
    regionName: string;
    governorateId: string;
    governorateName: string;
    technicianId?: string;
    technicianName?: string;
    warehouseId: string;
    warehouseName: string;
    warehouseKeeper: string;
    status: string; // حالة التركيب
    deliveryStatus?: string; // حالة التوصيل
    deliveryDate: string;
    notes: string;
    requiresInstallation: boolean;
    fileName?: string;
    fileSize?: number;
    fileUrl?: string;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    updatedAt: string;
  }

  const [installationOrders, setInstallationOrders] = useState<InstallationOrder[]>([]);
  const [filteredInstallationOrders, setFilteredInstallationOrders] = useState<InstallationOrder[]>([]);
  
  // بيانات للفلاتر
  const [technicians, setDrivers] = useState<{id: string; name: string; nameAr?: string}[]>([]);
  const [governorates, setGovernorates] = useState<{id: string; name: string; nameAr?: string}[]>([]);
  const [regions, setRegions] = useState<{id: string; name: string; nameAr?: string; governorateId?: string}[]>([]);
  const [districts, setDistricts] = useState<{id: string; name: string; nameAr?: string; regionId?: string}[]>([]);
  
  // States للبحث
  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState<string>("");
  const [searchCustomerName, setSearchCustomerName] = useState<string>("");
  const [searchCustomerPhone, setSearchCustomerPhone] = useState<string>("");
  const [searchNotes, setSearchNotes] = useState<string>("");
  const [searchTechnicianId, setSearchDriverId] = useState<string>("");
  const [searchGovernorateId, setSearchGovernorateId] = useState<string>("");
  const [searchRegionId, setSearchRegionId] = useState<string>("");
  const [searchDistrictId, setSearchDistrictId] = useState<string>("");
  const [searchBranchId, setSearchBranchId] = useState<string>("");
  const [searchDeliveryDate, setSearchDeliveryDate] = useState<dayjs.Dayjs | null>(null);
  const [searchInstallation, setSearchInstallation] = useState<string>("");
  const [searchBranchStatus, setSearchBranchStatus] = useState<string>("");
  const [searchDeliveryStatus, setSearchDeliveryStatus] = useState<string>(""); // إزالة الفلتر الافتراضي
  
  // حالة وضع تعيين الفني
  const [assignTechnicianMode, setAssignDriverMode] = useState(false);

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
  
  // دالة جلب طلبات التركيب من Firebase
  const fetchInstallationOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const allOrders: InstallationOrder[] = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as InstallationOrder));
      
      console.log('📊 جميع الطلبات من قاعدة البيانات:', allOrders.length);
      console.log('📋 الطلبات التي تتطلب تركيب:', 
        allOrders.filter(o => o.requiresInstallation === true).map(o => ({
          رقم_الفاتورة: o.fullInvoiceNumber,
          الحالة: o.status,
          يتطلب_تركيب: o.requiresInstallation
        }))
      );
      
      // فلترة الطلبات لعرض فقط:
      // 1. الطلبات التي تتطلب تركيب (requiresInstallation = true)
      // 2. حالة التوصيل: مكتملة أو مؤرشفة (ليست قيد الانتظار)
      const ordersWithInstallation = allOrders.filter(order => {
        const hasInstallation = order.requiresInstallation === true;
        const orderStatus = (order.status || '').trim();
        
        // الطلب يعتبر مكتمل إذا كانت حالته "مكتمل" أو "مكتملة" أو "مؤرشفة"
        const isDeliveryComplete = 
          orderStatus === 'مكتمل' || 
          orderStatus === 'مكتملة' || 
          orderStatus === 'مؤرشفة' ||
          orderStatus === 'تم التوصيل';
        
        // طباعة معلومات التصحيح للطلبات التي لها تركيب
        if (hasInstallation) {
          console.log('📋 طلب:', {
            رقم_الفاتورة: order.fullInvoiceNumber,
            يتطلب_تركيب: order.requiresInstallation,
            الحالة: `"${order.status}"`,
            الحالة_بعد_التنظيف: `"${orderStatus}"`,
            توصيل_مكتمل: isDeliveryComplete,
            سيظهر: hasInstallation && isDeliveryComplete
          });
        }
        
        return hasInstallation && isDeliveryComplete;
      });
      
      console.log('📦 إجمالي طلبات التوصيل:', allOrders.length);
      console.log('🔧 طلبات التركيب المفلترة:', ordersWithInstallation.length);
      console.log('✅ الفلاتر المطبقة: يتطلب تركيب + حالة التوصيل (مكتملة/مؤرشفة - ليست قيد الانتظار)');
      
      setInstallationOrders(ordersWithInstallation);
      setFilteredInstallationOrders(ordersWithInstallation);
    } catch (error) {
      console.error('Error fetching delivery orders:', error);
      message.error('حدث خطأ أثناء جلب طلبات التركيب');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
    fetchInstallationOrders();
    fetchTechnicians();
    fetchGovernorates();
    fetchRegions();
    fetchDistricts();
  }, [fetchInstallationOrders]);

  // جلب الفنيين
  const fetchTechnicians = async () => {
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snapshot = await getDocs(collection(db, 'technicians'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        nameAr: doc.data().nameAr || doc.data().name || ''
      }));
      setDrivers(data);
    } catch (error) {
      console.error('Error fetching technicians:', error);
    }
  };

  // جلب المحافظات
  const fetchGovernorates = async () => {
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snapshot = await getDocs(collection(db, 'governorates'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        nameAr: doc.data().nameAr || doc.data().name || ''
      }));
      setGovernorates(data);
    } catch (error) {
      console.error('Error fetching governorates:', error);
    }
  };

  // جلب المناطق
  const fetchRegions = async () => {
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snapshot = await getDocs(collection(db, 'regions'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        nameAr: doc.data().nameAr || doc.data().name || '',
        governorateId: doc.data().governorate || doc.data().governorateId || ''
      }));
      setRegions(data);
    } catch (error) {
      console.error('Error fetching regions:', error);
    }
  };

  // جلب الأحياء
  const fetchDistricts = async () => {
    try {
      const { getDocs, collection } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const snapshot = await getDocs(collection(db, 'districts'));
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        nameAr: doc.data().nameAr || doc.data().name || '',
        regionId: doc.data().regionId || ''
      }));
      setDistricts(data);
    } catch (error) {
      console.error('Error fetching districts:', error);
    }
  };

  // دالة الحذف
  const handleDelete = async (orderId: string) => {
    // البحث عن الطلب للحصول على رابط الملف
    const orderToDelete = installationOrders.find(order => order.id === orderId);
    
    Modal.confirm({
      title: 'تأكيد الحذف',
      content: 'هل أنت متأكد من حذف هذا الطلب؟ سيتم حذف الملف المرفق أيضاً. لا يمكن التراجع عن هذا الإجراء.',
      okText: 'نعم، احذف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const { deleteDoc, doc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          
          // حذف الملف من Storage إذا كان موجوداً
          if (orderToDelete?.fileUrl) {
            try {
              const { ref, deleteObject } = await import('firebase/storage');
              const { storage } = await import('@/lib/firebase');
              
              // استخراج مسار الملف من URL
              const fileUrl = orderToDelete.fileUrl;
              const decodedUrl = decodeURIComponent(fileUrl);
              const pathMatch = decodedUrl.match(/\/o\/(.+?)\?/);
              
              if (pathMatch && pathMatch[1]) {
                const filePath = pathMatch[1];
                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef);
                console.log('تم حذف الملف من Storage بنجاح');
              }
            } catch (storageError) {
              console.error('Error deleting file from storage:', storageError);
              // نكمل عملية الحذف حتى لو فشل حذف الملف
              message.warning('تم حذف الطلب ولكن حدث خطأ في حذف الملف المرفق');
            }
          }
          
          // حذف السجل من Firestore
          await deleteDoc(doc(db, 'delivery_orders', orderId));
          message.success('تم حذف الطلب والملف المرفق بنجاح');
          
          // تحديث القائمة
          fetchInstallationOrders();
        } catch (error) {
          console.error('Error deleting order:', error);
          message.error('حدث خطأ أثناء حذف الطلب');
        }
      }
    });
  };

  // عند تغيير invoices (بعد الجلب)، اعرض كل البيانات مباشرة في الجدول
  useEffect(() => {
    let filtered = [...installationOrders];

    // فلترة حسب فرع المستخدم إذا كان مدير فرع
    if (currentUser?.position === 'مدير فرع' && currentUser?.branchId) {
      filtered = filtered.filter(order => order.branchId === currentUser.branchId);
      console.log('🏪 Filtering orders for branch:', currentUser.branchId, 'Orders count:', filtered.length);
    }

    if (searchInvoiceNumber) {
      filtered = filtered.filter(order => 
        order.fullInvoiceNumber?.toLowerCase().includes(searchInvoiceNumber.toLowerCase()) ||
        order.invoiceNumberPart?.toLowerCase().includes(searchInvoiceNumber.toLowerCase())
      );
    }

    if (searchCustomerName) {
      filtered = filtered.filter(order => 
        order.customerName?.toLowerCase().includes(searchCustomerName.toLowerCase())
      );
    }

    if (searchCustomerPhone) {
      filtered = filtered.filter(order => 
        order.customerPhone?.includes(searchCustomerPhone)
      );
    }

    if (searchNotes) {
      filtered = filtered.filter(order => 
        order.notes?.toLowerCase().includes(searchNotes.toLowerCase())
      );
    }

    if (searchTechnicianId) {
      filtered = filtered.filter(order => order.technicianId === searchTechnicianId);
    }

    if (searchGovernorateId) {
      filtered = filtered.filter(order => order.governorateId === searchGovernorateId);
    }

    if (searchRegionId) {
      filtered = filtered.filter(order => order.regionId === searchRegionId);
    }

    if (searchDistrictId) {
      filtered = filtered.filter(order => order.districtId === searchDistrictId);
    }

    if (searchBranchId) {
      filtered = filtered.filter(order => order.branchId === searchBranchId);
    }

    if (searchDeliveryDate) {
      filtered = filtered.filter(order => 
        order.deliveryDate === searchDeliveryDate.format('YYYY-MM-DD')
      );
    }

    if (searchInstallation) {
      const requiresInstallation = searchInstallation === 'نعم';
      filtered = filtered.filter(order => order.requiresInstallation === requiresInstallation);
    }

    if (searchDeliveryStatus) {
      filtered = filtered.filter(order => {
        const status = order.status || 'قيد الانتظار';
        return status === searchDeliveryStatus;
      });
    }

    setFilteredInstallationOrders(filtered);
    setCurrentPage(1);
  }, [
    installationOrders,
    currentUser,
    searchInvoiceNumber,
    searchCustomerName,
    searchCustomerPhone,
    searchNotes,
    searchTechnicianId,
    searchGovernorateId,
    searchRegionId,
    searchDistrictId,
    searchBranchId,
    searchDeliveryDate,
    searchInstallation,
    searchDeliveryStatus
  ]);

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
    fetchInstallationOrders();
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
              <td class="total-value">${totalAfterDiscount.toLocaleString()}</td>
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
  // دالة فتح صفحة إشعار الفنيين
  const openTechnicianNotificationPage = (orders: InstallationOrder[]) => {
    const technicianWindow = window.open('', 'إشعار الفنيين', 'width=900,height=700');
    if (technicianWindow) {
      // تجميع الطلبات حسب الفني
      const ordersByTechnician = orders.reduce((acc, order) => {
        const technicianId = order.technicianId || 'غير محدد';
        if (!acc[technicianId]) {
          acc[technicianId] = {
            name: order.technicianName || 'غير محدد',
            orders: []
          };
        }
        acc[technicianId].orders.push(order);
        return acc;
      }, {} as Record<string, {name: string, orders: InstallationOrder[]}>);
      
      technicianWindow.document.write(`
        <html dir="rtl">
        <head>
          <title>إشعار الفنيين</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Tajawal', sans-serif; padding: 20px; background: #f5f5f5; }
            .header { background: #f97316; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .driver-section { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
            .driver-title { font-size: 20px; font-weight: bold; color: #f97316; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #f97316; }
            .order-item { padding: 12px; border-bottom: 1px solid #e5e5e5; font-size: 14px; }
            .order-item:hover { background: #f9fafb; }
            .send-btn { background: #f97316; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 16px; margin-top: 20px; width: 100%; }
            .send-btn:hover { background: #ea580c; }
            .summary { background: #fed7aa; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-size: 18px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🔧 إشعار الفنيين بطلبات التركيب</h1>
          </div>
          <div class="summary">
            عدد الفنيين: ${Object.keys(ordersByTechnician).length} | إجمالي الطلبات: ${orders.length}
          </div>
          ${Object.entries(ordersByTechnician).map(([technicianId, data]) => `
            <div class="driver-section">
              <div class="driver-title">👤 ${data.name} (${data.orders.length} طلب)</div>
              ${data.orders.map(order => `
                <div class="order-item">
                  📋 <strong>${order.fullInvoiceNumber}</strong> - 
                  👤 ${order.customerName} - 
                  📱 ${order.customerPhone} - 
                  📍 ${order.districtName} - ${order.regionName} - ${order.governorateName}
                  ${order.requiresInstallation ? ' - 🔧 يتطلب تركيب' : ''}
                  <br>
                  📅 تاريخ التركيب: ${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                  ${order.notes ? ` - 📝 ${order.notes}` : ''}
                </div>
              `).join('')}
            </div>
          `).join('')}
          <button class="send-btn" onclick="sendNotification()">📧 إرسال الإشعارات للفنيين</button>
          <script>
            function sendNotification() {
              if (confirm('هل تريد إرسال الإشعارات لجميع الفنيين؟')) {
                alert('تم إرسال الإشعارات بنجاح ✅');
                window.close();
              }
            }
          </script>
        </body>
        </html>
      `);
      technicianWindow.document.close();
    }
  };

  // دالة إرسال إشعار للفنيين
  const sendTechnicianNotification = (orders: InstallationOrder[]) => {
    Modal.confirm({
      title: 'إشعار الفني',
      content: `هل تريد إرسال إشعار للفنيين بـ ${orders.length} طلب تركيب؟`,
      okText: 'إرسال',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          message.loading('جاري إرسال الإشعار للفنيين...', 0);
          
          // تجميع الطلبات حسب الفني
          const ordersByTechnician = orders.reduce((acc, order) => {
            const technicianId = order.technicianId || '';
            if (!acc[technicianId]) {
              acc[technicianId] = [];
            }
            acc[technicianId].push(order);
            return acc;
          }, {} as Record<string, InstallationOrder[]>);
          
          const technicianCount = Object.keys(ordersByTechnician).length;
          
          // TODO: إضافة منطق إرسال الإشعارات للفنيين عبر Firebase
          // يمكن استخدام Firebase Cloud Messaging (FCM) أو إرسال بريد إلكتروني
          
          setTimeout(() => {
            message.destroy();
            message.success(`تم إرسال الإشعار لـ ${technicianCount} فني بنجاح (${orders.length} طلب)`);
          }, 1500);
        } catch (error) {
          message.error('حدث خطأ أثناء إرسال الإشعار');
        }
      }
    });
  };

  // دالة تعيين فني لطلب معين
  const handleAssignTechnician = async (orderId: string, technicianId: string, technicianName: string) => {
    Modal.confirm({
      title: 'تأكيد تعيين الفني',
      content: `هل تريد تعيين الفني "${technicianName}" لهذا الطلب؟`,
      okText: 'تأكيد',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          message.loading('جاري تعيين الفني...', 0);
          
          // TODO: تحديث Firebase بالفني الجديد
          const orderRef = doc(db, 'delivery_orders', orderId);
          await updateDoc(orderRef, {
            technicianId: technicianId,
            technicianName: technicianName,
            updatedAt: new Date().toISOString()
          });
          
          // تحديث البيانات المحلية
          setInstallationOrders(prev => 
            prev.map(order => 
              order.id === orderId 
                ? { ...order, technicianId, technicianName }
                : order
            )
          );
          
          message.destroy();
          message.success(`تم تعيين الفني "${technicianName}" بنجاح`);
        } catch (error) {
          console.error('Error assigning driver:', error);
          message.destroy();
          message.error('حدث خطأ أثناء تعيين الفني');
        }
      }
    });
  };

  // دالة طباعة طلبات التركيب المفلترة
  const handlePrint = () => {
    // تأكد من تحميل بيانات الشركة قبل الطباعة
    if (!companyData || !companyData.arabicName) {
      message.error('لم يتم تحميل بيانات الشركة بعد، يرجى المحاولة بعد لحظات');
      return;
    }

    // الحصول على طلبات التركيب المفلترة
    const ordersToPrint = filteredInstallationOrders;
    
    if (ordersToPrint.length === 0) {
      message.warning('لا توجد طلبات توصيل للطباعة');
      return;
    }

    // إنشاء HTML للطباعة
    const printWindow = window.open('', '', 'width=1400,height=900');
    printWindow?.document.write(`
      <html>
      <head>
        <title>طباعة طلبات التركيب</title>
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
            font-size: 9px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 4px 2px; 
            text-align: center;
            vertical-align: middle;
            font-size: 8px;
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
          .print-date {
            text-align: left;
            margin-top: 15px;
            font-size: 9px;
            color: #000;
          }
          .status-pending { color: #f59e0b; font-weight: bold; }
          .status-delivered { color: #10b981; font-weight: bold; }
          .status-cancelled { color: #ef4444; font-weight: bold; }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
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
          <h1>تقرير طلبات التركيب</h1>
          <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
          <div style="margin-top: 10px; font-size: 14px; color: #333;">
            إجمالي الطلبات: ${ordersToPrint.length}
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 60px;">م</th>
              <th style="width: 90px;">رقم الفاتورة</th>
              <th style="width: 120px;">اسم العميل</th>
              <th style="width: 85px;">هاتف العميل</th>
              <th style="width: 80px;">الفني</th>
              <th style="width: 70px;">الحي</th>
              <th style="width: 100px;">الملاحظات</th>
              <th style="width: 50px;">التركيب</th>
              <th style="width: 70px;">حالة الفرع</th>
              <th style="width: 80px;">حالة الطلب</th>
              <th style="width: 80px;">تاريخ التركيب</th>
              <th style="width: 80px;">وقت الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            ${ordersToPrint.map((order, idx) => {
              const formatDate = (dateStr) => {
                if (!dateStr) return '-';
                try {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString('ar-SA');
                } catch {
                  return dateStr;
                }
              };
              
              const formatDateTime = (dateStr) => {
                if (!dateStr) return '-';
                try {
                  const date = new Date(dateStr);
                  return date.toLocaleString('ar-SA', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                } catch {
                  return dateStr;
                }
              };
              
              const getStatusClass = (status) => {
                if (status === 'تم التركيب') return 'status-delivered';
                if (status === 'ملغي') return 'status-cancelled';
                return 'status-pending';
              };
              
              return '<tr>' +
                '<td>' + (idx + 1) + '</td>' +
                '<td>' + (order.fullInvoiceNumber || order.invoiceNumberPart || '-') + '</td>' +
                '<td>' + (order.customerName || '-') + '</td>' +
                '<td>' + (order.customerPhone || '-') + '</td>' +
                '<td>' + (order.technicianName || 'غير محدد') + '</td>' +
                '<td>' + (order.districtName || '-') + '</td>' +
                '<td>' + (order.notes || '-') + '</td>' +
                '<td>' + (order.requiresInstallation ? 'نعم' : 'لا') + '</td>' +
                '<td>' + (order.branchName || '-') + '</td>' +
                '<td class="' + getStatusClass(order.status) + '">' + (order.status || 'قيد الانتظار') + '</td>' +
                '<td>' + formatDate(order.deliveryDate) + '</td>' +
                '<td>' + formatDateTime(order.createdAt) + '</td>' +
                '</tr>';
            }).join('')}
          </tbody>
        </table>
        
        <div class="print-date">
          تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}
        </div>
        
        <!-- Signature Section -->
        <div style="
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0 20px;
          page-break-inside: avoid;
        ">
          <div style="flex: 1; text-align: right; font-size: 14px; font-weight: 500;">
            <div style="margin-bottom: 8px;">مدير العمليات: ___________________</div>
            <div>التوقيع: ___________________</div>
          </div>
          <div style="flex: 1; text-align: center; position: relative;">
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
          <div style="flex: 1; text-align: left; font-size: 14px; font-weight: 500;">
            <div style="margin-bottom: 8px;">مدير التركيب: ___________________</div>
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
  return (
    <>
      <Helmet>
        <title>طلبات التركيب | ERP90 Dashboard</title>
        <meta name="description" content="إدارة طلبات التركيب، متابعة حالة الطلب، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تركيب, طلبات, فني, عملاء, Installation, Orders, Technician" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
 


      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <svg className="h-8 w-8 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">طلبات التركيب</h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة ومتابعة طلبات التركيب</p>
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
          { label: "إدارة التركيبات", to: "/management/outputs" },
          { label: "طلبات التركيب" }
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
            <span style={labelStyle}>رقم الفاتورة</span>
            <Input 
              value={searchInvoiceNumber}
              onChange={e => setSearchInvoiceNumber(e.target.value)}
              placeholder="ادخل رقم الفاتورة"
              style={largeControlStyle}
              size="large"
              allowClear
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>اسم العميل</span>
            <Input 
              value={searchCustomerName}
              onChange={e => setSearchCustomerName(e.target.value)}
              placeholder="ادخل اسم العميل"
              style={largeControlStyle}
              size="large"
              allowClear
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>هاتف العميل</span>
            <Input 
              value={searchCustomerPhone}
              onChange={e => setSearchCustomerPhone(e.target.value)}
              placeholder="ادخل هاتف العميل"
              style={largeControlStyle}
              size="large"
              allowClear
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>الملاحظات</span>
            <Input 
              value={searchNotes}
              onChange={e => setSearchNotes(e.target.value)}
              placeholder="ادخل الملاحظات"
              style={largeControlStyle}
              size="large"
              allowClear
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>الفني</span>
            <Select
              value={searchTechnicianId || undefined}
              onChange={setSearchDriverId}
              placeholder="اختر الفني"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {technicians.map(driver => (
                <Option key={driver.id} value={driver.id}>
                  {driver.nameAr || driver.name}
                </Option>
              ))}
            </Select>
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>المحافظة</span>
            <Select
              value={searchGovernorateId || undefined}
              onChange={(value) => {
                setSearchGovernorateId(value);
                setSearchRegionId("");
                setSearchDistrictId("");
              }}
              placeholder="اختر المحافظة"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {governorates.map(gov => (
                <Option key={gov.id} value={gov.id}>
                  {gov.nameAr || gov.name}
                </Option>
              ))}
            </Select>
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>المنطقة</span>
            <Select
              value={searchRegionId || undefined}
              onChange={(value) => {
                setSearchRegionId(value);
                setSearchDistrictId("");
              }}
              placeholder="اختر المنطقة"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {regions
                .filter(r => !searchGovernorateId || r.governorateId === searchGovernorateId)
                .map(region => (
                  <Option key={region.id} value={region.id}>
                    {region.nameAr || region.name}
                  </Option>
                ))
              }
            </Select>
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>الحي</span>
            <Select
              value={searchDistrictId || undefined}
              onChange={setSearchDistrictId}
              placeholder="اختر الحي"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {districts
                .filter(d => !searchRegionId || d.regionId === searchRegionId)
                .map(district => (
                  <Option key={district.id} value={district.id}>
                    {district.nameAr || district.name}
                  </Option>
                ))
              }
            </Select>
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
                  <span style={labelStyle}>الفرع</span>
                  <Select
                    value={searchBranchId || undefined}
                    onChange={setSearchBranchId}
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
                  >
                    {branches.map(branch => (
                      <Option key={branch.id} value={branch.id}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>تاريخ التركيب</span>
                  <DatePicker 
                    value={searchDeliveryDate}
                    onChange={setSearchDeliveryDate}
                    placeholder="اختر تاريخ التركيب"
                    style={largeControlStyle}
                    size="large"
                    format="YYYY-MM-DD"
                    locale={arEG}
                    allowClear
                  />
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>التركيب</span>
                  <Select
                    value={searchInstallation || undefined}
                    onChange={setSearchInstallation}
                    placeholder="اختر حالة الطلب"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    allowClear
                  >
                    <Option value="نعم">نعم</Option>
                    <Option value="لا">لا</Option>
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>حالة مبلغ الفرع</span>
                  <Select
                    value={searchBranchStatus || undefined}
                    onChange={setSearchBranchStatus}
                    placeholder="اختر حالة مبلغ الفرع"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    allowClear
                  >
                    <Option value="الكل">الكل</Option>
                    <Option value="محدد">محدد</Option>
                    <Option value="غير محدد">غير محدد</Option>
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>حالة الطلب</span>
                  <Select
                    value={searchDeliveryStatus || undefined}
                    onChange={setSearchDeliveryStatus}
                    placeholder="اختر حالة الطلب"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    allowClear
                  >
                    <Option value="قيد الانتظار">قيد الانتظار</Option>
                    <Option value="قيد التركيب">قيد التركيب</Option>
                    <Option value="تم التركيب">تم التركيب</Option>
                    <Option value="ملغي">ملغي</Option>
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
            نتائج البحث: {filteredInstallationOrders.length} طلب تركيب - عرض الصفحة {currentPage} من {Math.ceil(filteredInstallationOrders.length / pageSize)}
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
    onClick={() => navigate('/management/installation-orders/new')}
  >
    اضافة طلب جديد
  </Button>
</motion.div>
      </motion.div>

      {/* تحذير للطلبات بدون فنيين */}
      {filteredInstallationOrders.filter(order => !order.technicianId || order.technicianId.trim() === '').length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg shadow-sm"
        >
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-orange-800 font-bold text-base mb-1"> تحذير: طلبات بدون فني</h4>
              <p className="text-orange-700 text-sm mb-2">
                يوجد <span className="font-bold text-lg">{filteredInstallationOrders.filter(order => !order.technicianId || order.technicianId.trim() === '').length}</span> طلب تركيب لم يتم تعيين فني لها
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {filteredInstallationOrders
                  .filter(order => !order.technicianId || order.technicianId.trim() === '')
                  .slice(0, 5)
                  .map((order, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1 bg-white px-3 py-1 rounded-full text-xs font-medium text-orange-700 border border-orange-200"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      {order.fullInvoiceNumber}
                    </span>
                  ))
                }
                {filteredInstallationOrders.filter(order => !order.technicianId || order.technicianId.trim() === '').length > 5 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-orange-600">
                    +{filteredInstallationOrders.filter(order => !order.technicianId || order.technicianId.trim() === '').length - 5} أخرى
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* نتائج البحث */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm overflow-x-auto relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
        
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              نتائج البحث ({filteredInstallationOrders.length} طلب)
            </h3>
            
            {/* زر تبديل وضع تعيين الفني */}
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
              <Switch
                checked={assignTechnicianMode}
                onChange={(checked) => {
                  setAssignDriverMode(checked);
                  if (checked) {
                    message.info('تم تفعيل وضع تعيين الفني. يمكنك الآن اختيار فني لكل طلب');
                  } else {
                    message.info('تم إيقاف وضع تعيين الفني');
                  }
                }}
                checkedChildren={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
                unCheckedChildren={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                }
              />
              <span className="text-sm font-medium text-blue-700">
                {assignTechnicianMode ? 'وضع تعيين الفني مفعل' : 'تفعيل وضع تعيين الفني'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              }
              className="bg-blue-100 text-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
              onClick={handlePrint}
            >
              طباعة
            </Button>
            <Button
              type="primary"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              onClick={() => {
                navigate('/management/confirm-installation-orders');
              }}
              disabled={filteredInstallationOrders.length === 0 || currentUser?.position === 'مدير فرع'}
              className="bg-green-500 hover:bg-green-600 border-green-600"
              size="large"
              title={currentUser?.position === 'مدير فرع' ? 'غير متاح لمدير الفرع' : ''}
            >
              تأكيد الطلبات
            </Button>
            <Button
              type="primary"
              icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              }
              onClick={() => {
                navigate('/management/technician-notifications');
              }}
              disabled={filteredInstallationOrders.length === 0 || currentUser?.position === 'مدير فرع'}
              className="bg-orange-500 hover:bg-orange-600 border-orange-600"
              size="large"
              title={currentUser?.position === 'مدير فرع' ? 'غير متاح لمدير الفرع' : ''}
            >
              إشعار فني
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
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const numA = a.fullInvoiceNumber || '';
                const numB = b.fullInvoiceNumber || '';
                return numA.localeCompare(numB, 'ar');
              },
              render: (text: string, record: InstallationOrder) => (
                <span className="text-blue-700 font-medium flex items-center gap-2">
                  {(!record.technicianId || record.technicianId.trim() === '') && (
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  )}
                  {text}
                </span>
              ),
            },
            {
              title: 'هاتف العميل',
              dataIndex: 'customerPhone',
              key: 'customerPhone',
              minWidth: 120,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const phoneA = a.customerPhone || '';
                const phoneB = b.customerPhone || '';
                return phoneA.localeCompare(phoneB);
              },
              render: (phone: string) => phone || 'غير متوفر',
            },
            {
              title: 'الفني',
              dataIndex: 'driver',
              key: 'driver',
              minWidth: assignTechnicianMode ? 200 : 120,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const nameA = a.technicianName || '';
                const nameB = b.technicianName || '';
                return nameA.localeCompare(nameB, 'ar');
              },
              render: (text: string, record: InstallationOrder) => {
                if (assignTechnicianMode) {
                  return (
                    <Select
                      value={record.technicianId || undefined}
                      onChange={(value) => {
                        const selectedDriver = technicians.find(d => d.id === value);
                        if (selectedDriver && record.id) {
                          handleAssignTechnician(
                            record.id, 
                            value, 
                            selectedDriver.nameAr || selectedDriver.name
                          );
                        }
                      }}
                      placeholder="اختر الفني"
                      style={{ width: '100%' }}
                      size="small"
                      showSearch
                      filterOption={(input, option) =>
                        option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                      }
                    >
                      {technicians.map(driver => (
                        <Option key={driver.id} value={driver.id}>
                          {driver.nameAr || driver.name}
                        </Option>
                      ))}
                    </Select>
                  );
                }
                return record.technicianName || '-';
              },
            },
            {
              title: 'الحي',
              dataIndex: 'district',
              key: 'district',
              minWidth: 120,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const districtA = a.districtName || '';
                const districtB = b.districtName || '';
                return districtA.localeCompare(districtB, 'ar');
              },
              render: (text: string, record: InstallationOrder) => record.districtName || '-',
            },
            {
              title: 'الملاحظات',
              dataIndex: 'notes',
              key: 'notes',
              minWidth: 150,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const notesA = a.notes || '';
                const notesB = b.notes || '';
                return notesA.localeCompare(notesB, 'ar');
              },
              render: (text: string) => text || '-',
            },
            {
              title: 'التركيب',
              dataIndex: 'installation',
              key: 'installation',
              minWidth: 100,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const installA = a.requiresInstallation ? 1 : 0;
                const installB = b.requiresInstallation ? 1 : 0;
                return installA - installB;
              },
              render: (text: string, record: InstallationOrder) => {
                const requires = record.requiresInstallation;
                return (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    requires ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {requires ? 'نعم' : 'لا'}
                  </span>
                );
              },
            },
            {
              title: 'حالة الفرع ',
              dataIndex: 'amount',
              key: 'amount',
              minWidth: 100,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const amountA = a.branchBalance || 0;
                const amountB = b.branchBalance || 0;
                return amountA - amountB;
              },
              render: (text: string, record: InstallationOrder) => {
                return record.branchBalance ? record.branchBalance.toLocaleString() : '0.00';
              },
            },
            {
              title: 'حالة الطلب',
              dataIndex: 'deliveryStatus',
              key: 'deliveryStatus',
              minWidth: 120,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const statusA = a.status || 'قيد الانتظار';
                const statusB = b.status || 'قيد الانتظار';
                return statusA.localeCompare(statusB, 'ar');
              },
              render: (status: string) => {
                let colorClass = 'bg-yellow-100 text-yellow-800';
                if (status === 'تم التركيب') colorClass = 'bg-green-100 text-green-800';
                else if (status === 'قيد التركيب') colorClass = 'bg-blue-100 text-blue-800';
                else if (status === 'ملغي') colorClass = 'bg-red-100 text-red-800';
                
                return (
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
                    {status || 'قيد الانتظار'}
                  </span>
                );
              },
            },
            {
              title: 'تاريخ التركيب',
              dataIndex: 'deliveryDate',
              key: 'deliveryDate',
              minWidth: 120,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const dateA = a.deliveryDate || '';
                const dateB = b.deliveryDate || '';
                return dateA.localeCompare(dateB);
              },
              render: (date: string) => date ? new Date(date).toLocaleDateString('en-GB') : '-',
            },
            {
              title: 'وقت الإنشاء',
              dataIndex: 'createdAt',
              key: 'createdAt',
              minWidth: 150,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const getTime = (createdAt: string | FirestoreTimestamp) => {
                  if (!createdAt) return 0;
                  if (typeof createdAt === 'object' && 'seconds' in createdAt) {
                    return createdAt.seconds * 1000;
                  }
                  if (typeof createdAt === 'string') {
                    return new Date(createdAt).getTime();
                  }
                  return 0;
                };
                return getTime(a.createdAt) - getTime(b.createdAt);
              },
              render: (createdAt: string | FirestoreTimestamp) => {
                if (!createdAt) return '-';
                
                // التعامل مع Firestore Timestamp
                if (typeof createdAt === 'object' && 'seconds' in createdAt) {
                  const date = new Date(createdAt.seconds * 1000);
                  return `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
                }
                
                // التعامل مع String
                if (typeof createdAt === 'string') {
                  const date = new Date(createdAt);
                  if (!isNaN(date.getTime())) {
                    return `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
                  }
                }
                
                return '-';
              },
            },
            {
              title: 'اسم العميل',
              dataIndex: 'customerName',
              key: 'customerName',
              minWidth: 150,
              sorter: (a: InstallationOrder, b: InstallationOrder) => {
                const nameA = a.customerName || '';
                const nameB = b.customerName || '';
                return nameA.localeCompare(nameB, 'ar');
              },
              render: (text: string) => text || '-',
            },
            {
              title: 'الإجراءات',
              key: 'actions',
              minWidth: 150,
              fixed: 'left' as const,
              render: (_: string, record: InstallationOrder) => (
                <div className="flex gap-2 justify-center">
                  <Button 
                    type="link" 
                    size="small"
                    icon={<EyeOutlined />}
                    className="text-purple-600 hover:text-purple-800"
                    onClick={() => {
                      if (record.fileUrl) {
                        window.open(record.fileUrl, '_blank');
                      } else {
                        message.info('لا يوجد ملف مرفق');
                      }
                    }}
                    title="عرض الملف"
                  />
                  <Button 
                    type="link" 
                    size="small"
                    icon={<EditOutlined />}
                    className="text-blue-600 hover:text-blue-800"
                    onClick={() => navigate(`/management/installation-orders/edit/${record.id}`)}
                    title="تعديل"
                  />
                  <Button 
                    type="link" 
                    size="small"
                    icon={<DeleteOutlined />}
                    className="text-red-600 hover:text-red-800"
                    onClick={() => handleDelete(record.id)}
                    title="حذف"
                  />
                </div>
              ),
            },
          ]}
          dataSource={filteredInstallationOrders
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((order, index) => ({
              key: order.id || index.toString(),
              invoiceNumber: order.fullInvoiceNumber,
              customerPhone: order.customerPhone,
              customerName: order.customerName,
              driver: order.technicianName || '-',
              district: order.districtName,
              notes: order.notes || '-',
              installation: order.requiresInstallation ? 'نعم' : 'لا',
              amount: order.branchBalance?.toFixed(2) || '0.00',
              deliveryStatus: order.status,
              deliveryDate: order.deliveryDate,
              ...order
            }))
          }
          rowKey="key"
          pagination={false}
          loading={isLoading}
          scroll={{ x: 1500 }}
          size="small"
          bordered
          rowClassName={(record: InstallationOrder) => 
            (!record.technicianId || record.technicianId.trim() === '') 
              ? '[&>td]:!bg-red-50 [&>td]:!text-red-800 [&>td]:!font-bold' 
              : ''
          }
          className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-blue-900 [&_.ant-table-thead_>_tr_>_th]:border-blue-300 [&_.ant-table-thead_>_tr_>_th]:font-semibold [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
          locale={{
            emptyText: (
              <div className="text-gray-400 py-8">لا توجد طلبات توصيل</div>
            )
          }}
        />

        {/* Pagination */}
        <div className="flex justify-center mt-4">
          <Pagination
            current={currentPage}
            total={filteredInstallationOrders.length}
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
      </motion.div>
    </div>
    </>
  );
};

export default InstallationOrders;
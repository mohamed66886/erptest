import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { motion } from 'framer-motion';
import { Table, Select, DatePicker, Button, Input, Card, Row, Col, Statistic, Modal, Popconfirm, message, Select as AntdSelect } from 'antd';
import { SearchOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, PlusOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { TableOutlined, PrinterOutlined, FileTextOutlined, CodeOutlined } from '@ant-design/icons';
import { Building2, FileText } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { fetchBranches, Branch } from '@/lib/branches';
import { Helmet } from "react-helmet";
import styles from './ReceiptVoucher.module.css';

const { Option } = Select;
const { confirm } = Modal;

interface QuotationRecord {
  key: string;
  id: string;
  quotationNumber: string;
  date: string;
  expiryDate: string;
  customerName: string;
  customerPhone: string;
  customerNumber: string;
  amount: number;
  branchId: string;
  branchName: string;
  paymentMethod: string;
  warehouse: string;
  status: string;
  movementType: string;
  accountType: string;
  items?: QuotationItem[]; // إضافة حقل العناصر لنقل بيانات المنتجات للفاتورة
  invoiceCreated?: boolean; // لتتبع ما إذا تم إنشاء فاتورة من عرض السعر
  invoiceId?: string; // رقم الفاتورة المرتبطة بعرض السعر
  salesOrderCreated?: boolean; // لتتبع ما إذا تم إنشاء أمر بيع من عرض السعر
  salesOrderId?: string; // رقم أمر البيع المرتبط بعرض السعر
  convertedTo?: 'invoice' | 'salesOrder' | null; // نوع التحويل
}

interface QuotationItem {
  itemNumber?: string;
  itemName?: string;
  quantity?: number;
  unit?: string;
  price?: number;
  discountPercent?: number;
  discountValue?: number;
  taxPercent?: number;
  taxValue?: number;
  total?: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface Warehouse {
  id: string;
  name?: string;
  nameAr?: string;
  nameEn?: string;
}

const Quotations: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  
  // خيارات البحث
  const [quotationNumber, setQuotationNumber] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [amount, setAmount] = useState<number | null>(null); // حقل واحد فقط للمبلغ
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerNumber, setCustomerNumber] = useState<string>('');
  const [selectedMovementType, setSelectedMovementType] = useState<string>(''); // فلتر نوع الحركة

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

  // تعيين التواريخ الافتراضية حسب السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setDateFrom(start);
      setDateTo(end);
    }
  }, [currentFinancialYear]);

  // بيانات عروض الأسعار
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<QuotationRecord[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalQuotations: 0,
    totalAmount: 0,
    activeQuotations: 0,
    expiredQuotations: 0,
    convertedToInvoice: 0,
    convertedToSalesOrder: 0
  });

  // جلب البيانات الأساسية
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // جلب الفروع
        const branchesData = await fetchBranches();
        setBranches(branchesData);

        // جلب العملاء
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        const customersData: Customer[] = customersSnapshot.docs.map(doc => {
          const customerData = {
            id: doc.id,
            name: doc.data().nameAr || doc.data().name || '',
            phone: doc.data().phone || doc.data().phoneNumber || doc.data().mobile || ''
          };
          console.log('Customer data:', customerData);
          return customerData;
        });
        setCustomers(customersData);

        // جلب طرق الدفع
        const paymentMethodsSnapshot = await getDocs(collection(db, 'paymentMethods'));
        const paymentMethodsData: PaymentMethod[] = paymentMethodsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().value || ''
        }));
        setPaymentMethods(paymentMethodsData);

        // جلب المخازن
        const warehousesSnapshot = await getDocs(collection(db, 'warehouses'));
        const warehousesData: Warehouse[] = warehousesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || ''
        }));
        setWarehouses(warehousesData);

      } catch (error) {
        console.error('خطأ في جلب البيانات الأساسية:', error);
      } finally {
        setBranchesLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // جلب بيانات عروض الأسعار من Firebase
  const fetchQuotationsData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where, orderBy, limit } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const quotationsQuery = collection(db, 'quotations');
      const constraints = [];

      // إضافة فلاتر البحث - نطبق فلتر التاريخ فقط في Firebase لتجنب مشكلة Index
      // جميع الفلاتر الأخرى ستطبق في JavaScript
      if (dateFrom && dateTo) {
        constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
        constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
      } else if (dateFrom) {
        constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      } else if (dateTo) {
        constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
      }
      
      // لا نطبق أي فلاتر أخرى في Firebase لتجنب مشكلة Composite Index تماماً
      // جميع الفلاتر الأخرى (الفرع، طريقة الدفع، المخزن، العميل) ستطبق في JavaScript

      // ترتيب حسب التاريخ
      constraints.push(orderBy('date', 'desc'));
      
      // إضافة حد أقصى للنتائج لتحسين الأداء (يمكن زيادته حسب الحاجة)
      constraints.push(limit(1000));

      const quotationsQueryWithConstraints = constraints.length > 1 
        ? query(quotationsQuery, ...constraints)
        : query(quotationsQuery, orderBy('date', 'desc'), limit(1000));

      const snapshot = await getDocs(quotationsQueryWithConstraints);
      const quotationsData: QuotationRecord[] = [];

      snapshot.docs.forEach(doc => {

        const data = doc.data();
        
        // الحصول على اسم الفرع
        const branch = branches.find(b => b.id === data.branch);
        const branchName = branch?.name || data.branch || '';

        // الحصول على اسم العميل
        // البحث عن العميل بالمعرف أولاً، ثم برقم الهاتف أو رقم الحساب
        const customer = customers.find(c => 
          c.id === data.customerNumber || 
          c.id === data.customer?.id ||
          c.phone === data.customerNumber ||
          c.phone === data.customer?.mobile
        );
        
        // استخراج البيانات من كائن العميل في المستند أو من قاعدة البيانات
        const customerName = customer?.name || data.customer?.name || data.customerName || '';
        const customerPhone = customer?.phone || data.customer?.mobile || data.customerPhone || data.phone || '';
        const customerNumber = data.customer?.id || data.customerNumber || customer?.id || '';

        // إضافة تسجيل للتحقق من البيانات
        console.log('Customer ID/Phone from quotation:', data.customerNumber);
        console.log('Customer object from quotation:', data.customer);
        console.log('Found customer:', customer);
        console.log('Customer phone from customer record:', customer?.phone);
        console.log('Customer phone from quotation data:', data.customerPhone);
        console.log('Final phone value:', customerPhone);

        // حساب حالة انتهاء الصلاحية
        const today = dayjs();
        const expiryDate = dayjs(data.validUntil || data.expiryDate);
        const isExpired = expiryDate.isValid() && expiryDate.isBefore(today);

        // الحصول على إجمالي المبلغ من totals أو حساب من الأصناف
        let totalAmount = 0;
        if (data.totals && data.totals.total) {
          totalAmount = parseFloat(data.totals.total) || 0;
        } else if (data.items && Array.isArray(data.items)) {
          totalAmount = data.items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0);
        }

        const quotation: QuotationRecord = {
          key: doc.id,
          id: doc.id,
          quotationNumber: data.quotationNumber || '',
          date: data.date || '',
          expiryDate: data.validUntil || data.expiryDate || '',
          customerName,
          customerPhone,
          customerNumber,
          amount: totalAmount,
          branchId: data.branch || '',
          branchName,
          paymentMethod: data.paymentMethod || '',
          warehouse: data.warehouse || '',
          status: isExpired ? 'منتهي الصلاحية' : 'نشط',
          movementType: data.movementType || 'عرض سعر',
          accountType: data.accountType || 'عميل',
          items: data.items || [], // إضافة الأصناف من عرض السعر
          invoiceCreated: data.invoiceCreated || false, // حالة إنشاء الفاتورة
          invoiceId: data.invoiceId || '', // رقم الفاتورة المرتبطة
          salesOrderCreated: data.salesOrderCreated || false, // حالة إنشاء أمر البيع
          salesOrderId: data.salesOrderId || '', // رقم أمر البيع المرتبط
          convertedTo: data.convertedTo || null // نوع التحويل
        };

        quotationsData.push(quotation);
      });

      // تطبيق الفلاتر الإضافية (التي لا يمكن تطبيقها في Firebase)
      let filtered = quotationsData;

      // فلتر الفرع
      if (selectedBranch) {
        filtered = filtered.filter(q => q.branchId === selectedBranch);
      }

      // فلتر طريقة الدفع
      if (selectedPaymentMethod) {
        filtered = filtered.filter(q => q.paymentMethod === selectedPaymentMethod);
      }

      // فلتر المخزن
      if (selectedWarehouse) {
        filtered = filtered.filter(q => q.warehouse === selectedWarehouse);
      }

      if (quotationNumber.trim()) {
        filtered = filtered.filter(q => 
          q.quotationNumber.toLowerCase().includes(quotationNumber.toLowerCase())
        );
      }

      // فلتر المبلغ (مطابقة جزئية)
      if (amount !== null && !isNaN(amount)) {
        filtered = filtered.filter(q => q.amount.toString().includes(amount.toString()));
      }

      if (customerPhone.trim()) {
        filtered = filtered.filter(q => 
          q.customerPhone && q.customerPhone.includes(customerPhone.trim())
        );
      }

      if (customerNumber.trim()) {
        filtered = filtered.filter(q => 
          (q.customerNumber && q.customerNumber.toLowerCase().includes(customerNumber.trim().toLowerCase())) ||
          (q.customerName && q.customerName.toLowerCase().includes(customerNumber.trim().toLowerCase()))
        );
      }

      // فلتر العميل المحدد من القائمة المنسدلة
      if (selectedCustomer) {
        filtered = filtered.filter(q => 
          q.customerNumber === selectedCustomer ||
          q.customerName === customers.find(c => c.id === selectedCustomer)?.name
        );
      }

      // فلتر نوع الحركة
      if (selectedMovementType) {
        filtered = filtered.filter(q => q.movementType === selectedMovementType);
      }

      setQuotations(quotationsData);
      setFilteredQuotations(filtered);

      // إظهار رسالة إذا تم الوصول للحد الأقصى من النتائج
      if (quotationsData.length === 1000) {
        message.warning('تم عرض أول 1000 نتيجة. يرجى تضييق نطاق البحث باستخدام فلاتر التاريخ للحصول على نتائج أكثر دقة.');
      }

      // إظهار رسالة إعلامية إذا كان هناك الكثير من النتائج بدون فلاتر
      if (!dateFrom && !dateTo && quotationsData.length > 500) {
        message.info('تم جلب عدد كبير من النتائج. لتحسين الأداء، يُنصح باستخدام فلاتر التاريخ.');
      }

      // حساب الإحصائيات
      const stats = {
        totalQuotations: filtered.length,
        totalAmount: filtered.reduce((sum, q) => sum + q.amount, 0),
        activeQuotations: filtered.filter(q => q.status === 'نشط' && !q.convertedTo).length,
        expiredQuotations: filtered.filter(q => q.status === 'منتهي الصلاحية').length,
        finishedQuotations: filtered.filter(q => q.status === 'منتهية').length,
        convertedToInvoice: filtered.filter(q => q.convertedTo === 'invoice').length,
        convertedToSalesOrder: filtered.filter(q => q.convertedTo === 'salesOrder').length
      };
      setTotalStats(stats);

    } catch (err) {
      console.error('خطأ في جلب بيانات عروض الأسعار:', err);
      message.error('حدث خطأ في جلب البيانات');
      setQuotations([]);
      setFilteredQuotations([]);
    } finally {
      setIsLoading(false);
    }
  }, [
    dateFrom, dateTo, selectedBranch, selectedPaymentMethod, selectedWarehouse,
    selectedCustomer, quotationNumber, amount,
    customerPhone, customerNumber, branches, customers, selectedMovementType
  ]);

  // تشغيل البحث تلقائياً عند تحميل الصفحة أو تغيير المعايير
  useEffect(() => {
    if (!branchesLoading && branches.length >= 0) {
      const timeoutId = setTimeout(() => {
        fetchQuotationsData();
      }, 300); // تأخير قصير لتجنب البحث المتكرر عند الكتابة السريعة
      
      return () => clearTimeout(timeoutId);
    }
  }, [branchesLoading, branches.length, fetchQuotationsData]);

  // عند الضغط على بحث
  const handleSearch = () => {
    fetchQuotationsData();
  };

  // مسح جميع خيارات البحث
  const clearAllFilters = () => {
    setQuotationNumber('');
    setSelectedBranch('');
    setAmount(null);
    setSelectedPaymentMethod('');
    setSelectedWarehouse('');
    setSelectedCustomer('');
    setCustomerPhone('');
    setCustomerNumber('');
    setSelectedMovementType(''); // إعادة تعيين فلتر نوع الحركة
    // إعادة تعيين التواريخ للسنة المالية الحالية
    if (currentFinancialYear) {
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setDateFrom(start);
      setDateTo(end);
    }
  };

  // حذف عرض سعر
  const handleDelete = async (id: string) => {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      await deleteDoc(doc(db, 'quotations', id));
      message.success('تم حذف عرض السعر بنجاح');
      fetchQuotationsData();
    } catch (error) {
      console.error('خطأ في حذف عرض السعر:', error);
      message.error('حدث خطأ في حذف عرض السعر');
    }
  };

  // تأكيد الحذف
  const confirmDelete = (id: string, quotationNumber: string) => {
    confirm({
      title: 'تأكيد الحذف',
      content: `هل أنت متأكد من حذف عرض السعر رقم ${quotationNumber}؟`,
      okText: 'حذف',
      okType: 'danger',
      cancelText: 'إلغاء',
      onOk() {
        handleDelete(id);
      },
    });
  };

  // إنشاء فاتورة من عرض السعر
  const handleCreateInvoice = async (quotation: QuotationRecord) => {
    try {
      // التحقق من وجود تحويل سابق
      if (quotation.convertedTo) {
        if (quotation.convertedTo === 'invoice') {
          message.warning('تم إنشاء فاتورة من هذا العرض مسبقاً');
        } else {
          message.warning('تم تحويل هذا العرض إلى أمر بيع، لا يمكن إنشاء فاتورة');
        }
        return;
      }

      // إعداد بيانات عرض السعر للنقل إلى صفحة الفاتورة
      const quotationData = {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customerName,
        customerPhone: quotation.customerPhone,
        customerNumber: quotation.customerNumber,
        branchId: quotation.branchId,
        branchName: quotation.branchName,
        paymentMethod: quotation.paymentMethod,
        warehouse: quotation.warehouse,
        items: quotation.items || [],
        amount: quotation.amount,
        date: quotation.date
      };

      // حفظ بيانات عرض السعر في localStorage للنقل إلى صفحة الفاتورة
      localStorage.setItem('quotationData', JSON.stringify(quotationData));
      
      // التوجه إلى صفحة إنشاء الفاتورة
      navigate('/management/sale');
      window.scrollTo(0, 0);
      
      message.success('تم التوجه إلى صفحة إنشاء الفاتورة');
    } catch (error) {
      console.error('خطأ في إنشاء الفاتورة:', error);
      message.error('حدث خطأ في إنشاء الفاتورة');
    }
  };

  // إنشاء أمر بيع من عرض السعر
  const handleCreateSalesOrder = async (quotation: QuotationRecord) => {
    try {
      // التحقق من وجود تحويل سابق
      if (quotation.convertedTo) {
        if (quotation.convertedTo === 'salesOrder') {
          message.warning('تم إنشاء أمر بيع من هذا العرض مسبقاً');
        } else {
          message.warning('تم تحويل هذا العرض إلى فاتورة، لا يمكن إنشاء أمر بيع');
        }
        return;
      }

      // إعداد بيانات عرض السعر للنقل إلى صفحة أمر البيع
      const quotationData = {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        customerName: quotation.customerName,
        customerPhone: quotation.customerPhone,
        customerNumber: quotation.customerNumber,
        branchId: quotation.branchId,
        branchName: quotation.branchName,
        paymentMethod: quotation.paymentMethod,
        warehouse: quotation.warehouse,
        items: quotation.items || [],
        amount: quotation.amount,
        date: quotation.date
      };

      // حفظ بيانات عرض السعر في localStorage للنقل إلى صفحة أمر البيع
      localStorage.setItem('quotationData', JSON.stringify(quotationData));
      
      // التوجه إلى صفحة إنشاء أمر البيع
      navigate('/stores/sales-order/new');
      window.scrollTo(0, 0);
      
      message.success('تم التوجه إلى صفحة إنشاء أمر البيع');
    } catch (error) {
      console.error('خطأ في إنشاء أمر البيع:', error);
      message.error('حدث خطأ في إنشاء أمر البيع');
    }
  };

  // تحديث حالة عرض السعر بعد إنشاء الفاتورة
  const updateQuotationStatus = async (quotationId: string, invoiceId: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      await updateDoc(doc(db, 'quotations', quotationId), {
        invoiceCreated: true,
        invoiceId: invoiceId,
        status: 'محول إلى فاتورة'
      });
      
      message.success('تم تحديث حالة عرض السعر');
      fetchQuotationsData(); // إعادة تحديث البيانات
    } catch (error) {
      console.error('خطأ في تحديث حالة عرض السعر:', error);
      message.error('حدث خطأ في تحديث حالة عرض السعر');
    }
  };

  // تحديث حالة التحويل لعرض السعر
  const updateQuotationConversionStatus = async (quotationId: string, convertedTo: 'invoice' | 'salesOrder', documentId: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const updateData: {
        convertedTo: 'invoice' | 'salesOrder';
        status: string;
        movementType: string;
        invoiceCreated?: boolean;
        invoiceId?: string;
        salesOrderCreated?: boolean;
        salesOrderId?: string;
      } = {
        convertedTo: convertedTo,
        status: 'منتهية',
        movementType: 'عرض سعر نهائي'
      };

      if (convertedTo === 'invoice') {
        updateData.invoiceCreated = true;
        updateData.invoiceId = documentId;
      } else {
        updateData.salesOrderCreated = true;
        updateData.salesOrderId = documentId;
      }
      
      await updateDoc(doc(db, 'quotations', quotationId), updateData);
      
      fetchQuotationsData(); // إعادة تحديث البيانات
    } catch (error) {
      console.error('خطأ في تحديث حالة التحويل:', error);
      message.error('حدث خطأ في تحديث حالة التحويل');
    }
  };

  // دالة تصدير البيانات إلى ملف Excel
  const handleExport = async () => {
    // تحميل exceljs من CDN إذا لم يكن موجوداً في window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ExcelJS = (window as any).ExcelJS;
    if (!ExcelJS) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ExcelJS = (window as any).ExcelJS;
    }

    const exportData = filteredQuotations.map(quotation => {
      const paymentMethod = paymentMethods.find(pm => pm.id === quotation.paymentMethod);
      return [
        quotation.quotationNumber,
        quotation.date,
        quotation.movementType || 'عرض سعر',
        quotation.customerNumber || '',
        quotation.customerName,
        quotation.customerPhone,
        quotation.amount.toFixed(2),
        quotation.branchName,
        paymentMethod?.name || quotation.paymentMethod,
        quotation.status
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('عروض الأسعار');

    // إعداد الأعمدة
    sheet.columns = [
      { header: 'رقم العرض', key: 'quotationNumber', width: 15 },
      { header: 'التاريخ', key: 'date', width: 12 },
      { header: 'نوع الحركة', key: 'movementType', width: 12 },
      { header: 'رقم الحساب', key: 'customerNumber', width: 15 },
      { header: 'العميل', key: 'customerName', width: 20 },
      { header: 'رقم الهاتف', key: 'customerPhone', width: 15 },
      { header: 'المبلغ', key: 'amount', width: 12 },
      { header: 'الفرع', key: 'branchName', width: 15 },
      { header: 'طريقة الدفع', key: 'paymentMethod', width: 12 },
      { header: 'الحالة', key: 'status', width: 12 }
    ];

    // إضافة البيانات
    sheet.addRows(exportData);

    // تنسيق رأس الجدول
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

    // تنسيق بقية الصفوف
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          left: { style: 'thin', color: { argb: 'FFDDDDDD' } },
          right: { style: 'thin', color: { argb: 'FFDDDDDD' } },
        };
      });
    }

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };

    // إنشاء ملف وحفظه
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `عروض_الأسعار_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // دالة طباعة البيانات بتنسيق XML
  const handlePrintXML = () => {
    // إنشاء محتوى XML
    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xmlContent += '<quotations>\n';
    xmlContent += '  <metadata>\n';
    xmlContent += `    <title>عروض الأسعار</title>\n`;
    xmlContent += `    <exportDate>${dayjs().format('YYYY-MM-DD HH:mm:ss')}</exportDate>\n`;
    xmlContent += `    <totalCount>${filteredQuotations.length}</totalCount>\n`;
    xmlContent += `    <totalAmount>${filteredQuotations.reduce((sum, q) => sum + q.amount, 0).toFixed(2)}</totalAmount>\n`;
    xmlContent += `    <financialYear>${fiscalYear}</financialYear>\n`;
    if (dateFrom || dateTo) {
      xmlContent += `    <dateRange>\n`;
      xmlContent += `      <from>${dateFrom ? dayjs(dateFrom).format('YYYY-MM-DD') : 'غير محدد'}</from>\n`;
      xmlContent += `      <to>${dateTo ? dayjs(dateTo).format('YYYY-MM-DD') : 'غير محدد'}</to>\n`;
      xmlContent += `    </dateRange>\n`;
    }
    xmlContent += '  </metadata>\n';
    xmlContent += '  <data>\n';

    filteredQuotations.forEach(quotation => {
      const paymentMethod = paymentMethods.find(pm => pm.id === quotation.paymentMethod);
      xmlContent += '    <quotation>\n';
      xmlContent += `      <quotationNumber>${quotation.quotationNumber || ''}</quotationNumber>\n`;
      xmlContent += `      <date>${quotation.date || ''}</date>\n`;
      xmlContent += `      <expiryDate>${quotation.expiryDate || ''}</expiryDate>\n`;
      xmlContent += `      <movementType><![CDATA[${quotation.movementType || 'عرض سعر'}]]></movementType>\n`;
      xmlContent += `      <customer>\n`;
      xmlContent += `        <customerNumber>${quotation.customerNumber || ''}</customerNumber>\n`;
      xmlContent += `        <customerName><![CDATA[${quotation.customerName || ''}]]></customerName>\n`;
      xmlContent += `        <customerPhone>${quotation.customerPhone || ''}</customerPhone>\n`;
      xmlContent += `      </customer>\n`;
      xmlContent += `      <financial>\n`;
      xmlContent += `        <amount>${quotation.amount.toFixed(2)}</amount>\n`;
      xmlContent += `        <currency>SAR</currency>\n`;
      xmlContent += `      </financial>\n`;
      xmlContent += `      <location>\n`;
      xmlContent += `        <branchId>${quotation.branchId || ''}</branchId>\n`;
      xmlContent += `        <branchName><![CDATA[${quotation.branchName || ''}]]></branchName>\n`;
      xmlContent += `        <warehouse><![CDATA[${quotation.warehouse || ''}]]></warehouse>\n`;
      xmlContent += `      </location>\n`;
      xmlContent += `      <paymentMethod><![CDATA[${paymentMethod?.name || quotation.paymentMethod || ''}]]></paymentMethod>\n`;
      xmlContent += `      <status><![CDATA[${quotation.status || ''}]]></status>\n`;
      xmlContent += `      <accountType><![CDATA[${quotation.accountType || ''}]]></accountType>\n`;
      xmlContent += `      <convertedTo>${quotation.convertedTo || ''}</convertedTo>\n`;
      
      // إضافة تفاصيل الأصناف إذا كانت موجودة
      if (quotation.items && quotation.items.length > 0) {
        xmlContent += '      <items>\n';
        quotation.items.forEach((item, index) => {
          xmlContent += `        <item index="${index + 1}">\n`;
          xmlContent += `          <itemNumber>${item.itemNumber || ''}</itemNumber>\n`;
          xmlContent += `          <itemName><![CDATA[${item.itemName || ''}]]></itemName>\n`;
          xmlContent += `          <quantity>${item.quantity || 0}</quantity>\n`;
          xmlContent += `          <unit><![CDATA[${item.unit || ''}]]></unit>\n`;
          xmlContent += `          <pricing>\n`;
          xmlContent += `            <price>${(item.price || 0).toFixed(2)}</price>\n`;
          xmlContent += `            <discountPercent>${item.discountPercent || 0}</discountPercent>\n`;
          xmlContent += `            <discountValue>${(item.discountValue || 0).toFixed(2)}</discountValue>\n`;
          xmlContent += `            <taxPercent>${item.taxPercent || 0}</taxPercent>\n`;
          xmlContent += `            <taxValue>${(item.taxValue || 0).toFixed(2)}</taxValue>\n`;
          xmlContent += `            <total>${(item.total || 0).toFixed(2)}</total>\n`;
          xmlContent += `          </pricing>\n`;
          xmlContent += '        </item>\n';
        });
        xmlContent += '      </items>\n';
      }
      
      xmlContent += '    </quotation>\n';
    });

    xmlContent += '  </data>\n';
    xmlContent += '</quotations>';

    // إنشاء نافذة جديدة للطباعة
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>عروض الأسعار - XML</title>
          <style>
            body { 
              font-family: 'Tajawal', Arial, sans-serif; 
              margin: 20px; 
              direction: rtl; 
              background: #f9f9f9;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border-radius: 10px;
            }
            .metadata {
              background: white;
              padding: 15px;
              margin-bottom: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .xml-content {
              background: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              border: 1px solid #e9ecef;
              white-space: pre-wrap;
              font-family: 'Courier New', monospace;
              font-size: 11px;
              line-height: 1.5;
              overflow-x: auto;
              max-height: 70vh;
              overflow-y: auto;
              direction: ltr;
              text-align: left;
              color: #333;
            }
            .buttons-container {
              display: flex;
              gap: 10px;
              justify-content: center;
              margin: 20px 0;
              flex-wrap: wrap;
            }
            .summary-stats {
              background: #e3f2fd;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
              border-left: 4px solid #2196f3;
            }
            .summary-stats h4 {
              margin: 0 0 10px 0;
              color: #1976d2;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 10px;
              margin-top: 10px;
            }
            .stat-item {
              background: white;
              padding: 8px 12px;
              border-radius: 4px;
              border: 1px solid #bbdefb;
            }
            @media print {
              body { background: white; }
              .header { 
                background: #667eea !important; 
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
              }
              .xml-content { 
                max-height: none; 
                font-size: 10px;
              }
            }
            .download-btn {
              background: #28a745;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin: 10px 5px;
              font-size: 14px;
            }
            .download-btn:hover {
              background: #218838;
            }
            .print-btn {
              background: #007bff;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 5px;
              cursor: pointer;
              margin: 10px 5px;
              font-size: 14px;
            }
            .print-btn:hover {
              background: #0056b3;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>تقرير عروض الأسعار - XML</h1>
            <p>تاريخ التصدير: ${dayjs().format('YYYY-MM-DD HH:mm:ss')}</p>
          </div>
          
          <div class="summary-stats">
            <h4>ملخص البيانات:</h4>
            <div class="stats-grid">
              <div class="stat-item"><strong>عدد عروض الأسعار:</strong> ${filteredQuotations.length}</div>
              <div class="stat-item"><strong>إجمالي المبلغ:</strong> ${filteredQuotations.reduce((sum, q) => sum + q.amount, 0).toFixed(2)} ر.س</div>
              <div class="stat-item"><strong>السنة المالية:</strong> ${fiscalYear}</div>
              <div class="stat-item"><strong>فترة البحث:</strong> ${dateFrom ? dayjs(dateFrom).format('YYYY-MM-DD') : 'غير محدد'} إلى ${dateTo ? dayjs(dateTo).format('YYYY-MM-DD') : 'غير محدد'}</div>
              <div class="stat-item"><strong>العروض النشطة:</strong> ${filteredQuotations.filter(q => q.status === 'نشط' && !q.convertedTo).length}</div>
              <div class="stat-item"><strong>محولة لفواتير:</strong> ${filteredQuotations.filter(q => q.convertedTo === 'invoice').length}</div>
              <div class="stat-item"><strong>محولة لأوامر بيع:</strong> ${filteredQuotations.filter(q => q.convertedTo === 'salesOrder').length}</div>
              <div class="stat-item"><strong>منتهية الصلاحية:</strong> ${filteredQuotations.filter(q => q.status === 'منتهي الصلاحية').length}</div>
            </div>
          </div>

          <div class="buttons-container">
            <button class="download-btn" onclick="downloadXML()">💾 تحميل ملف XML</button>
            <button class="print-btn" onclick="window.print()">🖨️ طباعة التقرير</button>
            <button class="print-btn" onclick="copyToClipboard()" style="background: #ff9800;">📋 نسخ XML</button>
          </div>
          
          <div class="xml-content" id="xmlContent">${xmlContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>

          <script>
            function downloadXML() {
              const xmlData = \`${xmlContent}\`;
              const blob = new Blob([xmlData], { type: 'application/xml' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'عروض_الأسعار_' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '_' + new Date().toTimeString().slice(0,8).replace(/:/g,'') + '.xml';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }

            function copyToClipboard() {
              const xmlData = \`${xmlContent}\`;
              navigator.clipboard.writeText(xmlData).then(function() {
                alert('تم نسخ محتوى XML إلى الحافظة بنجاح!');
              }, function(err) {
                console.error('خطأ في النسخ: ', err);
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = xmlData;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('تم نسخ محتوى XML إلى الحافظة بنجاح!');
              });
            }

            // تحسين شكل الطباعة
            window.addEventListener('beforeprint', function() {
              document.querySelector('.buttons-container').style.display = 'none';
            });
            
            window.addEventListener('afterprint', function() {
              document.querySelector('.buttons-container').style.display = 'flex';
            });
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      message.error('لا يمكن فتح نافذة الطباعة');
    }
  };

  // أعمدة الجدول
  const columns = [
    {
      title: 'رقم العرض',
      dataIndex: 'quotationNumber',
      key: 'quotationNumber',
      width: 120,
      sorter: (a: QuotationRecord, b: QuotationRecord) => a.quotationNumber.localeCompare(b.quotationNumber),
    },
    {
      title: 'التاريخ',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      sorter: (a: QuotationRecord, b: QuotationRecord) => dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: 'نوع الحركة',
      dataIndex: 'movementType',
      key: 'movementType',
      width: 100,
      render: (movementType: string) => (
        <span className="text-blue-800 font-medium bg-blue-50 px-2 py-1 rounded">
          {movementType || 'عرض سعر'}
        </span>
      ),
    },
    {
      title: 'رقم الحساب',
      dataIndex: 'customerNumber',
      key: 'customerNumber',
      width: 110,
      render: (customerNumber: string) => (
        <span className="text-gray-900 font-mono text-sm">
          {customerNumber || '-'}
        </span>
      ),
    },
    {
      title: 'العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      sorter: (a: QuotationRecord, b: QuotationRecord) => a.customerName.localeCompare(b.customerName),
      render: (customerName: string) => (
        <span className="text-gray-900 font-medium">
          {customerName || '-'}
        </span>
      ),
    },
    {
      title: 'رقم الهاتف',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 130,
      render: (phone: string) => {
        if (!phone || phone.trim() === '') {
          return <span className="text-gray-400">-</span>;
        }
        return <span className="text-gray-900 font-medium">{phone}</span>;
      },
    },
    {
      title: 'المبلغ',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (value: number) => `${value.toFixed(2)} ر.س`,
      sorter: (a: QuotationRecord, b: QuotationRecord) => a.amount - b.amount,
    },
    {
      title: 'الفرع',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      sorter: (a: QuotationRecord, b: QuotationRecord) => a.branchName.localeCompare(b.branchName),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string, record: QuotationRecord) => (
        <div className="flex flex-col gap-1">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === 'نشط' ? 'bg-green-100 text-green-800' : 
            status === 'منتهية' ? 'bg-gray-100 text-gray-800' :
            status === 'منتهي الصلاحية' ? 'bg-red-100 text-red-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            {status}
          </span>
          {record.convertedTo === 'invoice' && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              محول إلى فاتورة
            </span>
          )}
          {record.convertedTo === 'salesOrder' && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              محول إلى أمر بيع
            </span>
          )}
        </div>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: QuotationRecord) => (
        <div className="flex gap-1">
          {/* زر إنشاء فاتورة */}
          <Button
            type="text"
            size="small"
            title={
              record.convertedTo === 'invoice' ? 'تم إنشاء فاتورة بالفعل' :
              record.convertedTo === 'salesOrder' ? 'تم تحويل العرض إلى أمر بيع' :
              'إنشاء فاتورة'
            }
            icon={<FileText style={{ 
              color: record.convertedTo ? '#999' : '#52c41a', 
              fontSize: 16 
            }} />}
            onClick={() => handleCreateInvoice(record)}
            disabled={!!record.convertedTo}
            className={record.convertedTo ? "hover:bg-gray-100" : "hover:bg-green-100"}
          />
          
          {/* زر إنشاء أمر بيع */}
          <Button
            type="text"
            size="small"
            title={
              record.convertedTo === 'salesOrder' ? 'تم إنشاء أمر بيع بالفعل' :
              record.convertedTo === 'invoice' ? 'تم تحويل العرض إلى فاتورة' :
              'إنشاء أمر بيع'
            }
            icon={<ShoppingCartOutlined style={{ 
              color: record.convertedTo ? '#999' : '#722ed1', 
              fontSize: 16 
            }} />}
            onClick={() => handleCreateSalesOrder(record)}
            disabled={!!record.convertedTo}
            className={record.convertedTo ? "hover:bg-gray-100" : "hover:bg-purple-100"}
          />
          
          {/* زر التعديل - يتم تعطيله إذا تم التحويل */}
          <Button
            type="text"
            size="small"
            title={record.convertedTo ? 'لا يمكن التعديل بعد التحويل' : 'تعديل'}
            icon={<EditOutlined style={{ 
              color: record.convertedTo ? '#999' : '#2563eb', 
              fontSize: 16 
            }} />}
            onClick={() => {
              if (!record.convertedTo) {
                navigate(`/stores/quotations/edit/${record.id}`);
                window.scrollTo(0, 0);
              }
            }}
            disabled={!!record.convertedTo}
            className={record.convertedTo ? "hover:bg-gray-100" : "hover:bg-blue-100"}
          />
          
          {/* زر الحذف - متاح دائماً */}
          <Popconfirm
            title="تأكيد الحذف"
            description={`هل أنت متأكد من حذف عرض السعر رقم ${record.quotationNumber}؟`}
            onConfirm={() => handleDelete(record.id)}
            okText="حذف"
            cancelText="إلغاء"
            okType="danger"
          >
            <Button
              type="text"
              danger
              size="small"
              title="حذف"
              icon={<DeleteOutlined style={{ color: '#f5222d', fontSize: 16 }} />}
              className="hover:bg-red-100"
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  // Load font dynamically
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('tajawal-font')) {
      const link = document.createElement('link');
      link.id = 'tajawal-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // ستايل مشابه لصفحة الإضافة
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
    <div className="p-2 sm:p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen w-full max-w-full">
      <Helmet>
        <title>عروض الأسعار | ERP90 Dashboard</title>
        <meta name="description" content="إدارة عروض الأسعار، عرض وإدارة عروض أسعار العملاء، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, عروض أسعار, إدارة, عملاء, مبيعات, Quotations, Management, Sales" />
      </Helmet>
      
    <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">عروض الأسعار</h1>
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
                styles={{
                  popup: {
                    root: { textAlign: 'right', fontSize: 16 }
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخازن", to: "/stores" },
          { label: "عروض الأسعار" }
        ]}
      />

      {/* خيارات البحث */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-blue-100 flex flex-col gap-4 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2 m-0">
            <SearchOutlined className="text-blue-600 text-lg" /> خيارات البحث
          </h3>
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              navigate('/stores/quotations/new');
              window.scrollTo(0, 0);
            }}
            style={{ 
              height: 48, 
              fontSize: 16, 
              borderRadius: 8, 
              background: '#1677ff',
              borderColor: '#52c41a',
              color: '#fff',
              fontWeight: 500,
              padding: "8px 24px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
            size="large"
          >
            إضافة عرض سعر جديد
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">رقم عرض السعر</label>
            <Input
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
              placeholder="ادخل رقم عرض السعر"
              style={largeControlStyle}
              size="large"
            />
          </div>

          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">الفرع</label>
            <Select
              value={selectedBranch}
              onChange={setSelectedBranch}
              placeholder="اختر الفرع"
              style={largeControlStyle}
              size="large"
              allowClear
             className={styles.noAntBorder}
              loading={branchesLoading}
              showSearch
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
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">المبلغ</label>
            <Input
              type="number"
              value={amount !== null ? amount : ''}
              onChange={(e) => setAmount(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="ادخل المبلغ المطلوب"
              style={largeControlStyle}
              size="large"
            />
          </div>

          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">من تاريخ</label>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="اختر التاريخ"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
            />
          </div>

          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">إلى تاريخ</label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="اختر التاريخ"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
            />
          </div>

          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">العميل</label>
            <Select
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              placeholder="اختر العميل"
              style={largeControlStyle}
              size="large"
             className={styles.noAntBorder}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {customers.map(customer => (
                <Option key={customer.id} value={customer.id}>
                  {customer.name}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">نوع الحركة</label>
            <Select
              value={selectedMovementType}
              onChange={setSelectedMovementType}
              placeholder="اختر نوع الحركة"
              style={largeControlStyle}
              size="large"
              allowClear
              className={styles.noAntBorder}
            >
              <Option value="عرض سعر مبدئي">عرض سعر مبدئي</Option>
              <Option value="عرض سعر نهائي">عرض سعر نهائي</Option>
            </Select>
          </div>

          <div className="flex flex-col">
            <label style={labelStyle} className="text-sm font-medium text-gray-600 mb-1">رقم الهاتف</label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="ادخل رقم الهاتف"
              style={largeControlStyle}
              size="large"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap w-full">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isLoading}
            style={{ 
              height: 48, 
              fontSize: 16, 
              borderRadius: 8, 
              background: '#1677ff',
              borderColor: '#1677ff',
              fontWeight: 500,
              padding: "8px 24px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
            size="large"
          >
            بحث
          </Button>

          <Button
            onClick={clearAllFilters}
            style={{ 
              height: 48, 
              fontSize: 16, 
              borderRadius: 8, 
              borderColor: '#d9d9d9',
              fontWeight: 500,
              padding: "8px 24px",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}
            size="large"
          >
            مسح الفلاتر
          </Button>

        </div>
      </motion.div>

      {/* الإحصائيات السريعة */}
      {/* تم حذف الإحصائيات السريعة بناءً على طلب المستخدم */}

      {/* نتائج البحث */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-blue-100 flex flex-col gap-4 shadow-sm overflow-x-auto relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500"></div>
        
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <TableOutlined className="text-blue-600 text-lg" /> نتائج البحث
            {isLoading && (
              <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded animate-pulse">
                جاري البحث...
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            إجمالي: {filteredQuotations.length} عرض سعر
            {filteredQuotations.length > 0 && (
              <div className="flex gap-2">
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  style={{ 
                    height: 48, 
                    fontSize: 16, 
                    borderRadius: 8, 
                    background: '#52c41a',
                    borderColor: '#52c41a',
                    color: '#fff',
                    fontWeight: 500,
                    padding: "8px 24px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                  size="large"
                >
                  تصدير Excel
                </Button>
                <Button
                  icon={<CodeOutlined style={{ fontSize: 18, color: '#fff' }} />}
                  onClick={handlePrintXML}
                  style={{ 
                    height: 48, 
                    fontSize: 16, 
                    borderRadius: 8, 
                    background: '#722ed1',
                    borderColor: '#722ed1',
                    color: '#fff',
                    fontWeight: 500,
                    padding: "8px 24px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                  size="large"
                >
                  طباعة XML
                </Button>
                <Button
                  icon={<PrinterOutlined style={{ fontSize: 18, color: '#fff' }} />}
                  onClick={() => window.print()}
                  style={{ 
                    height: 48, 
                    fontSize: 16, 
                    borderRadius: 8, 
                    background: '#1677ff',
                    borderColor: '#1677ff',
                    color: '#fff',
                    fontWeight: 500,
                    padding: "8px 24px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                  }}
                  size="large"
                >
                  طباعة
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <Table
            columns={columns}
            dataSource={filteredQuotations}
            loading={isLoading}
            size="small"
            scroll={{ x: 1700 }}
            pagination={{
              total: filteredQuotations.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} من ${total} عرض سعر`,
            }}
            locale={{
              emptyText: 'لا توجد عروض أسعار في الفترة المحددة',
              filterConfirm: 'موافق',
              filterReset: 'إعادة تعيين',
              selectAll: 'تحديد الكل',
              selectInvert: 'عكس التحديد',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default Quotations;

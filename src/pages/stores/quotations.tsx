import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/Breadcrumb';
import { motion } from 'framer-motion';
import { Table, Select, DatePicker, Button, Input, Card, Row, Col, Statistic, Modal, Popconfirm, message } from 'antd';
import { SearchOutlined, DownloadOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { TableOutlined, PrinterOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { fetchBranches, Branch } from '@/lib/branches';
import { Helmet } from "react-helmet";

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
  amount: number;
  branchId: string;
  branchName: string;
  paymentMethod: string;
  warehouse: string;
  salesRep: string;
  status: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
}

interface SalesRep {
  id: string;
  name: string;
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
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  
  // خيارات البحث
  const [quotationNumber, setQuotationNumber] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [amountFrom, setAmountFrom] = useState<number | null>(null);
  const [amountTo, setAmountTo] = useState<number | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [selectedSalesRep, setSelectedSalesRep] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');

  // السنة المالية من السياق
  const { currentFinancialYear } = useFinancialYear();

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
    expiredQuotations: 0
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

        // جلب المندوبين
        const salesRepsSnapshot = await getDocs(collection(db, 'salesRepresentatives'));
        const salesRepsData: SalesRep[] = salesRepsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || ''
        }));
        setSalesReps(salesRepsData);

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
      const { getDocs, collection, query, where, orderBy } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const quotationsQuery = collection(db, 'quotations');
      const constraints = [];

      // إضافة فلاتر البحث
      if (dateFrom) {
        constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      }
      if (dateTo) {
        constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
      }
      if (selectedBranch) {
        constraints.push(where('branch', '==', selectedBranch));
      }
      if (selectedPaymentMethod) {
        constraints.push(where('paymentMethod', '==', selectedPaymentMethod));
      }
      if (selectedWarehouse) {
        constraints.push(where('warehouse', '==', selectedWarehouse));
      }
      if (selectedSalesRep) {
        constraints.push(where('delegate', '==', selectedSalesRep));
      }
      if (selectedCustomer) {
        constraints.push(where('customerNumber', '==', selectedCustomer));
      }

      // ترتيب حسب التاريخ
      constraints.push(orderBy('date', 'desc'));

      const quotationsQueryWithConstraints = constraints.length > 0 
        ? query(quotationsQuery, ...constraints)
        : quotationsQuery;

      const snapshot = await getDocs(quotationsQueryWithConstraints);
      const quotationsData: QuotationRecord[] = [];

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // الحصول على اسم الفرع
        const branch = branches.find(b => b.id === data.branch);
        const branchName = branch?.name || data.branch || '';

        // الحصول على اسم العميل
        // البحث عن العميل بالمعرف أولاً، ثم برقم الهاتف إذا لم يوجد
        let customer = customers.find(c => c.id === data.customerNumber);
        if (!customer) {
          // إذا لم نجد العميل بالمعرف، نبحث برقم الهاتف
          customer = customers.find(c => c.phone === data.customerNumber);
        }
        
        const customerName = customer?.name || data.customerName || '';
        const phone = customer?.phone || data.customerPhone || data.phone || '';

        // إضافة تسجيل للتحقق من البيانات
        console.log('Customer ID/Phone from quotation:', data.customerNumber);
        console.log('Found customer:', customer);
        console.log('Customer phone from customer record:', customer?.phone);
        console.log('Customer phone from quotation data:', data.customerPhone);
        console.log('Final phone value:', phone);

        // الحصول على اسم المندوب
        const salesRep = salesReps.find(s => s.id === data.delegate);
        const salesRepName = salesRep?.name || data.delegate || '';

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
          customerPhone: phone,
          amount: totalAmount,
          branchId: data.branch || '',
          branchName,
          paymentMethod: data.paymentMethod || '',
          warehouse: data.warehouse || '',
          salesRep: salesRepName,
          status: isExpired ? 'منتهي الصلاحية' : 'نشط'
        };

        quotationsData.push(quotation);
      });

      // تطبيق الفلاتر الإضافية (التي لا يمكن تطبيقها في Firebase)
      let filtered = quotationsData;

      if (quotationNumber.trim()) {
        filtered = filtered.filter(q => 
          q.quotationNumber.toLowerCase().includes(quotationNumber.toLowerCase())
        );
      }

      if (amountFrom !== null) {
        filtered = filtered.filter(q => q.amount >= amountFrom);
      }

      if (amountTo !== null) {
        filtered = filtered.filter(q => q.amount <= amountTo);
      }

      if (customerPhone.trim()) {
        filtered = filtered.filter(q => 
          q.customerPhone.includes(customerPhone)
        );
      }

      setQuotations(quotationsData);
      setFilteredQuotations(filtered);

      // حساب الإحصائيات
      const stats = {
        totalQuotations: filtered.length,
        totalAmount: filtered.reduce((sum, q) => sum + q.amount, 0),
        activeQuotations: filtered.filter(q => q.status === 'نشط').length,
        expiredQuotations: filtered.filter(q => q.status === 'منتهي الصلاحية').length
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
    selectedSalesRep, selectedCustomer, quotationNumber, amountFrom, amountTo,
    customerPhone, branches, customers, salesReps
  ]);

  // تشغيل البحث تلقائياً عند تحميل الصفحة أو تغيير المعايير
  useEffect(() => {
    if (!branchesLoading && branches.length >= 0) {
      fetchQuotationsData();
    }
  }, [branchesLoading, branches.length, fetchQuotationsData]);

  // عند الضغط على بحث
  const handleSearch = () => {
    fetchQuotationsData();
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
        quotation.customerName,
        quotation.customerPhone,
        quotation.amount.toFixed(2),
        quotation.branchName,
        paymentMethod?.name || quotation.paymentMethod,
        quotation.salesRep,
        quotation.status
      ];
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('عروض الأسعار');

    // إعداد الأعمدة
    sheet.columns = [
      { header: 'رقم العرض', key: 'quotationNumber', width: 15 },
      { header: 'التاريخ', key: 'date', width: 12 },
      { header: 'العميل', key: 'customerName', width: 20 },
      { header: 'رقم الهاتف', key: 'customerPhone', width: 15 },
      { header: 'المبلغ', key: 'amount', width: 12 },
      { header: 'الفرع', key: 'branchName', width: 15 },
      { header: 'طريقة الدفع', key: 'paymentMethod', width: 12 },
      { header: 'المندوب', key: 'salesRep', width: 15 },
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
    // تم حذف عمود تاريخ الانتهاء بناءً على طلب المستخدم
    {
      title: 'العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      sorter: (a: QuotationRecord, b: QuotationRecord) => a.customerName.localeCompare(b.customerName),
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
    // تم حذف عمود طريقة الدفع بناءً على طلب المستخدم
    // تم حذف عمود المخزن بناءً على طلب المستخدم
    {
      title: 'المندوب',
      dataIndex: 'salesRep',
      key: 'salesRep',
      width: 120,
      sorter: (a: QuotationRecord, b: QuotationRecord) => a.salesRep.localeCompare(b.salesRep),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          status === 'نشط' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {status}
        </span>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: QuotationRecord) => (
        <div className="flex gap-2">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined style={{ color: '#2563eb', fontSize: 18 }} />}
            onClick={() => {
              navigate(`/stores/quotations/edit/${record.id}`);
              window.scrollTo(0, 0);
            }}
            className="hover:bg-blue-100"
          />
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
              icon={<DeleteOutlined style={{ color: '#f5222d', fontSize: 18 }} />}
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

  return (
    <div className="p-2 sm:p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen w-full max-w-full">
      <Helmet>
        <title>عروض الأسعار | ERP90 Dashboard</title>
        <meta name="description" content="إدارة عروض الأسعار، عرض وإدارة عروض أسعار العملاء، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, عروض أسعار, إدارة, عملاء, مبيعات, Quotations, Management, Sales" />
      </Helmet>
      
      <div className="p-2 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden w-full max-w-full">
        <div className="flex items-center">
          <FileTextOutlined className="h-8 w-8 text-blue-600 ml-3" />
          <h1 className="text-2xl font-bold text-gray-800">عروض الأسعار</h1>
        </div>
        <p className="text-gray-600 mt-2">عرض وإدارة عروض الأسعار</p>
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
            className="bg-blue-600 hover:bg-green-700 border-green-600 hover:border-green-700 text-white"
          >
            إضافة عرض سعر جديد
          </Button>
        </div>
        
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">رقم عرض السعر</label>
            <Input
              value={quotationNumber}
              onChange={(e) => setQuotationNumber(e.target.value)}
              placeholder="ادخل رقم عرض السعر"
              className="w-full"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">الفرع</label>
            <Select
              value={selectedBranch}
              onChange={setSelectedBranch}
              placeholder="اختر الفرع"
              className="w-full"
              allowClear
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
            <label className="text-sm font-medium text-gray-600 mb-1">المبلغ من</label>
            <Input
              type="number"
              value={amountFrom}
              onChange={(e) => setAmountFrom(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="المبلغ الأدنى"
              className="w-full"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">المبلغ إلى</label>
            <Input
              type="number"
              value={amountTo}
              onChange={(e) => setAmountTo(e.target.value ? parseFloat(e.target.value) : null)}
              placeholder="المبلغ الأعلى"
              className="w-full"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">طريقة الدفع</label>
            <Select
              value={selectedPaymentMethod}
              onChange={setSelectedPaymentMethod}
              placeholder="اختر طريقة الدفع"
              className="w-full"
              allowClear
            >
              {paymentMethods.map(method => (
                <Option key={method.id} value={method.id}>
                  {method.name}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">المخزن</label>
            <Select
              value={selectedWarehouse}
              onChange={setSelectedWarehouse}
              placeholder="اختر المخزن"
              className="w-full"
              allowClear
            >
              {warehouses.map(warehouse => (
                <Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name || warehouse.nameAr || warehouse.nameEn || warehouse.id}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">من تاريخ</label>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="اختر التاريخ"
              className="w-full"
              format="YYYY-MM-DD"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">إلى تاريخ</label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="اختر التاريخ"
              className="w-full"
              format="YYYY-MM-DD"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">المندوب</label>
            <Select
              value={selectedSalesRep}
              onChange={setSelectedSalesRep}
              placeholder="اختر المندوب"
              className="w-full"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {salesReps.map(rep => (
                <Option key={rep.id} value={rep.id}>
                  {rep.name}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">العميل</label>
            <Select
              value={selectedCustomer}
              onChange={setSelectedCustomer}
              placeholder="اختر العميل"
              className="w-full"
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
            <label className="text-sm font-medium text-gray-600 mb-1">رقم الهاتف</label>
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="ادخل رقم الهاتف"
              className="w-full"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 flex-wrap w-full">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isLoading}
            className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
          >
            بحث
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
              <>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  className="bg-green-600 hover:bg-green-700 border-green-600 text-white ml-2 px-5 py-2 text-base font-bold"
                  size="middle"
                >
                  تصدير Excel
                </Button>
                <Button
                  icon={<PrinterOutlined style={{ fontSize: 18, color: '#2563eb' }} />}
                  onClick={() => window.print()}
                  className="bg-blue-100 hover:bg-blue-200 border-blue-200 text-blue-700 ml-2 px-5 py-2 text-base font-bold"
                  size="middle"
                  style={{ boxShadow: 'none' }}
                >
                  طباعة
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <Table
            columns={columns}
            dataSource={filteredQuotations}
            loading={isLoading}
            size="small"
            scroll={{ x: 1400 }}
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

import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import { motion } from 'framer-motion';
import { Table, Select, DatePicker, Button, Typography, Card, Row, Col, Statistic } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { BarChartOutlined, TableOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { fetchBranches, Branch } from '@/lib/branches';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Helmet } from "react-helmet";
import styles from './ReceiptVoucher.module.css';


const { Option } = Select;
const { Title } = Typography;

interface BranchSalesRecord {
  key: string;
  branchId: string;
  branchName: string;
  totalSales: number;
  totalDiscount: number;
  totalTax: number;
  salesCost: number;
  profitLoss: number;
  netTotal: number;
  invoiceCount: number;
}

interface ChartDataItem {
  branchName: string;
  totalSales: number;
  profitLoss: number;
}

interface InvoiceItem {
  itemNumber: string;
  quantity: string;
  price: string;
  discountValue: string;
  taxValue: string;
}

const BranchSales: React.FC = () => {
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

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
  
  // خيارات البحث
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [invoiceType, setInvoiceType] = useState<string>("sales"); // all, sales or returns

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
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setDateFrom(start);
      setDateTo(end);
    }
  }, [currentFinancialYear]);

  // بيانات التقرير
  const [branchSales, setBranchSales] = useState<BranchSalesRecord[]>([]);
  const [filteredSales, setFilteredSales] = useState<BranchSalesRecord[]>([]);

  // بيانات الرسم البياني
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);

  // إحصائيات إجمالية
  const [totalStats, setTotalStats] = useState({
    totalSales: 0,
    totalDiscount: 0,
    totalTax: 0,
    totalCost: 0,
    totalProfit: 0,
    totalNet: 0
  });

  useEffect(() => {
    fetchBranches().then(data => {
      setBranches(data);
      setBranchesLoading(false);
    });
  }, []);

  // جلب بيانات مبيعات الفروع من Firebase
  const fetchBranchSalesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // تحديد المجموعات بناءً على نوع الفاتورة
      let invoiceCollections: string[] = [];
      if (invoiceType === 'all') {
        invoiceCollections = ['sales_invoices', 'sales_returns'];
      } else if (invoiceType === 'returns') {
        invoiceCollections = ['sales_returns'];
      } else {
        invoiceCollections = ['sales_invoices'];
      }

      let allDocs: Array<import('firebase/firestore').QueryDocumentSnapshot> = [];
      for (const collectionName of invoiceCollections) {
        const baseQuery = collection(db, collectionName);
        const constraints = [];
        if (dateFrom) constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
        if (dateTo) constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
        const finalQuery = constraints.length > 0 ? query(baseQuery, ...constraints) : baseQuery;
        const snapshot = await getDocs(finalQuery);
        allDocs = allDocs.concat(snapshot.docs);
      }
      const branchSalesMap: { [key: string]: BranchSalesRecord } = {};
      
      // للتشخيص: طباعة معرفات الفروع الموجودة في البيانات
      const foundBranchIds = new Set<string>();
      
      // جلب بيانات الأصناف للحصول على أسعار الشراء
      const itemsSnapshot = await getDocs(collection(db, 'items'));
      const itemCosts: { [key: string]: number } = {};
      
      itemsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        itemCosts[doc.id] = data.purchasePrice || data.cost || 0;
      });
      
      for (const docSnapshot of allDocs) {
        const invoiceData = docSnapshot.data();
        const invoiceBranchId = invoiceData.branch;
        
        if (!invoiceBranchId) continue;
        
        // إضافة معرف الفرع إلى مجموعة الفروع الموجودة
        foundBranchIds.add(invoiceBranchId);
        
        // تطبيق فلترة الفروع المحددة هنا بدلاً من في الاستعلام
        if (branchIds.length > 0 && !branchIds.includes(invoiceBranchId)) {
          continue;
        }
        
        // الحصول على اسم الفرع
        const branch = branches.find(b => b.id === invoiceBranchId);
        const branchName = branch?.name || invoiceBranchId;
        
        // إنشاء سجل جديد إذا لم يكن موجوداً
        if (!branchSalesMap[invoiceBranchId]) {
          branchSalesMap[invoiceBranchId] = {
            key: invoiceBranchId,
            branchId: invoiceBranchId,
            branchName,
            totalSales: 0,
            totalDiscount: 0,
            totalTax: 0,
            salesCost: 0,
            profitLoss: 0,
            netTotal: 0,
            invoiceCount: 0
          };
        }
        
        // حساب إجماليات الفاتورة
        const items = invoiceData.items || [];
        let invoiceSales = 0;
        let invoiceDiscount = 0;
        let invoiceTax = 0;
        let invoiceCost = 0;
        
        items.forEach((item: InvoiceItem) => {
          const quantity = parseFloat(item.quantity) || 0;
          const price = parseFloat(item.price) || 0;
          const discountValue = parseFloat(item.discountValue) || 0;
          const taxValue = parseFloat(item.taxValue) || 0;
          
          // البحث عن تكلفة الصنف
          const itemCost = itemCosts[item.itemNumber] || 0;
          
          invoiceSales += quantity * price;
          invoiceDiscount += discountValue;
          invoiceTax += taxValue;
          invoiceCost += quantity * itemCost;
        });
        
        // الخصم الإضافي على مستوى الفاتورة
        const extraDiscount = parseFloat(invoiceData.extraDiscount) || 0;
        invoiceDiscount += extraDiscount;
        
        // إضافة البيانات إلى إجماليات الفرع
        branchSalesMap[invoiceBranchId].totalSales += invoiceSales;
        branchSalesMap[invoiceBranchId].totalDiscount += invoiceDiscount;
        branchSalesMap[invoiceBranchId].totalTax += invoiceTax;
        branchSalesMap[invoiceBranchId].salesCost += invoiceCost;
        branchSalesMap[invoiceBranchId].invoiceCount += 1;
      }
      
      // للتشخيص: طباعة معرفات الفروع الموجودة
      console.log('معرفات الفروع الموجودة في البيانات:', Array.from(foundBranchIds));
      console.log('معرفات الفروع المحددة:', branchIds);
      console.log('عدد الفواتير المسترجعة:', allDocs.length);
      
      // حساب الربح/الخسارة والصافي لكل فرع
      Object.values(branchSalesMap).forEach(branch => {
        branch.profitLoss = branch.totalSales - branch.totalDiscount - branch.salesCost;
        branch.netTotal = branch.totalSales - branch.totalDiscount - branch.totalTax;
      });
      
      const records = Object.values(branchSalesMap);
      setBranchSales(records);
      setFilteredSales(records);
      
      // حساب الإحصائيات الإجمالية
      const stats = records.reduce(
        (acc, branch) => ({
          totalSales: acc.totalSales + branch.totalSales,
          totalDiscount: acc.totalDiscount + branch.totalDiscount,
          totalTax: acc.totalTax + branch.totalTax,
          totalCost: acc.totalCost + branch.salesCost,
          totalProfit: acc.totalProfit + branch.profitLoss,
          totalNet: acc.totalNet + branch.netTotal
        }),
        { totalSales: 0, totalDiscount: 0, totalTax: 0, totalCost: 0, totalProfit: 0, totalNet: 0 }
      );
      setTotalStats(stats);
      
      // إعداد بيانات الرسم البياني
      const chartData: ChartDataItem[] = records.map(branch => ({
        branchName: branch.branchName,
        totalSales: branch.totalSales,
        profitLoss: branch.profitLoss
      }));
      
      // ترتيب البيانات حسب المبيعات
      const sortedData = chartData.sort((a, b) => b.totalSales - a.totalSales);
      setChartData(sortedData);
      
    } catch (err) {
      console.error('خطأ في جلب بيانات مبيعات الفروع:', err);
      setBranchSales([]);
      setFilteredSales([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [branchIds, invoiceType, dateFrom, dateTo, branches]);

  // تشغيل البحث تلقائياً عند تحميل الصفحة أو تغيير المعايير
  useEffect(() => {
    if (!branchesLoading && branches.length >= 0) {
      fetchBranchSalesData();
    }
  }, [branchesLoading, branches.length, fetchBranchSalesData]);

  // عند الضغط على بحث
  const handleSearch = () => {
    fetchBranchSalesData();
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

    const exportData = filteredSales.map(branch => [
      branch.branchName,
      branch.totalSales.toFixed(2),
      branch.totalDiscount.toFixed(2),
      branch.totalTax.toFixed(2),
      branch.netTotal.toFixed(2),
      branch.invoiceCount
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير مبيعات الفروع');

    // إعداد الأعمدة
    sheet.columns = [
      { header: 'الفرع', key: 'branchName', width: 20 },
      { header: 'إجمالي المبيعات', key: 'totalSales', width: 15 },
      { header: 'إجمالي الخصم', key: 'totalDiscount', width: 15 },
      { header: 'إجمالي الضريبة', key: 'totalTax', width: 15 },
      { header: 'الصافي', key: 'netTotal', width: 15 },
      { header: 'عدد الفواتير', key: 'invoiceCount', width: 12 }
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
    a.download = `تقرير_مبيعات_الفروع_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

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
          console.log('تم جلب بيانات الشركة بنجاح:', docData.data());
        } else {
          console.log('مجموعة الشركات فارغة');
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات الشركة:', error);
      }
    };
    fetchCompany();
  }, []);

  // دالة الطباعة
  const handlePrint = async () => {
    // التأكد من تحميل بيانات الشركة قبل الطباعة
    let currentCompanyData = companyData;
    
    // إذا لم تكن بيانات الشركة محملة، جلبها مرة أخرى
    if (!currentCompanyData || Object.keys(currentCompanyData).length === 0) {
      console.log('بيانات الشركة غير محملة، جاري الجلب...');
      try {
        const { db } = await import('@/lib/firebase');
        const { query, collection, getDocs } = await import('firebase/firestore');
        const q = query(collection(db, "companies"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          currentCompanyData = { ...docData.data() };
          setCompanyData(currentCompanyData);
          console.log('تم جلب بيانات الشركة:', currentCompanyData);
        } else {
          console.log('مجموعة الشركات فارغة، استخدام القيم الافتراضية');
          currentCompanyData = {
            arabicName: 'اسم الشركة',
            englishName: 'Company Name',
            companyType: '',
            commercialRegistration: 'غير متوفر',
            taxFile: 'غير متوفر',
            city: '',
            region: '',
            street: '',
            district: '',
            buildingNumber: '',
            postalCode: '',
            phone: '',
            mobile: '',
            logoUrl: 'https://via.placeholder.com/100x50?text=Company+Logo'
          };
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات الشركة:', error);
        currentCompanyData = {
          arabicName: 'اسم الشركة',
          englishName: 'Company Name',
          companyType: '',
          commercialRegistration: 'غير متوفر',
          taxFile: 'غير متوفر',
          city: '',
          region: '',
          street: '',
          district: '',
          buildingNumber: '',
          postalCode: '',
          phone: '',
          mobile: '',
          logoUrl: 'https://via.placeholder.com/100x50?text=Company+Logo'
        };
      }
    } else {
      console.log('بيانات الشركة محملة مسبقاً:', currentCompanyData);
    }

    // حساب الإجماليات
    const totalSales = filteredSales.reduce((sum, branch) => sum + branch.totalSales, 0);
    const totalDiscount = filteredSales.reduce((sum, branch) => sum + branch.totalDiscount, 0);
    const totalTax = filteredSales.reduce((sum, branch) => sum + branch.totalTax, 0);
    const totalNet = filteredSales.reduce((sum, branch) => sum + branch.netTotal, 0);
    const totalInvoices = filteredSales.reduce((sum, branch) => sum + branch.invoiceCount, 0);
    const avgSales = filteredSales.length > 0 ? totalSales / filteredSales.length : 0;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // التأكد من وجود البيانات المطلوبة
    const safeCompanyData = {
      arabicName: currentCompanyData?.arabicName || 'اسم الشركة',
      englishName: currentCompanyData?.englishName || 'Company Name',
      companyType: currentCompanyData?.companyType || '',
      commercialRegistration: currentCompanyData?.commercialRegistration || 'غير متوفر',
      taxFile: currentCompanyData?.taxFile || 'غير متوفر',
      city: currentCompanyData?.city || '',
      region: currentCompanyData?.region || '',
      street: currentCompanyData?.street || '',
      district: currentCompanyData?.district || '',
      buildingNumber: currentCompanyData?.buildingNumber || '',
      postalCode: currentCompanyData?.postalCode || '',
      phone: currentCompanyData?.phone || '',
      mobile: currentCompanyData?.mobile || '',
      logoUrl: currentCompanyData?.logoUrl || 'https://via.placeholder.com/100x50?text=Company+Logo'
    };

    console.log('البيانات المستخدمة في الطباعة:', safeCompanyData);

    printWindow.document.write(`
      <html>
      <head>
        <title>طباعة تقرير مبيعات الفروع</title>
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
          .print-date {
            text-align: left;
            margin-top: 15px;
            font-size: 9px;
            color: #000;
          }
          .print-last-page-only {
            display: none;
          }
          .totals-container {
            margin-top: 20px;
            display: flex;
            justify-content: flex-start;
            direction: rtl;
          }
          .totals-table {
            width: 300px;
            font-size: 12px;
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
            .print-last-page-only {
              display: block;
              break-inside: avoid;
              page-break-inside: avoid;
            }
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
            <div>${safeCompanyData.arabicName}</div>
            <div>${safeCompanyData.companyType}</div>
            <div>السجل التجاري: ${safeCompanyData.commercialRegistration}</div>
            <div>الملف الضريبي: ${safeCompanyData.taxFile}</div>
            <div>العنوان: ${safeCompanyData.city} ${safeCompanyData.region} ${safeCompanyData.street} ${safeCompanyData.district} ${safeCompanyData.buildingNumber}</div>
            <div>الرمز البريدي: ${safeCompanyData.postalCode}</div>
            <div>الهاتف: ${safeCompanyData.phone}</div>
            <div>الجوال: ${safeCompanyData.mobile}</div>
          </div>
          <div class="header-section center">
            <img src="${safeCompanyData.logoUrl}" class="logo" alt="Company Logo">
          </div>
          <div class="header-section company-info-en">
            <div>${safeCompanyData.englishName}</div>
            <div>${safeCompanyData.companyType}</div>
            <div>Commercial Reg.: ${safeCompanyData.commercialRegistration}</div>
            <div>Tax File: ${safeCompanyData.taxFile}</div>
            <div>Address: ${safeCompanyData.city} ${safeCompanyData.region} ${safeCompanyData.street} ${safeCompanyData.district} ${safeCompanyData.buildingNumber}</div>
            <div>Postal Code: ${safeCompanyData.postalCode}</div>
            <div>Phone: ${safeCompanyData.phone}</div>
            <div>Mobile: ${safeCompanyData.mobile}</div>
          </div>
        </div>
        
        <div class="header">
          <h1>تقرير مبيعات الفروع</h1>
          <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
          ${dateFrom && dateTo ? `
          <div style="margin-top: 10px; font-size: 14px; color: #333;">
            الفترة: من ${dateFrom.format('DD/MM/YYYY')} إلى ${dateTo.format('DD/MM/YYYY')}
          </div>
          ` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 200px;">الفرع</th>
              <th style="width: 140px;">إجمالي المبيعات</th>
              <th style="width: 140px;">إجمالي الخصم</th>
              <th style="width: 140px;">إجمالي الضريبة</th>
              <th style="width: 140px;">الصافي</th>
              <th style="width: 120px;">عدد الفواتير</th>
            </tr>
          </thead>
          <tbody>
            ${filteredSales.map(branch => `
              <tr>
                <td>${branch.branchName || '-'}</td>
                <td>${(branch.totalSales || 0).toLocaleString()} </td>
                <td>${(branch.totalDiscount || 0).toLocaleString()}</td>
                <td>${(branch.totalTax || 0).toLocaleString()} </td>
                <td>${(branch.netTotal || 0).toLocaleString()} </td>
                <td>${(branch.invoiceCount || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
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
                <td class="total-label">عدد الفروع:</td>
                <td class="total-value">${filteredSales.length.toLocaleString()} فرع</td>
              </tr>
              <tr>
                <td class="total-label">إجمالي المبيعات:</td>
                <td class="total-value">${totalSales.toLocaleString()} </td>
              </tr>
              <tr>
                <td class="total-label">إجمالي الخصم:</td>
                <td class="total-value">${totalDiscount.toLocaleString()} </td>
              </tr>
              <tr>
                <td class="total-label">إجمالي الضريبة:</td>
                <td class="total-value">${totalTax.toLocaleString()} </td>
              </tr>
              <tr>
                <td class="total-label">إجمالي الفواتير:</td>
                <td class="total-value">${totalInvoices.toLocaleString()} فاتورة</td>
              </tr>
              <tr>
                <td class="total-label">متوسط مبيعات الفرع:</td>
                <td class="total-value">${avgSales.toLocaleString()}</td>
              </tr>
              <tr class="final-total">
                <td class="total-label">إجمالي الصافي:</td>
                <td class="total-value">${totalNet.toLocaleString()} </td>
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
                <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${safeCompanyData.arabicName}</div>
                <div style="font-size: 14px; font-weight: 500; margin-top: 4px; line-height: 1.1;">${safeCompanyData.phone ? 'هاتف: ' + safeCompanyData.phone : ''}</div>
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

    printWindow.document.close();
    printWindow.focus();
    
    // انتظار تحميل الصور والخطوط قبل الطباعة
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1000);
  };

  // ألوان الرسم البياني
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#00ff00'];

  // أعمدة الجدول
  const columns = [
    {
      title: 'الفرع',
      dataIndex: 'branchName',
      key: 'branchName',
      
      minWidth: 150,
      sorter: (a: BranchSalesRecord, b: BranchSalesRecord) => a.branchName.localeCompare(b.branchName),
      render: (text: string) => (
        <span className="font-medium text-gray-800">{text}</span>
      ),
    },
    {
      title: 'إجمالي المبيعات',
      dataIndex: 'totalSales',
      key: 'totalSales',
      minWidth: 140,
      render: (value: number) => (
        <span className="font-semibold text-green-600">
          {value.toLocaleString()}
        </span>
      ),
      sorter: (a: BranchSalesRecord, b: BranchSalesRecord) => a.totalSales - b.totalSales,
    },
    {
      title: 'إجمالي الخصم',
      dataIndex: 'totalDiscount',
      key: 'totalDiscount',
      minWidth: 140,
      render: (value: number) => (
        <span className="font-semibold text-orange-600">
          {value.toLocaleString()}
        </span>
      ),
      sorter: (a: BranchSalesRecord, b: BranchSalesRecord) => a.totalDiscount - b.totalDiscount,
    },
    {
      title: 'إجمالي الضريبة',
      dataIndex: 'totalTax',
      key: 'totalTax',
      minWidth: 140,
      render: (value: number) => (
        <span className="font-semibold text-blue-600">
          {value.toLocaleString()}
        </span>
      ),
      sorter: (a: BranchSalesRecord, b: BranchSalesRecord) => a.totalTax - b.totalTax,
    },
    {
      title: 'الصافي',
      dataIndex: 'netTotal',
      key: 'netTotal',
      minWidth: 140,
      render: (value: number) => (
        <span className="font-bold text-purple-600">
          {value.toLocaleString()}
        </span>
      ),
      sorter: (a: BranchSalesRecord, b: BranchSalesRecord) => a.netTotal - b.netTotal,
    },
    {
      title: 'عدد الفواتير',
      dataIndex: 'invoiceCount',
      key: 'invoiceCount',
      minWidth: 120,
      render: (value: number) => (
        <span className="font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded">
          {value}
        </span>
      ),
      sorter: (a: BranchSalesRecord, b: BranchSalesRecord) => a.invoiceCount - b.invoiceCount,
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
        <title>تقرير مبيعات الفروع | ERP90 Dashboard</title>
        <meta name="description" content="تقرير فواتير المبيعات، عرض وطباعة فواتير العملاء، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, عملاء, ضريبة, طباعة, Sales, Invoice, Report, Tax, Customer" />
      </Helmet>
     <div className="p-2 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden w-full max-w-full">
        <div className="flex items-center">
          <BarChartOutlined className="h-8 w-8 text-green-600 ml-3" />
          <h1 className="text-2xl font-bold text-gray-800"> تقرير مبيعات الفروع</h1>
        </div>
        <p className="text-gray-600 mt-2">عرض وإدارة تقرير مبيعات الفروع</p>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500"></div>
      </div>
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "تقرير مبيعات الفروع" }
        ]}
      />

      {/* Search Options */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-4 sm:p-6 rounded-lg border border-blue-100 flex flex-col gap-6 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        
        <h3 className="text-xl font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <SearchOutlined className="text-blue-600 text-xl" /> خيارات البحث
        </h3>

        {/* الصف الأول */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label style={labelStyle} className="text-gray-700">من تاريخ</label>
            <DatePicker
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="اختر التاريخ"
              className="w-full"
              style={largeControlStyle}
              format="YYYY-MM-DD"
              disabledDate={disabledDate}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label style={labelStyle} className="text-gray-700">إلى تاريخ</label>
            <DatePicker
              value={dateTo}
              onChange={setDateTo}
              placeholder="اختر التاريخ"
              className="w-full"
              style={largeControlStyle}
              format="YYYY-MM-DD"
              disabledDate={disabledDate}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label style={labelStyle} className="text-gray-700">الفرع</label>
            <Select
              mode="multiple"
              value={branchIds}
              onChange={setBranchIds}
              placeholder="اختر الفروع"
              className={styles.noAntBorder}
              style={largeControlStyle}
              allowClear
              loading={branchesLoading}
              showSearch
              filterOption={(input, option) =>
                option?.label?.toString().toLowerCase().includes(input.toLowerCase()) ||
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
              dropdownRender={(menu) => (
                <div>
                  <div className="p-2 border-b border-gray-200">
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        if (branchIds.length === branches.length) {
                          setBranchIds([]);
                        } else {
                          setBranchIds(branches.map(branch => branch.id));
                        }
                      }}
                      className="text-blue-600 p-0"
                    >
                      {branchIds.length === branches.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </Button>
                  </div>
                  {menu}
                </div>
              )}
            >
              {branches.map(branch => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label style={labelStyle} className="text-gray-700">نوع الفاتورة</label>
            <Select
              value={invoiceType}

              onChange={setInvoiceType}
              className="w-full styles.noAntBorder "
              style={largeControlStyle}
            >
              <Option value="sales">فواتير المبيعات</Option>
              <Option value="returns">مردودات المبيعات</Option>
              <Option value="all">الكل</Option>
            </Select>
          </div>
        </div>

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

          <Button
            onClick={() => setShowMore(!showMore)}
            className="bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700"
            size="large"
          >
            {showMore ? 'إخفاء الخيارات المتقدمة' : 'عرض الخيارات المتقدمة'}
          </Button>
        </div>
      </motion.div>

      {/* تم حذف كروت الإحصائيات الإجمالية بناءً على طلب المستخدم */}

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
            نتائج البحث ({filteredSales.length} فرع)
            {branchIds.length > 0 && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                ({branchIds.length} فرع محدد)
              </span>
            )}
            {isLoading && (
              <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded animate-pulse">
                جاري البحث...
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={filteredSales.length === 0}
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
            >
              طباعة
            </Button>
          </div>
        </div>

        <div className="w-full overflow-x-auto">
          <Table
            style={{ direction: 'rtl' }}
            columns={columns}
            dataSource={filteredSales}
            loading={isLoading}
            size="small"
            scroll={{ x: 1200 }}
            bordered
            rowClassName={(record, index) => 
              index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
            }
            className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-blue-800 [&_.ant-table-thead_>_tr_>_th]:border-blue-200 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
            pagination={{
              total: filteredSales.length,
              pageSize: 30,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => 
                `عرض ${range[0]}-${range[1]} من أصل ${total} فرع`,
              pageSizeOptions: ['30', '50', '100'],
              className: 'text-lg'
            }}
            summary={() => {
              // حساب الإجماليات
              const totalSales = filteredSales.reduce((sum, branch) => sum + branch.totalSales, 0);
              const totalDiscount = filteredSales.reduce((sum, branch) => sum + branch.totalDiscount, 0);
              const totalTax = filteredSales.reduce((sum, branch) => sum + branch.totalTax, 0);
              const totalNet = filteredSales.reduce((sum, branch) => sum + branch.netTotal, 0);
              const totalInvoices = filteredSales.reduce((sum, branch) => sum + branch.invoiceCount, 0);

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row className=" font-bold">
                    <Table.Summary.Cell index={0} className=" font-bold text-gray-800">
                      الإجماليات
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} className=" font-bold text-green-600">
                      {totalSales.toLocaleString()}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} className=" font-bold text-orange-600">
                      {totalDiscount.toLocaleString()}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} className=" font-bold text-blue-600">
                      {totalTax.toLocaleString()}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} className=" font-bold text-purple-600">
                      {totalNet.toLocaleString()}
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5} className=" font-bold text-gray-700">
                      {totalInvoices.toLocaleString()}
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              );
            }}
            locale={{
              emptyText: branchIds.length > 0 
                ? `لا توجد بيانات للفروع المحددة في الفترة المحددة`
                : 'لا توجد بيانات مبيعات في الفترة المحددة',
              filterConfirm: 'موافق',
              filterReset: 'إعادة تعيين',
              selectAll: 'تحديد الكل',
              selectInvert: 'عكس التحديد',
            }}
          />
        </div>
      </motion.div>

      {/* Charts Section */}
      {chartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="w-full bg-white p-4 sm:p-6 rounded-lg border border-blue-100 flex flex-col gap-6 shadow-sm overflow-x-auto relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          
          <h3 className="text-xl font-semibold text-gray-700 flex items-center gap-3">
            <BarChartOutlined className="text-purple-600 text-xl" /> الرسوم البيانية
          </h3>

          <div className="w-full overflow-x-auto">
            {/* Bar Chart */}
            <div className="bg-gray-50 p-2 sm:p-4 rounded-lg w-full min-w-[320px]">
              <Title level={5} className="text-center mb-4">مبيعات الفروع</Title>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="branchName" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)} `, 'مبيعات الفرع']}
                  />
                  <Bar dataKey="totalSales" fill="#8884d8" name="مبيعات الفرع" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default BranchSales;

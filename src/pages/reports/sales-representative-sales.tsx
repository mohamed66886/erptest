import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '@/components/Breadcrumb';
import { motion } from 'framer-motion';
import { Table, Select, DatePicker, Button, Typography, Card, Row, Col, Statistic } from 'antd';
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons';
import { BarChartOutlined, TableOutlined, PrinterOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { useFinancialYear } from '@/hooks/useFinancialYear';
import { SalesRepresentativeService, SalesRepresentative } from '@/services/salesManagementService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Helmet } from "react-helmet";

const { Option } = Select;
const { Title } = Typography;

interface SalesRepSalesRecord {
  key: string;
  representativeId: string;
  representativeName: string;
  representativePhone: string;
  totalSales: number;
  totalDiscount: number;
  totalTax: number;
  salesCost: number;
  profitLoss: number;
  netTotal: number;
  invoiceCount: number;
}

interface ChartDataItem {
  representativeName: string;
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

const SalesRepresentativeSales: React.FC = () => {
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [salesReps, setSalesReps] = useState<SalesRepresentative[]>([]);
  const [salesRepsLoading, setSalesRepsLoading] = useState(true);
  
  // خيارات البحث
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [representativeIds, setRepresentativeIds] = useState<string[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<string>("all"); // all, paid, unpaid

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

  // بيانات التقرير
  const [repSales, setRepSales] = useState<SalesRepSalesRecord[]>([]);
  const [filteredSales, setFilteredSales] = useState<SalesRepSalesRecord[]>([]);

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
    SalesRepresentativeService.getAll().then(data => {
      setSalesReps(data);
      setSalesRepsLoading(false);
    });
  }, []);

  // جلب بيانات مبيعات المندوبين من Firebase
  const fetchRepSalesData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // جلب فواتير المبيعات
      const invoiceCollections = ['sales_invoices'];

      let allDocs: Array<import('firebase/firestore').QueryDocumentSnapshot> = [];
      for (const collectionName of invoiceCollections) {
        const baseQuery = collection(db, collectionName);
        const constraints = [];
        if (dateFrom) constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
        if (dateTo) constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
        
        // TODO: إضافة فلترة حالة السداد عندما يتم إضافة حقل paymentStatus للفواتير
        // if (paymentStatus === 'paid') {
        //   constraints.push(where('paymentStatus', '==', 'paid'));
        // } else if (paymentStatus === 'unpaid') {
        //   constraints.push(where('paymentStatus', '==', 'unpaid'));
        // }

        const finalQuery = constraints.length > 0 ? query(baseQuery, ...constraints) : baseQuery;
        const snapshot = await getDocs(finalQuery);
        allDocs = allDocs.concat(snapshot.docs);
      }

      const repSalesMap: { [key: string]: SalesRepSalesRecord } = {};
      
      // للتشخيص: طباعة معرفات المندوبين الموجودة في البيانات
      const foundRepIds = new Set<string>();
      
      // جلب بيانات الأصناف للحصول على أسعار الشراء
      const itemsSnapshot = await getDocs(collection(db, 'items'));
      const itemCosts: { [key: string]: number } = {};
      
      itemsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        itemCosts[doc.id] = data.purchasePrice || data.cost || 0;
      });
      
      for (const docSnapshot of allDocs) {
        const invoiceData = docSnapshot.data();
        const invoiceRepId = invoiceData.delegate || invoiceData.salesRepresentative || invoiceData.representative;
        
        if (!invoiceRepId) continue;
        
        // إضافة معرف المندوب إلى مجموعة المندوبين الموجودة
        foundRepIds.add(invoiceRepId);
        
        // تطبيق فلترة المندوبين المحددة هنا بدلاً من في الاستعلام
        if (representativeIds.length > 0 && !representativeIds.includes(invoiceRepId)) {
          continue;
        }
        
        // الحصول على اسم المندوب ورقم الهاتف
        const rep = salesReps.find(r => r.id === invoiceRepId);
        const repName = rep?.name || invoiceRepId;
        const repPhone = rep?.phone || '';
        
        // إنشاء سجل جديد إذا لم يكن موجوداً
        if (!repSalesMap[invoiceRepId]) {
          repSalesMap[invoiceRepId] = {
            key: invoiceRepId,
            representativeId: invoiceRepId,
            representativeName: repName,
            representativePhone: repPhone,
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
        
        // إضافة البيانات إلى إجماليات المندوب
        repSalesMap[invoiceRepId].totalSales += invoiceSales;
        repSalesMap[invoiceRepId].totalDiscount += invoiceDiscount;
        repSalesMap[invoiceRepId].totalTax += invoiceTax;
        repSalesMap[invoiceRepId].salesCost += invoiceCost;
        repSalesMap[invoiceRepId].invoiceCount += 1;
      }
      
      // للتشخيص: طباعة معرفات المندوبين الموجودة
      console.log('معرفات المندوبين الموجودة في البيانات:', Array.from(foundRepIds));
      console.log('معرفات المندوبين المحددة:', representativeIds);
      console.log('عدد الفواتير المسترجعة:', allDocs.length);
      
      // حساب الربح/الخسارة والصافي لكل مندوب
      Object.values(repSalesMap).forEach(rep => {
        rep.profitLoss = rep.totalSales - rep.totalDiscount - rep.salesCost;
        rep.netTotal = rep.totalSales - rep.totalDiscount - rep.totalTax;
      });
      
      const records = Object.values(repSalesMap);
      setRepSales(records);
      setFilteredSales(records);
      
      // حساب الإحصائيات الإجمالية
      const stats = records.reduce(
        (acc, rep) => ({
          totalSales: acc.totalSales + rep.totalSales,
          totalDiscount: acc.totalDiscount + rep.totalDiscount,
          totalTax: acc.totalTax + rep.totalTax,
          totalCost: acc.totalCost + rep.salesCost,
          totalProfit: acc.totalProfit + rep.profitLoss,
          totalNet: acc.totalNet + rep.netTotal
        }),
        { totalSales: 0, totalDiscount: 0, totalTax: 0, totalCost: 0, totalProfit: 0, totalNet: 0 }
      );
      setTotalStats(stats);
      
      // إعداد بيانات الرسم البياني
      const chartData: ChartDataItem[] = records.map(rep => ({
        representativeName: rep.representativeName,
        totalSales: rep.totalSales,
        profitLoss: rep.profitLoss
      }));
      
      // ترتيب البيانات حسب المبيعات
      const sortedData = chartData.sort((a, b) => b.totalSales - a.totalSales);
      setChartData(sortedData);
      
    } catch (err) {
      console.error('خطأ في جلب بيانات مبيعات المندوبين:', err);
      setRepSales([]);
      setFilteredSales([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [representativeIds, dateFrom, dateTo, salesReps]);

  // تشغيل البحث تلقائياً عند تحميل الصفحة أو تغيير المعايير
  useEffect(() => {
    if (!salesRepsLoading && salesReps.length >= 0) {
      fetchRepSalesData();
    }
  }, [salesRepsLoading, salesReps.length, fetchRepSalesData]);

  // عند الضغط على بحث
  const handleSearch = () => {
    fetchRepSalesData();
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

    const exportData = filteredSales.map(rep => [
      rep.representativePhone || 'غير محدد',
      rep.representativeName,
      rep.totalSales.toFixed(2),
      rep.totalDiscount.toFixed(2),
      rep.totalTax.toFixed(2),
      rep.netTotal.toFixed(2),
      rep.invoiceCount
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير مبيعات المندوبين');

    // إعداد الأعمدة
    sheet.columns = [
      { header: 'رقم الهاتف', key: 'representativePhone', width: 15 },
      { header: 'اسم المندوب', key: 'representativeName', width: 20 },
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
    a.download = `تقرير_مبيعات_المندوبين_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // ألوان الرسم البياني
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#00ff00'];

  // أعمدة الجدول
  const columns = [
    {
      title: 'رقم الهاتف',
      dataIndex: 'representativePhone',
      key: 'representativePhone',
      width: 120,
      render: (value: string) => value || 'غير محدد',
    },
    {
      title: 'اسم المندوب',
      dataIndex: 'representativeName',
      key: 'representativeName',
      width: 200,
    },
    {
      title: 'إجمالي المبيعات',
      dataIndex: 'totalSales',
      key: 'totalSales',
      width: 120,
      render: (value: number) => `${value.toFixed(2)} `,
      sorter: (a: SalesRepSalesRecord, b: SalesRepSalesRecord) => a.totalSales - b.totalSales,
    },
    {
      title: 'إجمالي الخصم',
      dataIndex: 'totalDiscount',
      key: 'totalDiscount',
      width: 120,
      render: (value: number) => `${value.toFixed(2)} `,
      sorter: (a: SalesRepSalesRecord, b: SalesRepSalesRecord) => a.totalDiscount - b.totalDiscount,
    },
    {
      title: 'إجمالي الضريبة',
      dataIndex: 'totalTax',
      key: 'totalTax',
      width: 120,
      render: (value: number) => `${value.toFixed(2)} `,
      sorter: (a: SalesRepSalesRecord, b: SalesRepSalesRecord) => a.totalTax - b.totalTax,
    },
    {
      title: 'الصافي',
      dataIndex: 'netTotal',
      key: 'netTotal',
      width: 120,
      render: (value: number) => `${value.toFixed(2)} `,
      sorter: (a: SalesRepSalesRecord, b: SalesRepSalesRecord) => a.netTotal - b.netTotal,
    },
    {
      title: 'عدد الفواتير',
      dataIndex: 'invoiceCount',
      key: 'invoiceCount',
      width: 100,
      sorter: (a: SalesRepSalesRecord, b: SalesRepSalesRecord) => a.invoiceCount - b.invoiceCount,
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
        <title>تقرير مبيعات المندوبين | ERP90 Dashboard</title>
        <meta name="description" content="تقرير مبيعات المندوبين، عرض وطباعة مبيعات مندوبي المبيعات، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, مندوبين, ضريبة, طباعة, Sales, Invoice, Report, Tax, Representative" />
      </Helmet>
     <div className="p-2 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden w-full max-w-full">
        <div className="flex items-center">
          <BarChartOutlined className="h-8 w-8 text-green-600 ml-3" />
          <h1 className="text-2xl font-bold text-gray-800"> تقرير مبيعات المندوبين</h1>
        </div>
        <p className="text-gray-600 mt-2">عرض وإدارة تقرير مبيعات مندوبي المبيعات</p>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-blue-500"></div>
      </div>
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "تقرير مبيعات المندوبين" }
        ]}
      />

      {/* Search Options */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-blue-100 flex flex-col gap-4 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
        
        <h3 className="text-lg font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <SearchOutlined className="text-blue-600 text-lg" /> خيارات البحث
        </h3>
        
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">مندوب المبيعات</label>
            <Select
              mode="multiple"
              value={representativeIds}
              onChange={setRepresentativeIds}
              placeholder="اختر المندوبين"
              className="w-full"
              allowClear
              loading={salesRepsLoading}
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
                        if (representativeIds.length === salesReps.length) {
                          setRepresentativeIds([]);
                        } else {
                          setRepresentativeIds(salesReps.map(rep => rep.id || ''));
                        }
                      }}
                      className="text-blue-600 p-0"
                    >
                      {representativeIds.length === salesReps.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                    </Button>
                  </div>
                  {menu}
                </div>
              )}
            >
              {salesReps.map(rep => (
                <Option key={rep.id} value={rep.id}>
                  {rep.name}
                </Option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-600 mb-1">حالة السداد</label>
            <Select
              value={paymentStatus}
              onChange={setPaymentStatus}
              className="w-full"
            >
              <Option value="all">الكل</Option>
              <Option value="paid">مسدد</Option>
              <Option value="unpaid">غير مسدد</Option>
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

          <div className="flex flex-col justify-end">
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
        </div>
      </motion.div>

      {/* Search Results */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-blue-100 flex flex-col gap-4 shadow-sm overflow-x-auto"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-blue-500"></div>
        
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <TableOutlined className="text-blue-600 text-lg" /> نتائج البحث
            {representativeIds.length > 0 && (
              <span className="text-sm text-blue-600 bg-blue-50 px-2 py-1 rounded">
                ({representativeIds.length} مندوب محدد)
              </span>
            )}
            {isLoading && (
              <span className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded animate-pulse">
                جاري البحث...
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            إجمالي: {filteredSales.length} مندوب
            {filteredSales.length > 0 && (
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
            dataSource={filteredSales}
            loading={isLoading}
            size="small"
            className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-blue-800 [&_.ant-table-thead_>_tr_>_th]:border-blue-200 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
            scroll={{ x: 800 }}
            pagination={{
              total: filteredSales.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} من ${total} مندوب`,
            }}
            locale={{
              emptyText: representativeIds.length > 0 
                ? `لا توجد بيانات للمندوبين المحددين في الفترة المحددة`
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
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-blue-100 flex flex-col gap-4 shadow-sm overflow-x-auto"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <BarChartOutlined className="text-purple-600 text-lg" /> الرسوم البيانية
          </h3>

          <div className="w-full overflow-x-auto">
            {/* Bar Chart */}
            <div className="bg-gray-50 p-2 sm:p-4 rounded-lg w-full min-w-[320px]">
              <Title level={5} className="text-center mb-4">مبيعات المندوبين</Title>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="representativeName" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(2)}`, 'مبيعات المندوب']}
                  />
                  <Bar dataKey="totalSales" fill="#8884d8" name="مبيعات المندوب" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default SalesRepresentativeSales;

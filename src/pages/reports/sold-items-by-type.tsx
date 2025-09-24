import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DatePicker, Input, Select, Table, Button } from "antd";
import { SearchOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import dayjs, { Dayjs } from 'dayjs';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { BarChartOutlined, TableOutlined, PrinterOutlined } from '@ant-design/icons';
import { Helmet } from "react-helmet";

const { Option } = Select;

interface TypeSalesRecord {
  key: string;
  typeNumber: string;
  typeName: string;
  totalQuantity: number;
  totalAmount: number;
  mostSoldItem: string;
  mostSoldItemQuantity: number;
}

interface ChartDataItem {
  typeName: string;
  totalQuantity: number;
  totalAmount: number;
}

const SoldItemsByType: React.FC = () => {
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  
  // ستايل موحد لعناصر الإدخال والدروب داون
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
  const [branchId, setBranchId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");

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

  // قوائم الخيارات
  const [types, setTypes] = useState<Array<{id: string, name: string}>>([]);

  // بيانات التقرير
  const [typeSales, setTypeSales] = useState<TypeSalesRecord[]>([]);
  const [filteredTypes, setFilteredTypes] = useState<TypeSalesRecord[]>([]);

  // بيانات الرسم البياني
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);

  // بيانات الشركة
  const [companyData, setCompanyData] = useState<Record<string, unknown>>({});

  // دالة إنشاء البيانات الافتراضية للشركة
  const createDefaultCompanyData = () => ({
    arabicName: 'شركة تجريبية للتجارة',
    englishName: 'Demo Trading Company',
    address: 'العنوان غير محدد',
    phone: 'غير محدد',
    email: 'غير محدد',
    taxNumber: 'غير محدد',
    commercialRegistration: 'غير محدد',
    logo: ''
  });

  useEffect(() => {
    fetchBranches().then(data => {
      setBranches(data);
      setBranchesLoading(false);
    });
    
    // جلب بيانات الشركة
    const fetchCompany = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        const possibleCollections = ['companies', 'company', 'company_settings'];
        let snapshot;
        let foundData = false;
        
        for (const collectionName of possibleCollections) {
          try {
            snapshot = await getDocs(collection(db, collectionName));
            if (!snapshot.empty) {
              foundData = true;
              break;
            }
          } catch (error) {
            console.log(`خطأ في الوصول إلى مجموعة ${collectionName}:`, error);
          }
        }
        
        if (foundData && snapshot && !snapshot.empty) {
          const companyDoc = snapshot.docs[0];
          const data = companyDoc.data();
          setCompanyData(data);
        } else {
          setCompanyData(createDefaultCompanyData());
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات الشركة:', error);
        setCompanyData(createDefaultCompanyData());
      }
    };
    fetchCompany();
  }, []);

  // جلب التصنيفات من قاعدة البيانات
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        let options: Array<{id: string, name: string}> = [];
        try {
          const snap = await getDocs(collection(db, 'item_types'));
          options = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || data.typeName || doc.id
            };
          });
        } catch (error) {
          console.log('لا توجد مجموعة item_types منفصلة، جاري جلب التصنيفات من inventory_items');
        }
        
        if (options.length === 0) {
          const snap = await getDocs(collection(db, 'inventory_items'));
          const typeSet = new Set<string>();
          
          snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.itemType && typeof data.itemType === 'string') {
              typeSet.add(data.itemType);
            } else if (data.type && typeof data.type === 'string') {
              typeSet.add(data.type);
            }
          });
          
          options = Array.from(typeSet).map((name, index) => ({
            id: `type_${index}`,
            name
          }));
        }
        
        setTypes(options);
      } catch (error) {
        console.error('خطأ في جلب التصنيفات:', error);
        setTypes([]);
      }
    };
    fetchTypes();
  }, []);

  // جلب بيانات المبيعات حسب التصنيف من Firebase
  const fetchTypeSales = async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const baseQuery = collection(db, 'sales_invoices');
      const constraints = [];
      
      if (branchId) constraints.push(where('branch', '==', branchId));
      if (dateFrom) constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      if (dateTo) constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));

      const finalQuery = constraints.length > 0 ? query(baseQuery, ...constraints) : baseQuery;
      const snapshot = await getDocs(finalQuery);
      
      // معالجة البيانات لحساب المبيعات لكل تصنيف
      const typeMap = new Map<string, {
        typeName: string;
        totalQuantity: number;
        totalAmount: number;
        items: Map<string, { name: string; quantity: number }>;
      }>();

      snapshot.docs.forEach(doc => {
        const invoice = doc.data();
        if (invoice.items && Array.isArray(invoice.items)) {
          invoice.items.forEach((item: { itemType?: string; type?: string; quantity?: string | number; totalAmount?: string | number; name?: string }) => {
            const typeName = item.itemType || item.type || 'بدون تصنيف';
            const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : item.quantity || 0;
            const totalAmount = typeof item.totalAmount === 'string' ? parseFloat(item.totalAmount) || 0 : item.totalAmount || 0;
            const itemName = item.name || 'غير محدد';

            if (!typeMap.has(typeName)) {
              typeMap.set(typeName, {
                typeName,
                totalQuantity: 0,
                totalAmount: 0,
                items: new Map()
              });
            }

            const typeData = typeMap.get(typeName)!;
            typeData.totalQuantity += quantity;
            typeData.totalAmount += totalAmount;

            // تتبع أكثر الأصناف مبيعاً في هذا التصنيف
            const currentItemQuantity = typeData.items.get(itemName)?.quantity || 0;
            typeData.items.set(itemName, {
              name: itemName,
              quantity: currentItemQuantity + quantity
            });
          });
        }
      });

      // تحويل البيانات إلى تنسيق الجدول
      const records: TypeSalesRecord[] = Array.from(typeMap.entries()).map(([typeName, data], index) => {
        // العثور على أكثر صنف مباع في هذا التصنيف
        let mostSoldItem = '';
        let mostSoldItemQuantity = 0;
        
        data.items.forEach((itemData) => {
          if (itemData.quantity > mostSoldItemQuantity) {
            mostSoldItem = itemData.name;
            mostSoldItemQuantity = itemData.quantity;
          }
        });

        return {
          key: `type_${index}`,
          typeNumber: (index + 1).toString(),
          typeName,
          totalQuantity: data.totalQuantity,
          totalAmount: data.totalAmount,
          mostSoldItem: mostSoldItem || 'لا يوجد',
          mostSoldItemQuantity
        };
      });

      setTypeSales(records);
      setFilteredTypes(records);

      // إعداد بيانات الرسم البياني
      const chartData = records.slice(0, 10).map(record => ({
        typeName: record.typeName,
        totalQuantity: record.totalQuantity,
        totalAmount: record.totalAmount
      }));
      setChartData(chartData);

    } catch (error) {
      console.error('خطأ في جلب بيانات المبيعات حسب التصنيف:', error);
      setTypeSales([]);
      setFilteredTypes([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // البحث والفلترة
  useEffect(() => {
    let filtered = [...typeSales];
    
    if (typeId) {
      const selectedType = types.find(c => c.id === typeId);
      if (selectedType) {
        filtered = filtered.filter(item => 
          item.typeName.toLowerCase().includes(selectedType.name.toLowerCase())
        );
      }
    }

    setFilteredTypes(filtered);
  }, [typeSales, typeId, types]);

  // دالة الطباعة
  const handlePrint = async () => {
    if (filteredTypes.length === 0) {
      return;
    }

    // حساب الإجماليات
    const totalQuantity = filteredTypes.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    const totalAmount = filteredTypes.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح للنوافذ المنبثقة لتتمكن من الطباعة');
      return;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>طباعة تقرير الأصناف المباعة حسب التصنيف</title>
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
          .print-date {
            text-align: left;
            margin-top: 15px;
            font-size: 9px;
            color: #000;
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
        </style>
      </head>
      <body>
        <div class="company-header">
          <div style="text-align: right; flex: 1;">
            <div style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">${companyData.arabicName || 'اسم الشركة'}</div>
            <div style="font-size: 10px; margin-bottom: 2px;">العنوان: ${companyData.address || 'غير محدد'}</div>
            <div style="font-size: 10px; margin-bottom: 2px;">هاتف: ${companyData.phone || 'غير محدد'}</div>
            <div style="font-size: 10px;">ايميل: ${companyData.email || 'غير محدد'}</div>
          </div>
          <div style="text-align: left; flex: 1;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px; font-family: Arial;">${companyData.englishName || 'Company Name'}</div>
            <div style="font-size: 9px; margin-bottom: 2px; font-family: Arial;">Tax No: ${companyData.taxNumber || 'N/A'}</div>
            <div style="font-size: 9px; font-family: Arial;">CR: ${companyData.commercialRegistration || 'N/A'}</div>
          </div>
        </div>
        
        <div class="header">
          <h1>تقرير الأصناف المباعة حسب التصنيف</h1>
          <p>من ${dateFrom ? dayjs(dateFrom).format('YYYY/MM/DD') : ''} إلى ${dateTo ? dayjs(dateTo).format('YYYY/MM/DD') : ''}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم التصنيف</th>
              <th>التصنيف</th>
              <th>إجمالي الكمية المباعة</th>
              <th>إجمالي المبلغ</th>
              <th>أكثر صنف مباع</th>
              <th>كمية أكثر صنف مباع</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTypes.map(item => `
              <tr>
                <td>${item.typeNumber}</td>
                <td>${item.typeName}</td>
                <td>${item.totalQuantity.toFixed(2)}</td>
                <td>${item.totalAmount.toFixed(2)}</td>
                <td>${item.mostSoldItem}</td>
                <td>${item.mostSoldItemQuantity.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals-container">
          <table class="totals-table">
            <tr>
              <th>إجمالي الكمية</th>
              <td>${totalQuantity.toFixed(2)}</td>
            </tr>
            <tr>
              <th>إجمالي المبلغ</th>
              <td>${totalAmount.toFixed(2)}</td>
            </tr>
            <tr>
              <th>عدد التصنيفات</th>
              <td>${filteredTypes.length}</td>
            </tr>
          </table>
        </div>

        <div class="print-date">
          تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} ${new Date().toLocaleTimeString('ar-SA')}
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1000);
  };

  // دالة تصدير البيانات إلى ملف Excel
  const handleExport = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ExcelJS = (window as any).ExcelJS;
    if (!ExcelJS) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
        script.onload = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ExcelJS = (window as any).ExcelJS;
          resolve(null);
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ExcelJS = (window as any).ExcelJS;
    }

    const exportData = filteredTypes.map(item => [
      item.typeNumber,
      item.typeName,
      item.totalQuantity,
      item.totalAmount,
      item.mostSoldItem,
      item.mostSoldItemQuantity,
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الأصناف المباعة حسب التصنيف');

    sheet.columns = [
      { header: 'رقم التصنيف', key: 'typeNumber', width: 12 },
      { header: 'التصنيف', key: 'typeName', width: 25 },
      { header: 'إجمالي الكمية المباعة', key: 'totalQuantity', width: 18 },
      { header: 'إجمالي المبلغ', key: 'totalAmount', width: 15 },
      { header: 'أكثر صنف مباع', key: 'mostSoldItem', width: 20 },
      { header: 'كمية أكثر صنف مباع', key: 'mostSoldItemQuantity', width: 18 },
    ];

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
    a.download = `تقرير_الأصناف_المباعة_حسب_التصنيف_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // ألوان الرسم البياني
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#00ff00'];

  // تحديد أعمدة الجدول
  const columns = [
    {
      title: 'رقم التصنيف',
      dataIndex: 'typeNumber',
      key: 'typeNumber',
      width: 120,
      align: 'center' as const,
    },
    {
      title: 'التصنيف',
      dataIndex: 'typeName',
      key: 'typeName',
      width: 200,
      align: 'center' as const,
    },
    {
      title: 'إجمالي الكمية المباعة',
      dataIndex: 'totalQuantity',
      key: 'totalQuantity',
      width: 150,
      align: 'center' as const,
      render: (value: number) => value?.toFixed(2) || '0.00'
    },
    {
      title: 'إجمالي المبلغ',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'center' as const,
      render: (value: number) => value?.toFixed(2) || '0.00'
    },
    {
      title: 'أكثر صنف مباع',
      dataIndex: 'mostSoldItem',
      key: 'mostSoldItem',
      width: 200,
      align: 'center' as const,
    },
    {
      title: 'كمية أكثر صنف مباع',
      dataIndex: 'mostSoldItemQuantity',
      key: 'mostSoldItemQuantity',
      width: 150,
      align: 'center' as const,
      render: (value: number) => value?.toFixed(2) || '0.00'
    },
  ];

  // CSS للجدول
  const tableStyle = `
    .ant-table-thead > tr > th {
      text-align: center !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      color: white !important;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
    }
    .ant-table-tbody > tr > td {
      text-align: center !important;
      font-size: 13px !important;
      border: 1px solid #e5e7eb !important;
    }
    .ant-table-tbody > tr:hover > td {
      background-color: #f0fdf4 !important;
    }
    .ant-table-summary > tr > td {
      text-align: center !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      background-color: #f9fafb !important;
      border: 1px solid #d1d5db !important;
    }
  `;

  // حساب الإجماليات
  const totalQuantity = filteredTypes.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
  const totalAmount = filteredTypes.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

  return (
    <>
      <Helmet>
        <title>تقرير الأصناف المباعة حسب التصنيف | ERP90 Dashboard</title>
        <meta name="description" content="تقرير الأصناف المباعة حسب التصنيف، عرض وإدارة مبيعات التصنيفات، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تصنيفات, أصناف, مبيعات, تقرير, Types, Items, Sales, Report" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        <style dangerouslySetInnerHTML={{ __html: tableStyle }} />

        {/* العنوان الرئيسي */}
        <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="flex items-center">
            <BarChartOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600 ml-1 sm:ml-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">تقرير الأصناف المباعة حسب التصنيف</h1>
          </div>
          <p className="text-xs sm:text-base text-gray-600 mt-2">عرض وإدارة تقرير الأصناف المباعة حسب التصنيف</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        </div>

        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة المبيعات", to: "/management/sales" },
            { label: "تقرير الأصناف المباعة حسب التصنيف" }
          ]}
        />

        {/* خيارات البحث والفلترة */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white p-6 rounded-lg shadow-sm border"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2 space-x-reverse">
              <SearchOutlined className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-800">خيارات البحث والفلترة</h3>
            </div>
            <Button
              type="link"
              onClick={() => setShowMore(!showMore)}
              className="text-blue-600 hover:text-blue-800"
            >
              {showMore ? 'عرض أقل' : 'عرض المزيد'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label style={labelStyle}>من تاريخ</label>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                locale={arEG}
                placeholder="اختر التاريخ"
                style={largeControlStyle}
                className="w-full"
              />
            </div>

            <div>
              <label style={labelStyle}>إلى تاريخ</label>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                locale={arEG}
                placeholder="اختر التاريخ"
                style={largeControlStyle}
                className="w-full"
              />
            </div>

            <div>
              <label style={labelStyle}>الفرع</label>
              <Select
                value={branchId}
                onChange={setBranchId}
                placeholder="اختر الفرع"
                style={largeControlStyle}
                className="w-full"
                allowClear
                loading={branchesLoading}
              >
                {branches.map(branch => (
                  <Option key={branch.id} value={branch.id}>
                    {branch.name}
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <label style={labelStyle}>التصنيف</label>
              <Select
                value={typeId}
                onChange={setTypeId}
                placeholder="اختر التصنيف"
                style={largeControlStyle}
                className="w-full"
                allowClear
              >
                {types.map(type => (
                  <Option key={type.id} value={type.id}>
                    {type.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex justify-center mt-6">
            <Button
              type="primary"
              size="large"
              icon={<SearchOutlined />}
              onClick={fetchTypeSales}
              loading={isLoading}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
            >
              بحث
            </Button>
          </div>
        </motion.div>

        {/* الرسوم البيانية */}
        <AnimatePresence>
          {chartData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="bg-white p-6 rounded-lg shadow-sm border"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <BarChartOutlined className="ml-2" />
                الرسوم البيانية
              </h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* رسم بياني للكمية */}
                <div className="h-80">
                  <h4 className="text-md font-medium text-gray-700 mb-2 text-center">إجمالي الكمية المباعة لكل تصنيف</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="typeName" 
                        tick={{ fontSize: 10, fill: '#666' }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis tick={{ fontSize: 12, fill: '#666' }} />
                      <Tooltip />
                      <Bar dataKey="totalQuantity" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* رسم دائري للمبلغ */}
                <div className="h-80">
                  <h4 className="text-md font-medium text-gray-700 mb-2 text-center">توزيع المبيعات حسب التصنيف</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.slice(0, 6)}
                        dataKey="totalAmount"
                        nameKey="typeName"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={(entry) => `${entry.typeName}: ${entry.totalAmount.toFixed(0)}`}
                      >
                        {chartData.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* النتائج */}
        <AnimatePresence>
          {filteredTypes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="bg-white rounded-lg shadow-sm border overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <TableOutlined className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-800">
                    تقرير الأصناف المباعة حسب التصنيف ({filteredTypes.length})
                  </h3>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Button
                    type="default"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    size="small"
                  >
                    تصدير Excel
                  </Button>
                  <Button
                    type="default"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    size="small"
                  >
                    طباعة
                  </Button>
                </div>
              </div>

              <Table
                columns={columns}
                dataSource={filteredTypes}
                pagination={{
                  pageSize: 20,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) =>
                    `${range[0]}-${range[1]} من ${total} تصنيف`,
                }}
                scroll={{ x: 800 }}
                size="middle"
                loading={isLoading}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={2}>
                        <strong>الإجمالي</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <strong>{totalQuantity.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>
                        <strong>{totalAmount.toFixed(2)}</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4} colSpan={2}>
                        <strong>{filteredTypes.length} تصنيف</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* رسالة عدم وجود بيانات */}
        {!isLoading && filteredTypes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-white p-12 rounded-lg shadow-sm border text-center"
          >
            <FileTextOutlined className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              لا توجد بيانات للعرض
            </h3>
            <p className="text-gray-500">
              قم بتحديد معايير البحث والضغط على زر "بحث" لعرض التقرير
            </p>
          </motion.div>
        )}
      </div>
    </>
  );
};

export default SoldItemsByType;

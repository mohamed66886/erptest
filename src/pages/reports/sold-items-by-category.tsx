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

interface CategorySalesRecord {
  key: string;
  categoryNumber: string;
  categoryName: string;
  totalQuantity: number;
  totalAmount: number;
  mostSoldItem: string;
  mostSoldItemQuantity: number;
}

interface ChartDataItem {
  categoryName: string;
  totalQuantity: number;
  totalAmount: number;
}

interface InvoiceItem {
  quantity?: string | number;
  totalAmount?: string | number;
  total?: string | number;
  name?: string;
  itemName?: string;
  itemNumber?: string;
  price?: string | number;
  discountValue?: string | number;
  discount?: string | number;
}

const SoldItemsByCategory: React.FC = () => {
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
  const [categoryId, setCategoryId] = useState<string>("");

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
  const [categories, setCategories] = useState<Array<{id: string, name: string}>>([]);

  // بيانات التقرير
  const [categorySales, setCategorySales] = useState<CategorySalesRecord[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<CategorySalesRecord[]>([]);

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

  // جلب الفئات من قاعدة البيانات (أصناف المستوى الأول)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { getDocs, collection, query, where } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // جلب أصناف المستوى الأول فقط كفئات
        const q = query(collection(db, 'inventory_items'), where('type', '==', 'مستوى أول'));
        const snapshot = await getDocs(q);
        
        const options = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'غير محدد'
          };
        });
        
        setCategories(options);
      } catch (error) {
        console.error('خطأ في جلب الفئات:', error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  // جلب بيانات المبيعات حسب الفئة من Firebase
  // ملاحظة: يتم حساب المبالغ بعد خصم قيمة الخصم من الإجمالي الأساسي
  const fetchCategorySales = async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      // أولاً: جلب جميع الأصناف من inventory_items لتحديد الفئات
      const itemsSnapshot = await getDocs(collection(db, 'inventory_items'));
      const itemsMap = new Map<string, { name: string; parentId?: number; type: string; id: number; itemCode?: string }>();
      
      console.log('عدد الأصناف المجلبة:', itemsSnapshot.docs.length);
      
      itemsSnapshot.docs.forEach(doc => {
        const item = doc.data();
        if (item.name && item.id !== undefined) {
          const itemData = {
            name: item.name,
            parentId: item.parentId,
            type: item.type,
            id: item.id,
            itemCode: item.itemCode
          };
          
          // أضف الصنف باسمه
          itemsMap.set(item.name, itemData);
          
          // أضف الصنف برقمه أيضاً للبحث السريع
          if (item.itemCode) {
            itemsMap.set(item.itemCode, itemData);
          }
          
          // أضف الصنف بـ ID أيضاً
          itemsMap.set(item.id.toString(), itemData);
        }
      });
      
      console.log('خريطة الأصناف:', Array.from(itemsMap.entries()).slice(0, 5));

      // دالة للعثور على الفئة (المستوى الأول) للصنف المباع
      const findParentCategory = (itemName: string): string => {
        console.log('البحث عن فئة للصنف:', itemName);
        let item = itemsMap.get(itemName);
        
        // إذا لم نجد الصنف بالاسم، جرب البحث برقم/كود الصنف
        if (!item) {
          // جرب البحث في جميع الأصناف
          for (const [key, itemData] of itemsMap) {
            if (itemData.itemCode === itemName || 
                itemData.id.toString() === itemName ||
                itemData.name === itemName) {
              item = itemData;
              break;
            }
          }
        }
        
        if (!item) {
          console.log('الصنف غير موجود في الخريطة:', itemName);
          return 'بدون فئة';
        }
        
        console.log('بيانات الصنف:', item);
        
        // إذا كان الصنف من المستوى الأول، فهو الفئة نفسها
        if (item.type === 'مستوى أول') {
          console.log('الصنف من المستوى الأول:', item.name);
          return item.name;
        }
        
        // إذا كان الصنف من المستوى الثاني، ابحث عن الأب (المستوى الأول)
        if (item.type === 'مستوى ثاني' && item.parentId) {
          console.log('الصنف من المستوى الثاني، البحث عن الأب ID:', item.parentId);
          for (const [parentName, parentItem] of itemsMap) {
            if (parentItem.id === item.parentId && parentItem.type === 'مستوى أول') {
              console.log('تم العثور على الأب (المستوى الأول):', parentItem.name);
              return parentItem.name;
            }
          }
        }
        
        // إذا كان الصنف رئيسي، ابحث عن أول صنف مستوى أول تابع له
        if (item.type === 'رئيسي') {
          console.log('الصنف رئيسي، البحث عن طفل من المستوى الأول');
          for (const [childName, childItem] of itemsMap) {
            if (childItem.parentId === item.id && childItem.type === 'مستوى أول') {
              console.log('تم العثور على طفل من المستوى الأول:', childItem.name);
              return childItem.name;
            }
          }
        }
        
        console.log('لم يتم العثور على فئة مناسبة للصنف:', itemName);
        return 'بدون فئة';
      };
      
      const baseQuery = collection(db, 'sales_invoices');
      const constraints = [];
      
      if (branchId) constraints.push(where('branch', '==', branchId));
      if (dateFrom) constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      if (dateTo) constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));

      const finalQuery = constraints.length > 0 ? query(baseQuery, ...constraints) : baseQuery;
      const snapshot = await getDocs(finalQuery);
      
      console.log('عدد الفواتير المجلبة:', snapshot.docs.length);
      
      // معالجة البيانات لحساب المبيعات لكل فئة
      const categoryMap = new Map<string, {
        categoryName: string;
        totalQuantity: number;
        totalAmount: number;
        items: Map<string, { name: string; quantity: number }>;
      }>();

      snapshot.docs.forEach((doc, index) => {
        const invoice = doc.data();
        console.log(`فاتورة ${index + 1}:`, {
          id: doc.id,
          hasItems: !!invoice.items,
          itemsLength: invoice.items?.length || 0,
          sampleItems: invoice.items?.slice(0, 2)
        });
        
        if (invoice.items && Array.isArray(invoice.items)) {
          invoice.items.forEach((item: InvoiceItem, itemIndex: number) => {
            // جرب عدة حقول للحصول على اسم الصنف
            let itemName = item.name || item.itemName;
            
            // إذا لم نجد اسم الصنف، حاول استخدام رقم الصنف للعثور على الاسم
            if (!itemName && item.itemNumber) {
              // البحث في خريطة الأصناف عن طريق الرقم أو الكود
              for (const [name, itemData] of itemsMap) {
                if (itemData.id.toString() === item.itemNumber || name.includes(item.itemNumber)) {
                  itemName = name;
                  break;
                }
              }
            }
            
            // إذا لم نجد اسم الصنف بعد، استخدم رقم الصنف أو "غير محدد"
            if (!itemName) {
              itemName = item.itemNumber || 'غير محدد';
            }
            const categoryName = findParentCategory(itemName);
            const quantity = typeof item.quantity === 'string' ? parseFloat(item.quantity) || 0 : item.quantity || 0;
            
            // حساب المبلغ الإجمالي بعد الخصم
            let totalAmount = 0;
            
            // جرب الحصول على المبلغ الإجمالي والخصم
            let baseTotal = 0;
            if (item.totalAmount !== undefined) {
              baseTotal = typeof item.totalAmount === 'string' ? parseFloat(item.totalAmount) || 0 : item.totalAmount || 0;
            } else if (item.total !== undefined) {
              baseTotal = typeof item.total === 'string' ? parseFloat(item.total) || 0 : item.total || 0;
            } else {
              // حساب الإجمالي الأساسي من السعر والكمية
              const price = typeof item.price === 'string' ? parseFloat(item.price) || 0 : item.price || 0;
              baseTotal = price * quantity;
            }
            
            // جرب الحصول على قيمة الخصم
            let discountValue = 0;
            if (item.discountValue !== undefined) {
              discountValue = typeof item.discountValue === 'string' ? parseFloat(item.discountValue) || 0 : item.discountValue || 0;
            } else if (item.discount !== undefined) {
              discountValue = typeof item.discount === 'string' ? parseFloat(item.discount) || 0 : item.discount || 0;
            }
            
            // المبلغ النهائي بعد الخصم
            totalAmount = baseTotal - discountValue;

            console.log(`صنف ${itemIndex + 1}:`, {
              itemName,
              categoryName,
              quantity,
              baseTotal: baseTotal.toFixed(2),
              discountValue: discountValue.toFixed(2),
              totalAmountAfterDiscount: totalAmount.toFixed(2),
              rawItem: item
            });

            if (!categoryMap.has(categoryName)) {
              categoryMap.set(categoryName, {
                categoryName,
                totalQuantity: 0,
                totalAmount: 0,
                items: new Map()
              });
            }

            const categoryData = categoryMap.get(categoryName)!;
            categoryData.totalQuantity += quantity;
            categoryData.totalAmount += totalAmount;

            // تتبع أكثر الأصناف مبيعاً في هذه الفئة
            const currentItemQuantity = categoryData.items.get(itemName)?.quantity || 0;
            categoryData.items.set(itemName, {
              name: itemName,
              quantity: currentItemQuantity + quantity
            });
          });
        }
      });
      
      console.log('خريطة الفئات النهائية:', Array.from(categoryMap.entries()));

      // تحويل البيانات إلى تنسيق الجدول
      const records: CategorySalesRecord[] = Array.from(categoryMap.entries()).map(([categoryName, data], index) => {
        // العثور على أكثر صنف مباع في هذه الفئة
        let mostSoldItem = '';
        let mostSoldItemQuantity = 0;
        
        data.items.forEach((itemData) => {
          if (itemData.quantity > mostSoldItemQuantity) {
            mostSoldItem = itemData.name;
            mostSoldItemQuantity = itemData.quantity;
          }
        });

        return {
          key: `category_${index}`,
          categoryNumber: (index + 1).toString(),
          categoryName,
          totalQuantity: data.totalQuantity,
          totalAmount: data.totalAmount,
          mostSoldItem: mostSoldItem || 'لا يوجد',
          mostSoldItemQuantity
        };
      });

      setCategorySales(records);
      setFilteredCategories(records);

      // إعداد بيانات الرسم البياني
      const chartData = records.slice(0, 10).map(record => ({
        categoryName: record.categoryName,
        totalQuantity: record.totalQuantity,
        totalAmount: record.totalAmount
      }));
      setChartData(chartData);

    } catch (error) {
      console.error('خطأ في جلب بيانات المبيعات حسب الفئة:', error);
      setCategorySales([]);
      setFilteredCategories([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // البحث والفلترة
  useEffect(() => {
    let filtered = [...categorySales];
    
    if (categoryId) {
      const selectedCategory = categories.find(c => c.id === categoryId);
      if (selectedCategory) {
        filtered = filtered.filter(item => 
          item.categoryName.toLowerCase().includes(selectedCategory.name.toLowerCase())
        );
      }
    }

    setFilteredCategories(filtered);
  }, [categorySales, categoryId, categories]);

  // دالة الطباعة
  const handlePrint = async () => {
    if (filteredCategories.length === 0) {
      return;
    }

    // حساب الإجماليات
    const totalQuantity = filteredCategories.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
    const totalAmount = filteredCategories.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح للنوافذ المنبثقة لتتمكن من الطباعة');
      return;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>طباعة تقرير الأصناف المباعة حسب الفئة</title>
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
          <h1>تقرير الأصناف المباعة حسب الفئة</h1>
          <p>من ${dateFrom ? dayjs(dateFrom).format('YYYY/MM/DD') : ''} إلى ${dateTo ? dayjs(dateTo).format('YYYY/MM/DD') : ''}</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>رقم الفئة</th>
              <th>الفئة</th>
              <th>إجمالي الكمية المباعة</th>
              <th>إجمالي المبلغ (بعد الخصم)</th>
              <th>أكثر صنف مباع</th>
              <th>كمية أكثر صنف مباع</th>
            </tr>
          </thead>
          <tbody>
            ${filteredCategories.map(item => `
              <tr>
                <td>${item.categoryNumber}</td>
                <td>${item.categoryName}</td>
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
              <th>عدد الفئات</th>
              <td>${filteredCategories.length}</td>
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

    const exportData = filteredCategories.map(item => [
      item.categoryNumber,
      item.categoryName,
      item.totalQuantity,
      item.totalAmount,
      item.mostSoldItem,
      item.mostSoldItemQuantity,
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الأصناف المباعة حسب الفئة');

    sheet.columns = [
      { header: 'رقم الفئة', key: 'categoryNumber', width: 12 },
      { header: 'الفئة', key: 'categoryName', width: 25 },
      { header: 'إجمالي الكمية المباعة', key: 'totalQuantity', width: 18 },
      { header: 'إجمالي المبلغ (بعد الخصم)', key: 'totalAmount', width: 20 },
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
    a.download = `تقرير_الأصناف_المباعة_حسب_الفئة_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
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
      title: 'رقم الفئة',
      dataIndex: 'categoryNumber',
      key: 'categoryNumber',
      width: 120,
      align: 'center' as const,
    },
    {
      title: 'الفئة',
      dataIndex: 'categoryName',
      key: 'categoryName',
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
      title: 'إجمالي المبلغ (بعد الخصم)',
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
      color: #1e40af !important;
      background: #dbeafe !important;
      border: 1px solid #bfdbfe !important;
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
  const totalQuantity = filteredCategories.reduce((sum, item) => sum + (item.totalQuantity || 0), 0);
  const totalAmount = filteredCategories.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

  return (
    <>
      <Helmet>
        <title>تقرير الأصناف المباعة حسب الفئة | ERP90 Dashboard</title>
        <meta name="description" content="تقرير الأصناف المباعة حسب الفئة، عرض وإدارة مبيعات الفئات، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فئات, أصناف, مبيعات, تقرير, Categories, Items, Sales, Report" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        <style dangerouslySetInnerHTML={{ __html: tableStyle }} />

        {/* العنوان الرئيسي */}
        <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="flex items-center">
            <BarChartOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600 ml-1 sm:ml-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">تقرير الأصناف المباعة حسب الفئة</h1>
          </div>
          <p className="text-xs sm:text-base text-gray-600 mt-2">عرض وإدارة تقرير الأصناف المباعة حسب الفئة </p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        </div>

        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة المبيعات", to: "/management/sales" },
            { label: "تقرير الأصناف المباعة حسب الفئة" }
          ]}
        />

        {/* خيارات البحث والفلترة */}
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
              <span style={labelStyle}>الفئة</span>
              <Select
                value={categoryId}
                onChange={setCategoryId}
                placeholder="اختر الفئة"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                optionFilterProp="label"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                <Option value="">جميع الفئات ({categories.length})</Option>
                {categories.map(category => (
                  <Option key={category.id} value={category.id}>
                    {category.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={fetchCategorySales}
              loading={isLoading}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
            >
              {isLoading ? "جاري البحث..." : "بحث"}
            </Button>
            <span className="text-gray-500 text-sm">نتائج البحث: {filteredCategories.length}</span>
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
          </motion.div>
        </motion.div>
                {/* النتائج */}
        <AnimatePresence>
          {filteredCategories.length > 0 && (
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
                  نتائج البحث ({filteredCategories.length} فئة)
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleExport}
                    disabled={filteredCategories.length === 0}
                    className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
                    size="large"
                  >
                    تصدير Excel
                  </Button>
                  <Button
                    type="primary"
                    icon={<PrinterOutlined />}
                    onClick={handlePrint}
                    disabled={filteredCategories.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
                    size="large"
                  >
                    طباعة
                  </Button>
                </div>
              </div>

              <Table  
                style={{ direction: 'rtl' }}
                dataSource={filteredCategories}
                columns={[
                  {
                    title: 'رقم الفئة',
                    dataIndex: 'categoryNumber',
                    key: 'categoryNumber',
                    minWidth: 120,
                    
                    sorter: (a: CategorySalesRecord, b: CategorySalesRecord) => (a.categoryNumber || '').localeCompare(b.categoryNumber || ''),
                    render: (text: string) => (
                      <span className="text-blue-700 font-medium">{text || 'غير محدد'}</span>
                    ),
                  },
                  {
                    title: 'الفئة',
                    dataIndex: 'categoryName',
                    key: 'categoryName',
                    minWidth: 200,
                    sorter: (a: CategorySalesRecord, b: CategorySalesRecord) => (a.categoryName || '').localeCompare(b.categoryName || ''),
                    render: (text: string) => (
                      <span className="text-gray-800 font-medium">{text || 'غير محدد'}</span>
                    ),
                  },
                  {
                    title: 'إجمالي الكمية المباعة',
                    dataIndex: 'totalQuantity',
                    key: 'totalQuantity',
                    minWidth: 150,
                    sorter: (a: CategorySalesRecord, b: CategorySalesRecord) => (a.totalQuantity || 0) - (b.totalQuantity || 0),
                    render: (value: number) => (
                      <span className="text-blue-700 font-semibold">
                        {(value || 0).toLocaleString()}
                      </span>
                    ),
                  },
                  {
                    title: 'إجمالي المبلغ',
                    dataIndex: 'totalAmount',
                    key: 'totalAmount',
                    minWidth: 150,
                    sorter: (a: CategorySalesRecord, b: CategorySalesRecord) => (a.totalAmount || 0) - (b.totalAmount || 0),
                    render: (value: number) => (
                      <span className="text-emerald-700 font-bold">
                        {(value || 0).toLocaleString()} ر.س
                      </span>
                    ),
                  },
                  {
                    title: 'أكثر صنف مباع',
                    dataIndex: 'mostSoldItem',
                    key: 'mostSoldItem',
                    minWidth: 200,
                    render: (text: string) => (
                      <span className="text-gray-600">{text || 'لا يوجد'}</span>
                    ),
                  },
                  {
                    title: 'كمية أكثر صنف مباع',
                    dataIndex: 'mostSoldItemQuantity',
                    key: 'mostSoldItemQuantity',
                    minWidth: 150,
                    sorter: (a: CategorySalesRecord, b: CategorySalesRecord) => (a.mostSoldItemQuantity || 0) - (b.mostSoldItemQuantity || 0),
                    render: (value: number) => (
                      <span className="text-green-700 font-semibold">
                        {(value || 0).toLocaleString()}
                      </span>
                    ),
                  },
                ]}
                rowKey="key"
                pagination={false}
                loading={isLoading}
                scroll={{ x: 1200 }}
                size="small"
                bordered
                className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-blue-800 [&_.ant-table-thead_>_tr_>_th]:border-blue-200 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
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
                  if (filteredCategories.length === 0) return null;
                  
                  return (
                    <Table.Summary fixed>
                      <Table.Summary.Row className=" font-bold">
                        <Table.Summary.Cell index={0} className=" text-gray-800 font-bold">
                          الإجماليات
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={1} className=" text-gray-800 font-bold">
                          {filteredCategories.length} فئة
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={2} className=" text-blue-700 font-bold">
                          {totalQuantity.toLocaleString()}
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={3} className=" text-emerald-700 font-bold">
                          {totalAmount.toLocaleString()} ر.س
                        </Table.Summary.Cell>
                        <Table.Summary.Cell index={4}></Table.Summary.Cell>
                        <Table.Summary.Cell index={5}></Table.Summary.Cell>
                      </Table.Summary.Row>
                    </Table.Summary>
                  );
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* رسالة عدم وجود بيانات */}
        {!isLoading && filteredCategories.length === 0 && (
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
                  <h4 className="text-md font-medium text-gray-700 mb-2 text-center">إجمالي الكمية المباعة لكل فئة</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.slice(0, 8)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="categoryName" 
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
                  <h4 className="text-md font-medium text-gray-700 mb-2 text-center">توزيع المبيعات حسب الفئة</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData.slice(0, 6)}
                        dataKey="totalAmount"
                        nameKey="categoryName"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label={(entry) => `${entry.categoryName}: ${entry.totalAmount.toFixed(0)}`}
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


      </div>
    </>
  );
};

export default SoldItemsByCategory;

import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message } from "antd";
import { WhatsAppOutlined, PrinterOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { Select as AntdSelect } from 'antd';

interface DeliveryOrder {
  id: string;
  fullInvoiceNumber: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  districtName: string;
  regionName: string;
  governorateName: string;
  driverName?: string;
  driverId?: string;
  warehouseId: string;
  warehouseName: string;
  warehouseKeeper: string;
  status: string;
  deliveryDate: string;
  fileUrl?: string;
  requiresInstallation: boolean;
  notes?: string;
  createdAt: string;
}

interface WarehouseData {
  id: string;
  name: string;
  keeper: string;
  phone: string;
  mobile?: string;
  ordersCount: number;
  orders: DeliveryOrder[];
}

const WarehouseNotifications: React.FC = () => {
  const navigate = useNavigate();
  
  // حالات البيانات
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(false);

  // بيانات الشركة
  const [companyData, setCompanyData] = useState<{
    arabicName?: string;
    englishName?: string;
    companyType?: string;
    commercialRegistration?: string;
    taxFile?: string;
    city?: string;
    region?: string;
    street?: string;
    district?: string;
    buildingNumber?: string;
    postalCode?: string;
    phone?: string;
    mobile?: string;
    logoUrl?: string;
  }>({});

  // السنة المالية
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

  // جلب بيانات الشركة
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        if (!companiesSnapshot.empty) {
          const companyDoc = companiesSnapshot.docs[0];
          setCompanyData(companyDoc.data());
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
      }
    };
    fetchCompanyData();
  }, []);

  // جلب البيانات
  const fetchWarehouseData = async () => {
    try {
      setLoading(true);
      
      // جلب طلبات التوصيل
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeliveryOrder[];
      
      // جلب بيانات المستودعات من delivery_warehouses
      const warehousesSnapshot = await getDocs(collection(db, 'delivery_warehouses'));
      const warehousesData = warehousesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        keeper: doc.data().keeper || 'غير محدد',
        phone: doc.data().phone || '',
        mobile: doc.data().phone || '',
        ...doc.data()
      }));
      
      // تجميع الطلبات حسب المستودع
      const warehouseMap = new Map<string, WarehouseData>();
      
      orders.forEach(order => {
        const warehouseId = order.warehouseId || 'unknown';
        const warehouseInfo = warehousesData.find(w => w.id === warehouseId);
        
        if (!warehouseMap.has(warehouseId)) {
          warehouseMap.set(warehouseId, {
            id: warehouseId,
            name: warehouseInfo?.name || order.warehouseName || 'مستودع غير محدد',
            keeper: warehouseInfo?.keeper || order.warehouseKeeper || 'غير محدد',
            phone: warehouseInfo?.phone || warehouseInfo?.mobile || '',
            mobile: warehouseInfo?.mobile || warehouseInfo?.phone || '',
            ordersCount: 0,
            orders: []
          });
        }
        
        const warehouse = warehouseMap.get(warehouseId)!;
        warehouse.orders.push(order);
        warehouse.ordersCount = warehouse.orders.length;
      });
      
      setWarehouses(Array.from(warehouseMap.values()));
      
      if (warehouseMap.size === 0) {
        message.info('لا توجد طلبات في المستودعات');
      }
    } catch (error) {
      console.error('Error fetching warehouse data:', error);
      message.error('حدث خطأ في تحميل بيانات المستودعات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouseData();
  }, []);

  // إرسال واتساب
  const handleSendWhatsApp = (warehouse: WarehouseData) => {
    if (!warehouse.phone && !warehouse.mobile) {
      message.error(`المستودع ${warehouse.name} ليس له رقم هاتف`);
      return;
    }

    // الحصول على رابط الموقع
    const currentBaseUrl = window.location.origin;
    
    // إنشاء الرسالة
    let whatsappMessage = `السلام عليكم ${warehouse.keeper}\n\n`;
    whatsappMessage += `لديك ${warehouse.ordersCount} طلب جديد في مستودع ${warehouse.name} قيد التنفيذ.\n\n`;
    whatsappMessage += `يمكنك طباعة الطلبات من الرابط التالي:\n`;
    whatsappMessage += `${currentBaseUrl}/warehouse-print/${warehouse.id}\n\n`;
    whatsappMessage += `تفاصيل الطلبات:\n`;
    
    warehouse.orders.forEach((order, index) => {
      whatsappMessage += `\n${index + 1}. رقم الفاتورة: ${order.fullInvoiceNumber}\n`;
      whatsappMessage += `   العميل: ${order.customerName || 'غير محدد'}\n`;
      whatsappMessage += `   الهاتف: ${order.customerPhone}\n`;
      whatsappMessage += `   المنطقة: ${order.districtName || 'غير محدد'}\n`;
      if (order.requiresInstallation) {
        whatsappMessage += `   ⚙️ يتطلب تركيب\n`;
      }
    });

    // تنظيف رقم الهاتف
    const phone = warehouse.mobile || warehouse.phone;
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const phoneWithCode = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`;
    
    // فتح واتساب
    const whatsappUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
    message.success('تم فتح واتساب');
  };

  // تنزيل الملفات المرفقة
  const handleDownloadFiles = async (warehouse: WarehouseData) => {
    try {
      // تصفية الطلبات التي تحتوي على ملفات
      const ordersWithFiles = warehouse.orders.filter(order => order.fileUrl);
      
      if (ordersWithFiles.length === 0) {
        message.warning(`لا توجد ملفات مرفقة في طلبات مستودع ${warehouse.name}`);
        return;
      }

      message.loading({ content: `جاري تنزيل ${ordersWithFiles.length} ملف...`, key: 'download', duration: 0 });

      let successCount = 0;
      let failCount = 0;

      // تنزيل كل ملف
      for (const order of ordersWithFiles) {
        if (order.fileUrl) {
          try {
            // فتح الملف في نافذة جديدة للتنزيل (حل لمشكلة CORS)
            // المتصفح سيتعامل مع التنزيل تلقائياً
            const link = document.createElement('a');
            link.href = order.fileUrl;
            
            // استخراج اسم الملف من URL أو استخدام رقم الفاتورة
            const urlParts = order.fileUrl.split('/');
            const fileName = decodeURIComponent(
              urlParts[urlParts.length - 1].split('?')[0]
            ).replace(/^.*%2F/, '') || `${order.fullInvoiceNumber || 'file'}`;
            
            link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            successCount++;
            
            // تأخير بسيط بين التنزيلات لتجنب حظر المتصفح
            await new Promise(resolve => setTimeout(resolve, 800));
          } catch (error) {
            console.error(`Error downloading file for order ${order.fullInvoiceNumber}:`, error);
            failCount++;
          }
        }
      }

      if (successCount > 0) {
        message.success({ 
          content: `تم فتح ${successCount} ملف للتنزيل${failCount > 0 ? ` (فشل ${failCount})` : ''}`, 
          key: 'download' 
        });
      } else {
        message.error({ content: 'فشل تنزيل جميع الملفات', key: 'download' });
      }
    } catch (error) {
      console.error('Error downloading files:', error);
      message.error({ content: 'حدث خطأ أثناء تنزيل الملفات', key: 'download' });
    }
  };

  // طباعة طلبات المستودع
  const handlePrint = (warehouse: WarehouseData) => {
    const printWindow = window.open('', '', 'width=1200,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>طلبات مستودع ${warehouse.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { 
            font-family: 'Tajawal', sans-serif; 
            padding: 15px; 
            color: #000;
            font-size: 11px;
            line-height: 1.4;
            margin: 0;
          }
          .company-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #8b5cf6;
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
            font-size: 10px;
            font-weight: 500;
            line-height: 1.4;
          }
          .company-info-en {
            text-align: left;
            font-family: Arial, sans-serif;
            direction: ltr;
            font-size: 9px;
            font-weight: 500;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #8b5cf6;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #8b5cf6;
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 700;
          }
          .header p {
            margin: 0;
            color: #6b7280;
            font-size: 13px;
          }
          .warehouse-info {
            background: #f3f4f6;
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
          }
          .warehouse-info div {
            margin: 3px 10px;
            font-size: 13px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            font-size: 10px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 8px 4px; 
            text-align: center;
            vertical-align: middle;
          }
          th { 
            background-color: #8b5cf6;
            color: #fff;
            font-weight: 600;
            font-size: 11px;
          }
          tbody tr:nth-child(even) {
            background-color: #f9fafb;
          }
          tbody tr:hover {
            background-color: #ede9fe;
          }
          .installation-badge {
            background: #10b981;
            color: white;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
          }
          .status-pending { color: #f59e0b; font-weight: bold; }
          .status-delivered { color: #10b981; font-weight: bold; }
          .status-cancelled { color: #ef4444; font-weight: bold; }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 10px;
          }
          @media print {
            body { padding: 10px; }
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
          <h1>
            <svg style="display: inline-block; vertical-align: middle; width: 28px; height: 28px; margin-left: 8px;" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            طلبات التوصيل - مستودع ${warehouse.name}
          </h1>
          <p>نظام إدارة الموارد ERP90</p>
        </div>
        
        <div class="warehouse-info">
          <div><strong>أمين المستودع:</strong> ${warehouse.keeper}</div>
          <div><strong>رقم الهاتف:</strong> ${warehouse.phone || warehouse.mobile || 'غير متوفر'}</div>
          <div><strong>عدد الطلبات:</strong> ${warehouse.ordersCount} طلب</div>
          <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">م</th>
              <th style="width: 90px;">رقم الفاتورة</th>
              <th style="width: 120px;">اسم العميل</th>
              <th style="width: 85px;">هاتف العميل</th>
              <th style="width: 80px;">السائق</th>
              <th style="width: 70px;">الحي</th>
              <th style="width: 100px;">الملاحظات</th>
              <th style="width: 50px;">التركيب</th>
              <th style="width: 70px;">حالة الفرع</th>
              <th style="width: 80px;">حالة التوصيل</th>
              <th style="width: 80px;">تاريخ التسليم</th>
              <th style="width: 80px;">وقت الإنشاء</th>
            </tr>
          </thead>
          <tbody>
            ${warehouse.orders.map((order, index) => {
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
                if (status === 'تم التوصيل') return 'status-delivered';
                if (status === 'ملغي') return 'status-cancelled';
                return 'status-pending';
              };
              
              return `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${order.fullInvoiceNumber}</strong></td>
                <td>${order.customerName || '-'}</td>
                <td>${order.customerPhone || '-'}</td>
                <td>${order.driverName || 'غير محدد'}</td>
                <td>${order.districtName || '-'}</td>
                <td style="font-size: 9px; text-align: right; padding-right: 6px;">${order.notes || '-'}</td>
                <td>${order.requiresInstallation ? '<span class="installation-badge">نعم <svg style="display: inline-block; vertical-align: middle; width: 12px; height: 12px; margin-right: 2px;" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg></span>' : 'لا'}</td>
                <td>${order.branchName || '-'}</td>
                <td class="${getStatusClass(order.status)}">${order.status || 'قيد الانتظار'}</td>
                <td>${formatDate(order.deliveryDate)}</td>
                <td>${formatDateTime(order.createdAt)}</td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p><strong>نظام ERP90 - إدارة الموارد</strong> | تم الطباعة بواسطة: ${warehouse.keeper}</p>
          <p style="margin-top: 5px; font-size: 10px;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}</p>
        </div>
        
        <!-- Signature Section -->
        <div style="
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0 20px;
          page-break-inside: avoid;
        ">
          <div style="flex: 1; text-align: right; font-size: 12px; font-weight: 500;">
            <div style="margin-bottom: 6px;">أمين المستودع: ___________________</div>
            <div>التوقيع: ___________________</div>
          </div>
          <div style="flex: 1; text-align: center; position: relative;">
            <div style="
              margin-top: 10px;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 160px;
              height: 60px;
              border: 3px dashed #8b5cf6;
              border-radius: 50%;
              box-shadow: 0 3px 10px 0 rgba(139,92,246,0.15);
              opacity: 0.9;
              background: repeating-linear-gradient(135deg, #f3f4f6 0 10px, #fff 10px 20px);
              font-family: 'Tajawal', Arial, sans-serif;
              font-size: 14px;
              font-weight: bold;
              color: #8b5cf6;
              letter-spacing: 1px;
              text-align: center;
              margin-left: auto;
              margin-right: auto;
              z-index: 2;
            ">
              <div style="width: 100%;">
                <div style="font-size: 16px; font-weight: 700; line-height: 1.2;">${companyData.arabicName || 'الشركة'}</div>
                <div style="font-size: 12px; font-weight: 500; margin-top: 4px; line-height: 1.1;">${companyData.phone ? 'هاتف: ' + companyData.phone : ''}</div>
              </div>
            </div>
          </div>
          <div style="flex: 1; text-align: left; font-size: 12px; font-weight: 500;">
            <div style="margin-bottom: 6px;">مدير المستودعات: ___________________</div>
            <div>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // أعمدة الجدول
  const columns = [
    {
      title: 'المستودع',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (text: string) => (
        <span className="font-semibold text-purple-700">{text}</span>
      ),
    },
    {
      title: 'أمين المستودع',
      dataIndex: 'keeper',
      key: 'keeper',
      width: 150,
    },
    {
      title: 'رقم الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (text: string, record: WarehouseData) => record.mobile || record.phone || 'غير متوفر',
    },
    {
      title: 'عدد الطلبات',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      width: 120,
      render: (count: number) => (
        <span className="font-bold text-lg text-blue-600">{count}</span>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: WarehouseData) => (
        <div className="flex gap-2 justify-center flex-wrap">
          <Button
            type="primary"
            icon={<WhatsAppOutlined />}
            onClick={() => handleSendWhatsApp(record)}
            className="bg-green-600 hover:bg-green-700"
            size="middle"
          >
            واتساب
          </Button>
          <Button
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
            size="middle"
          >
            طباعة
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadFiles(record)}
            size="middle"
            type="default"
            className="bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-300"
          >
            تنزيل الملفات
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      <Helmet>
        <title>إشعارات المستودعات | ERP90 Dashboard</title>
        <meta name="description" content="إشعارات وإدارة طلبات المستودعات" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <svg className="w-8 h-8 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إشعارات المستودعات</h1>
              <p className="text-gray-600 dark:text-gray-400">
                إدارة وإرسال إشعارات طلبات التوصيل للمستودعات
                {warehouses.length > 0 && <span className="font-semibold text-purple-600"> ({warehouses.length} مستودع)</span>}
              </p>
            </div>
          </div>
          
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
                styles={{
                  popup: {
                    root: {
                      textAlign: 'right',
                      fontSize: 16
                    }
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "طلبات التوصيل", to: "/management/orders" },
          { label: "إشعارات المستودعات" }
        ]}
      />

      {/* الجدول */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-700">
            المستودعات ({warehouses.length})
          </h3>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchWarehouseData}
            loading={loading}
          >
            تحديث
          </Button>
        </div>
        
        <Table
          columns={columns}
          dataSource={warehouses}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} مستودع`,
          }}
          locale={{
            emptyText: 'لا توجد مستودعات',
          }}
        />
      </motion.div>
    </div>
  );
};

export default WarehouseNotifications;

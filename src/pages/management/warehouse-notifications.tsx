import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message, DatePicker } from "antd";
import { WhatsAppOutlined, PrinterOutlined, ReloadOutlined, DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { Select as AntdSelect } from 'antd';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import dayjs from 'dayjs';

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
  const [filteredWarehouses, setFilteredWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(false);
  
  // حالات التصفية
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('قيد الانتظار'); // الحالة الافتراضية
  const [allWarehousesList, setAllWarehousesList] = useState<{id: string; name: string}[]>([]);

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
      const allOrders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeliveryOrder[];
      
      // تصفية الطلبات قيد الانتظار فقط
      const orders = allOrders.filter(order => 
        order.status === 'قيد الانتظار' || !order.status
      );
      
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
      
      // حفظ قائمة المستودعات للتصفية
      setAllWarehousesList(warehousesData.map(w => ({ id: w.id, name: w.name })));
      
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
      
      const warehousesArray = Array.from(warehouseMap.values());
      setWarehouses(warehousesArray);
      setFilteredWarehouses(warehousesArray);
      
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

  // تطبيق التصفية
  useEffect(() => {
    let filtered = [...warehouses];

    // تصفية حسب المستودع
    if (selectedWarehouseId) {
      filtered = filtered.filter(w => w.id === selectedWarehouseId);
    }

    // تصفية حسب تاريخ التسليم
    if (selectedDeliveryDate) {
      const dateStr = selectedDeliveryDate.format('YYYY-MM-DD');
      filtered = filtered.map(warehouse => {
        const filteredOrders = warehouse.orders.filter(order => order.deliveryDate === dateStr);
        return {
          ...warehouse,
          orders: filteredOrders,
          ordersCount: filteredOrders.length
        };
      }).filter(w => w.ordersCount > 0);
    }

    // تصفية حسب الحالة
    if (selectedStatus) {
      filtered = filtered.map(warehouse => {
        const filteredOrders = warehouse.orders.filter(order => {
          const orderStatus = order.status || 'قيد الانتظار';
          return orderStatus === selectedStatus;
        });
        return {
          ...warehouse,
          orders: filteredOrders,
          ordersCount: filteredOrders.length
        };
      }).filter(w => w.ordersCount > 0);
    }

    setFilteredWarehouses(filtered);
  }, [selectedWarehouseId, selectedDeliveryDate, selectedStatus, warehouses]);

  // إعادة تعيين التصفية
  const handleResetFilters = () => {
    setSelectedWarehouseId('');
    setSelectedDeliveryDate(null);
    setSelectedStatus('قيد الانتظار'); // إعادة للحالة الافتراضية
    setFilteredWarehouses(warehouses);
    message.success('تم إعادة تعيين التصفية');
  };

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
        whatsappMessage += ` يتطلب تركيب\n`;
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

  // عرض جميع الملفات في صفحة واحدة
  const handleDownloadFiles = async (warehouse: WarehouseData) => {
    try {
      // تصفية الطلبات التي تحتوي على ملفات
      const ordersWithFiles = warehouse.orders.filter(order => order.fileUrl);
      
      if (ordersWithFiles.length === 0) {
        message.warning(`لا توجد ملفات مرفقة في طلبات مستودع ${warehouse.name}`);
        return;
      }

      message.loading({ content: `جاري فتح ${ordersWithFiles.length} ملف...`, key: 'download', duration: 0 });

      // فتح نافذة جديدة تحتوي على جميع الملفات
      const printWindow = window.open('', '', 'width=1400,height=900');
      if (!printWindow) {
        message.error({ content: 'فشل فتح النافذة. يرجى السماح بالنوافذ المنبثقة', key: 'download' });
        return;
      }

      // إنشاء HTML يحتوي على جميع ملفات PDF
      const pdfsHtml = ordersWithFiles.map((order, index) => `
        <div class="pdf-container" style="page-break-after: always; margin-bottom: 20px;">
          <div class="pdf-header">
            <h3>ملف رقم ${index + 1} - فاتورة: ${order.fullInvoiceNumber} - ${order.customerName || 'غير محدد'}</h3>
          </div>
          <embed 
            src="${order.fileUrl}" 
            type="application/pdf" 
            width="100%" 
            height="1100px"
            style="border: 2px solid #8b5cf6; border-radius: 8px;"
          />
        </div>
      `).join('');

      printWindow.document.write(`
        <html dir="rtl">
        <head>
          <title>ملفات مستودع ${warehouse.name} - ${ordersWithFiles.length} ملف</title>
          <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
          <style>
            @page { 
              size: A4; 
              margin: 10mm;
            }
            body { 
              font-family: 'Tajawal', sans-serif; 
              padding: 20px;
              margin: 0;
              background: #f3f4f6;
            }
            .header {
              background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);
              color: white;
              padding: 20px;
              border-radius: 12px;
              margin-bottom: 20px;
              text-align: center;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header h1 {
              margin: 0 0 10px 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header p {
              margin: 5px 0;
              font-size: 16px;
              opacity: 0.95;
            }
            .pdf-container {
              background: white;
              padding: 20px;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .pdf-header {
              background: #f9fafb;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 15px;
              border-right: 4px solid #8b5cf6;
            }
            .pdf-header h3 {
              margin: 0;
              color: #1f2937;
              font-size: 18px;
              font-weight: 600;
            }
            .controls {
              position: fixed;
              top: 20px;
              left: 20px;
              background: white;
              padding: 15px;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
              z-index: 1000;
            }
            .btn {
              background: #8b5cf6;
              color: white;
              border: none;
              padding: 10px 20px;
              border-radius: 8px;
              cursor: pointer;
              font-family: 'Tajawal', sans-serif;
              font-size: 14px;
              font-weight: 600;
              margin: 5px;
              transition: all 0.3s;
            }
            .btn:hover {
              background: #7c3aed;
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(139, 92, 246, 0.3);
            }
            .btn-print {
              background: #10b981;
            }
            .btn-print:hover {
              background: #059669;
            }
            @media print {
              .controls { display: none; }
              .header { 
                background: #8b5cf6 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              body { background: white; }
              .pdf-container {
                box-shadow: none;
                page-break-after: always;
              }
            }
          </style>
        </head>
        <body>
          <div class="controls">
            <button class="btn btn-print" onclick="window.print()">
              🖨️ طباعة الكل
            </button>
            <button class="btn" onclick="window.close()">
              ✖️ إغلاق
            </button>
          </div>
          
          <div class="header">
            <h1>📦 ملفات مستودع ${warehouse.name}</h1>
            <p><strong>أمين المستودع:</strong> ${warehouse.keeper}</p>
            <p><strong>عدد الملفات:</strong> ${ordersWithFiles.length} ملف</p>
            <p><strong>التاريخ:</strong> ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          
          ${pdfsHtml}
          
          <div style="text-align: center; padding: 30px; color: #6b7280; font-size: 14px;">
            <p><strong>نظام ERP90 - إدارة الموارد</strong></p>
            <p>تم إنشاء هذا المستند بواسطة: ${warehouse.keeper}</p>
          </div>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      message.success({ 
        content: `تم فتح ${ordersWithFiles.length} ملف في نافذة واحدة`, 
        key: 'download' 
      });
      
    } catch (error) {
      console.error('Error opening files:', error);
      message.error({ content: 'حدث خطأ أثناء فتح الملفات', key: 'download' });
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
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #000;
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
            background-color: #bbbbbc;
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
          <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
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
                  return date.toLocaleDateString('en-GB');
                } catch {
                  return dateStr;
                }
              };
              
              const formatDateTime = (dateStr) => {
                if (!dateStr) return '-';
                try {
                  const date = new Date(dateStr);
                  return date.toLocaleString('en-GB', { 
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
          <p style="margin-top: 5px; font-size: 10px;">تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}</p>
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
          { label: "إدارة التوصيلات", to: "/management/outputs" },
          { label: "طلبات التوصيل", to: "/management/delivery-orders" },
          { label: "إشعارات المستودعات" }
        ]}
      />

      {/* قسم التصفية */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-4"
      >
        <div className="flex items-center gap-3 mb-4">
          <FilterOutlined className="text-purple-600 text-xl" />
          <h3 className="text-lg font-semibold text-gray-700">تصفية البيانات</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* تصفية المستودع */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-700">المستودع</label>
            <AntdSelect
              value={selectedWarehouseId || undefined}
              onChange={setSelectedWarehouseId}
              placeholder="جميع المستودعات"
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
              style={{ 
                width: '100%', 
                height: 42,
                borderRadius: 8,
              }}
              size="large"
            >
              {allWarehousesList.map(warehouse => (
                <AntdSelect.Option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </AntdSelect.Option>
              ))}
            </AntdSelect>
          </div>

          {/* تصفية تاريخ التسليم */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-700">تاريخ التسليم</label>
            <DatePicker
              value={selectedDeliveryDate}
              onChange={setSelectedDeliveryDate}
              placeholder="جميع التواريخ"
              format="YYYY-MM-DD"
              locale={arEG}
              allowClear
              style={{ 
                width: '100%', 
                height: 42,
                borderRadius: 8,
              }}
              size="large"
            />
          </div>

          {/* تصفية الحالة */}
          <div className="flex flex-col">
            <label className="mb-2 text-sm font-medium text-gray-700">حالة الطلب</label>
            <AntdSelect
              value={selectedStatus || undefined}
              onChange={setSelectedStatus}
              placeholder="اختر الحالة"
              allowClear
              style={{ 
                width: '100%', 
                height: 42,
                borderRadius: 8,
              }}
              size="large"
            >
              <AntdSelect.Option value="قيد الانتظار"> قيد الانتظار</AntdSelect.Option>
              <AntdSelect.Option value="مكتمل">مكتمل</AntdSelect.Option>
              <AntdSelect.Option value="مؤرشف"> مؤرشف</AntdSelect.Option>
            </AntdSelect>
          </div>
        </div>

        {/* زر إعادة التعيين */}
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleResetFilters}
            icon={<ReloadOutlined />}
            disabled={!selectedWarehouseId && !selectedDeliveryDate && selectedStatus === 'قيد الانتظار'}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300"
            size="large"
          >
            إعادة تعيين الفلاتر
          </Button>
        </div>

        {/* عرض نتائج التصفية */}
        {(selectedWarehouseId || selectedDeliveryDate || selectedStatus) && (
          <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-semibold text-purple-700">التصفية النشطة:</span>
              {selectedWarehouseId && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                  المستودع: {allWarehousesList.find(w => w.id === selectedWarehouseId)?.name}
                </span>
              )}
              {selectedDeliveryDate && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                  التاريخ: {selectedDeliveryDate.format('YYYY-MM-DD')}
                </span>
              )}
              {selectedStatus && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                  الحالة: {selectedStatus === 'قيد الانتظار' ? '⏳' : selectedStatus === 'مكتمل' ? '✅' : '📦'} {selectedStatus}
                </span>
              )}
              <span className="mr-auto font-semibold text-purple-700">
                النتائج: {filteredWarehouses.length} مستودع - {filteredWarehouses.reduce((sum, w) => sum + w.ordersCount, 0)} طلب
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* الجدول */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-700">
            المستودعات ({filteredWarehouses.length})
            {filteredWarehouses.length > 0 && (
              <span className="text-sm text-gray-500 mr-2">
                - إجمالي الطلبات: {filteredWarehouses.reduce((sum, w) => sum + w.ordersCount, 0)}
              </span>
            )}
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
          dataSource={filteredWarehouses}
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

import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message } from "antd";
import { WhatsAppOutlined, PrinterOutlined, ReloadOutlined } from '@ant-design/icons';
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
      
      // جلب بيانات المستودعات
      const warehousesSnapshot = await getDocs(collection(db, 'warehouses'));
      const warehousesData = warehousesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().nameAr || '',
        keeper: doc.data().keeper || doc.data().warehouseKeeper || 'غير محدد',
        phone: doc.data().phone || doc.data().mobile || '',
        mobile: doc.data().mobile || doc.data().phone || '',
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
        whatsappMessage += `   🔧 يتطلب تركيب\n`;
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

  // طباعة طلبات المستودع
  const handlePrint = (warehouse: WarehouseData) => {
    const printWindow = window.open('', '', 'width=900,height=1200');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
      <head>
        <title>طلبات مستودع ${warehouse.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 15mm; }
          body { 
            font-family: 'Tajawal', sans-serif; 
            padding: 20px; 
            color: #000;
            font-size: 14px;
            line-height: 1.5;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #8b5cf6;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #8b5cf6;
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .warehouse-info {
            background: #f3f4f6;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .warehouse-info div {
            margin: 5px 0;
            font-size: 16px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 12px 8px; 
            text-align: center;
          }
          th { 
            background-color: #8b5cf6;
            color: #fff;
            font-weight: 600;
            font-size: 15px;
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
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #6b7280;
          }
          @media print {
            body { padding: 10px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📦 طلبات التوصيل - ${warehouse.name}</h1>
        </div>
        
        <div class="warehouse-info">
          <div><strong>أمين المستودع:</strong> ${warehouse.keeper}</div>
          <div><strong>رقم الهاتف:</strong> ${warehouse.phone || warehouse.mobile || 'غير متوفر'}</div>
          <div><strong>عدد الطلبات:</strong> ${warehouse.ordersCount} طلب</div>
          <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>م</th>
              <th>رقم الفاتورة</th>
              <th>اسم العميل</th>
              <th>رقم الهاتف</th>
              <th>المنطقة</th>
              <th>الحي</th>
              <th>التركيب</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${warehouse.orders.map((order, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${order.fullInvoiceNumber}</strong></td>
                <td>${order.customerName || 'غير محدد'}</td>
                <td>${order.customerPhone}</td>
                <td>${order.regionName || '-'}</td>
                <td>${order.districtName || '-'}</td>
                <td>${order.requiresInstallation ? '<span class="installation-badge">نعم 🔧</span>' : 'لا'}</td>
                <td>${order.status || 'قيد الانتظار'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p>تم الطباعة من نظام ERP90 - إدارة الموارد</p>
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
      width: 200,
      render: (_: unknown, record: WarehouseData) => (
        <div className="flex gap-2 justify-center">
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

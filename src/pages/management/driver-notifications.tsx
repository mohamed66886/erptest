import React, { useState, useEffect } from 'react';
import { Table, Button, Select, message } from 'antd';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Breadcrumb from '../../components/Breadcrumb';
import { useFinancialYear } from '../../hooks/useFinancialYear';
import { WhatsAppOutlined, PrinterOutlined } from '@ant-design/icons';

const { Option } = Select;

// واجهة طلب التوصيل
interface DeliveryOrder {
  id: string;
  fullInvoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  districtName?: string;
  regionName?: string;
  governorateName?: string;
  driverId: string;
  driverName: string;
  deliveryDate?: string;
  status: string;
  branchBalance?: number;
  requiresInstallation?: boolean;
  notes?: string;
  createdAt?: string | { seconds: number; nanoseconds: number };
}

// واجهة بيانات السائق
interface DriverData {
  id: string;
  name: string;
  phone: string;
  mobile: string;
  driverPhone?: string;
  driverMobile?: string;
  ordersCount: number;
  orders: DeliveryOrder[];
}

const DriverNotifications: React.FC = () => {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { currentFinancialYear, activeYears } = useFinancialYear();
  const fiscalYear = currentFinancialYear?.year?.toString() || new Date().getFullYear().toString();

  // جلب بيانات السائقين وطلباتهم
  const fetchDriverData = async () => {
    setLoading(true);
    try {
      // جلب طلبات التوصيل للسنة المالية المحددة
      const deliveryOrdersRef = collection(db, 'delivery_orders');
      const ordersQuery = query(
        deliveryOrdersRef,
        where('fiscalYear', '==', fiscalYear)
      );
      const ordersSnapshot = await getDocs(ordersQuery);

      // جلب بيانات السائقين
      const driversRef = collection(db, 'drivers');
      const driversSnapshot = await getDocs(driversRef);

      // تحويل بيانات السائقين إلى خريطة
      const driversMap = new Map<string, {
        id: string;
        name: string;
        phone: string;
        mobile: string;
        driverPhone: string;
        driverMobile: string;
      }>();
      driversSnapshot.docs.forEach(doc => {
        const data = doc.data();
        driversMap.set(doc.id, {
          id: doc.id,
          name: data.nameAr || data.name || 'غير محدد',
          phone: data.phone || data.phoneNumber || '',
          mobile: data.mobile || data.mobileNumber || '',
          driverPhone: data.driverPhone || data.phone || data.phoneNumber || '',
          driverMobile: data.driverMobile || data.mobile || data.mobileNumber || ''
        });
      });

      // تجميع الطلبات حسب السائق
      const driverOrdersMap = new Map<string, DeliveryOrder[]>();
      
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const driverId = data.driverId;
        
        if (driverId && driverId.trim() !== '') {
          const order: DeliveryOrder = {
            id: doc.id,
            fullInvoiceNumber: data.fullInvoiceNumber || data.invoiceNumber || '',
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || data.customerMobile || '',
            customerAddress: data.customerAddress || '',
            districtName: data.districtName || '',
            regionName: data.regionName || '',
            governorateName: data.governorateName || '',
            driverId: driverId,
            driverName: data.driverName || '',
            deliveryDate: data.deliveryDate || '',
            status: data.status || 'قيد الانتظار',
            branchBalance: data.branchBalance || 0,
            requiresInstallation: data.requiresInstallation || false,
            notes: data.notes || '',
            createdAt: data.createdAt
          };

          if (!driverOrdersMap.has(driverId)) {
            driverOrdersMap.set(driverId, []);
          }
          driverOrdersMap.get(driverId)!.push(order);
        }
      });

      // إنشاء مصفوفة بيانات السائقين
      const driversData: DriverData[] = [];
      driverOrdersMap.forEach((orders, driverId) => {
        const driverInfo = driversMap.get(driverId);
        if (driverInfo) {
          driversData.push({
            id: driverId,
            name: driverInfo.name,
            phone: driverInfo.driverPhone || driverInfo.driverMobile || driverInfo.phone || driverInfo.mobile || 'غير متوفر',
            mobile: driverInfo.mobile,
            driverPhone: driverInfo.driverPhone,
            driverMobile: driverInfo.driverMobile,
            ordersCount: orders.length,
            orders: orders
          });
        }
      });

      // ترتيب السائقين حسب عدد الطلبات (تنازلياً)
      driversData.sort((a, b) => b.ordersCount - a.ordersCount);

      setDrivers(driversData);
      message.success(`تم جلب بيانات ${driversData.length} سائق بنجاح`);
    } catch (error) {
      console.error('Error fetching driver data:', error);
      message.error('حدث خطأ أثناء جلب بيانات السائقين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fiscalYear) {
      fetchDriverData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fiscalYear]);

  // دالة إرسال واتساب للسائق
  const handleSendWhatsApp = (driver: DriverData) => {
    const phone = driver.driverPhone || driver.driverMobile || driver.phone || driver.mobile;
    
    if (!phone || phone === 'غير متوفر') {
      message.warning('رقم هاتف السائق غير متوفر');
      return;
    }

    // إنشاء رسالة واتساب
    let whatsappMessage = `السلام عليكم ${driver.name}\n\n`;
    whatsappMessage += `لديك ${driver.ordersCount} طلب توصيل جديد قيد التنفيذ:\n\n`;
    
    // طباعة الطلبات
    const printUrl = window.location.origin + '/management/driver-notifications/print/' + driver.id;
    whatsappMessage += `🖨️ رابط الطباعة: ${printUrl}\n\n`;
    
    whatsappMessage += `تفاصيل الطلبات:\n`;
    driver.orders.forEach((order, index) => {
      whatsappMessage += `\n${index + 1}. فاتورة رقم: ${order.fullInvoiceNumber}\n`;
      whatsappMessage += `   - العميل: ${order.customerName}\n`;
      whatsappMessage += `   - الهاتف: ${order.customerPhone}\n`;
      whatsappMessage += `   - العنوان: ${order.customerAddress || 'غير محدد'}\n`;
      whatsappMessage += `   - المنطقة: ${order.districtName || ''} ${order.regionName || ''}\n`;
      if (order.requiresInstallation) {
        whatsappMessage += `   - ⚠️ يتطلب تركيب\n`;
      }
      if (order.notes) {
        whatsappMessage += `   - ملاحظات: ${order.notes}\n`;
      }
    });

    whatsappMessage += `\n\nيرجى التواصل مع العملاء لتحديد مواعيد التوصيل.\n`;
    whatsappMessage += `شكراً لك 🙏`;

    // إزالة علامة + من رقم الهاتف إذا كانت موجودة
    const cleanPhone = phone.replace(/\+/g, '');
    
    // فتح واتساب
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
    window.open(whatsappUrl, '_blank');
  };

  // دالة الطباعة
  const handlePrint = (driver: DriverData) => {
    const printWindow = window.open('', '', 'width=900,height=700');
    if (!printWindow) {
      message.error('تعذر فتح نافذة الطباعة');
      return;
    }

    // إنشاء محتوى HTML للطباعة
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>طلبات التوصيل - ${driver.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Tajawal', sans-serif;
            padding: 20px;
            direction: rtl;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          .driver-info {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 10px;
            margin-bottom: 25px;
            border-right: 4px solid #667eea;
          }
          .driver-info h2 {
            font-size: 22px;
            color: #333;
            margin-bottom: 15px;
          }
          .driver-info p {
            font-size: 16px;
            color: #555;
            margin: 8px 0;
          }
          .driver-info strong {
            color: #667eea;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            text-align: center;
            font-weight: 700;
            font-size: 16px;
          }
          td {
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
            text-align: center;
            font-size: 14px;
          }
          tr:hover {
            background-color: #f5f5f5;
          }
          .installation-badge {
            background: #ffc107;
            color: #000;
            padding: 4px 12px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 600;
          }
          .notes {
            color: #666;
            font-size: 13px;
            font-style: italic;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #888;
            font-size: 14px;
            padding-top: 20px;
            border-top: 2px solid #e0e0e0;
          }
          @media print {
            body {
              padding: 10px;
            }
            .header {
              background: #667eea !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            th {
              background: #667eea !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚚 طلبات التوصيل</h1>
          <p style="font-size: 16px; margin-top: 10px;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>

        <div class="driver-info">
          <h2>معلومات السائق</h2>
          <p><strong>اسم السائق:</strong> ${driver.name}</p>
          <p><strong>رقم الهاتف:</strong> ${driver.phone}</p>
          <p><strong>عدد الطلبات:</strong> ${driver.ordersCount} طلب</p>
        </div>

        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>رقم الفاتورة</th>
              <th>اسم العميل</th>
              <th>رقم الهاتف</th>
              <th>العنوان</th>
              <th>المنطقة</th>
              <th>التركيب</th>
              <th>الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${driver.orders.map((order, index) => `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${order.fullInvoiceNumber}</strong></td>
                <td>${order.customerName}</td>
                <td>${order.customerPhone}</td>
                <td>${order.customerAddress || 'غير محدد'}</td>
                <td>${order.districtName || ''} ${order.regionName || ''}</td>
                <td>${order.requiresInstallation ? '<span class="installation-badge">يتطلب تركيب</span>' : '-'}</td>
                <td class="notes">${order.notes || '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>تم إنشاء هذا التقرير من نظام ERP90</p>
          <p>جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // أعمدة الجدول
  const columns = [
    {
      title: 'السائق',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a: DriverData, b: DriverData) => a.name.localeCompare(b.name, 'ar'),
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800">{text}</span>
        </div>
      ),
    },
    {
      title: 'رقم الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone: string, record: DriverData) => (
        <div className="flex flex-col items-center">
          <span className="font-medium text-gray-700">{phone}</span>
          <span className="text-xs text-gray-500">رقم السائق</span>
        </div>
      ),
    },
    {
      title: 'عدد الطلبات',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      width: 120,
      sorter: (a: DriverData, b: DriverData) => a.ordersCount - b.ordersCount,
      render: (count: number) => (
        <div className="flex items-center justify-center gap-2">
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold">
            {count}
          </div>
        </div>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 200,
      render: (_: unknown, record: DriverData) => (
        <div className="flex gap-2 justify-center">
          <Button
            type="primary"
            icon={<WhatsAppOutlined />}
            onClick={() => handleSendWhatsApp(record)}
            className="bg-green-500 hover:bg-green-600"
            size="middle"
          >
            واتساب
          </Button>
          <Button
            type="default"
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
    <>
      <Helmet>
        <title>إشعارات السائقين | ERP90 Dashboard</title>
        <meta name="description" content="إدارة إشعارات السائقين وطلبات التوصيل، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, سائقين, إشعارات, توصيل, واتساب, Drivers, Notifications, Delivery" />
      </Helmet>

      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        {/* Header */}
        <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <svg className="h-8 w-8 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إشعارات السائقين</h1>
                <p className="text-gray-600 dark:text-gray-400">إدارة ومتابعة طلبات التوصيل للسائقين</p>
              </div>
            </div>

            {/* السنة المالية */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <span className="flex items-center gap-2">
                <label className="text-base font-medium text-gray-700 dark:text-gray-300">السنة المالية:</label>
              </span>
              <div className="min-w-[160px]">
                <Select
                  value={fiscalYear}
                  disabled
                  style={{ 
                    width: 160, 
                    height: 40, 
                    fontSize: 16, 
                    borderRadius: 8, 
                    background: '#fff',
                    textAlign: 'right'
                  }}
                  size="middle"
                >
                  {activeYears && activeYears.map(y => (
                    <Option key={y.id} value={y.year.toString()}>{y.year}</Option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة المخرجات", to: "/management/outputs" },
            { label: "طلبات التوصيل", to: "/management/orders" },
            { label: "إشعارات السائقين" }
          ]}
        />

        {/* الجدول */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-4 rounded-lg shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              السائقين ({drivers.length})
            </h3>
            
            <Button
              type="primary"
              onClick={fetchDriverData}
              loading={loading}
              className="bg-purple-500 hover:bg-purple-600"
            >
              تحديث البيانات
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={drivers}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} من ${total} سائق`,
              showSizeChanger: false,
            }}
            locale={{
              emptyText: (
                <div className="py-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500 text-lg">لا توجد بيانات سائقين</p>
                </div>
              )
            }}
            className="[&_.ant-table-thead_>_tr_>_th]:bg-purple-100 [&_.ant-table-thead_>_tr_>_th]:text-purple-900 [&_.ant-table-thead_>_tr_>_th]:border-purple-200 [&_.ant-table-thead_>_tr_>_th]:font-bold [&_.ant-table-tbody_>_tr:hover_>_td]:bg-purple-50"
          />
        </motion.div>
      </div>
    </>
  );
};

export default DriverNotifications;

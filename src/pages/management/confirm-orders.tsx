import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message, Tag, Checkbox, Select, Input } from "antd";
import { WhatsAppOutlined, CheckCircleOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { useAuth } from "@/contexts/useAuth";
import dayjs from 'dayjs';
import { Select as AntdSelect } from 'antd';

const { Option } = Select;


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
  warehouseName: string;
  status: string;
  deliveryDate: string;
  fileUrl?: string;
  requiresInstallation: boolean;
  createdAt: string;
}

interface Driver {
  id: string;
  name?: string;
  nameAr?: string;
  phone?: string;
  mobile?: string;
}

const ConfirmOrders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // حالات البيانات
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("قيد الانتظار");
  const [searchText, setSearchText] = useState<string>("");
  const [filterDeliveryDate, setFilterDeliveryDate] = useState<string>("");
  const [sending, setSending] = useState(false);

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

  // جلب السائقين
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const driversSnapshot = await getDocs(collection(db, 'drivers'));
        const driversData = driversSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Driver[];
        setDrivers(driversData);
      } catch (error) {
        console.error('Error fetching drivers:', error);
      }
    };
    fetchDrivers();
  }, []);

  // جلب الطلبات
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // جلب جميع الطلبات بدون فلتر للتأكد من وجود البيانات
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeliveryOrder[];
      
      console.log('Fetched orders:', ordersData); // للتشخيص
      setOrders(ordersData);
      
      if (ordersData.length === 0) {
        message.info('لا توجد طلبات في النظام');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      message.error('حدث خطأ في تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // معالجة تحديد الطلبات
  const handleSelectOrder = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredOrders.map(order => order.id);
      setSelectedOrders(allIds);
    } else {
      setSelectedOrders([]);
    }
  };

  // تصفية الطلبات
  const filteredOrders = orders.filter(order => {
    let matches = true;
    
    if (filterDriver && order.driverId !== filterDriver) {
      matches = false;
    }
    
    if (filterStatus && order.status !== filterStatus) {
      matches = false;
    }
    
    if (filterDeliveryDate) {
      const orderDate = dayjs(order.deliveryDate).format('YYYY-MM-DD');
      matches = matches && orderDate === filterDeliveryDate;
    }
    
    if (searchText) {
      const search = searchText.toLowerCase();
      matches = matches && (
        order.fullInvoiceNumber?.toLowerCase().includes(search) ||
        order.customerName?.toLowerCase().includes(search) ||
        order.customerPhone?.includes(search)
      );
    }
    
    return matches;
  });

  // إرسال عبر واتساب
  const handleSendWhatsApp = () => {
    if (selectedOrders.length === 0) {
      message.warning('يرجى تحديد طلب واحد على الأقل');
      return;
    }

    // الحصول على رابط الموقع الحالي
    const currentBaseUrl = window.location.origin;

    // تجميع الطلبات حسب السائق
    const ordersByDriver = new Map<string, DeliveryOrder[]>();
    
    selectedOrders.forEach(orderId => {
      const order = orders.find(o => o.id === orderId);
      if (order && order.driverId) {
        const driverOrders = ordersByDriver.get(order.driverId) || [];
        driverOrders.push(order);
        ordersByDriver.set(order.driverId, driverOrders);
      }
    });

    if (ordersByDriver.size === 0) {
      message.error('الطلبات المحددة ليس لها سائق مخصص');
      return;
    }

    // إرسال رسالة لكل سائق
    ordersByDriver.forEach((driverOrders, driverId) => {
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) return;

      const driverPhone = driver.mobile || driver.phone;
      if (!driverPhone) {
        message.error(`السائق ${driver.nameAr || driver.name} ليس له رقم هاتف`);
        return;
      }

      // إنشاء الرسالة
      let whatsappMessage = `أهلاً ${driver.nameAr || driver.name}\n\n`;
      whatsappMessage += `لديك ${driverOrders.length} طلب${driverOrders.length > 1 ? ' طلبات' : ''} للتوصيل\n`;
      
      driverOrders.forEach((order, index) => {
        whatsappMessage += `\nالطلب ${index + 1}:\n`;
        whatsappMessage += `رقم الفاتورة: ${order.fullInvoiceNumber}\n`;
        whatsappMessage += `اسم العميل: ${order.customerName || 'غير محدد'}\n`;
        whatsappMessage += `رقم العميل: ${order.customerPhone}\n`;
        whatsappMessage += `تاريخ التسليم: ${order.deliveryDate}\n`;
        whatsappMessage += `\n>> لعرض الطلب والملف المرفق:\n`;
        whatsappMessage += `${currentBaseUrl}/orders/view?id=${order.id}\n`;
        whatsappMessage += `\n** بعد التسليم واستلام توقيع العميل\n`;
        whatsappMessage += `يرجى الدخول على الرابط التالي لإتمام الطلب ورفع الملف الموقع:\n`;
        whatsappMessage += `${currentBaseUrl}/orders/complete?id=${order.id}\n`;
      });

      // تنظيف رقم الهاتف
      const cleanPhone = driverPhone.replace(/[^0-9]/g, '');
      const phoneWithCode = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`;
      
      // فتح واتساب
      const whatsappUrl = `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
    });

    message.success('تم فتح واتساب لإرسال الطلبات');
  };

  // أعمدة الجدول
  const columns = [
    {
      title: (
        <Checkbox
          checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
          indeterminate={selectedOrders.length > 0 && selectedOrders.length < filteredOrders.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'select',
      width: 50,
      render: (_text: unknown, record: DeliveryOrder) => (
        <Checkbox
          checked={selectedOrders.includes(record.id)}
          onChange={(e) => handleSelectOrder(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: 'رقم الفاتورة',
      dataIndex: 'fullInvoiceNumber',
      key: 'fullInvoiceNumber',
      width: 200,
      render: (text: string) => (
        <span className="font-semibold text-blue-600">{text}</span>
      ),
    },
    {
      title: 'اسم العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
    },
    {
      title: 'رقم الهاتف',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 120,
    },
    {
      title: 'الفرع',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
    },
    {
      title: 'المنطقة',
      dataIndex: 'regionName',
      key: 'regionName',
      width: 120,
    },
    {
      title: 'الحي',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
    },
    {
      title: 'السائق',
      dataIndex: 'driverName',
      key: 'driverName',
      width: 120,
      render: (text: string) => text || <span className="text-gray-400">غير محدد</span>,
    },
    {
      title: 'تاريخ التسليم',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        let color = 'orange';
        if (status === 'مكتمل') color = 'green';
        if (status === 'ملغي') color = 'red';
        return <Tag color={color}>{status}</Tag>;
      },
    },
  ];

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      <Helmet>
        <title>تأكيد طلبات التوصيل | ERP90 Dashboard</title>
        <meta name="description" content="تأكيد وإرسال طلبات التوصيل للسائقين عبر واتساب" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircleOutlined className="text-3xl text-green-600 dark:text-green-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">تأكيد طلبات التوصيل</h1>
              <p className="text-gray-600 dark:text-gray-400">
                اختر الطلبات وأرسلها للسائقين عبر واتساب 
                {orders.length > 0 && <span className="font-semibold text-blue-600"> ({orders.length} طلب)</span>}
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-200"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "تأكيد طلبات التوصيل" }
        ]}
      />

      {/* الفلاتر */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب السائق</label>
            <Select
              value={filterDriver || undefined}
              onChange={setFilterDriver}
              placeholder="جميع السائقين"
              allowClear
              style={{ width: '100%' }}
              size="large"
            >
              {drivers.map(driver => (
                <Option key={driver.id} value={driver.id}>
                  {driver.nameAr || driver.name}
                </Option>
              ))}
            </Select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب الحالة</label>
            <Select
              value={filterStatus}
              onChange={setFilterStatus}
              placeholder="قيد الانتظار"
              disabled
              style={{ width: '100%', cursor: 'not-allowed' }}
              size="large"
            >
              <Option value="قيد الانتظار">قيد الانتظار</Option>
              <Option value="مكتمل">مكتمل</Option>
              <Option value="ملغي">ملغي</Option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب تاريخ التسليم</label>
            <Input
              type="date"
              value={filterDeliveryDate}
              onChange={(e) => setFilterDeliveryDate(e.target.value)}
              placeholder="اختر تاريخ التسليم"
              size="large"
              allowClear
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">البحث</label>
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ابحث برقم الفاتورة أو الاسم أو الهاتف"
              prefix={<SearchOutlined />}
              size="large"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            <span className="font-semibold">{selectedOrders.length}</span> طلب محدد من <span className="font-semibold">{filteredOrders.length}</span>
          </div>
          
          <div className="flex gap-3">
            <Button
              icon={<ReloadOutlined />}
              size="large"
              onClick={fetchOrders}
              loading={loading}
              style={{ height: 48, fontSize: 18 }}
            >
              تحديث
            </Button>
            
            <Button
              type="primary"
              icon={<WhatsAppOutlined />}
              size="large"
              onClick={handleSendWhatsApp}
              disabled={selectedOrders.length === 0}
              className="bg-green-600 hover:bg-green-700"
              style={{ height: 48, fontSize: 18, minWidth: 150 }}
            >
              إرسال عبر واتساب
            </Button>
          </div>
        </div>
      </motion.div>

      {/* الجدول */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="w-full bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
      >
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} طلب`,
          }}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: 'لا توجد طلبات',
          }}
        />
      </motion.div>
    </div>
  );
};

export default ConfirmOrders;

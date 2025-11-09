import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message, Tag, Checkbox, Select, Input, Alert } from "antd";
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
  branchId: string;
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
  const [filterDeliveryDate, setFilterDeliveryDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [sending, setSending] = useState(false);
  const [multipleDriversSelected, setMultipleDriversSelected] = useState(false);

  // بيانات المستخدم الحالي من localStorage
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    fullName: string;
    position: string;
    branchId?: string;
    branchName?: string;
    warehouseId?: string;
    warehouseName?: string;
    permissions?: string[];
  } | null>(null);

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

  // تحميل بيانات المستخدم الحالي من localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        console.log('👤 Current User in Confirm Orders:', user);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }, []);

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
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const ordersData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as DeliveryOrder[];
      
      console.log('✅ Fetched all orders:', ordersData.length);
      console.log('👤 Current user position:', currentUser?.position);
      console.log('🏪 Current user branchId:', currentUser?.branchId);
      
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
  }, [currentUser?.position, currentUser?.branchId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // معالجة تحديد الطلبات
  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelectedOrders = checked 
      ? [...selectedOrders, orderId]
      : selectedOrders.filter(id => id !== orderId);
    
    setSelectedOrders(newSelectedOrders);
    checkMultipleDrivers(newSelectedOrders);
  };

  const handleSelectAll = (checked: boolean) => {
    const newSelectedOrders = checked ? filteredOrders.map(order => order.id) : [];
    setSelectedOrders(newSelectedOrders);
    checkMultipleDrivers(newSelectedOrders);
  };

  // التحقق من تعدد السائقين
  const checkMultipleDrivers = (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setMultipleDriversSelected(false);
      return;
    }

    const uniqueDrivers = new Set<string>();
    orderIds.forEach(orderId => {
      const order = orders.find(o => o.id === orderId);
      if (order && order.driverId) {
        uniqueDrivers.add(order.driverId);
      }
    });

    setMultipleDriversSelected(uniqueDrivers.size > 1);
  };

  // تصفية الطلبات
  const filteredOrders = orders.filter(order => {
    let matches = true;
    
    // فلترة حسب فرع المستخدم إذا كان مدير فرع
    if (currentUser?.position === 'مدير فرع' && currentUser?.branchId) {
      if (order.branchId !== currentUser.branchId) {
        return false;
      }
    }
    
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

    const currentBaseUrl = window.location.origin;
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

    // التحقق من أن جميع الطلبات لسائق واحد فقط
    if (ordersByDriver.size > 1) {
      message.error('يجب اختيار طلبات لسائق واحد فقط. لا يمكن إرسال طلبات لأكثر من سائق في نفس الوقت');
      return;
    }

    ordersByDriver.forEach((driverOrders, driverId) => {
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) return;

      const driverPhone = driver.mobile || driver.phone;
      if (!driverPhone) {
        message.error(`السائق ${driver.nameAr || driver.name} ليس له رقم هاتف`);
        return;
      }

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

      const cleanPhone = driverPhone.replace(/[^0-9]/g, '');
      const phoneWithCode = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.startsWith('0') ? cleanPhone.substring(1) : cleanPhone}`;
      
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
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => a.fullInvoiceNumber.localeCompare(b.fullInvoiceNumber),
      render: (text: string) => (
        <span className="font-semibold text-blue-600">{text}</span>
      ),
    },
    {
      title: 'رقم الهاتف',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.customerPhone || '').localeCompare(b.customerPhone || ''),
    },
    {
      title: 'السائق',
      dataIndex: 'driverName',
      key: 'driverName',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.driverName || '').localeCompare(b.driverName || ''),
      render: (text: string) => text || <span className="text-gray-400">غير محدد</span>,
    },
    {
      title: 'الحي',
      dataIndex: 'districtName',
      key: 'districtName',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.districtName || '').localeCompare(b.districtName || ''),
    },
    {
      title: 'اسم العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.customerName || '').localeCompare(b.customerName || ''),
    },
    {
      title: 'الفرع',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.branchName || '').localeCompare(b.branchName || ''),
    },
    {
      title: 'المنطقة',
      dataIndex: 'regionName',
      key: 'regionName',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.regionName || '').localeCompare(b.regionName || ''),
    },
    {
      title: 'تاريخ التسليم',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => dayjs(a.deliveryDate).unix() - dayjs(b.deliveryDate).unix(),
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      sorter: (a: DeliveryOrder, b: DeliveryOrder) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => {
        let color = 'orange';
        if (status === 'مكتمل') color = 'green';
        if (status === 'ملغي') color = 'red';
        return <Tag color={color}>{status}</Tag>;
      },
    },
  ];

  // ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة الطلبات
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
  const labelStyle: React.CSSProperties = { fontSize: 18, fontWeight: 500, marginBottom: 2, display: 'block' };

  return (
    <>
      <Helmet>
        <title>تأكيد طلبات التوصيل | ERP90 Dashboard</title>
        <meta name="description" content="تأكيد وإرسال طلبات التوصيل للسائقين عبر واتساب" />
      </Helmet>
      
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        
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
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-200"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <SearchOutlined className="text-green-600" /> خيارات البحث
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span style={labelStyle}>تصفية حسب السائق</span>
              <Select
                value={filterDriver || undefined}
                onChange={setFilterDriver}
                placeholder="جميع السائقين"
                allowClear
                style={largeControlStyle}
                size="large"
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {drivers.map(driver => (
                  <Option key={driver.id} value={driver.id}>
                    {driver.nameAr || driver.name}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>تصفية حسب الحالة</span>
              <Select
                value={filterStatus}
                onChange={setFilterStatus}
                placeholder="قيد الانتظار"
                style={largeControlStyle}
                size="large"
              >
                <Option value="قيد الانتظار">قيد الانتظار</Option>
                <Option value="مكتمل">مكتمل</Option>
                <Option value="ملغي">ملغي</Option>
              </Select>
            </div>

            <div className="flex flex-col">
              <span style={labelStyle}>تصفية حسب تاريخ التسليم</span>
              <Input
                type="date"
                value={filterDeliveryDate}
                onChange={(e) => setFilterDeliveryDate(e.target.value)}
                placeholder="اختر تاريخ التسليم"
                size="large"
                allowClear
                style={largeControlStyle}
              />
            </div>

            <div className="flex flex-col">
              <span style={labelStyle}>البحث</span>
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="ابحث برقم الفاتورة أو الاسم أو الهاتف"
                prefix={<SearchOutlined />}
                size="large"
                style={largeControlStyle}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={fetchOrders}
              loading={loading}
              className="bg-blue-500 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              style={{ height: 48, fontSize: 18 }}
            >
              {loading ? "جاري التحديث..." : "تحديث"}
            </Button>
            
            <Button
              type="primary"
              icon={<WhatsAppOutlined />}
              onClick={handleSendWhatsApp}
              disabled={selectedOrders.length === 0}
              className="bg-green-600 hover:bg-green-700"
              style={{ height: 48, fontSize: 18, minWidth: 180 }}
            >
              إرسال عبر واتساب ({selectedOrders.length})
            </Button>
            
            <span className="text-gray-500 text-sm flex-1">
              نتائج البحث: <span className="font-semibold">{filteredOrders.length}</span> طلب - 
              محدد: <span className="font-semibold text-green-600">{selectedOrders.length}</span>
            </span>
          </div>
        </motion.div>

        {/* الجدول */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 shadow-sm overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-200"></div>
          
          {/* تنبيه عند اختيار أكثر من سائق */}
          {multipleDriversSelected && (
            <div className="mb-4">
              <Alert
                message="تنبيه: تم اختيار طلبات لأكثر من سائق"
                description="لا يمكن إرسال طلبات لأكثر من سائق في نفس الوقت. يرجى اختيار طلبات لسائق واحد فقط."
                type="warning"
                showIcon
                closable
                onClose={() => setMultipleDriversSelected(false)}
                style={{ fontSize: 16 }}
              />
            </div>
          )}
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              نتائج البحث ({filteredOrders.length} طلب)
            </h3>
          </div>
          
          <Table
            columns={columns}
            dataSource={filteredOrders}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '30', '50', '100'],
              showTotal: (total) => `إجمالي ${total} طلب`,
            }}
            scroll={{ x: 1400 }}
            locale={{
              emptyText: 'لا توجد طلبات',
            }}
            className="custom-table-header"
            style={{
              '--header-bg': '#c0dbfe',
              '--header-color': '#1e40af',
            } as React.CSSProperties}
          />
          <style>{`
            .custom-table-header .ant-table-thead > tr > th {
              background-color: #c0dbfe !important;
              color: #1e40af !important;
              font-weight: 600 !important;
              font-size: 16px !important;
              border-bottom: 2px solid #93c5fd !important;
            }
            .custom-table-header .ant-table-thead > tr > th::before {
              display: none !important;
            }
            .custom-table-header .ant-table-column-sorter {
              color: #1e40af !important;
            }
            .custom-table-header .ant-table-column-sorter-up.active,
            .custom-table-header .ant-table-column-sorter-down.active {
              color: #1e3a8a !important;
            }
          `}</style>
        </motion.div>
      </div>
    </>
  );
};

export default ConfirmOrders;

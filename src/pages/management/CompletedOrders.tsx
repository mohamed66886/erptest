import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message, Tag, Checkbox, Select, Input, Modal } from "antd";
import { SearchOutlined, ReloadOutlined, InboxOutlined, DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { useAuth } from "@/contexts/useAuth";
import dayjs from 'dayjs';
import { Select as AntdSelect } from 'antd';

const { Option } = Select;

interface CompletedOrder {
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
  completedAt?: string;
  signedFileUrl?: string;
  signedFileName?: string;
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

const CompletedOrders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // حالات البيانات
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("");
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [archiving, setArchiving] = useState(false);

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

  // جلب الطلبات المكتملة
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // جلب الطلبات المكتملة فقط
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const ordersData = ordersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CompletedOrder[];
      
      // فلترة الطلبات المكتملة فقط
      const completedOrders = ordersData.filter(order => order.status === 'مكتمل');
      
      console.log('Fetched completed orders:', completedOrders);
      setOrders(completedOrders);
      
      if (completedOrders.length === 0) {
        message.info('لا توجد طلبات مكتملة');
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
    
    if (filterBranch && order.branchName !== filterBranch) {
      matches = false;
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

  // أرشفة الطلبات
  const handleArchive = () => {
    if (selectedOrders.length === 0) {
      message.warning('يرجى تحديد طلب واحد على الأقل للأرشفة');
      return;
    }

    Modal.confirm({
      title: 'تأكيد الأرشفة',
      content: `هل أنت متأكد من أرشفة ${selectedOrders.length} طلب؟`,
      okText: 'نعم، أرشف',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        setArchiving(true);
        try {
          // تحديث حالة الطلبات المحددة إلى "مؤرشف"
          const updatePromises = selectedOrders.map(orderId => 
            updateDoc(doc(db, 'delivery_orders', orderId), {
              status: 'مؤرشف',
              archivedAt: new Date().toISOString(),
              archivedBy: user?.uid || '',
              updatedAt: new Date().toISOString(),
            })
          );

          await Promise.all(updatePromises);

          message.success(`تم أرشفة ${selectedOrders.length} طلب بنجاح`);
          
          // إعادة تحميل البيانات
          setSelectedOrders([]);
          fetchOrders();
        } catch (error) {
          console.error('Error archiving orders:', error);
          message.error('حدث خطأ أثناء أرشفة الطلبات');
        } finally {
          setArchiving(false);
        }
      },
    });
  };

  // عرض الملف الموقع
  const handleViewFile = (fileUrl?: string, fileName?: string) => {
    if (!fileUrl) {
      message.warning('لا يوجد ملف موقع لهذا الطلب');
      return;
    }
    window.open(fileUrl, '_blank');
  };

  // الحصول على قائمة الفروع الفريدة
  const uniqueBranches = Array.from(new Set(orders.map(order => order.branchName))).filter(Boolean);

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
      fixed: 'left' as const,
      render: (_text: unknown, record: CompletedOrder) => (
        <Checkbox
          checked={selectedOrders.includes(record.id)}
          onChange={(e) => handleSelectOrder(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '#',
      key: 'index',
      width: 60,
      fixed: 'left' as const,
      render: (_text: unknown, _record: CompletedOrder, index: number) => index + 1,
    },
    {
      title: 'اسم العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      render: (text: string) => text || <span className="text-gray-400">غير محدد</span>,
    },
    {
      title: 'رقم العميل',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 130,
      render: (text: string) => (
        <span className="font-mono text-sm">{text}</span>
      ),
    },
    {
      title: 'الفرع',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
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
      title: 'تاريخ ووقت التأكيد',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: (date: string) => {
        if (!date) return <span className="text-gray-400">غير محدد</span>;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{dayjs(date).format('DD/MM/YYYY')}</span>
            <span className="text-xs text-gray-500">{dayjs(date).format('HH:mm:ss')}</span>
          </div>
        );
      },
    },
    {
      title: 'السائق',
      dataIndex: 'driverName',
      key: 'driverName',
      width: 120,
      render: (text: string) => text || <span className="text-gray-400">غير محدد</span>,
    },
    {
      title: 'الملف الموقع',
      key: 'signedFile',
      width: 150,
      render: (_text: unknown, record: CompletedOrder) => (
        <div className="flex gap-2">
          {record.signedFileUrl ? (
            <>
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleViewFile(record.signedFileUrl, record.signedFileName)}
              >
                عرض
              </Button>
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                href={record.signedFileUrl}
                download={record.signedFileName}
                target="_blank"
              >
                تحميل
              </Button>
            </>
          ) : (
            <span className="text-gray-400 text-sm">لا يوجد</span>
          )}
        </div>
      ),
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      fixed: 'right' as const,
      render: (status: string) => {
        const color = 'green';
        return <Tag color={color} className="font-medium">{status}</Tag>;
      },
    },
  ];

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      <Helmet>
        <title>الطلبات المكتملة | ERP90 Dashboard</title>
        <meta name="description" content="عرض وإدارة الطلبات المكتملة" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
              <svg className="h-8 w-8 text-teal-600 dark:text-teal-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">الطلبات المكتملة</h1>
              <p className="text-gray-600 dark:text-gray-400">
                عرض وإدارة الطلبات المكتملة
                {orders.length > 0 && <span className="font-semibold text-teal-600"> ({orders.length} طلب)</span>}
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 to-teal-200"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات", to: "/management/outputs" },
          { label: "الطلبات المكتملة" }
        ]}
      />

      {/* الفلاتر */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">تصفية حسب الفرع</label>
            <Select
              value={filterBranch || undefined}
              onChange={setFilterBranch}
              placeholder="جميع الفروع"
              allowClear
              style={{ width: '100%' }}
              size="large"
            >
              {uniqueBranches.map(branch => (
                <Option key={branch} value={branch}>
                  {branch}
                </Option>
              ))}
            </Select>
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
              danger
              icon={<InboxOutlined />}
              size="large"
              onClick={handleArchive}
              disabled={selectedOrders.length === 0}
              loading={archiving}
              style={{ height: 48, fontSize: 18, minWidth: 150 }}
            >
              أرشفة المحدد
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
            pageSizeOptions: ['10', '20', '50', '100'],
          }}
          scroll={{ x: 1600 }}
          locale={{
            emptyText: 'لا توجد طلبات مكتملة',
          }}
          className="custom-table"
        />
      </motion.div>
    </div>
  );
};

export default CompletedOrders;

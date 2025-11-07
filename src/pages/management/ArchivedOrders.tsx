import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Table, Button, message, Tag, Checkbox, Select, Input, Modal } from "antd";
import { SearchOutlined, ReloadOutlined, DeleteOutlined, DownloadOutlined, EyeOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { useAuth } from "@/contexts/useAuth";
import dayjs from 'dayjs';
import { Select as AntdSelect } from 'antd';

const { Option } = Select;

interface ArchivedOrder {
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
  archivedAt?: string;
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

const ArchivedOrders: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // حالات البيانات
  const [orders, setOrders] = useState<ArchivedOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [filterDriver, setFilterDriver] = useState<string>("");
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

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

  // جلب الطلبات المؤرشفة
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      // جلب الطلبات المؤرشفة فقط
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const ordersData = ordersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as ArchivedOrder[];
      
      // فلترة الطلبات المؤرشفة فقط
      const archivedOrders = ordersData.filter(order => order.status === 'مؤرشف');
      
      console.log('Fetched archived orders:', archivedOrders);
      setOrders(archivedOrders);
      
      if (archivedOrders.length === 0) {
        message.info('لا توجد طلبات مؤرشفة');
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

  // حذف الطلبات نهائياً
  const handleDeletePermanently = () => {
    if (selectedOrders.length === 0) {
      message.warning('يرجى تحديد طلب واحد على الأقل للحذف');
      return;
    }

    Modal.confirm({
      title: 'تحذير: حذف نهائي',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <p className="text-red-600 font-semibold mb-2">
             تحذير: هذا الإجراء لا يمكن التراجع عنه!
          </p>
          <p>
            سيتم حذف <span className="font-bold">{selectedOrders.length}</span> طلب نهائياً من قاعدة البيانات.
          </p>
          <p className="mt-2">هل أنت متأكد من المتابعة؟</p>
        </div>
      ),
      okText: 'نعم، احذف نهائياً',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleting(true);
        try {
          // حذف الطلبات المحددة نهائياً من قاعدة البيانات
          const deletePromises = selectedOrders.map(orderId => 
            deleteDoc(doc(db, 'delivery_orders', orderId))
          );

          await Promise.all(deletePromises);

          message.success(`تم حذف ${selectedOrders.length} طلب نهائياً من قاعدة البيانات`);
          
          // إعادة تحميل البيانات
          setSelectedOrders([]);
          fetchOrders();
        } catch (error) {
          console.error('Error deleting orders:', error);
          message.error('حدث خطأ أثناء حذف الطلبات');
        } finally {
          setDeleting(false);
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
      render: (_text: unknown, record: ArchivedOrder) => (
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
      render: (_text: unknown, _record: ArchivedOrder, index: number) => index + 1,
    },
    {
      title: 'اسم العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => (a.customerName || '').localeCompare(b.customerName || ''),
      render: (text: string) => text || <span className="text-gray-400">غير محدد</span>,
    },
    {
      title: 'رقم العميل',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 130,
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => (a.customerPhone || '').localeCompare(b.customerPhone || ''),
      render: (text: string) => (
        <span className="font-mono text-sm">{text}</span>
      ),
    },
    {
      title: 'الفرع',
      dataIndex: 'branchName',
      key: 'branchName',
      width: 120,
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => (a.branchName || '').localeCompare(b.branchName || ''),
    },
    {
      title: 'رقم الفاتورة',
      dataIndex: 'fullInvoiceNumber',
      key: 'fullInvoiceNumber',
      width: 200,
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => a.fullInvoiceNumber.localeCompare(b.fullInvoiceNumber),
      render: (text: string) => (
        <span className="font-semibold text-blue-600">{text}</span>
      ),
    },
    {
      title: 'تاريخ الأرشفة والوقت',
      dataIndex: 'archivedAt',
      key: 'archivedAt',
      width: 180,
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => {
        if (!a.archivedAt) return 1;
        if (!b.archivedAt) return -1;
        return dayjs(a.archivedAt).unix() - dayjs(b.archivedAt).unix();
      },
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
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => (a.driverName || '').localeCompare(b.driverName || ''),
      render: (text: string) => text || <span className="text-gray-400">غير محدد</span>,
    },
    {
      title: 'الملف الموقع',
      key: 'signedFile',
      width: 150,
      render: (_text: unknown, record: ArchivedOrder) => (
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
      sorter: (a: ArchivedOrder, b: ArchivedOrder) => (a.status || '').localeCompare(b.status || ''),
      render: (status: string) => {
        const color = 'gray';
        return <Tag color={color} className="font-medium">{status}</Tag>;
      },
    },
  ];

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
  const labelStyle: React.CSSProperties = { fontSize: 18, fontWeight: 500, marginBottom: 2, display: 'block' };

  return (
    <>
      <Helmet>
        <title>الطلبات المؤرشفة | ERP90 Dashboard</title>
        <meta name="description" content="عرض وإدارة الطلبات المؤرشفة" />
      </Helmet>
      
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        
        {/* Header */}
        <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg className="h-8 w-8 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">الطلبات المؤرشفة</h1>
                <p className="text-gray-600 dark:text-gray-400">
                  عرض وإدارة الطلبات المؤرشفة
                  {orders.length > 0 && <span className="font-semibold text-gray-600"> ({orders.length} طلب)</span>}
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
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-gray-400 to-gray-200"></div>
        </div>

        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة المخرجات", to: "/management/outputs" },
            { label: "الطلبات المؤرشفة" }
          ]}
        />

        {/* الفلاتر */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-gray-200 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-400 to-gray-200"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <SearchOutlined className="text-gray-600" /> خيارات البحث
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <span style={labelStyle}>تصفية حسب الفرع</span>
              <Select
                value={filterBranch || undefined}
                onChange={setFilterBranch}
                placeholder="جميع الفروع"
                allowClear
                style={largeControlStyle}
                size="large"
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {uniqueBranches.map(branch => (
                  <Option key={branch} value={branch}>
                    {branch}
                  </Option>
                ))}
              </Select>
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
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeletePermanently}
              disabled={selectedOrders.length === 0}
              loading={deleting}
              style={{ height: 48, fontSize: 18, minWidth: 180 }}
            >
              حذف نهائي ({selectedOrders.length})
            </Button>
            
            <span className="text-gray-500 text-sm flex-1">
              نتائج البحث: <span className="font-semibold">{filteredOrders.length}</span> طلب - 
              محدد: <span className="font-semibold text-red-600">{selectedOrders.length}</span>
            </span>
          </div>
        </motion.div>

        {/* تحذير */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="w-full bg-red-50 border-l-4 border-red-400 p-4 rounded-lg shadow-sm"
        >
          <div className="flex items-start gap-3">
            <ExclamationCircleOutlined className="text-red-600 text-2xl mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 mb-1">⚠️ تحذير مهم</h3>
              <p className="text-red-700">
                الحذف من هذه الصفحة هو <span className="font-bold">حذف نهائي</span> ولا يمكن التراجع عنه. سيتم حذف الطلبات من قاعدة البيانات بشكل دائم.
              </p>
            </div>
          </div>
        </motion.div>

        {/* الجدول */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-gray-200 shadow-sm overflow-hidden relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-400 to-gray-200"></div>
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              الطلبات المؤرشفة ({filteredOrders.length} طلب)
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
            scroll={{ x: 1600 }}
            locale={{
              emptyText: 'لا توجد طلبات مؤرشفة',
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

export default ArchivedOrders;

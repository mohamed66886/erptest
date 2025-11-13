import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, Card, Tag, Image, Space, Button, Input, DatePicker, Select, message, Modal, Descriptions, Row, Col } from "antd";
import { 
  SearchOutlined, 
  EyeOutlined, 
  FileImageOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  FileExcelOutlined,
  InboxOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from "framer-motion";
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import Breadcrumb from "@/components/Breadcrumb";
import type { ColumnsType } from 'antd/es/table';
import * as XLSX from 'xlsx';

dayjs.locale('ar');

const { RangePicker } = DatePicker;
const { Option } = Select;

interface Technician {
  id: string;
  name: string;
  nameAr?: string;
  phone?: string;
  specialization?: string;
  status?: string;
}

interface District {
  id: string;
  name: string;
  regionId?: string;
}

interface Region {
  id: string;
  name: string;
  governorateId?: string;
}

interface Governorate {
  id: string;
  name: string;
}

interface InstallationOrder {
  id: string;
  orderNumber: string;
  documentNumber: string;
  customerName: string;
  phone: string;
  technicianName: string;
  technicianPhone: string;
  districtName?: string;
  regionName?: string;
  governorateName?: string;
  installationDate: string;
  serviceType: string[];
  notes?: string;
  status: string;
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeImageFileName?: string;
  afterImageFileName?: string;
  imagesUploadedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const CompletedOrders: React.FC = () => {
  const { currentFinancialYear } = useFinancialYear();
  const [orders, setOrders] = useState<InstallationOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<InstallationOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InstallationOrder | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [archiving, setArchiving] = useState(false);

  // Advanced search filters
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [searchDocumentNumber, setSearchDocumentNumber] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchCustomerName, setSearchCustomerName] = useState('');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [searchGovernorate, setSearchGovernorate] = useState('');
  const [searchInstallationDate, setSearchInstallationDate] = useState<dayjs.Dayjs | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // جلب البيانات
  useEffect(() => {
    if (currentFinancialYear) {
      fetchCompletedOrders();
      fetchTechnicians();
      fetchGovernorates();
      fetchRegions();
      fetchDistricts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFinancialYear]);

  // Fetch technicians
  const fetchTechnicians = async () => {
    try {
      const techniciansSnapshot = await getDocs(collection(db, 'technicians'));
      const techniciansData = techniciansSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().nameAr || '',
        nameAr: doc.data().nameAr || doc.data().name || '',
        phone: doc.data().phone || doc.data().mobile || '',
        specialization: doc.data().specialization,
        status: doc.data().status
      }));
      setTechnicians(techniciansData.filter(t => !t.status || t.status === 'active' || t.status === 'نشط'));
    } catch (error) {
      console.error('Error fetching technicians:', error);
      setTechnicians([]);
    }
  };

  // Fetch governorates
  const fetchGovernorates = async () => {
    try {
      const governoratesSnapshot = await getDocs(collection(db, 'governorates'));
      const governoratesData = governoratesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data() as { name?: string }).name || ''
      }));
      setGovernorates(governoratesData);
    } catch (error) {
      console.error('Error fetching governorates:', error);
      setGovernorates([
        { id: '1', name: 'الرياض' },
        { id: '2', name: 'جدة' },
        { id: '3', name: 'الدمام' },
        { id: '4', name: 'مكة المكرمة' },
        { id: '5', name: 'المدينة المنورة' },
        { id: '6', name: 'الخبر' },
        { id: '7', name: 'الطائف' }
      ]);
    }
  };

  // Fetch regions
  const fetchRegions = async () => {
    try {
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData = regionsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data() as { name?: string }).name || '',
        governorateId: (doc.data() as { governorateId?: string }).governorateId
      }));
      setRegions(regionsData);
    } catch (error) {
      console.error('Error fetching regions:', error);
      setRegions([
        { id: '1', name: 'الشمال' },
        { id: '2', name: 'الجنوب' },
        { id: '3', name: 'الشرق' },
        { id: '4', name: 'الغرب' },
        { id: '5', name: 'الوسط' }
      ]);
    }
  };

  // Fetch districts
  const fetchDistricts = async () => {
    try {
      const districtsSnapshot = await getDocs(collection(db, 'districts'));
      const districtsData = districtsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data() as { name?: string }).name || '',
        regionId: (doc.data() as { regionId?: string }).regionId
      }));
      setDistricts(districtsData);
    } catch (error) {
      console.error('Error fetching districts:', error);
      setDistricts([
        { id: '1', name: 'حي النهضة' },
        { id: '2', name: 'حي الملك فهد' },
        { id: '3', name: 'حي الروضة' },
        { id: '4', name: 'حي العليا' },
        { id: '5', name: 'حي السليمانية' }
      ]);
    }
  };

  const fetchCompletedOrders = async () => {
    if (!currentFinancialYear) return;
    
    setLoading(true);
    try {
      const ordersRef = collection(db, "installation_orders");
      
      // استعلام بدون orderBy لتجنب مشكلة الفهرس
      // نجلب فقط الطلبات المكتملة
      const q = query(
        ordersRef,
        where("status", "==", "مكتمل")
      );

      const querySnapshot = await getDocs(q);
      const ordersData: InstallationOrder[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const order = {
          id: doc.id,
          ...data,
        } as InstallationOrder;
        
        // فقط الطلبات التي تحتوي على صور قبل وبعد
        // وتطابق السنة المالية الحالية (إذا كانت موجودة)
        const matchesFinancialYear = !data.financialYearId || data.financialYearId === currentFinancialYear.id;
        
        if (order.beforeImageUrl && order.afterImageUrl && matchesFinancialYear) {
          ordersData.push(order);
        }
      });

      // ترتيب البيانات في الذاكرة بدلاً من قاعدة البيانات
      ordersData.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // ترتيب تنازلي (الأحدث أولاً)
      });

      setOrders(ordersData);
      setFilteredOrders(ordersData);
      
      console.log('✅ Completed orders loaded:', ordersData.length);
    } catch (error) {
      console.error("Error fetching completed orders:", error);
      message.error("حدث خطأ في تحميل الطلبات المكتملة");
    } finally {
      setLoading(false);
    }
  };

  // البحث والفلترة المتقدمة
  useEffect(() => {
    let filtered = [...orders];

    // البحث النصي العام
    if (searchText) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        order.documentNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchText.toLowerCase()) ||
        order.phone.includes(searchText)
      );
    }

    // البحث برقم الطلب
    if (searchOrderNumber) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchOrderNumber.toLowerCase())
      );
    }

    // البحث برقم المستند
    if (searchDocumentNumber) {
      filtered = filtered.filter(order =>
        order.documentNumber.toLowerCase().includes(searchDocumentNumber.toLowerCase())
      );
    }

    // البحث برقم الهاتف
    if (searchPhone) {
      filtered = filtered.filter(order => order.phone.includes(searchPhone));
    }

    // البحث باسم العميل
    if (searchCustomerName) {
      filtered = filtered.filter(order =>
        order.customerName.toLowerCase().includes(searchCustomerName.toLowerCase())
      );
    }

    // البحث بالحي
    if (searchDistrict) {
      filtered = filtered.filter(order =>
        order.districtName === searchDistrict
      );
    }

    // البحث بالمنطقة
    if (searchRegion) {
      filtered = filtered.filter(order =>
        order.regionName === searchRegion
      );
    }

    // البحث بالمحافظة
    if (searchGovernorate) {
      filtered = filtered.filter(order =>
        order.governorateName === searchGovernorate
      );
    }

    // البحث بتاريخ التركيب
    if (searchInstallationDate) {
      filtered = filtered.filter(order =>
        dayjs(order.installationDate).isSame(searchInstallationDate, 'day')
      );
    }

    // فلترة حسب نطاق التاريخ
    if (selectedDateRange && selectedDateRange[0] && selectedDateRange[1]) {
      filtered = filtered.filter(order => {
        const orderDate = dayjs(order.installationDate);
        return orderDate.isAfter(selectedDateRange[0]) && orderDate.isBefore(selectedDateRange[1]);
      });
    }

    // فلترة حسب الفني
    if (selectedTechnician) {
      filtered = filtered.filter(order => order.technicianName === selectedTechnician);
    }

    setFilteredOrders(filtered);
  }, [searchText, searchOrderNumber, searchDocumentNumber, searchPhone, searchCustomerName,
      searchDistrict, searchRegion, searchGovernorate, searchInstallationDate,
      selectedDateRange, selectedTechnician, orders]);

  // عرض التفاصيل
  const showOrderDetails = (order: InstallationOrder) => {
    setSelectedOrder(order);
    setDetailsModalVisible(true);
  };

  // Archive selected orders
  const handleArchiveOrders = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('الرجاء تحديد طلب واحد على الأقل للأرشفة');
      return;
    }

    Modal.confirm({
      title: 'تأكيد الأرشفة',
      icon: <ExclamationCircleOutlined />,
      content: `هل أنت متأكد من أرشفة ${selectedRowKeys.length} طلب؟`,
      okText: 'نعم، أرشفة',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        setArchiving(true);
        try {
          const archivePromises = selectedRowKeys.map(async (orderId) => {
            const orderRef = doc(db, 'installation_orders', orderId as string);
            await updateDoc(orderRef, {
              status: 'مؤرشف',
              archivedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          });

          await Promise.all(archivePromises);

          // تحديث القوائم المحلية
          const updatedOrders = orders.map(order => 
            selectedRowKeys.includes(order.id) 
              ? { ...order, status: 'مؤرشف' }
              : order
          );
          setOrders(updatedOrders);
          setFilteredOrders(filteredOrders.map(order => 
            selectedRowKeys.includes(order.id) 
              ? { ...order, status: 'مؤرشف' }
              : order
          ));

          setSelectedRowKeys([]);
          message.success(`تم أرشفة ${selectedRowKeys.length} طلب بنجاح`);
        } catch (error) {
          console.error('Error archiving orders:', error);
          message.error('حدث خطأ في أرشفة الطلبات');
        } finally {
          setArchiving(false);
        }
      },
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const dataToExport = filteredOrders.map(order => ({
        'رقم الطلب': order.orderNumber,
        'رقم المستند': order.documentNumber,
        'اسم العميل': order.customerName,
        'الهاتف': order.phone,
        'الفني': order.technicianName,
        'هاتف الفني': order.technicianPhone,
        'تاريخ التركيب': dayjs(order.installationDate).format('YYYY-MM-DD'),
        'المحافظة': order.governorateName || '',
        'المنطقة': order.regionName || '',
        'الحي': order.districtName || '',
        'نوع الخدمة': order.serviceType.join(', '),
        'الملاحظات': order.notes || '',
        'الحالة': order.status,
        'تاريخ رفع الصور': order.imagesUploadedAt ? dayjs(order.imagesUploadedAt).format('YYYY-MM-DD HH:mm') : '',
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلبات المكتملة');
      XLSX.writeFile(wb, `completed_orders_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      message.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      message.error('حدث خطأ في تصدير البيانات');
    }
  };

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

  const columns: ColumnsType<InstallationOrder> = [
    {
      title: "رقم الطلب",
      dataIndex: "orderNumber",
      key: "orderNumber",
      width: 120,
      fixed: 'left',
      render: (text: string) => (
        <span className="font-semibold text-blue-600">{text}</span>
      ),
    },
    {
      title: "رقم المستند",
      dataIndex: "documentNumber",
      key: "documentNumber",
      width: 120,
    },
    {
      title: "اسم العميل",
      dataIndex: "customerName",
      key: "customerName",
      width: 150,
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <UserOutlined className="text-gray-500" />
          <span>{text}</span>
        </div>
      ),
    },
    {
      title: "الهاتف",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <PhoneOutlined className="text-green-600" />
          <span className="font-mono">{text}</span>
        </div>
      ),
    },
    {
      title: "الفني",
      dataIndex: "technicianName",
      key: "technicianName",
      width: 150,
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <ToolOutlined className="text-purple-600" />
          <span>{text}</span>
        </div>
      ),
    },
    {
      title: "تاريخ التركيب",
      dataIndex: "installationDate",
      key: "installationDate",
      width: 130,
      render: (date: string) => (
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-orange-600" />
          <span>{dayjs(date).format('DD/MM/YYYY')}</span>
        </div>
      ),
    },
    {
      title: "صورة قبل",
      key: "beforeImage",
      width: 120,
      align: 'center',
      render: (_: unknown, record: InstallationOrder) => (
        record.beforeImageUrl ? (
          <Image
            src={record.beforeImageUrl}
            alt="صورة قبل التركيب"
            width={80}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
            preview={{
              mask: <div className="flex flex-col items-center gap-1"><EyeOutlined /><span className="text-xs">معاينة</span></div>
            }}
          />
        ) : (
          <Tag color="default">لا توجد صورة</Tag>
        )
      ),
    },
    {
      title: "صورة بعد",
      key: "afterImage",
      width: 120,
      align: 'center',
      render: (_: unknown, record: InstallationOrder) => (
        record.afterImageUrl ? (
          <Image
            src={record.afterImageUrl}
            alt="صورة بعد التركيب"
            width={80}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 8, cursor: 'pointer' }}
            preview={{
              mask: <div className="flex flex-col items-center gap-1"><EyeOutlined /><span className="text-xs">معاينة</span></div>
            }}
          />
        ) : (
          <Tag color="default">لا توجد صورة</Tag>
        )
      ),
    },
    {
      title: "تاريخ رفع الصور",
      dataIndex: "imagesUploadedAt",
      key: "imagesUploadedAt",
      width: 150,
      render: (date: string) => (
        date ? (
          <div className="flex items-center gap-2">
            <CheckCircleOutlined className="text-green-600" />
            <span className="text-xs">{dayjs(date).format('DD/MM/YYYY HH:mm')}</span>
          </div>
        ) : (
          <Tag color="warning">غير محدد</Tag>
        )
      ),
    },
    {
      title: "الحالة",
      dataIndex: "status",
      key: "status",
      width: 100,
      fixed: 'right',
      render: (status: string) => (
        <Tag 
          color={status === 'مؤرشف' ? 'default' : 'success'} 
          icon={status === 'مؤرشف' ? <InboxOutlined /> : <CheckCircleOutlined />}
        >
          {status}
        </Tag>
      ),
    },
    {
      title: "الإجراءات",
      key: "actions",
      width: 100,
      fixed: 'right',
      align: 'center',
      render: (_: unknown, record: InstallationOrder) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => showOrderDetails(record)}
        >
          التفاصيل
        </Button>
      ),
    },
  ];

  return (
    <>
      <Helmet>
        <title>الطلبات المكتملة | ERP90 Dashboard</title>
        <meta name="description" content="عرض وإدارة طلبات التركيب المكتملة مع الصور، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تركيب, طلبات مكتملة, صور, فني, عملاء, Installation, Completed Orders" />
      </Helmet>

      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        {/* Header */}
        <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircleOutlined style={{ fontSize: 32, color: '#16a34a' }} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">الطلبات المكتملة مع الصور</h1>
                <p className="text-gray-600 dark:text-gray-400">عرض طلبات التركيب المكتملة التي تم رفع الصور لها</p>
              </div>
            </div>
            
            {/* Statistics Tags */}
            <div className="flex items-center gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  إجمالي: {filteredOrders.length}
                </span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  فنيين: {technicians.length}
                </span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-200"></div>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة التركيب", to: "/management/installation" },
            { label: "الطلبات المكتملة" },
          ]}
        />

        {/* Info Alert */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <FileImageOutlined className="text-xl text-green-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-green-800">
            <strong>ملاحظة:</strong> يعرض هذا القسم فقط طلبات التركيب المكتملة التي تم رفع صور قبل وبعد التركيب لها
          </div>
        </div>

        {/* Search Filters Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-200"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <SearchOutlined className="text-emerald-600" /> خيارات البحث
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <div className="flex flex-col">
              <span style={labelStyle}>رقم الطلب</span>
              <Input 
                value={searchOrderNumber}
                onChange={e => setSearchOrderNumber(e.target.value)}
                placeholder="ادخل رقم الطلب"
                style={largeControlStyle}
                size="large"
                allowClear
              />
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>رقم المستند</span>
              <Input 
                value={searchDocumentNumber}
                onChange={e => setSearchDocumentNumber(e.target.value)}
                placeholder="ادخل رقم المستند"
                style={largeControlStyle}
                size="large"
                allowClear
              />
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>رقم الهاتف</span>
              <Input 
                value={searchPhone}
                onChange={e => setSearchPhone(e.target.value)}
                placeholder="ادخل رقم الهاتف"
                style={largeControlStyle}
                size="large"
                allowClear
              />
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>اسم العميل</span>
              <Input 
                value={searchCustomerName}
                onChange={e => setSearchCustomerName(e.target.value)}
                placeholder="ادخل اسم العميل"
                style={largeControlStyle}
                size="large"
                allowClear
              />
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>الفني</span>
              <Select
                value={selectedTechnician || undefined}
                onChange={setSelectedTechnician}
                placeholder="اختر الفني"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {technicians.map(tech => (
                  <Option key={tech.id} value={tech.nameAr || tech.name}>
                    {tech.nameAr || tech.name} {tech.phone && `- ${tech.phone}`}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>المحافظة</span>
              <Select
                value={searchGovernorate || undefined}
                onChange={setSearchGovernorate}
                placeholder="اختر المحافظة"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {governorates.map(gov => (
                  <Option key={gov.id} value={gov.name}>
                    {gov.name}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>المنطقة</span>
              <Select
                value={searchRegion || undefined}
                onChange={setSearchRegion}
                placeholder="اختر المنطقة"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {regions.map(region => (
                  <Option key={region.id} value={region.name}>
                    {region.name}
                  </Option>
                ))}
              </Select>
            </div>
            
            <div className="flex flex-col">
              <span style={labelStyle}>الحي</span>
              <Select
                value={searchDistrict || undefined}
                onChange={setSearchDistrict}
                placeholder="اختر الحي"
                style={{ width: '100%', ...largeControlStyle }}
                size="large"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
              >
                {districts.map(district => (
                  <Option key={district.id} value={district.name}>
                    {district.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>
          
          <AnimatePresence>
            {showMoreFilters && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-hidden"
              >
                <div className="flex flex-col">
                  <span style={labelStyle}>تاريخ التركيب</span>
                  <DatePicker
                    value={searchInstallationDate}
                    onChange={setSearchInstallationDate}
                    placeholder="اختر التاريخ"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    format="YYYY-MM-DD"
                  />
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>نطاق التاريخ</span>
                  <RangePicker
                    value={selectedDateRange}
                    onChange={(dates) => setSelectedDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                    placeholder={['من تاريخ', 'إلى تاريخ']}
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    format="YYYY-MM-DD"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <Button
              type="link"
              onClick={() => setShowMoreFilters(!showMoreFilters)}
              className="text-emerald-600 hover:text-emerald-700 font-medium"
            >
              {showMoreFilters ? '▲ إخفاء الخيارات الإضافية' : '▼ إظهار المزيد من الخيارات'}
            </Button>
            
            <div className="flex gap-2 flex-wrap">
              <Button
                icon={<FileExcelOutlined />}
                onClick={exportToExcel}
                size="large"
                style={{ 
                  backgroundColor: '#c0dbfe', 
                  borderColor: '#c0dbfe',
                  color: '#1e40af',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#93c5fd';
                  e.currentTarget.style.borderColor = '#93c5fd';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#c0dbfe';
                  e.currentTarget.style.borderColor = '#c0dbfe';
                }}
              >
                تصدير Excel
              </Button>

              <Button
                onClick={() => {
                  setSearchText('');
                  setSearchOrderNumber('');
                  setSearchDocumentNumber('');
                  setSearchPhone('');
                  setSearchCustomerName('');
                  setSearchDistrict('');
                  setSearchRegion('');
                  setSearchGovernorate('');
                  setSearchInstallationDate(null);
                  setSelectedDateRange(null);
                  setSelectedTechnician('');
                }}
                size="large"
                style={{ 
                  backgroundColor: '#c0dbfe', 
                  borderColor: '#c0dbfe',
                  color: '#1e40af',
                  fontWeight: 600
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#93c5fd';
                  e.currentTarget.style.borderColor = '#93c5fd';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#c0dbfe';
                  e.currentTarget.style.borderColor = '#c0dbfe';
                }}
              >
                مسح الفلاتر
              </Button>
            </div>
          </div>
        </motion.div>

      {/* Table Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-700">قائمة الطلبات المكتملة</h3>
          
          {selectedRowKeys.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                تم تحديد {selectedRowKeys.length} طلب
              </span>
              <Button
                type="primary"
                danger
                icon={<InboxOutlined />}
                onClick={handleArchiveOrders}
                loading={archiving}
                size="large"
              >
                أرشفة المحدد ({selectedRowKeys.length})
              </Button>
            </div>
          )}
        </div>

        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500, y: 600 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} طلب`,
            position: ['bottomCenter'],
          }}
          locale={{
            emptyText: "لا توجد طلبات مكتملة بها صور",
          }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (selectedKeys) => {
              setSelectedRowKeys(selectedKeys);
            },
            getCheckboxProps: (record) => ({
              disabled: record.status === 'مؤرشف',
            }),
          }}
        />
      </div>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-blue-600" />
            <span>تفاصيل الطلب</span>
          </div>
        }
        open={detailsModalVisible}
        onCancel={() => setDetailsModalVisible(false)}
        footer={null}
        width={900}
        centered
      >
        {selectedOrder && (
          <div className="space-y-4">
            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="رقم الطلب" span={1}>
                <span className="font-semibold text-blue-600">{selectedOrder.orderNumber}</span>
              </Descriptions.Item>
              <Descriptions.Item label="رقم المستند" span={1}>
                {selectedOrder.documentNumber}
              </Descriptions.Item>
              <Descriptions.Item label="اسم العميل" span={1}>
                {selectedOrder.customerName}
              </Descriptions.Item>
              <Descriptions.Item label="الهاتف" span={1}>
                <span className="font-mono">{selectedOrder.phone}</span>
              </Descriptions.Item>
              <Descriptions.Item label="الفني" span={1}>
                {selectedOrder.technicianName}
              </Descriptions.Item>
              <Descriptions.Item label="هاتف الفني" span={1}>
                <span className="font-mono">{selectedOrder.technicianPhone}</span>
              </Descriptions.Item>
              <Descriptions.Item label="تاريخ التركيب" span={1}>
                {dayjs(selectedOrder.installationDate).format('DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="الحالة" span={1}>
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  {selectedOrder.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="العنوان" span={2}>
                {selectedOrder.governorateName} - {selectedOrder.regionName} - {selectedOrder.districtName}
              </Descriptions.Item>
              <Descriptions.Item label="نوع الخدمة" span={2}>
                {selectedOrder.serviceType.join(', ')}
              </Descriptions.Item>
              {selectedOrder.notes && (
                <Descriptions.Item label="ملاحظات" span={2}>
                  {selectedOrder.notes}
                </Descriptions.Item>
              )}
              {selectedOrder.imagesUploadedAt && (
                <Descriptions.Item label="تاريخ رفع الصور" span={2}>
                  {dayjs(selectedOrder.imagesUploadedAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Images Section */}
            <div className="mt-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FileImageOutlined className="text-blue-600" />
                صور التركيب
              </h3>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Card 
                    title="صورة قبل التركيب"
                    className="shadow-md"
                    headStyle={{ backgroundColor: '#f0f9ff', color: '#1e40af', fontWeight: 'bold' }}
                  >
                    {selectedOrder.beforeImageUrl ? (
                      <Image
                        src={selectedOrder.beforeImageUrl}
                        alt="صورة قبل التركيب"
                        style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
                        preview={{
                          mask: <div className="flex flex-col items-center gap-1"><EyeOutlined /><span>معاينة</span></div>
                        }}
                      />
                    ) : (
                      <div className="text-center py-20 bg-gray-100 rounded-lg">
                        <FileImageOutlined className="text-6xl text-gray-400 mb-2" />
                        <p className="text-gray-500">لا توجد صورة</p>
                      </div>
                    )}
                  </Card>
                </Col>
                <Col xs={24} md={12}>
                  <Card 
                    title="صورة بعد التركيب"
                    className="shadow-md"
                    headStyle={{ backgroundColor: '#f0fdf4', color: '#15803d', fontWeight: 'bold' }}
                  >
                    {selectedOrder.afterImageUrl ? (
                      <Image
                        src={selectedOrder.afterImageUrl}
                        alt="صورة بعد التركيب"
                        style={{ width: '100%', height: 300, objectFit: 'cover', borderRadius: 8 }}
                        preview={{
                          mask: <div className="flex flex-col items-center gap-1"><EyeOutlined /><span>معاينة</span></div>
                        }}
                      />
                    ) : (
                      <div className="text-center py-20 bg-gray-100 rounded-lg">
                        <FileImageOutlined className="text-6xl text-gray-400 mb-2" />
                        <p className="text-gray-500">لا توجد صورة</p>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </div>
          </div>
        )}
      </Modal>
      </div>

      <style>{`
        .ant-table-wrapper {
          direction: rtl;
        }
        
        /* تخصيص رأس الجدول */
        .ant-table-thead > tr > th {
          background-color: #c0dbfe !important;
          color: #1e40af !important;
          font-weight: 600 !important;
          border-bottom: 2px solid #93c5fd !important;
        }
        
        .ant-table-thead > tr > th::before {
          background-color: #1e40af !important;
        }
      `}</style>
    </>
  );
};

export default CompletedOrders;

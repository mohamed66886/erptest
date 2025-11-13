import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { collection, query, where, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, deleteObject } from "firebase/storage";
import { Table, Card, Tag, Image, Space, Button, Input, DatePicker, Select, message, Modal, Descriptions, Row, Col } from "antd";
import { 
  SearchOutlined, 
  EyeOutlined, 
  FileImageOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  ToolOutlined,
  FileTextOutlined,
  InboxOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  WarningOutlined
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

// Interfaces for Firebase data
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
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const ArchivedOrders: React.FC = () => {
  const { currentFinancialYear } = useFinancialYear();
  const [orders, setOrders] = useState<InstallationOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<InstallationOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedDateRange, setSelectedDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InstallationOrder | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleting, setDeleting] = useState(false);

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

  // Location data from Firebase
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);

  // جلب البيانات
  useEffect(() => {
    if (currentFinancialYear) {
      fetchArchivedOrders();
    }
    fetchTechnicians();
    fetchGovernorates();
    fetchRegions();
    fetchDistricts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFinancialYear]);

  // Fetch technicians from Firebase
  const fetchTechnicians = async () => {
    try {
      const techniciansRef = collection(db, "technicians");
      const querySnapshot = await getDocs(techniciansRef);
      const techData: Technician[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Only include active technicians
        if (data.status === 'active' || data.status === 'نشط') {
          techData.push({
            id: doc.id,
            name: data.name,
            nameAr: data.nameAr,
            phone: data.phone,
            specialization: data.specialization,
            status: data.status
          });
        }
      });
      
      setTechnicians(techData);
    } catch (error) {
      console.error("Error fetching technicians:", error);
      // Fallback data
      setTechnicians([
        { id: '1', name: 'Ahmed', nameAr: 'أحمد', phone: '0501234567' },
        { id: '2', name: 'Mohammed', nameAr: 'محمد', phone: '0507654321' }
      ]);
    }
  };

  // Fetch governorates from Firebase
  const fetchGovernorates = async () => {
    try {
      const governoratesRef = collection(db, "governorates");
      const querySnapshot = await getDocs(governoratesRef);
      const govData: Governorate[] = [];
      
      querySnapshot.forEach((doc) => {
        govData.push({
          id: doc.id,
          name: doc.data().name
        });
      });
      
      setGovernorates(govData);
    } catch (error) {
      console.error("Error fetching governorates:", error);
      // Fallback data
      setGovernorates([
        { id: '1', name: 'الرياض' },
        { id: '2', name: 'جدة' },
        { id: '3', name: 'الدمام' }
      ]);
    }
  };

  // Fetch regions from Firebase
  const fetchRegions = async () => {
    try {
      const regionsRef = collection(db, "regions");
      const querySnapshot = await getDocs(regionsRef);
      const regData: Region[] = [];
      
      querySnapshot.forEach((doc) => {
        regData.push({
          id: doc.id,
          name: doc.data().name,
          governorateId: doc.data().governorateId
        });
      });
      
      setRegions(regData);
    } catch (error) {
      console.error("Error fetching regions:", error);
      // Fallback data
      setRegions([
        { id: '1', name: 'الشمال' },
        { id: '2', name: 'الجنوب' },
        { id: '3', name: 'الشرق' }
      ]);
    }
  };

  // Fetch districts from Firebase
  const fetchDistricts = async () => {
    try {
      const districtsRef = collection(db, "districts");
      const querySnapshot = await getDocs(districtsRef);
      const distData: District[] = [];
      
      querySnapshot.forEach((doc) => {
        distData.push({
          id: doc.id,
          name: doc.data().name,
          regionId: doc.data().regionId
        });
      });
      
      setDistricts(distData);
    } catch (error) {
      console.error("Error fetching districts:", error);
      // Fallback data
      setDistricts([
        { id: '1', name: 'حي النهضة' },
        { id: '2', name: 'حي الملك فهد' },
        { id: '3', name: 'حي الروضة' }
      ]);
    }
  };

  const fetchArchivedOrders = async () => {
    if (!currentFinancialYear) return;
    
    setLoading(true);
    try {
      const ordersRef = collection(db, "installation_orders");
      
      // جلب الطلبات المؤرشفة فقط
      const q = query(
        ordersRef,
        where("status", "==", "مؤرشف")
      );

      const querySnapshot = await getDocs(q);
      const ordersData: InstallationOrder[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const order = {
          id: doc.id,
          ...data,
        } as InstallationOrder;
        
        // فلترة حسب السنة المالية إذا كانت موجودة
        const matchesFinancialYear = !data.financialYearId || data.financialYearId === currentFinancialYear.id;
        
        if (matchesFinancialYear) {
          ordersData.push(order);
        }
      });

      // ترتيب البيانات حسب تاريخ الأرشفة (الأحدث أولاً)
      ordersData.sort((a, b) => {
        const dateA = new Date(a.archivedAt || a.updatedAt).getTime();
        const dateB = new Date(b.archivedAt || b.updatedAt).getTime();
        return dateB - dateA;
      });

      setOrders(ordersData);
      setFilteredOrders(ordersData);
      
      console.log('📦 Archived orders loaded:', ordersData.length);
    } catch (error) {
      console.error("Error fetching archived orders:", error);
      message.error("حدث خطأ في تحميل الطلبات المؤرشفة");
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

  // حذف صورة من Firebase Storage
  const deleteImageFromStorage = async (imageUrl?: string) => {
    if (!imageUrl) return;
    
    try {
      // استخراج المسار من الـ URL
      const imageRef = ref(storage, imageUrl);
      await deleteObject(imageRef);
      console.log('✅ Image deleted from storage:', imageUrl);
    } catch (error) {
      // إذا كانت الصورة غير موجودة، نتجاهل الخطأ
      const firebaseError = error as { code?: string };
      if (firebaseError.code === 'storage/object-not-found') {
        console.log('ℹ️ Image not found in storage, skipping:', imageUrl);
      } else {
        console.error('❌ Error deleting image:', error);
        throw error;
      }
    }
  };

  // حذف الطلبات نهائياً
  const handleDeleteOrders = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('الرجاء تحديد طلب واحد على الأقل للحذف');
      return;
    }

    Modal.confirm({
      title: 'تحذير: حذف نهائي',
      icon: <WarningOutlined className="text-red-600" />,
      content: (
        <div className="space-y-2">
          <p className="text-red-600 font-semibold">
            ⚠️ هذا الإجراء لا يمكن التراجع عنه!
          </p>
          <p>
            سيتم حذف <strong>{selectedRowKeys.length}</strong> طلب نهائياً من قاعدة البيانات.
          </p>
          <p className="text-sm text-red-600">
            📷 سيتم حذف جميع الصور المرفقة أيضاً.
          </p>
          <p className="text-sm text-gray-600">
            هل أنت متأكد من المتابعة؟
          </p>
        </div>
      ),
      okText: 'نعم، احذف نهائياً',
      cancelText: 'إلغاء',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleting(true);
        const hideLoading = message.loading('جاري الحذف...', 0);
        
        try {
          let deletedCount = 0;
          let errorCount = 0;

          // حذف كل طلب مع الصور
          for (const orderId of selectedRowKeys) {
            try {
              // البحث عن بيانات الطلب
              const order = orders.find(o => o.id === orderId);
              
              if (order) {
                // حذف الصور إن وجدت
                const deleteImagePromises = [];
                
                if (order.beforeImageUrl) {
                  deleteImagePromises.push(deleteImageFromStorage(order.beforeImageUrl));
                }
                
                if (order.afterImageUrl) {
                  deleteImagePromises.push(deleteImageFromStorage(order.afterImageUrl));
                }
                
                // انتظار حذف جميع الصور
                if (deleteImagePromises.length > 0) {
                  await Promise.allSettled(deleteImagePromises);
                }
              }
              
              // حذف المستند من Firestore
              const orderRef = doc(db, 'installation_orders', orderId as string);
              await deleteDoc(orderRef);
              
              deletedCount++;
              console.log(`✅ Order ${orderId} deleted successfully with images`);
            } catch (error) {
              console.error(`❌ Error deleting order ${orderId}:`, error);
              errorCount++;
            }
          }

          hideLoading();

          // تحديث القوائم المحلية
          const updatedOrders = orders.filter(order => !selectedRowKeys.includes(order.id));
          setOrders(updatedOrders);
          setFilteredOrders(filteredOrders.filter(order => !selectedRowKeys.includes(order.id)));

          setSelectedRowKeys([]);
          
          // رسالة النجاح
          if (errorCount === 0) {
            message.success(`تم حذف ${deletedCount} طلب مع الصور بنجاح 🎉`);
          } else {
            message.warning(`تم حذف ${deletedCount} طلب، فشل حذف ${errorCount} طلب`);
          }
        } catch (error) {
          hideLoading();
          console.error('Error deleting orders:', error);
          message.error('حدث خطأ في حذف الطلبات');
        } finally {
          setDeleting(false);
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
        'تاريخ الأرشفة': order.archivedAt ? dayjs(order.archivedAt).format('YYYY-MM-DD HH:mm') : '',
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلبات المؤرشفة');
      XLSX.writeFile(wb, `archived_orders_${dayjs().format('YYYY-MM-DD')}.xlsx`);
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
        <span className="font-semibold text-gray-600">{text}</span>
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
      title: "تاريخ الأرشفة",
      dataIndex: "archivedAt",
      key: "archivedAt",
      width: 150,
      render: (date: string) => (
        date ? (
          <div className="flex items-center gap-2">
            <InboxOutlined className="text-gray-600" />
            <span className="text-xs">{dayjs(date).format('DD/MM/YYYY HH:mm')}</span>
          </div>
        ) : (
          <Tag color="default">غير محدد</Tag>
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
        <Tag color="default" icon={<InboxOutlined />}>
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
          type="default"
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
        <title>الطلبات المؤرشفة | ERP90 Dashboard</title>
        <meta name="description" content="عرض وإدارة طلبات التركيب المؤرشفة، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تركيب, طلبات مؤرشفة, أرشيف, Installation, Archived Orders" />
      </Helmet>

      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        {/* Header */}
        <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
                <InboxOutlined style={{ fontSize: 32, color: '#6b7280' }} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">الطلبات المؤرشفة</h1>
                <p className="text-gray-600 dark:text-gray-400">عرض وإدارة طلبات التركيب المؤرشفة</p>
              </div>
            </div>
            
            {/* Statistics Tags */}
            <div className="flex items-center gap-3">
              <div className="bg-gray-50 dark:bg-gray-900/20 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                  إجمالي: {filteredOrders.length}
                </span>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-lg border border-purple-200 dark:border-purple-800">
                <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                  فنيين: {technicians.length}
                </span>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-gray-500 to-gray-300"></div>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة التركيب", to: "/management/installation" },
            { label: "الطلبات المؤرشفة" },
          ]}
        />

        {/* Info Alert */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
          <WarningOutlined className="text-xl text-yellow-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-yellow-800">
            <strong>تحذير:</strong> الطلبات المحذوفة من هذا القسم سيتم حذفها نهائياً مع جميع الصور المرفقة ولا يمكن استرجاعها مرة أخرى!
          </div>
        </div>

        {/* Search Filters Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-gray-100 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-500 to-gray-300"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <SearchOutlined className="text-gray-600" /> خيارات البحث
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
              className="text-gray-600 hover:text-gray-700 font-medium"
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
          <h3 className="text-lg font-semibold text-gray-700">قائمة الطلبات المؤرشفة</h3>
          
          {selectedRowKeys.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                تم تحديد {selectedRowKeys.length} طلب
              </span>
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                onClick={handleDeleteOrders}
                loading={deleting}
                size="large"
                className="bg-red-600 hover:bg-red-700"
              >
                حذف نهائي ({selectedRowKeys.length})
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
            emptyText: "لا توجد طلبات مؤرشفة",
          }}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (selectedKeys) => {
              setSelectedRowKeys(selectedKeys);
            },
          }}
        />
      </div>

      {/* Details Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2">
            <FileTextOutlined className="text-gray-600" />
            <span>تفاصيل الطلب المؤرشف</span>
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
                <span className="font-semibold text-gray-600">{selectedOrder.orderNumber}</span>
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
                <Tag color="default" icon={<InboxOutlined />}>
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
              {selectedOrder.archivedAt && (
                <Descriptions.Item label="تاريخ الأرشفة" span={2}>
                  {dayjs(selectedOrder.archivedAt).format('DD/MM/YYYY HH:mm')}
                </Descriptions.Item>
              )}
            </Descriptions>

            {/* Images Section */}
            <div className="mt-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FileImageOutlined className="text-gray-600" />
                صور التركيب
              </h3>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12}>
                  <Card 
                    title="صورة قبل التركيب"
                    className="shadow-md"
                    headStyle={{ backgroundColor: '#f9fafb', color: '#374151', fontWeight: 'bold' }}
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
                    headStyle={{ backgroundColor: '#f9fafb', color: '#374151', fontWeight: 'bold' }}
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
          background-color: #f3f4f6 !important;
          color: #374151 !important;
          font-weight: 600 !important;
          border-bottom: 2px solid #d1d5db !important;
        }
        
        .ant-table-thead > tr > th::before {
          background-color: #374151 !important;
        }
      `}</style>
    </>
  );
};

export default ArchivedOrders;

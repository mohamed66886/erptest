import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Space, 
  message, 
  Tag,
  Typography,
  Row,
  Col,
  Switch,
  Select,
  Modal,
  DatePicker
} from 'antd';

const { Option } = Select;
import { 
  EyeOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  UserSwitchOutlined,
  CheckSquareOutlined,
  WhatsAppOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from "framer-motion";
import Breadcrumb from "@/components/Breadcrumb";
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  FieldValue,
  doc,
  updateDoc
} from 'firebase/firestore';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;

// Types
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
  id?: string;
  orderNumber: string;
  date: string;
  createdTime: string;
  documentNumber: string;
  installationDate: string;
  responsibleEntity: string;
  customerName: string;
  phone: string;
  technicianName: string;
  technicianPhone: string;
  district: string;
  districtName?: string;
  region: string;
  regionName?: string;
  governorate: string;
  governorateName?: string;
  serviceType: string[];
  notes: string;
  status?: string;
  createdAt?: Timestamp | FieldValue | string;
  sourceType?: 'manual' | 'delivery';
  deliveryOrderId?: string;
}

const ConfirmedOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<InstallationOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [assignTechnicianMode, setAssignTechnicianMode] = useState(false);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  
  // States for confirmation modal
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<React.Key[]>([]);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [selectedTechnicianFilter, setSelectedTechnicianFilter] = useState<string>('');

  // Search filters
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [searchDocumentNumber, setSearchDocumentNumber] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchCustomerName, setSearchCustomerName] = useState('');
  const [searchTechnician, setSearchTechnician] = useState('');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [searchGovernorate, setSearchGovernorate] = useState('');
  const [searchInstallationDate, setSearchInstallationDate] = useState<dayjs.Dayjs | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    fetchConfirmedOrders();
    fetchTechnicians();
    fetchGovernorates();
    fetchRegions();
    fetchDistricts();
  }, []);

  // Fetch confirmed orders
  const fetchConfirmedOrders = async () => {
    setLoading(true);
    try {
      const ordersQuery = query(
        collection(db, 'installation_orders'),
        where('status', '==', 'مؤكد')
      );
      const querySnapshot = await getDocs(ordersQuery);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InstallationOrder[];
      
      // Sort manually in JavaScript
      ordersData.sort((a, b) => {
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 
                      typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 
                      typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime; // Descending order (newest first)
      });
      
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching confirmed orders:', error);
      message.error('حدث خطأ في جلب الطلبات المؤكدة');
    } finally {
      setLoading(false);
    }
  };

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

  // Handle assign technician
  const handleAssignTechnician = async (orderId: string, technicianId: string, technicianName: string, technicianPhone: string) => {
    Modal.confirm({
      title: 'تأكيد تعيين الفني',
      content: `هل تريد تعيين الفني "${technicianName}" لهذا الطلب؟`,
      okText: 'تأكيد',
      cancelText: 'إلغاء',
      onOk: async () => {
        try {
          const orderRef = doc(db, 'installation_orders', orderId);
          await updateDoc(orderRef, {
            technicianName: technicianName,
            technicianPhone: technicianPhone || '',
            updatedAt: new Date().toISOString()
          });
          
          message.success(`تم تعيين الفني "${technicianName}" بنجاح`);
          fetchConfirmedOrders(); // Refresh the list
        } catch (error) {
          console.error('Error assigning technician:', error);
          message.error('حدث خطأ في تعيين الفني');
        }
      }
    });
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const dataToExport = orders.map(order => ({
        'رقم الطلب': order.orderNumber,
        'التاريخ': order.date,
        'وقت الإنشاء': order.createdTime,
        'رقم المستند': order.documentNumber,
        'تاريخ التركيب': order.installationDate,
        'الجهة المسؤولة': order.responsibleEntity,
        'اسم العميل': order.customerName,
        'الهاتف': order.phone,
        'اسم الفني': order.technicianName,
        'هاتف الفني': order.technicianPhone,
        'الحي': order.districtName || order.district,
        'المنطقة': order.regionName || order.region,
        'المحافظة': order.governorateName || order.governorate,
        'نوع الخدمة': order.serviceType.join(', '),
        'الملاحظات': order.notes,
        'الحالة': order.status || 'مؤكد'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الطلبات المؤكدة');
      XLSX.writeFile(wb, `confirmed_orders_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      message.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      message.error('حدث خطأ في تصدير البيانات');
    }
  };

  // Filter orders with advanced filters
  const filteredOrders = orders.filter(order => {
    // البحث العام
    const generalSearch = !searchText || 
      order.orderNumber.toLowerCase().includes(searchText.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchText.toLowerCase()) ||
      order.phone.includes(searchText) ||
      order.documentNumber.toLowerCase().includes(searchText.toLowerCase());

    // البحث برقم الطلب
    const orderNumberMatch = !searchOrderNumber || 
      order.orderNumber.toLowerCase().includes(searchOrderNumber.toLowerCase());

    // البحث برقم المستند
    const documentNumberMatch = !searchDocumentNumber || 
      order.documentNumber.toLowerCase().includes(searchDocumentNumber.toLowerCase());

    // البحث برقم الهاتف
    const phoneMatch = !searchPhone || 
      order.phone.includes(searchPhone);

    // البحث باسم العميل
    const customerNameMatch = !searchCustomerName || 
      order.customerName.toLowerCase().includes(searchCustomerName.toLowerCase());

    // البحث بالفني
    const technicianMatch = !searchTechnician || 
      (order.technicianName && order.technicianName.toLowerCase().includes(searchTechnician.toLowerCase()));

    // البحث بالحي
    const districtMatch = !searchDistrict || 
      (order.districtName && order.districtName === searchDistrict) ||
      (order.district && order.district === searchDistrict);

    // البحث بالمنطقة
    const regionMatch = !searchRegion || 
      (order.regionName && order.regionName === searchRegion) ||
      (order.region && order.region === searchRegion);

    // البحث بالمحافظة
    const governorateMatch = !searchGovernorate || 
      (order.governorateName && order.governorateName === searchGovernorate) ||
      (order.governorate && order.governorate === searchGovernorate);

    // البحث بتاريخ التركيب
    const installationDateMatch = !searchInstallationDate || 
      (order.installationDate && dayjs(order.installationDate).isSame(searchInstallationDate, 'day'));

    return generalSearch && orderNumberMatch && documentNumberMatch && phoneMatch && 
           customerNameMatch && technicianMatch && districtMatch && regionMatch && 
           governorateMatch && installationDateMatch;
  });

  // Filter orders with assigned technicians
  const ordersWithTechnicians = orders.filter(order => 
    order.technicianName && order.technicianName.trim() !== ''
  );

  // Filter orders by selected technician in modal
  const filteredOrdersByTechnician = selectedTechnicianFilter 
    ? ordersWithTechnicians.filter(order => order.technicianName === selectedTechnicianFilter)
    : ordersWithTechnicians;

  // Get unique technicians from orders
  const uniqueTechnicians = Array.from(new Set(ordersWithTechnicians.map(order => order.technicianName)))
    .filter(name => name && name.trim() !== '')
    .sort();

  // Open confirmation modal
  const openConfirmationModal = () => {
    if (ordersWithTechnicians.length === 0) {
      message.warning('لا توجد طلبات بها فني معين');
      return;
    }
    setSelectedTechnicianFilter('');
    setSelectedOrderIds([]);
    setConfirmationModalVisible(true);
  };

  // Send WhatsApp messages
  const sendWhatsAppMessages = () => {
    if (selectedOrderIds.length === 0) {
      message.warning('الرجاء تحديد طلب واحد على الأقل');
      return;
    }

    setConfirmationLoading(true);
    
    const selectedOrders = filteredOrdersByTechnician.filter(order => 
      selectedOrderIds.includes(order.id || '')
    );

    // Group orders by technician
    const ordersByTechnician = selectedOrders.reduce((acc, order) => {
      const techName = order.technicianName;
      if (!acc[techName]) {
        acc[techName] = {
          phone: order.technicianPhone,
          orders: []
        };
      }
      acc[techName].orders.push(order);
      return acc;
    }, {} as Record<string, { phone: string; orders: InstallationOrder[] }>);

    let successCount = 0;
    
    Object.entries(ordersByTechnician).forEach(([technicianName, data]) => {
      let phone = data.phone?.replace(/\D/g, '');
      // إضافة كود الدولة السعودية وإزالة الصفر الأول
      if (phone) {
        if (phone.startsWith('0')) {
          phone = phone.substring(1); // إزالة الصفر الأول
        }
        if (!phone.startsWith('966')) {
          phone = '966' + phone; // إضافة كود الدولة السعودية
        }
      }
      if (phone) {
        const ordersCount = data.orders.length;
        
        let messageText = `أهلاً *${technicianName}*\n`;
        messageText += `لديك عدد ${ordersCount} طلب\n\n`;
        
        data.orders.forEach((order, index) => {
          const orderNum = index + 1;
          const uploadImagesUrl = `${window.location.origin}/installation/upload-images?id=${order.id}`;
          
          messageText += `━━━━━━━━━━━━━━━━━━\n`;
          messageText += `*الطلب ${orderNum}*\n\n`;
          messageText += `*رقم الطلب:* ${order.orderNumber}\n`;
          if (order.documentNumber) {
            messageText += `*رقم المستند:* ${order.documentNumber}\n`;
          }
          messageText += `*العنوان:* ${order.governorateName || order.governorate} - ${order.regionName || order.region} - ${order.districtName || order.district}\n`;
          messageText += `*العميل:* ${order.customerName}\n`;
          messageText += `*هاتف العميل:* ${order.phone}\n`;
          messageText += `*تاريخ التركيب:* ${dayjs(order.installationDate).format('YYYY-MM-DD')}\n`;
          messageText += `*نوع الخدمة:* ${order.serviceType.join(', ')}\n`;
          if (order.notes) {
            messageText += `*ملاحظات:* ${order.notes}\n`;
          }
          messageText += `\n*رابط رفع الصور (قبل وبعد التركيب):*\n${uploadImagesUrl}\n`;
          
          if (index < data.orders.length - 1) {
            messageText += `\n`;
          }
        });
        
        messageText += `━━━━━━━━━━━━━━━━━━\n`;
        messageText += `شكراً لك`;

        const encodedMessage = encodeURIComponent(messageText);
        const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
        window.open(whatsappUrl, '_blank');
        successCount++;
      }
    });

    setTimeout(() => {
      setConfirmationLoading(false);
      if (successCount > 0) {
        message.success(`تم فتح ${successCount} محادثة واتساب`);
        setSelectedOrderIds([]);
        setConfirmationModalVisible(false);
      } else {
        message.error('لم يتم العثور على أرقام هواتف صحيحة');
      }
    }, 1000);
  };

  // Columns for confirmation modal table
  const confirmationColumns = [
    {
      title: 'رقم الطلب',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 120,
    },
    {
      title: 'اسم العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
    },
    {
      title: 'تاريخ التركيب',
      dataIndex: 'installationDate',
      key: 'installationDate',
      width: 130,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: 'الفني',
      dataIndex: 'technicianName',
      key: 'technicianName',
      width: 150,
    },
    {
      title: 'هاتف الفني',
      dataIndex: 'technicianPhone',
      key: 'technicianPhone',
      width: 130,
    },
    {
      title: 'الموقع',
      key: 'location',
      width: 200,
      render: (_: unknown, record: InstallationOrder) => (
        <div style={{ fontSize: 12 }}>
          <div>{record.governorateName || record.governorate}</div>
          <div>{record.regionName || record.region}</div>
          <div>{record.districtName || record.district}</div>
        </div>
      )
    },
    {
      title: 'نوع الخدمة',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 150,
      render: (types: string[]) => types.join(', ')
    },
  ];

  // Table columns
  const columns = [
    {
      title: 'رقم الطلب',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 130,
      fixed: 'left' as const,
      render: (text: string, record: InstallationOrder) => (
        <div>
          <Text strong style={{ color: '#1890ff' }}>{text}</Text>
          {record.sourceType === 'delivery' && (
            <div>
              <Tag color="green" style={{ fontSize: 10, marginTop: 4 }}>
                مستورد تلقائياً
              </Tag>
            </div>
          )}
        </div>
      )
    },
    {
      title: 'التاريخ',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: 'رقم المستند',
      dataIndex: 'documentNumber',
      key: 'documentNumber',
      width: 120,
    },
    {
      title: 'تاريخ التركيب',
      dataIndex: 'installationDate',
      key: 'installationDate',
      width: 130,
      render: (date: string) => (
        <div>
          <div>{dayjs(date).format('YYYY-MM-DD')}</div>
          <Tag color="green" style={{ fontSize: 10, marginTop: 4 }}>مؤكد</Tag>
        </div>
      )
    },
    {
      title: 'الجهة المسؤولة',
      dataIndex: 'responsibleEntity',
      key: 'responsibleEntity',
      width: 150,
    },
    {
      title: 'اسم العميل',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
    },
    {
      title: 'الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
    },
    {
      title: 'الفني',
      dataIndex: 'technicianName',
      key: 'technicianName',
      width: 200,
      render: (name: string, record: InstallationOrder) => {
        if (assignTechnicianMode) {
          return (
            <Select
              placeholder="اختر الفني"
              style={{ width: '100%' }}
              value={name || undefined}
              onChange={(value) => {
                const selectedTech = technicians.find(t => t.id === value);
                if (selectedTech && record.id) {
                  handleAssignTechnician(
                    record.id,
                    selectedTech.id,
                    selectedTech.nameAr || selectedTech.name,
                    selectedTech.phone || ''
                  );
                }
              }}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const label = String(option?.children || '');
                return label.toLowerCase().includes(input.toLowerCase());
              }}
            >
              {technicians.map(tech => (
                <Option key={tech.id} value={tech.id}>
                  {tech.nameAr || tech.name} {tech.phone ? `- ${tech.phone}` : ''}
                </Option>
              ))}
            </Select>
          );
        }
        return name ? (
          <div>
            <div>{name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.technicianPhone || ''}
            </Text>
          </div>
        ) : (
          <Tag color="orange">لم يحدد بعد</Tag>
        );
      }
    },
    {
      title: 'الحي',
      dataIndex: 'district',
      key: 'district',
      width: 120,
      render: (_text: unknown, record: InstallationOrder) => record.districtName || record.district || '-'
    },
    {
      title: 'المنطقة',
      dataIndex: 'region',
      key: 'region',
      width: 100,
      render: (_text: unknown, record: InstallationOrder) => record.regionName || record.region || '-'
    },
    {
      title: 'المحافظة',
      dataIndex: 'governorate',
      key: 'governorate',
      width: 120,
      render: (_text: unknown, record: InstallationOrder) => record.governorateName || record.governorate || '-'
    },
    {
      title: 'نوع الخدمة',
      dataIndex: 'serviceType',
      key: 'serviceType',
      width: 150,
      render: (types: string[]) => (
        <Space direction="vertical" size={2}>
          {types.map((type, index) => (
            <Tag key={index} color="blue">{type}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      fixed: 'right' as const,
      width: 100,
      render: (_text: unknown, record: InstallationOrder) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/installation/orders`)}
          title="عرض التفاصيل"
        >
          عرض
        </Button>
      ),
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
  const labelStyle = { fontSize: 18, fontWeight: 500, marginBottom: 2, display: 'block' };

  return (
    <>
      <Helmet>
        <title>الطلبات المؤكدة | ERP90 Dashboard</title>
        <meta name="description" content="عرض وإدارة طلبات التركيب المؤكدة، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تركيب, طلبات مؤكدة, فني, عملاء, Installation, Confirmed Orders" />
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
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">الطلبات المؤكدة</h1>
                <p className="text-gray-600 dark:text-gray-400">عرض وإدارة طلبات التركيب المؤكدة</p>
              </div>
            </div>
            
            {/* Statistics Tags */}
            <div className="flex items-center gap-3">
              <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800">
                <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                  إجمالي: {orders.length}
                </span>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  لها فني: {ordersWithTechnicians.length}
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
            { label: "إدارة التركيبات", to: "/management/installation" },
            { label: "الطلبات المؤكدة" }
          ]}
        />

        {/* Info Alert */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <svg className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-green-800">
            <strong>ملاحظة:</strong> هذه الصفحة تعرض جميع طلبات التركيب التي تم تأكيدها (لها تاريخ تركيب محدد).
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
                value={searchTechnician || undefined}
                onChange={setSearchTechnician}
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
                  <Option key={tech.id} value={tech.name}>
                    {tech.nameAr || tech.name} - {tech.phone}
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
                icon={<CheckSquareOutlined />}
                onClick={openConfirmationModal}
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
                تأكيد الطلبات ({ordersWithTechnicians.length})
              </Button>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 12,
                padding: '8px 16px',
                background: assignTechnicianMode ? '#e6f7ff' : '#f5f5f5',
                borderRadius: 8,
                border: assignTechnicianMode ? '2px solid #1890ff' : '2px solid #d9d9d9',
                transition: 'all 0.3s'
              }}>
                <UserSwitchOutlined 
                  style={{ 
                    fontSize: 20, 
                    color: assignTechnicianMode ? '#1890ff' : '#8c8c8c' 
                  }} 
                />
                <span style={{ 
                  fontSize: 16, 
                  fontWeight: 500,
                  color: assignTechnicianMode ? '#1890ff' : '#595959'
                }}>
                  وضع تعيين الفني
                </span>
                <Switch
                  checked={assignTechnicianMode}
                  onChange={(checked) => {
                    setAssignTechnicianMode(checked);
                    if (checked) {
                      message.info('تم تفعيل وضع تعيين الفني. اختر فني من القائمة لتعيينه للطلبات.');
                    } else {
                      message.info('تم إلغاء وضع تعيين الفني.');
                    }
                  }}
                  checkedChildren="مفعل"
                  unCheckedChildren="معطل"
                  size="default"
                />
              </div>

              <Button
                onClick={() => {
                  setSearchText('');
                  setSearchOrderNumber('');
                  setSearchDocumentNumber('');
                  setSearchPhone('');
                  setSearchCustomerName('');
                  setSearchTechnician('');
                  setSearchDistrict('');
                  setSearchRegion('');
                  setSearchGovernorate('');
                  setSearchInstallationDate(null);
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
          <div className="p-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-700">قائمة الطلبات المؤكدة</h3>
          </div>

          <Table
            columns={columns}
            dataSource={filteredOrders}
            rowKey="id"
            loading={loading}
            scroll={{ x: 1800, y: 600 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `إجمالي ${total} طلب مؤكد`,
            }}
            bordered
          />
        </div>

        {/* Confirmation Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CheckSquareOutlined style={{ fontSize: 24, color: '#1890ff' }} />
              <span style={{ fontSize: 20, fontWeight: 600 }}>تأكيد وإرسال الطلبات للفنيين</span>
            </div>
          }
          open={confirmationModalVisible}
          onCancel={() => {
            setConfirmationModalVisible(false);
            setSelectedOrderIds([]);
            setSelectedTechnicianFilter('');
          }}
          width={1200}
          footer={null}
          style={{ top: 20 }}
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ 
              background: '#e6f7ff', 
              border: '1px solid #91d5ff', 
              borderRadius: 8, 
              padding: 12,
              marginBottom: 16
            }}>
              <Text style={{ fontSize: 14, color: '#0050b3' }}>
                 <strong>ملاحظة:</strong> اختر فني محدد أو اترك الحقل فارغاً لعرض جميع الطلبات. يمكنك إرسال إشعار واتساب للطلبات المحددة.
              </Text>
            </div>

            {/* Technician Filter */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col xs={24} sm={12} md={8}>
                <Select
                  placeholder="فلترة حسب الفني"
                  style={{ width: '100%' }}
                  size="large"
                  allowClear
                  value={selectedTechnicianFilter || undefined}
                  onChange={(value) => {
                    setSelectedTechnicianFilter(value || '');
                    setSelectedOrderIds([]); // Clear selection when filter changes
                  }}
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) => {
                    const label = String(option?.children || '');
                    return label.toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {uniqueTechnicians.map((techName) => (
                    <Option key={techName} value={techName}>
                      {techName}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>

            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space>
                <Tag color="blue" style={{ fontSize: 14, padding: '6px 12px' }}>
                  {selectedTechnicianFilter ? `طلبات ${selectedTechnicianFilter}` : 'جميع الطلبات'}: {filteredOrdersByTechnician.length}
                </Tag>
                <Tag color="green" style={{ fontSize: 14, padding: '6px 12px' }}>
                  المحدد: {selectedOrderIds.length}
                </Tag>
              </Space>

              <Button
                type="primary"
                icon={<WhatsAppOutlined />}
                size="large"
                loading={confirmationLoading}
                disabled={selectedOrderIds.length === 0}
                onClick={sendWhatsAppMessages}
                style={{ 
                  backgroundColor: '#25D366', 
                  borderColor: '#25D366',
                  fontWeight: 600
                }}
              >
                إرسال واتساب ({selectedOrderIds.length})
              </Button>
            </div>
          </div>

          <Table
            columns={confirmationColumns}
            dataSource={filteredOrdersByTechnician}
            rowKey="id"
            loading={confirmationLoading}
            scroll={{ x: 1000, y: 500 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `إجمالي ${total} طلب`,
            }}
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys: selectedOrderIds,
              onChange: (selectedKeys, selectedRows) => {
                // التحقق من أن جميع الطلبات المحددة لنفس الفني
                if (selectedRows.length > 0) {
                  const firstTechnician = selectedRows[0].technicianName;
                  const allSameTechnician = selectedRows.every(
                    (order) => order.technicianName === firstTechnician
                  );
                  
                  if (!allSameTechnician) {
                    message.warning('يجب تحديد طلبات لنفس الفني فقط');
                    return;
                  }
                }
                setSelectedOrderIds(selectedKeys);
              },
              getCheckboxProps: (record) => {
                // إذا كان هناك طلبات محددة بالفعل، تحقق من أن الفني نفسه
                if (selectedOrderIds.length > 0) {
                  const firstSelectedOrder = filteredOrdersByTechnician.find(
                    (order) => order.id === selectedOrderIds[0]
                  );
                  if (firstSelectedOrder && firstSelectedOrder.technicianName !== record.technicianName) {
                    return {
                      disabled: true,
                    };
                  }
                }
                return {};
              },
              selections: [
                {
                  key: 'all',
                  text: 'تحديد الكل',
                  onSelect: () => {
                    setSelectedOrderIds(filteredOrdersByTechnician.map(order => order.id || ''));
                  },
                },
                {
                  key: 'none',
                  text: 'إلغاء التحديد',
                  onSelect: () => {
                    setSelectedOrderIds([]);
                  },
                },
              ],
            }}
            bordered
          />
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

export default ConfirmedOrders;

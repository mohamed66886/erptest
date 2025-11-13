import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  Table, 
  Button, 
  Input, 
  Select, 
  Space, 
  Popconfirm, 
  message, 
  Tag,
  Modal,
  Form,
  DatePicker,
  Checkbox,
  Typography,
  Row,
  Col,
  Divider,
  Spin
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  FileExcelOutlined,
  BellOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  ImportOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from "framer-motion";
import Breadcrumb from "@/components/Breadcrumb";
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  serverTimestamp,
  FieldValue
} from 'firebase/firestore';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// Types
interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
}

interface Technician {
  id: string;
  name: string;
  phone: string;
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

interface FormValues {
  orderNumber: string;
  date: dayjs.Dayjs;
  createdTime: string;
  documentNumber: string;
  installationDate: dayjs.Dayjs;
  responsibleEntity: string;
  customerName: string;
  phone: string;
  technicianName: string;
  technicianPhone: string;
  district: string;
  region: string;
  governorate: string;
  serviceType: string[];
  notes: string;
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
  sourceType?: 'manual' | 'delivery'; // لتمييز مصدر الطلب
  deliveryOrderId?: string; // معرف طلب التوصيل الأصلي
}

interface DeliveryOrder {
  id: string;
  fullInvoiceNumber: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  districtName: string;
  regionName: string;
  governorateName: string;
  status: string;
  requiresInstallation: boolean;
  deliveryDate?: string;
  completedAt?: string;
  archivedAt?: string;
  createdAt?: Timestamp | FieldValue | string;
}

const InstallationOrders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<InstallationOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState<InstallationOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<InstallationOrder | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);

  // Search filters
  const [searchOrderNumber, setSearchOrderNumber] = useState('');
  const [searchDocumentNumber, setSearchDocumentNumber] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchNotes, setSearchNotes] = useState('');
  const [searchTechnician, setSearchTechnician] = useState('');
  const [searchDistrict, setSearchDistrict] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [searchGovernorate, setSearchGovernorate] = useState('');
  const [searchInstallationDate, setSearchInstallationDate] = useState<dayjs.Dayjs | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchBranches();
    fetchTechnicians();
    fetchGovernorates();
    fetchRegions();
    fetchDistricts();
    fetchAndCreateInstallationOrdersFromDelivery();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch branches
  const fetchBranches = async () => {
    try {
      const branchesSnapshot = await getDocs(collection(db, 'branches'));
      const branchesData = branchesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data() as { name?: string }).name || '',
        code: (doc.data() as { code?: string }).code,
        address: (doc.data() as { address?: string }).address
      }));
      setBranches(branchesData);
    } catch (error) {
      console.error('Error fetching branches:', error);
      message.error('حدث خطأ في جلب بيانات الفروع');
    }
  };

  // Fetch technicians
  const fetchTechnicians = async () => {
    try {
      const techniciansSnapshot = await getDocs(collection(db, 'technicians'));
      const techniciansData = techniciansSnapshot.docs.map(doc => ({
        id: doc.id,
        name: (doc.data() as { name?: string }).name || '',
        phone: (doc.data() as { phone?: string }).phone || '',
        specialization: (doc.data() as { specialization?: string }).specialization,
        status: (doc.data() as { status?: string }).status
      }));
      setTechnicians(techniciansData.filter(t => !t.status || t.status === 'active' || t.status === 'نشط'));
    } catch (error) {
      console.error('Error fetching technicians:', error);
      // إذا لم تكن هناك مجموعة فنيين، نستخدم قائمة افتراضية
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
      // قائمة افتراضية
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
      // قائمة افتراضية
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
      // قائمة افتراضية
      setDistricts([
        { id: '1', name: 'حي النهضة' },
        { id: '2', name: 'حي الملك فهد' },
        { id: '3', name: 'حي الروضة' },
        { id: '4', name: 'حي العليا' },
        { id: '5', name: 'حي السليمانية' }
      ]);
    }
  };

  // Fetch orders
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const ordersQuery = query(
        collection(db, 'installation_orders')
      );
      const querySnapshot = await getDocs(ordersQuery);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InstallationOrder[];
      
      // فلترة الطلبات التي حالتها "جديد" فقط
      const newOrders = ordersData.filter(order => 
        !order.status || order.status === 'جديد'
      );
      
      // ترتيب يدوي حسب تاريخ الإنشاء (الأحدث أولاً)
      newOrders.sort((a, b) => {
        const aTime = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 
                      typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 
                      typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });
      
      setOrders(newOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      message.error('حدث خطأ في جلب الطلبات');
    } finally {
      setLoading(false);
    }
  };

  // Generate order number
  const generateOrderNumber = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(db, 'installation_orders'));
      const orderCount = ordersSnapshot.size;
      return `INS-${(orderCount + 1).toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating order number:', error);
      return `INS-${Date.now()}`;
    }
  };

  // Fetch delivery orders and create installation orders automatically
  const fetchAndCreateInstallationOrdersFromDelivery = async () => {
    try {
      setLoading(true);
      // جلب طلبات التوصيل المكتملة/المؤرشفة التي تحتاج تركيب
      const deliveryOrdersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const deliveryOrders = deliveryOrdersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DeliveryOrder[];
      
      // فلترة الطلبات المكتملة/المؤرشفة التي تحتاج تركيب
      const ordersNeedingInstallation = deliveryOrders.filter(order => 
        (order.status === 'مكتمل' || order.status === 'مؤرشف') &&
        order.requiresInstallation === true
      );

      // جلب طلبات التركيب الموجودة
      const existingInstallationOrders = await getDocs(collection(db, 'installation_orders'));
      const existingDeliveryOrderIds = existingInstallationOrders.docs
        .map(doc => doc.data().deliveryOrderId)
        .filter(id => id); // فقط الطلبات التي لها deliveryOrderId

      let createdCount = 0;
      
      // إنشاء طلبات تركيب للطلبات الجديدة فقط
      for (const deliveryOrder of ordersNeedingInstallation) {
        // تحقق إذا كان الطلب موجود مسبقاً
        if (!existingDeliveryOrderIds.includes(deliveryOrder.id)) {
          const orderNumber = await generateOrderNumber();
          const currentTime = dayjs();
          
          const installationOrderData = {
            orderNumber,
            date: currentTime.format('YYYY-MM-DD'),
            createdTime: currentTime.format('HH:mm:ss'),
            documentNumber: deliveryOrder.fullInvoiceNumber, // رقم الفاتورة
            installationDate: '', // سيتم تحديده لاحقاً
            responsibleEntity: deliveryOrder.branchName, // الفرع
            customerName: deliveryOrder.customerName,
            phone: deliveryOrder.customerPhone,
            technicianName: '', // سيتم تحديده لاحقاً
            technicianPhone: '', // سيتم تحديده لاحقاً
            district: deliveryOrder.districtName,
            region: deliveryOrder.regionName,
            governorate: deliveryOrder.governorateName,
            serviceType: ['تركيب'], // نوع الخدمة الافتراضي
            notes: `تم إنشاؤه تلقائياً من طلب توصيل: ${deliveryOrder.fullInvoiceNumber}`,
            status: 'جديد',
            sourceType: 'delivery',
            deliveryOrderId: deliveryOrder.id,
            createdAt: serverTimestamp()
          };

          // إضافة طلب التركيب
          await addDoc(collection(db, 'installation_orders'), installationOrderData);
          createdCount++;
          console.log(`تم إنشاء طلب تركيب: ${orderNumber} من طلب التوصيل: ${deliveryOrder.fullInvoiceNumber}`);
        }
      }

      // إعادة تحميل الطلبات بعد الإضافة
      await fetchOrders();
      
      if (createdCount > 0) {
        message.success(`تم إنشاء ${createdCount} طلب تركيب جديد من طلبات التوصيل`);
      } else {
        message.info('جميع طلبات التوصيل موجودة مسبقاً');
      }
    } catch (error) {
      console.error('Error creating installation orders from delivery:', error);
      message.error('حدث خطأ في مزامنة طلبات التوصيل');
    } finally {
      setLoading(false);
    }
  };

  // Navigate to add order page
  const navigateToAddOrder = () => {
    navigate('/installation/add-order');
  };

  // Show edit modal
  const showEditModal = (order: InstallationOrder) => {
    setEditingOrder(order);
    form.setFieldsValue({
      ...order,
      date: order.date ? dayjs(order.date) : null,
      installationDate: order.installationDate ? dayjs(order.installationDate) : null,
    });
    setIsModalVisible(true);
  };

  // Show view modal
  const showViewModal = (order: InstallationOrder) => {
    setViewingOrder(order);
    setIsViewModalVisible(true);
  };

  // Handle submit
  const handleSubmit = async (values: FormValues) => {
    try {
      const orderData = {
        orderNumber: values.orderNumber,
        date: values.date.format('YYYY-MM-DD'),
        createdTime: values.createdTime || dayjs().format('HH:mm:ss'),
        documentNumber: values.documentNumber,
        installationDate: values.installationDate.format('YYYY-MM-DD'),
        responsibleEntity: values.responsibleEntity,
        customerName: values.customerName,
        phone: values.phone,
        technicianName: values.technicianName,
        technicianPhone: values.technicianPhone,
        district: values.district,
        districtName: values.district, // حفظ اسم الحي
        region: values.region,
        regionName: values.region, // حفظ اسم المنطقة
        governorate: values.governorate,
        governorateName: values.governorate, // حفظ اسم المحافظة
        serviceType: values.serviceType,
        notes: values.notes || '',
        status: values.installationDate ? 'مؤكد' : 'جديد',
        createdAt: serverTimestamp()
      };

      if (editingOrder && editingOrder.id) {
        // Update existing order
        await updateDoc(doc(db, 'installation_orders', editingOrder.id), orderData);
        message.success('تم تحديث الطلب بنجاح');
      } else {
        // Add new order
        await addDoc(collection(db, 'installation_orders'), orderData);
        message.success('تم إضافة الطلب بنجاح');
      }

      setIsModalVisible(false);
      form.resetFields();
      fetchOrders();
    } catch (error) {
      console.error('Error saving order:', error);
      message.error('حدث خطأ في حفظ الطلب');
    }
  };

  // Delete order
  const handleDelete = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'installation_orders', orderId));
      message.success('تم حذف الطلب بنجاح');
      fetchOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      message.error('حدث خطأ في حذف الطلب');
    }
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
        'الحي': order.district,
        'المنطقة': order.region,
        'المحافظة': order.governorate,
        'نوع الخدمة': order.serviceType.join(', '),
        'الملاحظات': order.notes,
        'الحالة': order.status || 'جديد'
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'طلبات التركيب');
      XLSX.writeFile(wb, `installation_orders_${dayjs().format('YYYY-MM-DD')}.xlsx`);
      message.success('تم تصدير البيانات بنجاح');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      message.error('حدث خطأ في تصدير البيانات');
    }
  };

  // Send customer notification
  const sendCustomerNotification = (order: InstallationOrder) => {
    // This is a placeholder - implement actual notification logic
    message.info(`سيتم إرسال إشعار للعميل ${order.customerName} على رقم ${order.phone}`);
  };

  // Send WhatsApp notification
  const sendWhatsAppNotification = (order: InstallationOrder) => {
    if (!order.id) {
      message.error('معرف الطلب غير موجود');
      return;
    }

    // إنشاء رابط صفحة التأكيد
    const confirmationUrl = `${window.location.origin}/installation/confirm/${order.id}`;
    
    // نص الرسالة
    const messageText = `السيد / ${order.customerName}
السلام عليكم ورحمة الله وبركاته

لديكم طلب تركيب برجاء تحديد التاريخ المناسب لسيادتكم لإجراء عملية التركيب

رقم الطلب: ${order.orderNumber}
رقم المستند: ${order.documentNumber}

للتأكيد وتحديد موعد التركيب، الرجاء الضغط على الرابط التالي:
${confirmationUrl}

شكراً لكم`;

    // تحويل النص لصيغة URL
    const encodedMessage = encodeURIComponent(messageText);
    
    // رقم الهاتف بدون الصفر الأول وإضافة كود الدولة (966 للسعودية)
    const phoneNumber = order.phone.startsWith('0') 
      ? '966' + order.phone.slice(1) 
      : '966' + order.phone;
    
    // فتح واتساب
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
    
    message.success('تم فتح واتساب لإرسال الإشعار');
  };

  // Confirm order
  const confirmOrder = async (orderId: string) => {
    try {
      await updateDoc(doc(db, 'installation_orders', orderId), {
        status: 'مؤكد'
      });
      message.success('تم تأكيد الطلب بنجاح');
      fetchOrders();
    } catch (error) {
      console.error('Error confirming order:', error);
      message.error('حدث خطأ في تأكيد الطلب');
    }
  };

  // Print order
  const handlePrint = () => {
    window.print();
  };

  // Filter orders with advanced filters
  const filteredOrders = orders.filter(order => {
    // البحث برقم الطلب
    const orderNumberMatch = !searchOrderNumber || 
      order.orderNumber.toLowerCase().includes(searchOrderNumber.toLowerCase());

    // البحث برقم المستند
    const documentNumberMatch = !searchDocumentNumber || 
      order.documentNumber.toLowerCase().includes(searchDocumentNumber.toLowerCase());

    // البحث برقم الهاتف
    const phoneMatch = !searchPhone || 
      order.phone.includes(searchPhone);

    // البحث في الملاحظات
    const notesMatch = !searchNotes || 
      (order.notes && order.notes.toLowerCase().includes(searchNotes.toLowerCase()));

    // البحث بالفني
    const technicianMatch = !searchTechnician || 
      (order.technicianName && order.technicianName.toLowerCase().includes(searchTechnician.toLowerCase())) ||
      (order.technicianPhone && order.technicianPhone.includes(searchTechnician));

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

    // البحث باسم العميل
    const customerNameMatch = !searchText || 
      order.customerName.toLowerCase().includes(searchText.toLowerCase());

    return orderNumberMatch && documentNumberMatch && phoneMatch && 
           notesMatch && technicianMatch && districtMatch && regionMatch && 
           governorateMatch && installationDateMatch && customerNameMatch;
  });

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
      title: 'وقت الإنشاء',
      dataIndex: 'createdTime',
      key: 'createdTime',
      width: 100,
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
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : <Tag color="orange">لم يحدد بعد</Tag>
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
      width: 150,
      render: (name: string) => name || <Tag color="orange">لم يحدد بعد</Tag>
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
      title: 'الملاحظات',
      dataIndex: 'notes',
      key: 'notes',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'الحالة',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const color = status === 'مؤكد' ? 'green' : status === 'ملغي' ? 'red' : 'blue';
        return <Tag color={color}>{status || 'جديد'}</Tag>;
      }
    },
    {
      title: 'إشعار العميل',
      key: 'whatsapp',
      width: 150,
      align: 'center' as const,
      fixed: 'right' as const,
      render: (_text: unknown, record: InstallationOrder) => (
        <Button
          type="primary"
          style={{ backgroundColor: '#25D366', borderColor: '#25D366' }}
          icon={<BellOutlined />}
          onClick={() => sendWhatsAppNotification(record)}
          size="middle"
        >
          إرسال واتساب
        </Button>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      fixed: 'right' as const,
      width: 200,
      render: (_text: unknown, record: InstallationOrder) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => showViewModal(record)}
            title="معاينة"
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => showEditModal(record)}
            title="تعديل"
          />
          <Popconfirm
            title="هل أنت متأكد من حذف هذا الطلب؟"
            onConfirm={() => handleDelete(record.id!)}
            okText="نعم"
            cancelText="لا"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              title="حذف"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة طلبات التوصيل
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
        <title>طلبات التركيب | ERP90 Dashboard</title>
        <meta name="description" content="إدارة طلبات التركيب والصيانة، متابعة حالة التركيب، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تركيب, صيانة, طلبات, فني, عملاء, Installation, Orders" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <svg className="h-8 w-8 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">طلبات التركيب</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة ومتابعة طلبات التركيب والصيانة</p>
            </div>
          </div>
          
          {/* Statistics Tags */}
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 dark:bg-orange-900/20 px-4 py-2 rounded-lg border border-orange-200 dark:border-orange-800">
              <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                إجمالي: {orders.length}
              </span>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-lg border border-green-200 dark:border-green-800">
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                تلقائي: {orders.filter(o => o.sourceType === 'delivery').length}
              </span>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 px-4 py-2 rounded-lg border border-purple-200 dark:border-purple-800">
              <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                يدوي: {orders.filter(o => o.sourceType !== 'delivery').length}
              </span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التركيبات", to: "/management/installation" },
          { label: "طلبات التركيب" }
        ]}
      />

      {/* Info Alert */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
        <svg className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="text-sm text-yellow-800">
          <strong>ملاحظة:</strong> هذه الصفحة تعرض فقط الطلبات الجديدة (التي لم يتم تأكيدها بعد). يتم استيراد الطلبات تلقائياً من طلبات التوصيل المكتملة والمؤرشفة التي تحتاج تركيب.
        </div>
      </div>

      {/* Search Filters Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
        
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
            <span style={labelStyle}>اسم العميل</span>
            <Input 
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="ادخل اسم العميل"
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
            <span style={labelStyle}>الملاحظات</span>
            <Input 
              value={searchNotes}
              onChange={e => setSearchNotes(e.target.value)}
              placeholder="ابحث في الملاحظات"
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
                  {tech.name} - {tech.phone}
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
              type="primary"
              icon={<PlusOutlined />}
              onClick={navigateToAddOrder}
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
              إضافة طلب جديد
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={fetchAndCreateInstallationOrdersFromDelivery}
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
              مزامنة طلبات التوصيل
            </Button>
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
                setSearchNotes('');
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
          <h3 className="text-lg font-semibold text-gray-700">قائمة طلبات التركيب</h3>
        </div>

        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          scroll={{ x: 2200, y: 600 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `إجمالي ${total} طلب`,
          }}
          bordered
        />
      </div>

        {/* Edit Modal */}
        <Modal
          title={
            <Title level={3}>
              ✏️ تعديل طلب تركيب
            </Title>
          }
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            form.resetFields();
          }}
          footer={null}
          width={900}
          style={{ top: 20 }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            className="installation-order-form"
          >
            {/* البيانات الأساسية */}
            <Divider orientation="left">
              <Text strong style={{ fontSize: 16 }}>📋 البيانات الأساسية</Text>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="رقم الطلب"
                  name="orderNumber"
                  rules={[{ required: true, message: 'الرجاء إدخال رقم الطلب' }]}
                >
                  <Input disabled size="large" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="التاريخ"
                  name="date"
                  rules={[{ required: true, message: 'الرجاء اختيار التاريخ' }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    size="large"
                    format="YYYY-MM-DD"
                    disabledDate={(current) => current && current < dayjs().startOf('day')}
                  />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="وقت الإنشاء"
                  name="createdTime"
                >
                  <Input disabled size="large" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="رقم المستند"
                  name="documentNumber"
                  rules={[{ required: true, message: 'الرجاء إدخال رقم المستند' }]}
                >
                  <Input placeholder="رقم المستند" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="تاريخ التركيب"
                  name="installationDate"
                  rules={[{ required: true, message: 'الرجاء اختيار تاريخ التركيب' }]}
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    size="large"
                    format="YYYY-MM-DD"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  label="الجهة المسؤولة (الفرع)"
                  name="responsibleEntity"
                  rules={[{ required: true, message: 'الرجاء اختيار الجهة المسؤولة' }]}
                >
                  <Select placeholder="اختر الفرع" size="large">
                    {branches.map(branch => (
                      <Option key={branch.id} value={branch.name}>
                        {branch.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* بيانات العميل */}
            <Divider orientation="left">
              <Text strong style={{ fontSize: 16 }}>👤 بيانات العميل</Text>
            </Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="اسم العميل"
                  name="customerName"
                  rules={[{ required: true, message: 'الرجاء إدخال اسم العميل' }]}
                >
                  <Input placeholder="اسم العميل" size="large" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="رقم الهاتف"
                  name="phone"
                  rules={[
                    { required: true, message: 'الرجاء إدخال رقم الهاتف' },
                    { pattern: /^[0-9]{10}$/, message: 'رقم الهاتف يجب أن يكون 10 أرقام' }
                  ]}
                >
                  <Input placeholder="05xxxxxxxx" size="large" maxLength={10} />
                </Form.Item>
              </Col>
            </Row>

            {/* بيانات العنوان */}
            <Divider orientation="left">
              <Text strong style={{ fontSize: 16 }}>📍 بيانات العنوان</Text>
            </Divider>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="الحي"
                  name="district"
                  rules={[{ required: true, message: 'الرجاء اختيار الحي' }]}
                >
                  <Select placeholder="اختر الحي" size="large" showSearch>
                    {districts.map(district => (
                      <Option key={district.id} value={district.name}>{district.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="المنطقة"
                  name="region"
                  rules={[{ required: true, message: 'الرجاء اختيار المنطقة' }]}
                >
                  <Select placeholder="اختر المنطقة" size="large" showSearch>
                    {regions.map(region => (
                      <Option key={region.id} value={region.name}>{region.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="المحافظة"
                  name="governorate"
                  rules={[{ required: true, message: 'الرجاء اختيار المحافظة' }]}
                >
                  <Select placeholder="اختر المحافظة" size="large" showSearch>
                    {governorates.map(gov => (
                      <Option key={gov.id} value={gov.name}>{gov.name}</Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* بيانات الفني */}
            <Divider orientation="left">
              <Text strong style={{ fontSize: 16 }}>🔧 بيانات الفني</Text>
            </Divider>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="الفني"
                  name="technicianName"
                  rules={[{ required: true, message: 'الرجاء اختيار الفني' }]}
                >
                  <Select 
                    placeholder="اختر الفني" 
                    size="large" 
                    showSearch
                    onChange={(value) => {
                      const selectedTech = technicians.find(t => t.name === value);
                      if (selectedTech) {
                        form.setFieldsValue({ technicianPhone: selectedTech.phone });
                      }
                    }}
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    {technicians.map(tech => (
                      <Option key={tech.id} value={tech.name}>
                        {tech.name} - {tech.phone}
                        {tech.specialization && ` (${tech.specialization})`}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="هاتف الفني"
                  name="technicianPhone"
                  rules={[
                    { required: true, message: 'الرجاء إدخال هاتف الفني' },
                    { pattern: /^[0-9]{10}$/, message: 'رقم الهاتف يجب أن يكون 10 أرقام' }
                  ]}
                >
                  <Input placeholder="05xxxxxxxx" size="large" maxLength={10} />
                </Form.Item>
              </Col>
            </Row>

            {/* بيانات الخدمة */}
            <Divider orientation="left">
              <Text strong style={{ fontSize: 16 }}>🛠️ بيانات الخدمة</Text>
            </Divider>

            <Form.Item
              label="نوع الخدمة"
              name="serviceType"
              rules={[{ required: true, message: 'الرجاء اختيار نوع الخدمة' }]}
            >
              <Checkbox.Group style={{ width: '100%' }}>
                <Row gutter={[16, 16]}>
                  <Col span={8}>
                    <Checkbox value="تركيب" style={{ fontSize: 16 }}>
                      🔨 تركيب
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="فك" style={{ fontSize: 16 }}>
                      🔧 فك
                    </Checkbox>
                  </Col>
                  <Col span={8}>
                    <Checkbox value="فك وتركيب" style={{ fontSize: 16 }}>
                      🔄 فك وتركيب
                    </Checkbox>
                  </Col>
                </Row>
              </Checkbox.Group>
            </Form.Item>

            {/* الملاحظات */}
            <Divider orientation="left">
              <Text strong style={{ fontSize: 16 }}>📝 ملاحظات</Text>
            </Divider>

            <Form.Item
              label="ملاحظات"
              name="notes"
            >
              <TextArea
                rows={4}
                placeholder="أدخل أي ملاحظات إضافية..."
                size="large"
              />
            </Form.Item>

            {/* Action Buttons */}
            <Form.Item>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
                <Button
                  size="large"
                  onClick={() => {
                    setIsModalVisible(false);
                    form.resetFields();
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  icon={<CheckCircleOutlined />}
                >
                  حفظ
                </Button>
                <Button
                  type="default"
                  size="large"
                  onClick={handlePrint}
                >
                  حفظ وطباعة
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* View Modal */}
        <Modal
          title={<Title level={3}>👁️ معاينة طلب التركيب</Title>}
          open={isViewModalVisible}
          onCancel={() => setIsViewModalVisible(false)}
          footer={[
            <Button key="close" onClick={() => setIsViewModalVisible(false)}>
              إغلاق
            </Button>
          ]}
          width={700}
        >
          {viewingOrder && (
            <div style={{ padding: '20px 0' }}>
              <Row gutter={[16, 24]}>
                <Col span={12}>
                  <Text strong>رقم الطلب:</Text>
                  <div><Tag color="blue" style={{ fontSize: 14 }}>{viewingOrder.orderNumber}</Tag></div>
                </Col>
                <Col span={12}>
                  <Text strong>التاريخ:</Text>
                  <div><Text>{viewingOrder.date}</Text></div>
                </Col>
                <Col span={12}>
                  <Text strong>وقت الإنشاء:</Text>
                  <div><Text>{viewingOrder.createdTime}</Text></div>
                </Col>
                <Col span={12}>
                  <Text strong>رقم المستند:</Text>
                  <div><Text>{viewingOrder.documentNumber}</Text></div>
                </Col>
                <Col span={12}>
                  <Text strong>تاريخ التركيب:</Text>
                  <div><Text>{viewingOrder.installationDate}</Text></div>
                </Col>
                <Col span={12}>
                  <Text strong>الجهة المسؤولة:</Text>
                  <div><Text>{viewingOrder.responsibleEntity}</Text></div>
                </Col>

                <Col span={24}><Divider>بيانات العميل</Divider></Col>
                <Col span={12}>
                  <Text strong>اسم العميل:</Text>
                  <div><Text>{viewingOrder.customerName}</Text></div>
                </Col>
                <Col span={12}>
                  <Text strong>رقم الهاتف:</Text>
                  <div><Text>{viewingOrder.phone}</Text></div>
                </Col>

                <Col span={24}><Divider>بيانات العنوان</Divider></Col>
                <Col span={8}>
                  <Text strong>الحي:</Text>
                  <div><Text>{viewingOrder.district}</Text></div>
                </Col>
                <Col span={8}>
                  <Text strong>المنطقة:</Text>
                  <div><Text>{viewingOrder.region}</Text></div>
                </Col>
                <Col span={8}>
                  <Text strong>المحافظة:</Text>
                  <div><Text>{viewingOrder.governorate}</Text></div>
                </Col>

                <Col span={24}><Divider>بيانات الفني</Divider></Col>
                <Col span={12}>
                  <Text strong>اسم الفني:</Text>
                  <div><Text>{viewingOrder.technicianName}</Text></div>
                </Col>
                <Col span={12}>
                  <Text strong>هاتف الفني:</Text>
                  <div><Text>{viewingOrder.technicianPhone}</Text></div>
                </Col>

                <Col span={24}><Divider>بيانات الخدمة</Divider></Col>
                <Col span={24}>
                  <Text strong>نوع الخدمة:</Text>
                  <div style={{ marginTop: 8 }}>
                    {viewingOrder.serviceType.map((type, index) => (
                      <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                        {type}
                      </Tag>
                    ))}
                  </div>
                </Col>

                {viewingOrder.notes && (
                  <>
                    <Col span={24}><Divider>ملاحظات</Divider></Col>
                    <Col span={24}>
                      <div style={{ 
                        background: '#f5f5f5', 
                        padding: 12, 
                        borderRadius: 8,
                        whiteSpace: 'pre-wrap'
                      }}>
                        {viewingOrder.notes}
                      </div>
                    </Col>
                  </>
                )}

                <Col span={24}><Divider>الحالة</Divider></Col>
                <Col span={24}>
                  <Tag color={viewingOrder.status === 'مؤكد' ? 'green' : 'blue'} style={{ fontSize: 14 }}>
                    {viewingOrder.status || 'جديد'}
                  </Tag>
                </Col>
              </Row>
            </div>
          )}
        </Modal>
      </div>

      <style>{`
        .installation-order-form .ant-form-item-label > label {
          font-weight: 600;
          font-size: 14px;
        }
        
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
        
        @media print {
          .ant-modal-footer,
          .ant-modal-close {
            display: none !important;
          }
        }
      `}</style>
    </>
  );
};

export default InstallationOrders;

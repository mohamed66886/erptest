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
  Modal
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
import { motion } from 'framer-motion';
import Breadcrumb from '@/components/Breadcrumb';

const { Title, Text } = Typography;

// Types
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
  const [technicians, setTechnicians] = useState<{id: string; name: string; nameAr?: string; phone?: string}[]>([]);
  
  // States for confirmation modal
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<React.Key[]>([]);
  const [confirmationLoading, setConfirmationLoading] = useState(false);
  const [selectedTechnicianFilter, setSelectedTechnicianFilter] = useState<string>('');

  useEffect(() => {
    fetchConfirmedOrders();
    fetchTechnicians();
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
        phone: doc.data().phone || doc.data().mobile || ''
      }));
      setTechnicians(techniciansData);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      message.error('حدث خطأ في جلب قائمة الفنيين');
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

  // Filter orders
  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchText.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchText.toLowerCase()) ||
    order.phone.includes(searchText) ||
    order.documentNumber.toLowerCase().includes(searchText.toLowerCase())
  );

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

  return (
    <>
      <Helmet>
        <title>الطلبات المؤكدة - ERP90</title>
      </Helmet>

      <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <CheckCircleOutlined style={{ fontSize: 32, color: '#16a34a' }} />
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
                  الطلبات المؤكدة
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-base">
                  عرض جميع طلبات التركيب المؤكدة
                </p>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-200"></div>
        </div>

        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة التركيبات", to: "/installation" },
            { label: "الطلبات المؤكدة" }
          ]}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card>
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={2} style={{ marginBottom: 0 }}>
                  ✅ الطلبات المؤكدة
                </Title>
                <div style={{ display: 'flex', gap: 16 }}>
                  <Tag color="green" style={{ fontSize: 14, padding: '6px 12px' }}>
                    إجمالي الطلبات المؤكدة: {orders.length}
                  </Tag>
                </div>
              </div>

              <div style={{ 
                background: '#f0fdf4', 
                border: '1px solid #86efac', 
                borderRadius: 8, 
                padding: 12, 
                marginBottom: 16 
              }}>
                <Text style={{ fontSize: 14, color: '#16a34a' }}>
                  ℹ️ <strong>ملاحظة:</strong> هذه الصفحة تعرض جميع طلبات التركيب التي تم تأكيدها (لها تاريخ تركيب محدد).
                </Text>
              </div>

              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={24} md={12} lg={8}>
                  <Input
                    placeholder="البحث برقم الطلب، اسم العميل، رقم الهاتف..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    size="large"
                  />
                </Col>
              </Row>

              <Space wrap style={{ marginBottom: 16 }}>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={exportToExcel}
                  size="large"
                  type="primary"
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  تصدير Excel
                </Button>

                <Button
                  icon={<CheckSquareOutlined />}
                  onClick={openConfirmationModal}
                  size="large"
                  type="primary"
                  style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
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
              </Space>
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
          </Card>
        </motion.div>

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
              onChange: (selectedKeys) => {
                setSelectedOrderIds(selectedKeys);
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
      `}</style>
    </>
  );
};

export default ConfirmedOrders;

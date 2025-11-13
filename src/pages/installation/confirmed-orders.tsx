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
  Col
} from 'antd';
import { 
  EyeOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { db } from '@/lib/firebase';
import { 
  collection, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  FieldValue
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

  useEffect(() => {
    fetchConfirmedOrders();
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

              <Space wrap>
                <Button
                  icon={<FileExcelOutlined />}
                  onClick={exportToExcel}
                  size="large"
                  type="primary"
                  style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
                >
                  تصدير Excel
                </Button>
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

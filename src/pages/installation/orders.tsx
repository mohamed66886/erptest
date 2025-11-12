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
  SearchOutlined
} from '@ant-design/icons';
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
import { motion } from 'framer-motion';

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
  region: string;
  governorate: string;
  serviceType: string[];
  notes: string;
  status?: string;
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

  // Districts, Regions, Governorates data
  const districts = ['حي النهضة', 'حي الملك فهد', 'حي الروضة', 'حي العليا', 'حي السليمانية'];
  const regions = ['الشمال', 'الجنوب', 'الشرق', 'الغرب', 'الوسط'];
  const governorates = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الخبر', 'الطائف'];

  useEffect(() => {
    fetchOrders();
    fetchBranches();
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

  // Fetch orders
  const fetchOrders = async () => {
    setLoading(true);
    try {
      const ordersQuery = query(
        collection(db, 'installation_orders'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(ordersQuery);
      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as InstallationOrder[];
      setOrders(ordersData);
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
        region: values.region,
        governorate: values.governorate,
        serviceType: values.serviceType,
        notes: values.notes || '',
        status: 'جديد',
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
      render: (text: string) => <Text strong style={{ color: '#1890ff' }}>{text}</Text>
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
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
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
    },
    {
      title: 'الحي',
      dataIndex: 'district',
      key: 'district',
      width: 120,
    },
    {
      title: 'المنطقة',
      dataIndex: 'region',
      key: 'region',
      width: 100,
    },
    {
      title: 'المحافظة',
      dataIndex: 'governorate',
      key: 'governorate',
      width: 120,
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

  return (
    <>
      <Helmet>
        <title>طلبات التركيب - ERP90</title>
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ padding: '24px' }}
      >
        <Card>
          <div style={{ marginBottom: 24 }}>
            <Title level={2} style={{ marginBottom: 16 }}>
              📦 طلبات التركيب
            </Title>

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
                type="primary"
                icon={<PlusOutlined />}
                onClick={navigateToAddOrder}
                size="large"
              >
                إضافة طلب جديد
              </Button>
              <Button
                icon={<FileExcelOutlined />}
                onClick={exportToExcel}
                size="large"
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
            scroll={{ x: 2000, y: 600 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `إجمالي ${total} طلب`,
            }}
            bordered
          />
        </Card>

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
                      <Option key={district} value={district}>{district}</Option>
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
                      <Option key={region} value={region}>{region}</Option>
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
                      <Option key={gov} value={gov}>{gov}</Option>
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
                  label="اسم الفني"
                  name="technicianName"
                  rules={[{ required: true, message: 'الرجاء إدخال اسم الفني' }]}
                >
                  <Input placeholder="اسم الفني" size="large" />
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
            </Button>,
            <Button
              key="notify"
              type="default"
              icon={<BellOutlined />}
              onClick={() => viewingOrder && sendCustomerNotification(viewingOrder)}
            >
              إشعار العميل
            </Button>,
            <Button
              key="confirm"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => {
                if (viewingOrder?.id) {
                  confirmOrder(viewingOrder.id);
                  setIsViewModalVisible(false);
                }
              }}
            >
              تأكيد الطلب
            </Button>,
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
      </motion.div>

      <style>{`
        .installation-order-form .ant-form-item-label > label {
          font-weight: 600;
          font-size: 14px;
        }
        
        .ant-table-wrapper {
          direction: rtl;
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

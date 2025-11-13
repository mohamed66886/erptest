import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { collection, query, where, getDocs } from "firebase/firestore";
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
  CheckCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import Breadcrumb from "@/components/Breadcrumb";
import type { ColumnsType } from 'antd/es/table';

dayjs.locale('ar');

const { RangePicker } = DatePicker;
const { Option } = Select;

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
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InstallationOrder | null>(null);

  // جلب البيانات
  useEffect(() => {
    if (currentFinancialYear) {
      fetchCompletedOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFinancialYear]);

  const fetchCompletedOrders = async () => {
    if (!currentFinancialYear) return;
    
    setLoading(true);
    try {
      const ordersRef = collection(db, "installation_orders");
      
      // استعلام بدون orderBy لتجنب مشكلة الفهرس
      const q = query(
        ordersRef,
        where("financialYearId", "==", currentFinancialYear.id),
        where("status", "==", "مكتمل")
      );

      const querySnapshot = await getDocs(q);
      const ordersData: InstallationOrder[] = [];
      const techniciansList: Set<string> = new Set();

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const order = {
          id: doc.id,
          ...data,
        } as InstallationOrder;
        
        // فقط الطلبات التي تحتوي على صور قبل وبعد
        if (order.beforeImageUrl && order.afterImageUrl) {
          ordersData.push(order);
          
          if (data.technicianName) {
            techniciansList.add(data.technicianName);
          }
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
      setTechnicians(Array.from(techniciansList));
    } catch (error) {
      console.error("Error fetching completed orders:", error);
      message.error("حدث خطأ في تحميل الطلبات المكتملة");
    } finally {
      setLoading(false);
    }
  };

  // البحث والفلترة
  useEffect(() => {
    let filtered = [...orders];

    // البحث النصي
    if (searchText) {
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        order.documentNumber.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customerName.toLowerCase().includes(searchText.toLowerCase()) ||
        order.phone.includes(searchText)
      );
    }

    // فلترة حسب التاريخ
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
  }, [searchText, selectedDateRange, selectedTechnician, orders]);

  // عرض التفاصيل
  const showOrderDetails = (order: InstallationOrder) => {
    setSelectedOrder(order);
    setDetailsModalVisible(true);
  };

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
        <Tag color="success" icon={<CheckCircleOutlined />}>
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
    <div className="w-full p-4 sm:p-6 space-y-6 font-['Tajawal']" dir="rtl">
      <Helmet>
        <title>الطلبات المكتملة | إدارة التركيب</title>
        <meta name="description" content="عرض طلبات التركيب المكتملة مع الصور" />
      </Helmet>

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <CheckCircleOutlined className="text-3xl text-green-600 dark:text-green-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">الطلبات المكتملة مع الصور</h1>
            <p className="text-gray-600 dark:text-gray-400">عرض طلبات التركيب المكتملة التي تم رفع الصور لها</p>
          </div>
        </div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التركيب", to: "/installation" },
          { label: "الطلبات المكتملة" },
        ]}
      />

      {/* Info Alert */}
      <Card className="shadow-md bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200">
        <div className="flex items-center gap-3">
          <FileImageOutlined className="text-3xl text-blue-600" />
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              📸 الطلبات المكتملة مع الصور
            </h3>
            <p className="text-sm text-gray-600">
              يعرض هذا القسم فقط طلبات التركيب المكتملة التي تم رفع صور قبل وبعد التركيب لها
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="shadow-md">
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Input
                placeholder="البحث برقم الطلب، المستند، العميل أو الهاتف"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                size="large"
                allowClear
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <RangePicker
                placeholder={['من تاريخ', 'إلى تاريخ']}
                style={{ width: '100%' }}
                size="large"
                value={selectedDateRange}
                onChange={(dates) => setSelectedDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
              />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Select
                placeholder="تصفية حسب الفني"
                style={{ width: '100%' }}
                size="large"
                value={selectedTechnician}
                onChange={setSelectedTechnician}
                allowClear
              >
                {technicians.map((tech) => (
                  <Option key={tech} value={tech}>{tech}</Option>
                ))}
              </Select>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* Statistics */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card className="shadow-md bg-gradient-to-br from-green-50 to-green-100">
            <div className="text-center">
              <h3 className="text-lg text-gray-600 mb-2">إجمالي الطلبات المكتملة</h3>
              <p className="text-4xl font-bold text-green-600">{filteredOrders.length}</p>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="text-center">
              <h3 className="text-lg text-gray-600 mb-2">جميع الطلبات بها صور</h3>
              <p className="text-4xl font-bold text-blue-600">
                {filteredOrders.length}
              </p>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="text-center">
              <h3 className="text-lg text-gray-600 mb-2">عدد الفنيين</h3>
              <p className="text-4xl font-bold text-purple-600">{technicians.length}</p>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card className="shadow-lg">
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
        />
      </Card>

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
  );
};

export default CompletedOrders;

import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  DatePicker, 
  message, 
  Space,
  Typography,
  Divider,
  Row,
  Col,
  Tag,
  Spin,
  Result
} from 'antd';
import { 
  CheckCircleOutlined,
  CalendarOutlined,
  UserOutlined,
  PhoneOutlined,
  HomeOutlined,
  FileTextOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { db } from '@/lib/firebase';
import { 
  doc, 
  getDoc, 
  updateDoc
} from 'firebase/firestore';
import dayjs from 'dayjs';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { motion } from 'framer-motion';
import 'dayjs/locale/ar';

dayjs.locale('ar');

const { Title, Text, Paragraph } = Typography;

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
}

const ConfirmInstallationOrder: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<InstallationOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (orderId) {
      fetchOrder();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Fetch order details
  const fetchOrder = async () => {
    if (!orderId) return;

    setLoading(true);
    try {
      const orderDoc = await getDoc(doc(db, 'installation_orders', orderId));
      
      if (orderDoc.exists()) {
        const orderData = {
          id: orderDoc.id,
          ...orderDoc.data()
        } as InstallationOrder;
        
        setOrder(orderData);
        
        // إذا كان هناك تاريخ تركيب محدد مسبقاً
        if (orderData.installationDate) {
          setSelectedDate(dayjs(orderData.installationDate));
        }
      } else {
        message.error('الطلب غير موجود');
      }
    } catch (error) {
      console.error('Error fetching order:', error);
      message.error('حدث خطأ في جلب بيانات الطلب');
    } finally {
      setLoading(false);
    }
  };

  // Handle confirm
  const handleConfirm = async () => {
    if (!selectedDate) {
      message.error('يرجى تحديد تاريخ التركيب');
      return;
    }

    if (!orderId) {
      message.error('معرف الطلب غير موجود');
      return;
    }

    setSubmitting(true);
    try {
      await updateDoc(doc(db, 'installation_orders', orderId), {
        installationDate: selectedDate.format('YYYY-MM-DD'),
        status: 'مؤكد',
        confirmedAt: new Date().toISOString()
      });

      setConfirmed(true);
      message.success('تم تأكيد موعد التركيب بنجاح');
    } catch (error) {
      console.error('Error confirming order:', error);
      message.error('حدث خطأ في تأكيد الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  // Disable dates (same day or previous days)
  const disabledDate = (current: dayjs.Dayjs) => {
    // لا يمكن اختيار اليوم الحالي أو الأيام السابقة
    return current && current.isBefore(dayjs().add(1, 'day').startOf('day'));
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Result
          status="404"
          title="الطلب غير موجود"
          subTitle="عذراً، لم نتمكن من العثور على الطلب المطلوب"
          extra={
            <Button type="primary" onClick={() => navigate('/')}>
              العودة للرئيسية
            </Button>
          }
        />
      </div>
    );
  }

  if (confirmed) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: window.innerWidth < 768 ? '15px' : '20px'
      }}>
        <Helmet>
          <title>تم التأكيد بنجاح | ERP90</title>
        </Helmet>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{ width: '100%', maxWidth: 600 }}
        >
          <Result
            status="success"
            title={
              <span style={{ fontSize: window.innerWidth < 768 ? '18px' : '24px' }}>
                تم تأكيد موعد التركيب بنجاح!
              </span>
            }
            subTitle={
              <div>
                <Paragraph style={{ fontSize: window.innerWidth < 768 ? 15 : 18, marginTop: window.innerWidth < 768 ? 15 : 20 }}>
                  شكراً لك سيد/ة <strong>{order.customerName}</strong>
                </Paragraph>
                <Paragraph style={{ fontSize: window.innerWidth < 768 ? 14 : 16 }}>
                  تم تأكيد موعد التركيب بتاريخ: <strong>{selectedDate?.format('YYYY/MM/DD')}</strong>
                </Paragraph>
                <Paragraph style={{ fontSize: window.innerWidth < 768 ? 14 : 16 }}>
                  رقم الطلب: <strong>{order.orderNumber}</strong>
                </Paragraph>
                <Paragraph style={{ fontSize: window.innerWidth < 768 ? 12 : 14, marginTop: window.innerWidth < 768 ? 15 : 20, color: '#666' }}>
                  سيتم التواصل معكم قبل موعد التركيب
                </Paragraph>
              </div>
            }
            extra={[
              <Button 
                type="primary" 
                size="large"
                key="home"
                onClick={() => window.close()}
                style={{ 
                  minWidth: window.innerWidth < 768 ? 120 : 150,
                  height: window.innerWidth < 768 ? 45 : 50,
                  fontSize: window.innerWidth < 768 ? 15 : 16
                }}
              >
                إغلاق
              </Button>
            ]}
            style={{
              background: 'white',
              padding: window.innerWidth < 768 ? '40px 20px' : '60px 40px',
              borderRadius: 16,
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: window.innerWidth < 768 ? '20px 10px' : '40px 20px',
      fontFamily: 'Tajawal, sans-serif'
    }}>
      <Helmet>
        <title>تأكيد طلب التركيب | ERP90</title>
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ maxWidth: 800, margin: '0 auto' }}
      >
        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}
          bodyStyle={{ padding: 0 }}
        >
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: window.innerWidth < 768 ? '20px 15px' : '30px',
            textAlign: 'center',
            color: 'white'
          }}>
            <CheckCircleOutlined style={{ fontSize: window.innerWidth < 768 ? 40 : 60, marginBottom: window.innerWidth < 768 ? 8 : 16 }} />
            <Title level={window.innerWidth < 768 ? 3 : 2} style={{ color: 'white', marginBottom: 8, fontSize: window.innerWidth < 768 ? '20px' : '30px' }}>
              تأكيد طلب خدمة التركيب
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: window.innerWidth < 768 ? 14 : 16 }}>
              السلام عليكم ورحمة الله وبركاته
            </Text>
          </div>

          {/* Customer Info */}
          <div style={{ padding: window.innerWidth < 768 ? '15px' : '20px 20px 0' }}>
            <Card 
              style={{ 
                background: '#f8f9ff', 
                border: '2px solid #667eea',
                borderRadius: 12,
                marginBottom: window.innerWidth < 768 ? 20 : 30
              }}
              bodyStyle={{ padding: window.innerWidth < 768 ? '16px' : '24px' }}
            >
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Space size={window.innerWidth < 768 ? 'small' : 'large'} style={{ fontSize: window.innerWidth < 768 ? 16 : 20 }}>
                    <UserOutlined style={{ color: '#667eea', fontSize: window.innerWidth < 768 ? 20 : 24 }} />
                    <Text strong style={{ fontSize: window.innerWidth < 768 ? 16 : 20 }}>
                      السيد / {order.customerName}
                    </Text>
                  </Space>
                </Col>
                <Col xs={24} sm={12}>
                  <Space size="small" direction={window.innerWidth < 768 ? 'horizontal' : 'horizontal'}>
                    <PhoneOutlined style={{ color: '#667eea', fontSize: window.innerWidth < 768 ? 14 : 16 }} />
                    <Text style={{ fontSize: window.innerWidth < 768 ? 13 : 14 }}>
                      <span style={{ display: window.innerWidth < 768 ? 'block' : 'inline' }}>
                        رقم الهاتف: {order.phone}
                      </span>
                    </Text>
                  </Space>
                </Col>
                <Col xs={24} sm={12}>
                  <Space size="small" direction={window.innerWidth < 768 ? 'horizontal' : 'horizontal'}>
                    <FileTextOutlined style={{ color: '#667eea', fontSize: window.innerWidth < 768 ? 14 : 16 }} />
                    <Text style={{ fontSize: window.innerWidth < 768 ? 13 : 14 }}>
                      رقم الطلب: <Tag color="blue" style={{ fontSize: window.innerWidth < 768 ? 11 : 12 }}>{order.orderNumber}</Tag>
                    </Text>
                  </Space>
                </Col>
              </Row>
            </Card>

            {/* Message */}
            <Paragraph style={{ 
              fontSize: window.innerWidth < 768 ? 15 : 18, 
              textAlign: 'center',
              background: '#fffbe6',
              padding: window.innerWidth < 768 ? '15px' : '20px',
              borderRadius: 12,
              border: '2px solid #fadb14',
              marginBottom: window.innerWidth < 768 ? 20 : 30,
              lineHeight: window.innerWidth < 768 ? '1.6' : '1.8'
            }}>
              لديكم طلب تركيب، برجاء تحديد التاريخ المناسب لسيادتكم لإجراء عملية التركيب
            </Paragraph>

            {/* Order Details */}
            <Card 
              title={
                <Space size="small">
                  <FileTextOutlined style={{ color: '#667eea', fontSize: window.innerWidth < 768 ? 16 : 18 }} />
                  <Text strong style={{ fontSize: window.innerWidth < 768 ? 15 : 16 }}>تفاصيل الطلب</Text>
                </Space>
              }
              style={{ marginBottom: window.innerWidth < 768 ? 20 : 30 }}
              bodyStyle={{ padding: window.innerWidth < 768 ? '12px' : '24px' }}
            >
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 12 : 14 }}>رقم المستند:</Text>
                  <div><Text strong style={{ fontSize: window.innerWidth < 768 ? 14 : 16 }}>{order.documentNumber}</Text></div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 12 : 14 }}>الفرع:</Text>
                  <div><Text strong style={{ fontSize: window.innerWidth < 768 ? 14 : 16 }}>{order.responsibleEntity}</Text></div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 12 : 14 }}>نوع الخدمة:</Text>
                  <div>
                    {order.serviceType.map((type, index) => (
                      <Tag key={index} color="blue" style={{ marginTop: 4, fontSize: window.innerWidth < 768 ? 11 : 12 }}>
                        {type}
                      </Tag>
                    ))}
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 12 : 14 }}>العنوان:</Text>
                  <div>
                    <Space direction="vertical" size={0}>
                      <Text style={{ fontSize: window.innerWidth < 768 ? 14 : 16 }}>{order.district}</Text>
                      <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 11 : 12 }}>
                        {order.region} - {order.governorate}
                      </Text>
                    </Space>
                  </div>
                </Col>
              </Row>
            </Card>

            <Divider style={{ margin: window.innerWidth < 768 ? '15px 0' : '24px 0' }} />

            {/* Date Selection */}
            <Card
              title={
                <Space size="small">
                  <CalendarOutlined style={{ color: '#667eea', fontSize: window.innerWidth < 768 ? 18 : 20 }} />
                  <Text strong style={{ fontSize: window.innerWidth < 768 ? 16 : 18 }}>تحديد موعد التركيب</Text>
                </Space>
              }
              style={{ marginBottom: window.innerWidth < 768 ? 20 : 30 }}
              bodyStyle={{ padding: window.innerWidth < 768 ? '16px' : '24px' }}
            >
              <Row gutter={[16, 24]} justify="center">
                <Col span={24} style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 12 : 14, display: 'block', marginBottom: 16, lineHeight: '1.6' }}>
                    <ClockCircleOutlined /> يرجى اختيار تاريخ التركيب (لا يمكن اختيار اليوم الحالي أو الأيام السابقة)
                  </Text>
                  <DatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    placeholder="اختر التاريخ"
                    size="large"
                    format="YYYY-MM-DD"
                    locale={arEG}
                    disabledDate={disabledDate}
                    style={{ 
                      width: '100%',
                      maxWidth: window.innerWidth < 768 ? '100%' : 400,
                      height: window.innerWidth < 768 ? 50 : 60,
                      fontSize: window.innerWidth < 768 ? 16 : 18,
                      borderRadius: 12,
                      borderWidth: 2
                    }}
                    suffixIcon={<CalendarOutlined style={{ fontSize: window.innerWidth < 768 ? 16 : 20 }} />}
                  />
                </Col>
              </Row>
            </Card>

            {/* Action Buttons */}
            <Row gutter={16} justify="center" style={{ marginBottom: window.innerWidth < 768 ? 15 : 20 }}>
              <Col xs={24} sm={20} md={16} lg={12}>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<CheckCircleOutlined />}
                  onClick={handleConfirm}
                  loading={submitting}
                  disabled={!selectedDate}
                  style={{
                    height: window.innerWidth < 768 ? 50 : 60,
                    fontSize: window.innerWidth < 768 ? 16 : 18,
                    fontWeight: 'bold',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: 'none',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                  }}
                >
                  تأكيد واعتماد
                </Button>
              </Col>
            </Row>

            {/* Note */}
            <Card 
              style={{ background: '#f0f5ff', border: '1px solid #adc6ff', marginBottom: window.innerWidth < 768 ? 15 : 0 }}
              bodyStyle={{ padding: window.innerWidth < 768 ? '12px' : '16px' }}
            >
              <Text type="secondary" style={{ fontSize: window.innerWidth < 768 ? 12 : 13, lineHeight: '1.6' }}>
                📌 ملاحظة: بعد تأكيد الموعد، سيتم تحديث تاريخ التركيب في النظام وسيتم التواصل معكم قبل الموعد المحدد
              </Text>
            </Card>
          </div>
        </Card>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: window.innerWidth < 768 ? 20 : 30 }}>
          <Text style={{ color: 'white', fontSize: window.innerWidth < 768 ? 12 : 14 }}>
            © 2025 ERP90 - جميع الحقوق محفوظة
          </Text>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmInstallationOrder;

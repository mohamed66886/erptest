import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Button, Card, Descriptions, message, Spin, Tag, Empty } from "antd";
import { DownloadOutlined, FileTextOutlined, PhoneOutlined, EnvironmentOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';

dayjs.locale('ar');

interface DeliveryOrder {
  id: string;
  fullInvoiceNumber: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  districtName: string;
  regionName: string;
  governorateName: string;
  driverName?: string;
  warehouseName: string;
  warehouseKeeper: string;
  status: string;
  deliveryDate: string;
  fileUrl?: string;
  fileName?: string;
  requiresInstallation: boolean;
  notes?: string;
  createdAt: string;
}

const ViewOrder: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        message.error('رقم الطلب غير صحيح');
        setLoading(false);
        return;
      }

      try {
        const orderDoc = await getDoc(doc(db, 'delivery_orders', orderId));
        
        if (orderDoc.exists()) {
          setOrder({
            id: orderDoc.id,
            ...orderDoc.data()
          } as DeliveryOrder);
        } else {
          message.error('الطلب غير موجود');
        }
      } catch (error) {
        console.error('Error fetching order:', error);
        message.error('حدث خطأ في تحميل بيانات الطلب');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  const handleDownloadFile = async () => {
    if (!order?.fileUrl) {
      message.warning('لا يوجد ملف مرفق');
      return;
    }

    setDownloading(true);
    try {
      // فتح الملف في نافذة جديدة للتحميل
      window.open(order.fileUrl, '_blank');
      message.success('تم فتح الملف للتحميل');
    } catch (error) {
      console.error('Error downloading file:', error);
      message.error('حدث خطأ أثناء تحميل الملف');
    } finally {
      setDownloading(false);
    }
  };

  const handleCallCustomer = () => {
    if (!order?.customerPhone) return;
    window.location.href = `tel:${order.customerPhone}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <Spin size="large" tip="جاري تحميل بيانات الطلب..." />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg">
          <Empty description="الطلب غير موجود" />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4 font-['Tajawal']">
      <Helmet>
        <title>عرض طلب التوصيل - {order.fullInvoiceNumber}</title>
        <meta name="description" content={`تفاصيل طلب التوصيل رقم ${order.fullInvoiceNumber}`} />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-6 py-6">
        {/* العنوان */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            طلب توصيل
          </h1>
          <p className="text-xl text-gray-600">
            رقم الفاتورة: <span className="font-bold text-blue-600">{order.fullInvoiceNumber}</span>
          </p>
        </motion.div>

        {/* حالة الطلب */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex justify-center"
        >
          <Tag 
            color={order.status === 'قيد الانتظار' ? 'orange' : order.status === 'مكتمل' ? 'green' : 'red'}
            className="text-xl px-6 py-3 rounded-full"
          >
            {order.status}
          </Tag>
        </motion.div>

        {/* معلومات العميل */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card 
            title={
              <div className="flex items-center gap-3">
                <PhoneOutlined className="text-2xl text-blue-600" />
                <span className="text-2xl">معلومات العميل</span>
              </div>
            }
            className="shadow-lg border-2 border-blue-100"
          >
            <Descriptions bordered column={1} size="middle">
              <Descriptions.Item label={<span className="text-lg font-semibold">الاسم</span>}>
                <span className="text-lg">{order.customerName || 'غير محدد'}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">رقم الهاتف</span>}>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-mono">{order.customerPhone}</span>
                  <Button 
                    type="primary" 
                    icon={<PhoneOutlined />}
                    onClick={handleCallCustomer}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    اتصال
                  </Button>
                </div>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </motion.div>

        {/* معلومات التوصيل */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card 
            title={
              <div className="flex items-center gap-3">
                <EnvironmentOutlined className="text-2xl text-red-600" />
                <span className="text-2xl">معلومات التوصيل</span>
              </div>
            }
            className="shadow-lg border-2 border-red-100"
          >
            <Descriptions bordered column={1} size="middle">
              <Descriptions.Item label={<span className="text-lg font-semibold">المحافظة</span>}>
                <span className="text-lg">{order.governorateName}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">المنطقة</span>}>
                <span className="text-lg">{order.regionName}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">الحي</span>}>
                <span className="text-lg">{order.districtName}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">تاريخ التسليم</span>}>
                <span className="text-lg font-semibold text-red-600">
                  {dayjs(order.deliveryDate).format('dddd، DD MMMM YYYY')}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </motion.div>

        {/* تفاصيل إضافية */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card 
            title={<span className="text-2xl">تفاصيل إضافية</span>}
            className="shadow-lg border-2 border-gray-100"
          >
            <Descriptions bordered column={1} size="middle">
              <Descriptions.Item label={<span className="text-lg font-semibold">الفرع</span>}>
                <span className="text-lg">{order.branchName}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">المستودع</span>}>
                <span className="text-lg">{order.warehouseName}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">أمين المستودع</span>}>
                <span className="text-lg">{order.warehouseKeeper}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="text-lg font-semibold">يتطلب تركيب</span>}>
                <Tag color={order.requiresInstallation ? 'blue' : 'default'} className="text-base px-4 py-1">
                  {order.requiresInstallation ? 'نعم' : 'لا'}
                </Tag>
              </Descriptions.Item>
              {order.notes && (
                <Descriptions.Item label={<span className="text-lg font-semibold">ملاحظات</span>}>
                  <span className="text-lg">{order.notes}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </motion.div>

        {/* الملف المرفق */}
        {order.fileUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card 
              title={
                <div className="flex items-center gap-3">
                  <FileTextOutlined className="text-2xl text-purple-600" />
                  <span className="text-2xl">الملف المرفق</span>
                </div>
              }
              className="shadow-lg border-2 border-purple-100"
            >
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="text-center">
                  <p className="text-lg text-gray-600 mb-2">اسم الملف:</p>
                  <p className="text-xl font-semibold text-gray-800">{order.fileName || 'ملف الطلب'}</p>
                </div>
                <Button
                  type="primary"
                  size="large"
                  icon={<DownloadOutlined />}
                  onClick={handleDownloadFile}
                  loading={downloading}
                  className="bg-purple-600 hover:bg-purple-700 h-14 px-8 text-lg"
                >
                  تحميل الملف
                </Button>
              </div>
            </Card>
          </motion.div>
        )}

        {/* تذكير للسائق */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
        >
          <Card className="shadow-lg border-2 border-amber-200 bg-amber-50">
            <div className="text-center space-y-3">
              <h3 className="text-2xl font-bold text-amber-800">⚠️ تنبيه مهم</h3>
              <p className="text-lg text-gray-700">
                بعد التسليم واستلام توقيع العميل، يرجى الدخول على رابط إتمام الطلب لرفع الملف الموقع
              </p>
              <Button
                type="primary"
                size="large"
                onClick={() => window.location.href = `/orders/complete?id=${order.id}`}
                className="bg-amber-600 hover:bg-amber-700 h-14 px-8 text-lg mt-4"
              >
                إتمام الطلب ورفع الملف الموقع
              </Button>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default ViewOrder;

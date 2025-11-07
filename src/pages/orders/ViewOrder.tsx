import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Button, Card, message, Spin, Tag, Empty } from "antd";
import { DownloadOutlined, FileTextOutlined, PhoneOutlined, EnvironmentOutlined, EyeOutlined } from '@ant-design/icons';
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
      // استخدام طريقة بديلة لتجنب مشكلة CORS
      const link = document.createElement('a');
      link.href = order.fileUrl;
      link.download = order.fileName || 'delivery-order.pdf';
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('تم فتح الملف للتحميل');
    } catch (error) {
      console.error('Error downloading file:', error);
      message.error('حدث خطأ أثناء تحميل الملف');
    } finally {
      setDownloading(false);
    }
  };

  const handleViewFile = () => {
    if (!order?.fileUrl) {
      message.warning('لا يوجد ملف مرفق');
      return;
    }
    window.open(order.fileUrl, '_blank');
  };

  const handleCallCustomer = () => {
    if (!order?.customerPhone) return;
    window.location.href = `tel:${order.customerPhone}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center">
        <Spin size="large" />
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-3 sm:p-6 font-['Tajawal']">
      <Helmet>
        <title>عرض طلب التوصيل - {order.fullInvoiceNumber}</title>
        <meta name="description" content={`تفاصيل طلب التوصيل رقم ${order.fullInvoiceNumber}`} />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 py-4 sm:py-6">
        {/* العنوان */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-2">
            طلب توصيل
          </h1>
          <p className="text-base sm:text-xl text-gray-600">
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
            className="text-base sm:text-xl px-4 sm:px-6 py-2 sm:py-3 rounded-full"
          >
            {order.status}
          </Tag>
        </motion.div>

        {/* معلومات العميل والتوصيل */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card 
            title={
              <div className="flex items-center gap-2 sm:gap-3">
                <PhoneOutlined className="text-lg sm:text-2xl text-blue-600" />
                <span className="text-lg sm:text-2xl">معلومات العميل والتوصيل</span>
              </div>
            }
            className="shadow-lg border-2 border-blue-100"
          >
            <div className="space-y-4">
              {/* معلومات العميل */}
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-blue-800 mb-3">بيانات العميل</h3>
                <div className="flex items-center justify-between border-b border-blue-200 pb-2">
                  <span className="text-sm sm:text-base font-semibold text-gray-600">الاسم</span>
                  <span className="text-base sm:text-lg font-medium">{order.customerName || 'غير محدد'}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm sm:text-base font-semibold text-gray-600 mb-2 sm:mb-0">رقم الهاتف</span>
                  <div className="flex items-center gap-3">
                    <span className="text-base sm:text-lg font-mono">{order.customerPhone}</span>
                    <Button 
                      type="primary" 
                      icon={<PhoneOutlined />}
                      onClick={handleCallCustomer}
                      className="bg-green-600 hover:bg-green-700"
                      size="middle"
                    >
                      اتصال
                    </Button>
                  </div>
                </div>
              </div>

              {/* معلومات التوصيل */}
              <div className="bg-red-50 p-3 sm:p-4 rounded-lg space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-red-800 mb-3 flex items-center gap-2">
                  <EnvironmentOutlined />
                  <span>معلومات التوصيل</span>
                </h3>
                <div className="flex items-center justify-between border-b border-red-200 pb-2">
                  <span className="text-sm sm:text-base font-semibold text-gray-600">المحافظة</span>
                  <span className="text-base sm:text-lg font-medium">{order.governorateName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-red-200 pb-2">
                  <span className="text-sm sm:text-base font-semibold text-gray-600">المنطقة</span>
                  <span className="text-base sm:text-lg font-medium">{order.regionName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-red-200 pb-2">
                  <span className="text-sm sm:text-base font-semibold text-gray-600">الحي</span>
                  <span className="text-base sm:text-lg font-medium">{order.districtName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-red-200 pb-2">
                  <span className="text-sm sm:text-base font-semibold text-gray-600">تاريخ التسليم</span>
                  <span className="text-sm sm:text-base font-semibold text-red-600">
                    {dayjs(order.deliveryDate).format('dddd، DD MMMM YYYY')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm sm:text-base font-semibold text-gray-600">يتطلب تركيب</span>
                  <Tag color={order.requiresInstallation ? 'blue' : 'default'} className="text-sm sm:text-base px-3 py-1">
                    {order.requiresInstallation ? 'نعم' : 'لا'}
                  </Tag>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* الملف المرفق */}
        {order.fileUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card 
              title={
                <div className="flex items-center gap-2 sm:gap-3">
                  <FileTextOutlined className="text-lg sm:text-2xl text-purple-600" />
                  <span className="text-lg sm:text-2xl">الملف المرفق</span>
                </div>
              }
              className="shadow-lg border-2 border-purple-100"
            >
              <div className="space-y-4">
                <div className="text-center bg-purple-50 p-3 sm:p-4 rounded-lg">
                  <p className="text-sm sm:text-base text-gray-600 mb-1">اسم الملف:</p>
                  <p className="text-base sm:text-lg font-semibold text-gray-800 break-all">
                    {order.fileName || 'ملف الطلب'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    type="default"
                    size="large"
                    icon={<EyeOutlined />}
                    onClick={handleViewFile}
                    className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    عرض الملف
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<DownloadOutlined />}
                    onClick={handleDownloadFile}
                    loading={downloading}
                    className="w-full bg-purple-600 hover:bg-purple-700 h-12 sm:h-14 text-base sm:text-lg font-medium"
                  >
                    تحميل الملف
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* تذكير للسائق */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="shadow-lg border-2 border-amber-200 bg-amber-50">
            <div className="text-center space-y-3">
              <h3 className="text-xl sm:text-2xl font-bold text-amber-800">⚠️ تنبيه مهم</h3>
              <p className="text-sm sm:text-lg text-gray-700 leading-relaxed">
                بعد التسليم واستلام توقيع العميل، يرجى الدخول على رابط إتمام الطلب لرفع الملف الموقع
              </p>
              <Button
                type="primary"
                size="large"
                onClick={() => window.location.href = `/orders/complete?id=${order.id}`}
                className="bg-amber-600 hover:bg-amber-700 w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base sm:text-lg mt-4"
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

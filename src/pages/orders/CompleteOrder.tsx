import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion } from "framer-motion";
import { Button, Card, message, Spin, Upload, UploadFile, Tag } from "antd";
import { UploadOutlined, CheckCircleOutlined, FileTextOutlined } from '@ant-design/icons';
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
  status: string;
  deliveryDate: string;
}

const CompleteOrder: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('id');
  
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [completed, setCompleted] = useState(false);

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
          const orderData = {
            id: orderDoc.id,
            ...orderDoc.data()
          } as DeliveryOrder;
          
          setOrder(orderData);
          
          // التحقق إذا كان الطلب مكتملاً مسبقاً
          if (orderData.status === 'مكتمل') {
            setCompleted(true);
          }
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

  const handleFileUpload = (info: { fileList: UploadFile[] }) => {
    let newFileList = [...info.fileList];
    
    // السماح بملف واحد فقط
    newFileList = newFileList.slice(-1);
    
    // تحديد الحجم الأقصى 5MB
    newFileList = newFileList.map(file => {
      if (file.size && file.size > 5 * 1024 * 1024) {
        message.error('حجم الملف يجب أن يكون أقل من 5MB');
        return null;
      }
      return file;
    }).filter((file): file is UploadFile => file !== null);

    setFileList(newFileList);
  };

  const handleComplete = async () => {
    if (fileList.length === 0) {
      message.error('يرجى إرفاق الملف الموقع من العميل');
      return;
    }

    if (!order) return;

    setUploading(true);

    try {
      let signedFileUrl = '';
      
      // رفع الملف الموقع إلى Firebase Storage
      if (fileList[0].originFileObj) {
        const file = fileList[0].originFileObj;
        const timestamp = new Date().getTime();
        const fileName = `signed-orders/${order.fullInvoiceNumber}_signed_${timestamp}_${file.name}`;
        const storageRef = ref(storage, fileName);
        
        // رفع الملف
        await uploadBytes(storageRef, file);
        
        // الحصول على رابط التحميل
        signedFileUrl = await getDownloadURL(storageRef);
      }

      // تحديث حالة الطلب في Firestore
      await updateDoc(doc(db, 'delivery_orders', orderId!), {
        status: 'مكتمل',
        signedFileUrl,
        signedFileName: fileList[0].name,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      message.success('تم إتمام الطلب بنجاح! شكراً لك');
      setCompleted(true);
      
    } catch (error) {
      console.error('خطأ في إتمام الطلب:', error);
      message.error('حدث خطأ أثناء إتمام الطلب. يرجى المحاولة مرة أخرى');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-3 sm:p-4">
        <Card className="max-w-md w-full shadow-lg">
          <div className="text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800">الطلب غير موجود</h2>
          </div>
        </Card>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-3 sm:p-4 font-['Tajawal']">
        <Helmet>
          <title>تم إتمام الطلب بنجاح</title>
        </Helmet>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          <Card className="shadow-2xl border-2 border-green-200">
            <div className="text-center space-y-4 sm:space-y-6 py-6 sm:py-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                <CheckCircleOutlined className="text-6xl sm:text-8xl text-green-600" />
              </motion.div>
              
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">
                تم إتمام الطلب بنجاح!
              </h2>
              
              <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                <p className="text-base sm:text-xl text-gray-700">
                  رقم الفاتورة: <span className="font-bold text-green-600">{order.fullInvoiceNumber}</span>
                </p>
              </div>
              
              <p className="text-base sm:text-lg text-gray-600">
                شكراً لك على إتمام التوصيل
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-3 sm:p-6 font-['Tajawal']">
      <Helmet>
        <title>إتمام طلب التوصيل - {order.fullInvoiceNumber}</title>
        <meta name="description" content={`إتمام طلب التوصيل رقم ${order.fullInvoiceNumber}`} />
      </Helmet>

      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6 py-4 sm:py-6">
        {/* العنوان */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-2">
            إتمام طلب التوصيل
          </h1>
          <p className="text-base sm:text-xl text-gray-600">
            رقم الفاتورة: <span className="font-bold text-green-600">{order.fullInvoiceNumber}</span>
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
            color={order.status === 'قيد الانتظار' ? 'orange' : 'green'}
            className="text-base sm:text-xl px-4 sm:px-6 py-2 sm:py-3 rounded-full"
          >
            {order.status}
          </Tag>
        </motion.div>

        {/* ملخص الطلب */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card 
            title={<span className="text-lg sm:text-2xl">ملخص الطلب</span>}
            className="shadow-lg border-2 border-green-100"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm sm:text-base font-semibold text-gray-600">اسم العميل</span>
                <span className="text-base sm:text-lg font-medium">{order.customerName || 'غير محدد'}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-sm sm:text-base font-semibold text-gray-600">رقم الهاتف</span>
                <span className="text-base sm:text-lg font-mono">{order.customerPhone}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                <span className="text-sm sm:text-base font-semibold text-gray-600 mb-1 sm:mb-0">العنوان</span>
                <span className="text-sm sm:text-base text-gray-700 text-right">
                  {order.governorateName} - {order.regionName} - {order.districtName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm sm:text-base font-semibold text-gray-600">تاريخ التسليم</span>
                <span className="text-base sm:text-lg font-medium">{dayjs(order.deliveryDate).format('DD/MM/YYYY')}</span>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* رفع الملف الموقع */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card 
            title={
              <div className="flex items-center gap-2 sm:gap-3">
                <FileTextOutlined className="text-lg sm:text-2xl text-blue-600" />
                <span className="text-lg sm:text-2xl">رفع الملف الموقع</span>
              </div>
            }
            className="shadow-lg border-2 border-blue-100"
          >
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg space-y-2">
                <p className="text-sm sm:text-lg text-gray-700 flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>تأكد من استلام توقيع العميل على الفاتورة</span>
                </p>
                <p className="text-sm sm:text-lg text-gray-700 flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>قم برفع نسخة من الفاتورة الموقعة (صورة أو PDF)</span>
                </p>
              </div>

              <div className="flex justify-center">
                <Upload
                  fileList={fileList}
                  onChange={handleFileUpload}
                  beforeUpload={() => false}
                  accept=".pdf,.jpg,.jpeg,.png"
                  maxCount={1}
                  listType="picture-card"
                  className="upload-list-inline"
                >
                  {fileList.length === 0 && (
                    <div className="text-center p-4 sm:p-6 min-w-[200px]">
                      <UploadOutlined className="text-4xl sm:text-5xl text-gray-400 mb-3" />
                      <div className="text-base sm:text-lg font-semibold text-gray-700 mb-2">اضغط لرفع الملف</div>
                      <div className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                        PDF أو صورة
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        (الحد الأقصى: 5MB)
                      </div>
                    </div>
                  )}
                </Upload>
              </div>

              {fileList.length > 0 && (
                <div className="text-center bg-green-50 p-3 rounded-lg">
                  <p className="text-sm sm:text-base text-green-600 font-semibold break-all">
                    ✓ تم اختيار الملف: {fileList[0].name}
                  </p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* زر الإتمام */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="flex justify-center pt-2 sm:pt-4"
        >
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={handleComplete}
            loading={uploading}
            disabled={fileList.length === 0}
            className="bg-green-600 hover:bg-green-700 w-full sm:w-auto h-14 sm:h-16 px-8 sm:px-12 text-lg sm:text-xl font-bold"
          >
            {uploading ? 'جاري الإتمام...' : 'تأكيد إتمام الطلب'}
          </Button>
        </motion.div>

        {/* ملاحظة */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <Card className="shadow-lg border-2 border-amber-200 bg-amber-50">
            <div className="text-center">
              <p className="text-xs sm:text-base text-gray-700 leading-relaxed">
                ⚠️ بعد الضغط على "تأكيد إتمام الطلب" سيتم تحديث حالة الطلب إلى "مكتمل" ولن يمكن التراجع
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default CompleteOrder;

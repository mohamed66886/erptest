import React, { useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from 'react-router-dom';
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion } from "framer-motion";
import { Button, Card, message, Spin, Upload, UploadFile, Tag, Row, Col } from "antd";
import { UploadOutlined, CheckCircleOutlined, CameraOutlined, FileImageOutlined, PhoneOutlined, CalendarOutlined, UserOutlined, EnvironmentOutlined, ToolOutlined, FileTextOutlined, InfoCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/ar';
import imageCompression from 'browser-image-compression';

dayjs.locale('ar');

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
  beforeImageUrl?: string;
  afterImageUrl?: string;
  beforeImageFileName?: string;
  afterImageFileName?: string;
  imagesUploadedAt?: string;
}

const UploadInstallationImages: React.FC = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('id');
  
  const [order, setOrder] = useState<InstallationOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [beforeFileList, setBeforeFileList] = useState<UploadFile[]>([]);
  const [afterFileList, setAfterFileList] = useState<UploadFile[]>([]);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) {
        message.error('رقم الطلب غير صحيح');
        setLoading(false);
        return;
      }

      try {
        const orderDoc = await getDoc(doc(db, 'installation_orders', orderId));
        
        if (orderDoc.exists()) {
          const orderData = {
            id: orderDoc.id,
            ...orderDoc.data()
          } as InstallationOrder;
          
          setOrder(orderData);
          
          // التحقق إذا تم رفع الصور مسبقاً
          if (orderData.beforeImageUrl && orderData.afterImageUrl) {
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

  // ضغط الصورة
  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
    };
    
    try {
      const compressedFile = await imageCompression(file, options);
      return new File([compressedFile], file.name, { type: 'image/jpeg' });
    } catch (error) {
      console.error('خطأ في ضغط الصورة:', error);
      return file;
    }
  };

  const handleBeforeFileUpload = async (info: { fileList: UploadFile[] }) => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-1);
    
    for (const file of newFileList) {
      if (file.size && file.size > 10 * 1024 * 1024) {
        message.error('حجم الصورة يجب أن يكون أقل من 10MB');
        return;
      }
    }

    setBeforeFileList(newFileList);
  };

  const handleAfterFileUpload = async (info: { fileList: UploadFile[] }) => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-1);
    
    for (const file of newFileList) {
      if (file.size && file.size > 10 * 1024 * 1024) {
        message.error('حجم الصورة يجب أن يكون أقل من 10MB');
        return;
      }
    }

    setAfterFileList(newFileList);
  };

  const handleUploadImages = async () => {
    if (beforeFileList.length === 0) {
      message.error('يرجى إرفاق صورة قبل التركيب');
      return;
    }

    if (afterFileList.length === 0) {
      message.error('يرجى إرفاق صورة بعد التركيب');
      return;
    }

    if (!order) return;

    setUploading(true);

    try {
      let beforeImageUrl = '';
      let afterImageUrl = '';
      let beforeImageFileName = '';
      let afterImageFileName = '';
      
      // رفع صورة قبل التركيب (مع الضغط)
      if (beforeFileList[0].originFileObj) {
        const file = beforeFileList[0].originFileObj;
        message.loading({ content: 'جاري ضغط صورة قبل التركيب...', key: 'compress-before' });
        const compressedFile = await compressImage(file);
        message.success({ content: 'تم ضغط الصورة بنجاح', key: 'compress-before', duration: 2 });
        
        const timestamp = new Date().getTime();
        const fileName = `installation-images/${order.orderNumber}_before_${timestamp}_${compressedFile.name}`;
        const storageRef = ref(storage, fileName);
        
        message.loading({ content: 'جاري رفع صورة قبل التركيب...', key: 'upload-before' });
        await uploadBytes(storageRef, compressedFile);
        beforeImageUrl = await getDownloadURL(storageRef);
        beforeImageFileName = compressedFile.name;
        message.success({ content: 'تم رفع صورة قبل التركيب', key: 'upload-before', duration: 2 });
      }

      // رفع صورة بعد التركيب (مع الضغط)
      if (afterFileList[0].originFileObj) {
        const file = afterFileList[0].originFileObj;
        message.loading({ content: 'جاري ضغط صورة بعد التركيب...', key: 'compress-after' });
        const compressedFile = await compressImage(file);
        message.success({ content: 'تم ضغط الصورة بنجاح', key: 'compress-after', duration: 2 });
        
        const timestamp = new Date().getTime();
        const fileName = `installation-images/${order.orderNumber}_after_${timestamp}_${compressedFile.name}`;
        const storageRef = ref(storage, fileName);
        
        message.loading({ content: 'جاري رفع صورة بعد التركيب...', key: 'upload-after' });
        await uploadBytes(storageRef, compressedFile);
        afterImageUrl = await getDownloadURL(storageRef);
        afterImageFileName = compressedFile.name;
        message.success({ content: 'تم رفع صورة بعد التركيب', key: 'upload-after', duration: 2 });
      }

      // تحديث الطلب في Firestore وتغيير الحالة إلى "مكتمل"
      message.loading({ content: 'جاري تحديث حالة الطلب...', key: 'update-status' });
      await updateDoc(doc(db, 'installation_orders', orderId!), {
        beforeImageUrl,
        afterImageUrl,
        beforeImageFileName,
        afterImageFileName,
        imagesUploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'مكتمل',
      });
      message.success({ content: 'تم تحديث حالة الطلب إلى مكتمل', key: 'update-status', duration: 2 });

      message.success('تم رفع الصور بنجاح! شكراً لك');
      setCompleted(true);
      
    } catch (error) {
      console.error('خطأ في رفع الصور:', error);
      message.error('حدث خطأ أثناء رفع الصور. يرجى المحاولة مرة أخرى');
    } finally {
      setUploading(false);
    }
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-3 sm:p-4">
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-3 sm:p-4 font-['Tajawal']">
        <Helmet>
          <title>تم رفع الصور بنجاح</title>
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
                تم رفع الصور بنجاح!
              </h2>
              
              <div className="bg-green-50 p-3 sm:p-4 rounded-lg space-y-2">
                <p className="text-base sm:text-xl text-gray-700 flex items-center justify-center gap-2">
                  <FileTextOutlined className="text-green-600" />
                  رقم الطلب: <span className="font-bold text-green-600">{order.orderNumber}</span>
                </p>
                <p className="text-sm sm:text-base text-gray-600 flex items-center justify-center gap-2">
                  <FileImageOutlined />
                  رقم المستند: {order.documentNumber}
                </p>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-base sm:text-lg text-gray-600">
                <CheckCircleOutlined className="text-green-600" />
                <span>شكراً لك على رفع صور التركيب</span>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-3 sm:p-6 font-['Tajawal']">
      <Helmet>
        <title>رفع صور التركيب - {order.orderNumber}</title>
        <meta name="description" content={`رفع صور التركيب للطلب رقم ${order.orderNumber}`} />
      </Helmet>

      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6 py-4 sm:py-6">
        {/* العنوان */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-2">
            <CameraOutlined className="text-3xl sm:text-5xl text-blue-600" />
            <h1 className="text-2xl sm:text-4xl font-bold text-gray-800">
              رفع صور التركيب
            </h1>
          </div>
          <p className="text-base sm:text-xl text-gray-600 flex items-center justify-center gap-2">
            <FileTextOutlined />
            رقم الطلب: <span className="font-bold text-blue-600">{order.orderNumber}</span>
          </p>
          <p className="text-sm sm:text-base text-gray-600 mt-1 flex items-center justify-center gap-2">
            <FileImageOutlined />
            رقم المستند: {order.documentNumber}
          </p>
        </motion.div>

        {/* معلومات الطلب */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card 
            title={<span className="text-lg sm:text-2xl">معلومات الطلب</span>}
            className="shadow-lg border-2 border-blue-100"
          >
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm sm:text-base font-semibold text-gray-600 flex items-center gap-2">
                      <UserOutlined className="text-blue-600" />
                      اسم العميل
                    </span>
                    <span className="text-base sm:text-lg font-medium">{order.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm sm:text-base font-semibold text-gray-600 flex items-center gap-2">
                      <PhoneOutlined className="text-green-600" />
                      الهاتف
                    </span>
                    <span className="text-base sm:text-lg font-mono">{order.phone}</span>
                  </div>
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm sm:text-base font-semibold text-gray-600 flex items-center gap-2">
                      <CalendarOutlined className="text-orange-600" />
                      تاريخ التركيب
                    </span>
                    <span className="text-base sm:text-lg font-medium">{dayjs(order.installationDate).format('DD/MM/YYYY')}</span>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-sm sm:text-base font-semibold text-gray-600 flex items-center gap-2">
                      <ToolOutlined className="text-purple-600" />
                      الفني
                    </span>
                    <span className="text-base sm:text-lg font-medium">{order.technicianName}</span>
                  </div>
                  <div className="flex flex-col border-b pb-2">
                    <span className="text-sm sm:text-base font-semibold text-gray-600 mb-1 flex items-center gap-2">
                      <EnvironmentOutlined className="text-red-600" />
                      العنوان
                    </span>
                    <span className="text-sm sm:text-base text-gray-700 text-right">
                      {order.governorateName} - {order.regionName} - {order.districtName}
                    </span>
                  </div>
                  <div className="flex flex-col border-b pb-2">
                    <span className="text-sm sm:text-base font-semibold text-gray-600 mb-1 flex items-center gap-2">
                      <FileTextOutlined className="text-cyan-600" />
                      نوع الخدمة
                    </span>
                    <span className="text-sm sm:text-base text-gray-700 text-right">
                      {order.serviceType.join(', ')}
                    </span>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </motion.div>

        {/* رفع الصور */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card 
            title={
              <div className="flex items-center gap-2 sm:gap-3">
                <CameraOutlined className="text-lg sm:text-2xl text-blue-600" />
                <span className="text-lg sm:text-2xl">رفع صور التركيب</span>
              </div>
            }
            className="shadow-lg border-2 border-blue-100"
          >
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg space-y-3">
                <p className="text-sm sm:text-lg text-gray-700 flex items-start gap-2">
                  <CameraOutlined className="text-blue-600 text-lg" />
                  <span>قم برفع صورة واضحة قبل بدء التركيب</span>
                </p>
                <p className="text-sm sm:text-lg text-gray-700 flex items-start gap-2">
                  <CheckCircleOutlined className="text-green-600 text-lg" />
                  <span>قم برفع صورة واضحة بعد إتمام التركيب</span>
                </p>
                <p className="text-xs sm:text-sm text-gray-600 flex items-start gap-2">
                  <InfoCircleOutlined className="text-orange-600" />
                  <span>سيتم ضغط الصور تلقائياً لتسريع عملية الرفع</span>
                </p>
              </div>

              <Row gutter={[24, 24]}>
                {/* صورة قبل التركيب */}
                <Col xs={24} md={12}>
                  <div className="text-center">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-2">
                      <CameraOutlined className="text-blue-600" />
                      صورة قبل التركيب
                    </h3>
                    <div className="flex justify-center">
                      <Upload
                        fileList={beforeFileList}
                        onChange={handleBeforeFileUpload}
                        beforeUpload={() => false}
                        accept="image/*"
                        maxCount={1}
                        listType="picture-card"
                        className="upload-list-inline"
                      >
                        {beforeFileList.length === 0 && (
                          <div className="text-center p-4 sm:p-6 min-w-[200px]">
                            <CameraOutlined className="text-4xl sm:text-5xl text-blue-400 mb-3" />
                            <div className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                              اضغط لرفع الصورة
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500">
                              (الحد الأقصى: 10MB)
                            </div>
                          </div>
                        )}
                      </Upload>
                    </div>
                    {beforeFileList.length > 0 && (
                      <Tag color="success" className="mt-2" icon={<CheckCircleOutlined />}>
                        تم اختيار الصورة
                      </Tag>
                    )}
                  </div>
                </Col>

                {/* صورة بعد التركيب */}
                <Col xs={24} md={12}>
                  <div className="text-center">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 flex items-center justify-center gap-2">
                      <CheckCircleOutlined className="text-green-600" />
                      صورة بعد التركيب
                    </h3>
                    <div className="flex justify-center">
                      <Upload
                        fileList={afterFileList}
                        onChange={handleAfterFileUpload}
                        beforeUpload={() => false}
                        accept="image/*"
                        maxCount={1}
                        listType="picture-card"
                        className="upload-list-inline"
                      >
                        {afterFileList.length === 0 && (
                          <div className="text-center p-4 sm:p-6 min-w-[200px]">
                            <CameraOutlined className="text-4xl sm:text-5xl text-green-400 mb-3" />
                            <div className="text-base sm:text-lg font-semibold text-gray-700 mb-2">
                              اضغط لرفع الصورة
                            </div>
                            <div className="text-xs sm:text-sm text-gray-500">
                              (الحد الأقصى: 10MB)
                            </div>
                          </div>
                        )}
                      </Upload>
                    </div>
                    {afterFileList.length > 0 && (
                      <Tag color="success" className="mt-2" icon={<CheckCircleOutlined />}>
                        تم اختيار الصورة
                      </Tag>
                    )}
                  </div>
                </Col>
              </Row>
            </div>
          </Card>
        </motion.div>

        {/* زر الرفع */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex justify-center pt-2 sm:pt-4"
        >
          <Button
            type="primary"
            size="large"
            icon={<UploadOutlined />}
            onClick={handleUploadImages}
            loading={uploading}
            disabled={beforeFileList.length === 0 || afterFileList.length === 0}
            className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto h-14 sm:h-16 px-8 sm:px-12 text-lg sm:text-xl font-bold"
          >
            {uploading ? 'جاري الرفع...' : 'رفع الصور'}
          </Button>
        </motion.div>

        {/* ملاحظة */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
        >
          <Card className="shadow-lg border-2 border-amber-200 bg-amber-50">
            <div className="text-center">
              <p className="text-xs sm:text-base text-gray-700 leading-relaxed">
                ⚠️ تأكد من وضوح الصور قبل الرفع. يجب أن تظهر جميع تفاصيل التركيب بشكل واضح
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default UploadInstallationImages;

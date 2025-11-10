import React, { useState, useEffect } from 'react';
import { Table, Button, Select, message, DatePicker } from 'antd';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import Breadcrumb from '../../components/Breadcrumb';
import { WhatsAppOutlined, PrinterOutlined, ReloadOutlined, FilterOutlined, FilePdfOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import dayjs from 'dayjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const { Option } = Select;

// واجهة طلب التوصيل
interface DeliveryOrder {
  id: string;
  fullInvoiceNumber: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  districtName?: string;
  regionName?: string;
  governorateName?: string;
  driverId: string;
  driverName: string;
  deliveryDate?: string;
  status: string;
  branchBalance?: number;
  requiresInstallation?: boolean;
  notes?: string;
  createdAt?: string | { seconds: number; nanoseconds: number };
}

// واجهة بيانات السائق
interface DriverData {
  id: string;
  name: string;
  phone: string;
  mobile: string;
  driverPhone?: string;
  driverMobile?: string;
  ordersCount: number;
  orders: DeliveryOrder[];
}

const DriverNotifications: React.FC = () => {
  const [drivers, setDrivers] = useState<DriverData[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<DriverData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('قيد الانتظار');
  
  // حالات التصفية
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [selectedDeliveryDate, setSelectedDeliveryDate] = useState<dayjs.Dayjs | null>(null);
  const [allDriversList, setAllDriversList] = useState<{id: string; name: string}[]>([]);
  
  // بيانات الشركة
  const [companyData, setCompanyData] = useState<{
    arabicName?: string;
    englishName?: string;
    companyType?: string;
    commercialRegistration?: string;
    taxFile?: string;
    city?: string;
    region?: string;
    street?: string;
    district?: string;
    buildingNumber?: string;
    postalCode?: string;
    phone?: string;
    mobile?: string;
    logoUrl?: string;
  }>({});

  // جلب بيانات السائقين وطلباتهم
  const fetchDriverData = async () => {
    setLoading(true);
    try {
      // جلب طلبات التوصيل من collection delivery_orders
      const deliveryOrdersRef = collection(db, 'delivery_orders');
      
      // جلب كل الطلبات بدون فلتر السنة المالية (سنفلتر لاحقاً)
      const ordersSnapshot = await getDocs(deliveryOrdersRef);
      console.log('🔍 معلومات البحث:', {
        الحالة_المطلوبة: statusFilter,
        عدد_الطلبات_المجلوبة: ordersSnapshot.size,
        مسار_البحث: 'delivery_orders'
      });
      
      // طباعة عينة من البيانات للتحقق
      if (ordersSnapshot.size > 0) {
        const sampleDoc = ordersSnapshot.docs[0].data();
        console.log('📋 عينة من بيانات الطلب:', {
          status: sampleDoc.status,
          fiscalYear: sampleDoc.fiscalYear,
          driverId: sampleDoc.driverId,
          driverName: sampleDoc.driverName,
          fullInvoiceNumber: sampleDoc.fullInvoiceNumber,
          customerName: sampleDoc.customerName
        });
        
        // طباعة كل الحالات الموجودة في الطلبات
        const allStatuses = ordersSnapshot.docs.map(doc => doc.data().status);
        const uniqueStatuses = [...new Set(allStatuses)].filter(Boolean);
        console.log('📊 جميع الحالات الموجودة في الطلبات:', uniqueStatuses);
        
        // طباعة كل السنوات المالية الموجودة
        const allYears = ordersSnapshot.docs.map(doc => doc.data().fiscalYear);
        const uniqueYears = [...new Set(allYears)].filter(Boolean);
        console.log('📅 جميع السنوات المالية الموجودة:', uniqueYears);
      } else {
        console.warn('⚠️ لا توجد طلبات توصيل في قاعدة البيانات');
      }

      // جلب بيانات السائقين
      const driversRef = collection(db, 'drivers');
      const driversSnapshot = await getDocs(driversRef);
      console.log('👥 عدد السائقين في قاعدة البيانات:', driversSnapshot.size);

      // تحويل بيانات السائقين إلى خريطة
      const driversMap = new Map<string, {
        id: string;
        name: string;
        phone: string;
        mobile: string;
        driverPhone: string;
        driverMobile: string;
      }>();
      driversSnapshot.docs.forEach(doc => {
        const data = doc.data();
        driversMap.set(doc.id, {
          id: doc.id,
          name: data.nameAr || data.name || 'غير محدد',
          phone: data.phone || data.phoneNumber || '',
          mobile: data.mobile || data.mobileNumber || '',
          driverPhone: data.driverPhone || data.phone || data.phoneNumber || '',
          driverMobile: data.driverMobile || data.mobile || data.mobileNumber || ''
        });
      });

      // تجميع الطلبات حسب السائق
      const driverOrdersMap = new Map<string, DeliveryOrder[]>();
      
      console.log('🔄 بدء معالجة الطلبات...');
      
      let totalOrdersProcessed = 0;
      let filteredOrdersCount = 0;
      
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const driverId = data.driverId;
        const orderStatus = data.status || 'قيد الانتظار'; // استخدام حقل status
        
        totalOrdersProcessed++;
        
        console.log('📦 معالجة طلب:', {
          id: doc.id,
          driverId: driverId,
          driverName: data.driverName,
          status: orderStatus,
          fiscalYear: data.fiscalYear
        });
        
        // فلترة حسب الحالة المختارة
        if (statusFilter !== 'الكل' && orderStatus !== statusFilter) {
          return; // تجاهل الطلب إذا لم يطابق الفلتر
        }
        
        filteredOrdersCount++;
        
        if (driverId && driverId.trim() !== '') {
          const order: DeliveryOrder = {
            id: doc.id,
            fullInvoiceNumber: data.fullInvoiceNumber || data.invoiceNumber || '',
            customerName: data.customerName || '',
            customerPhone: data.customerPhone || data.customerMobile || '',
            customerAddress: data.customerAddress || '',
            districtName: data.districtName || '',
            regionName: data.regionName || '',
            governorateName: data.governorateName || '',
            driverId: driverId,
            driverName: data.driverName || '',
            deliveryDate: data.deliveryDate || '',
            status: orderStatus,
            branchBalance: data.branchBalance || 0,
            requiresInstallation: data.requiresInstallation || false,
            notes: data.notes || '',
            createdAt: data.createdAt
          };

          if (!driverOrdersMap.has(driverId)) {
            driverOrdersMap.set(driverId, []);
          }
          driverOrdersMap.get(driverId)!.push(order);
        }
      });

      console.log('📊 نتائج الفلترة:', {
        إجمالي_الطلبات: totalOrdersProcessed,
        الطلبات_المفلترة: filteredOrdersCount,
        الفلتر_المطبق: statusFilter,
        عدد_السائقين: driverOrdersMap.size
      });

      // إنشاء مصفوفة بيانات السائقين
      const driversData: DriverData[] = [];
      
      console.log('👥 عدد السائقين الذين لديهم طلبات:', driverOrdersMap.size);
      
      driverOrdersMap.forEach((orders, driverId) => {
        const driverInfo = driversMap.get(driverId);
        console.log(`🚗 السائق ${driverId}:`, {
          موجود_في_قاعدة_البيانات: !!driverInfo,
          عدد_الطلبات: orders.length,
          اسم_السائق: driverInfo?.name
        });
        
        if (driverInfo) {
          driversData.push({
            id: driverId,
            name: driverInfo.name,
            phone: driverInfo.driverPhone || driverInfo.driverMobile || driverInfo.phone || driverInfo.mobile || 'غير متوفر',
            mobile: driverInfo.mobile,
            driverPhone: driverInfo.driverPhone,
            driverMobile: driverInfo.driverMobile,
            ordersCount: orders.length,
            orders: orders
          });
        }
      });

      // ترتيب السائقين حسب عدد الطلبات (تنازلياً)
      driversData.sort((a, b) => b.ordersCount - a.ordersCount);

      setDrivers(driversData);
      setFilteredDrivers(driversData);
      
      // حفظ قائمة السائقين للتصفية
      setAllDriversList(driversData.map(d => ({ id: d.id, name: d.name })));
      
      console.log('✅ النتائج النهائية:', {
        عدد_السائقين: driversData.length,
        إجمالي_الطلبات: driversData.reduce((sum, d) => sum + d.ordersCount, 0)
      });
      
      if (driversData.length === 0) {
        message.info(`لا توجد طلبات توصيل بحالة "${statusFilter}"`);
      } else {
        const totalOrders = driversData.reduce((sum, d) => sum + d.ordersCount, 0);
        message.success(`تم جلب ${totalOrders} طلب لـ ${driversData.length} سائق بنجاح`);
      }
    } catch (error) {
      console.error('Error fetching driver data:', error);
      message.error('حدث خطأ أثناء جلب بيانات السائقين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  // تطبيق التصفية
  useEffect(() => {
    let filtered = [...drivers];

    // تصفية حسب السائق
    if (selectedDriverId) {
      filtered = filtered.filter(d => d.id === selectedDriverId);
    }

    // تصفية حسب تاريخ التسليم
    if (selectedDeliveryDate) {
      const dateStr = selectedDeliveryDate.format('YYYY-MM-DD');
      filtered = filtered.map(driver => {
        const filteredOrders = driver.orders.filter(order => order.deliveryDate === dateStr);
        return {
          ...driver,
          orders: filteredOrders,
          ordersCount: filteredOrders.length
        };
      }).filter(d => d.ordersCount > 0);
    }

    setFilteredDrivers(filtered);
  }, [selectedDriverId, selectedDeliveryDate, drivers]);

  // إعادة تعيين التصفية
  const handleResetFilters = () => {
    setSelectedDriverId('');
    setSelectedDeliveryDate(null);
    setFilteredDrivers(drivers);
    message.success('تم إعادة تعيين التصفية');
  };

  // جلب بيانات الشركة
  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        const companiesSnapshot = await getDocs(collection(db, 'companies'));
        if (!companiesSnapshot.empty) {
          const companyDoc = companiesSnapshot.docs[0];
          setCompanyData(companyDoc.data());
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
      }
    };
    fetchCompanyData();
  }, []);

  // دالة إرسال واتساب للسائق
  const handleSendWhatsApp = async (driver: DriverData) => {
    const phone = driver.driverPhone || driver.driverMobile || driver.phone || driver.mobile;
    
    if (!phone || phone === 'غير متوفر') {
      message.warning('رقم هاتف السائق غير متوفر');
      return;
    }

    try {
      message.loading({ content: 'جاري إنشاء ملف PDF...', key: 'pdf-generation' });

      // إنشاء ملف PDF
      const pdfBlob = await generatePDF(driver);
      
      message.loading({ content: 'جاري رفع الملف...', key: 'pdf-generation' });
      
      // رفع PDF على Firebase Storage
      const timestamp = new Date().getTime();
      const fileName = `driver-orders/${driver.id}_${timestamp}.pdf`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, pdfBlob);
      const pdfUrl = await getDownloadURL(storageRef);
      
      message.success({ content: 'تم رفع الملف بنجاح!', key: 'pdf-generation' });

      // إنشاء رسالة واتساب
      let whatsappMessage = `السلام عليكم ${driver.name}\n\n`;
      whatsappMessage += `لديك ${driver.ordersCount} طلب توصيل جديد قيد التنفيذ\n\n`;
      whatsappMessage += ` يمكنك تحميل تفاصيل الطلبات من الرابط التالي:\n${pdfUrl}\n\n`;
      whatsappMessage += `شكراً لك `;

      // معالجة رقم الهاتف
      let cleanPhone = phone.replace(/\+/g, '').replace(/\s/g, '').replace(/-/g, '');
      
      // إضافة كود الدولة السعودية (+966) إذا لم يكن موجوداً
      if (!cleanPhone.startsWith('966')) {
        // إزالة الصفر من البداية إذا كان موجوداً
        if (cleanPhone.startsWith('0')) {
          cleanPhone = cleanPhone.substring(1);
        }
        // إضافة كود الدولة
        cleanPhone = '966' + cleanPhone;
      }
      
      console.log('📱 رقم الهاتف النهائي:', cleanPhone);
      console.log('📄 رابط PDF:', pdfUrl);
      
      // فتح واتساب
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`;
      window.open(whatsappUrl, '_blank');
      
    } catch (error) {
      console.error('Error generating/uploading PDF:', error);
      message.error('حدث خطأ أثناء إنشاء أو رفع الملف');
    }
  };

  // دالة توليد PDF
  const generatePDF = async (driver: DriverData): Promise<Blob> => {
    try {
      const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return '-';
        try {
          const date = new Date(dateStr);
          return date.toLocaleDateString('en-GB');
        } catch {
          return dateStr;
        }
      };

      // تحويل شعار الشركة إلى Base64 مع ضغطه لتجنب مشاكل CORS وتقليل الحجم
      let logoBase64 = '';
      if (companyData.logoUrl) {
        try {
          console.log('🔄 جاري تحميل الشعار من:', companyData.logoUrl);
          const response = await fetch(companyData.logoUrl, { mode: 'cors' });
          const blob = await response.blob();
          console.log('✅ تم تحميل Blob، الحجم:', (blob.size / 1024).toFixed(2), 'KB');
          
          // إنشاء صورة مصغرة ومضغوطة
          logoBase64 = await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              console.log('✅ تم تحميل الصورة، الأبعاد:', img.width, 'x', img.height);
              
              // إنشاء canvas لتصغير وضغط الصورة
              const canvas = document.createElement('canvas');
              const maxSize = 200; // زيادة الحجم الأقصى للشعار
              
              let width = img.width;
              let height = img.height;
              
              // حساب الأبعاد الجديدة مع الحفاظ على النسبة
              if (width > height) {
                if (width > maxSize) {
                  height = (height * maxSize) / width;
                  width = maxSize;
                }
              } else {
                if (height > maxSize) {
                  width = (width * maxSize) / height;
                  height = maxSize;
                }
              }
              
              canvas.width = width;
              canvas.height = height;
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                // تحسين جودة الرسم
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);
                
                // ضغط الصورة بجودة 0.8 (أعلى من 0.6 لجودة أفضل)
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                console.log('✅ تم تحويل الصورة إلى Base64، الحجم:', (dataUrl.length / 1024).toFixed(2), 'KB');
                resolve(dataUrl);
              } else {
                console.error('❌ فشل الحصول على canvas context');
                reject(new Error('Failed to get canvas context'));
              }
            };
            
            img.onerror = (err) => {
              console.error('❌ فشل تحميل الصورة:', err);
              reject(new Error('Failed to load image'));
            };
            
            // تحميل الصورة من Blob
            const objectUrl = URL.createObjectURL(blob);
            img.src = objectUrl;
            
            // تنظيف object URL بعد التحميل
            setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
          });
          
          console.log('✅ تم تحميل وضغط شعار الشركة بنجاح');
        } catch (error) {
          console.error('❌ فشل تحميل الشعار:', error);
          logoBase64 = ''; // استخدام بدون شعار في حالة الفشل
        }
      } else {
        console.warn('⚠️ لا يوجد رابط للشعار في بيانات الشركة');
      }

      console.log('🖼️ حالة الشعار:', logoBase64 ? `تم التحميل (${(logoBase64.length / 1024).toFixed(2)} KB)` : 'غير متوفر');

      // إنشاء عنصر HTML مؤقت
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '1100px'; // عرض ثابت للطباعة الأفضل
      tempDiv.style.padding = '20px';
      tempDiv.style.backgroundColor = 'white';
      tempDiv.style.fontFamily = 'Tajawal, Arial, sans-serif';
      tempDiv.style.direction = 'rtl';

      console.log('📝 جاري إنشاء HTML للطباعة...');
      console.log('🔍 طول Base64 للشعار:', logoBase64.length, 'حرف');
      
      // محتوى HTML
      tempDiv.innerHTML = `
        <div style="font-family: 'Tajawal', Arial, sans-serif; color: #000; font-size: 11px; line-height: 1.4;">
          <!-- Company Header -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 2px solid #000; padding-bottom: 10px;">
            <div style="flex: 1; text-align: right; font-size: 10px; font-weight: 500;">
              <div>${companyData.arabicName || ''}</div>
              <div>${companyData.companyType || ''}</div>
              <div>السجل التجاري: ${companyData.commercialRegistration || ''}</div>
              <div>الملف الضريبي: ${companyData.taxFile || ''}</div>
              <div>الهاتف: ${companyData.phone || ''}</div>
            </div>
            <div style="flex: 0 0 130px; text-align: center; display: flex; align-items: center; justify-content: center;">
              ${logoBase64 ? `<img src="${logoBase64}" style="width: 120px; height: auto; max-height: 90px; object-fit: contain; display: block; background: white; padding: 5px;" alt="شعار الشركة" />` : '<div style="width: 120px; height: 60px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 9px; color: #999; background: #f9f9f9;">شعار الشركة</div>'}
            </div>
            <div style="flex: 1; text-align: left; font-family: Arial; direction: ltr; font-size: 9px; font-weight: 500;">
              <div>${companyData.englishName || ''}</div>
              <div>${companyData.companyType || ''}</div>
              <div>Commercial Reg.: ${companyData.commercialRegistration || ''}</div>
              <div>Tax File: ${companyData.taxFile || ''}</div>
              <div>Phone: ${companyData.phone || ''}</div>
            </div>
          </div>
          
          <!-- Title -->
          <div style="text-align: center; margin-bottom: 20px; border-bottom: 3px solid #000; padding-bottom: 15px;">
            <h1 style="color: #000; margin: 0 0 8px 0; font-size: 24px; font-weight: 700;">طلبات التوصيل - السائق ${driver.name}</h1>
            <p style="margin: 0; color: #6b7280; font-size: 13px;">نظام إدارة الموارد ERP90</p>
          </div>
          
          <!-- Driver Info -->
          <div style="background: #f3f4f6; padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; flex-wrap: wrap;">
            <div style="margin: 3px 10px; font-size: 13px;"><strong>اسم السائق:</strong> ${driver.name}</div>
            <div style="margin: 3px 10px; font-size: 13px;"><strong>رقم الهاتف:</strong> ${driver.phone || 'غير متوفر'}</div>
            <div style="margin: 3px 10px; font-size: 13px;"><strong>عدد الطلبات:</strong> ${driver.ordersCount} طلب</div>
            <div style="margin: 3px 10px; font-size: 13px;"><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          
          <!-- Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px;">
            <thead>
              <tr style="background-color: #bbbbbc; color: #fff;">
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">م</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">رقم الفاتورة</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">اسم العميل</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">هاتف العميل</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">الحي</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">المنطقة</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">الملاحظات</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">التركيب</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">حالة التوصيل</th>
                <th style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">تاريخ التسليم</th>
              </tr>
            </thead>
            <tbody>
              ${driver.orders.map((order, index) => `
                <tr style="${index % 2 === 0 ? 'background-color: #f9fafb;' : ''}">
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${index + 1}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;"><strong>${order.fullInvoiceNumber}</strong></td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${order.customerName || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${order.customerPhone || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${order.districtName || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${order.regionName || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: right; font-size: 9px;">${order.notes || '-'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${order.requiresInstallation ? '<span style="background: #10b981; color: white; padding: 3px 6px; border-radius: 4px; font-size: 9px;">نعم ⚙️</span>' : 'لا'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center; font-weight: bold;">${order.status || 'قيد الانتظار'}</td>
                  <td style="border: 1px solid #d1d5db; padding: 8px 4px; text-align: center;">${formatDate(order.deliveryDate)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <!-- Footer -->
          <div style="margin-top: 20px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px;">
            <p><strong>نظام ERP90 - إدارة الموارد</strong> | تم الطباعة بواسطة: ${driver.name}</p>
            <p style="margin-top: 5px; font-size: 10px;">تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}</p>
          </div>
          
          <!-- Signature Section -->
          <div style="margin-top: 40px; display: flex; justify-content: space-between; padding: 0 20px;">
            <div style="flex: 1; text-align: right; font-size: 12px;">
              <div style="margin-bottom: 6px;">السائق: ___________________</div>
              <div>التوقيع: ___________________</div>
            </div>
            <div style="flex: 1; text-align: center;">
              <div style="margin: 10px auto; width: 160px; height: 60px; border: 3px dashed #000; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: repeating-linear-gradient(135deg, #f3f4f6 0 10px, #fff 10px 20px);">
                <div style="text-align: center;">
                  <div style="font-size: 16px; font-weight: 700;">${companyData.arabicName || 'الشركة'}</div>
                  <div style="font-size: 12px; margin-top: 4px;">${companyData.phone ? 'هاتف: ' + companyData.phone : ''}</div>
                </div>
              </div>
            </div>
            <div style="flex: 1; text-align: left; font-size: 12px;">
              <div style="margin-bottom: 6px;">مشرف التوصيل: ___________________</div>
              <div>التاريخ: ${new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(tempDiv);
      
      // تحويل HTML إلى Canvas ثم PDF
      const canvas = await html2canvas(tempDiv, {
        scale: 1.2, // تقليل الدقة من 2 إلى 1.2 لتقليل حجم الملف
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
      
      // استخدام JPEG بدلاً من PNG مع ضغط 0.7 لتقليل الحجم
      const imgData = canvas.toDataURL('image/jpeg', 0.7);
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape A4
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'JPEG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // تحويل PDF إلى Blob
      const pdfBlob = pdf.output('blob');
      return pdfBlob;
      
    } catch (error) {
      throw error;
    }
  };

  // دالة الطباعة
  const handlePrint = (driver: DriverData) => {
    const printWindow = window.open('', '', 'width=1200,height=900');
    if (!printWindow) {
      message.error('تعذر فتح نافذة الطباعة');
      return;
    }

    // إنشاء محتوى HTML للطباعة
    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>طلبات التوصيل - ${driver.name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          body { 
            font-family: 'Tajawal', sans-serif; 
            padding: 15px; 
            color: #000;
            font-size: 11px;
            line-height: 1.4;
            margin: 0;
          }
          .company-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header-section {
            flex: 1;
            min-width: 0;
            padding: 0 8px;
            box-sizing: border-box;
          }
          .header-section.center {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 0 0 120px;
            max-width: 120px;
            min-width: 100px;
          }
          .logo {
            width: 100px;
            height: auto;
            margin-bottom: 8px;
          }
          .company-info-ar {
            text-align: right;
            font-size: 10px;
            font-weight: 500;
            line-height: 1.4;
          }
          .company-info-en {
            text-align: left;
            font-family: Arial, sans-serif;
            direction: ltr;
            font-size: 9px;
            font-weight: 500;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
          }
          .header h1 {
            color: #000;
            margin: 0 0 8px 0;
            font-size: 24px;
            font-weight: 700;
          }
          .header p {
            margin: 0;
            color: #6b7280;
            font-size: 13px;
          }
          .driver-info {
            background: #f3f4f6;
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            flex-wrap: wrap;
          }
          .driver-info div {
            margin: 3px 10px;
            font-size: 13px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            font-size: 10px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 8px 4px; 
            text-align: center;
            vertical-align: middle;
          }
          th { 
            background-color: #bbbbbc;
            color: #fff;
            font-weight: 600;
            font-size: 11px;
          }
          tbody tr:nth-child(even) {
            background-color: #f9fafb;
          }
          tbody tr:hover {
            background-color: #ede9fe;
          }
          .installation-badge {
            background: #10b981;
            color: white;
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 600;
          }
          .status-pending { color: #f59e0b; font-weight: bold; }
          .status-delivered { color: #10b981; font-weight: bold; }
          .status-cancelled { color: #ef4444; font-weight: bold; }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 11px;
            color: #6b7280;
            border-top: 1px solid #e5e7eb;
            padding-top: 10px;
          }
          @media print {
            body { padding: 10px; }
            .company-header {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            th {
              background: #bbbbbc !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <!-- Company Header Section -->
        <div class="company-header">
          <div class="header-section company-info-ar">
            <div>${companyData.arabicName || ''}</div>
            <div>${companyData.companyType || ''}</div>
            <div>السجل التجاري: ${companyData.commercialRegistration || ''}</div>
            <div>الملف الضريبي: ${companyData.taxFile || ''}</div>
            <div>العنوان: ${companyData.city || ''} ${companyData.region || ''} ${companyData.street || ''} ${companyData.district || ''} ${companyData.buildingNumber || ''}</div>
            <div>الرمز البريدي: ${companyData.postalCode || ''}</div>
            <div>الهاتف: ${companyData.phone || ''}</div>
            <div>الجوال: ${companyData.mobile || ''}</div>
          </div>
          <div class="header-section center">
            <img src="${companyData.logoUrl || 'https://via.placeholder.com/100x50?text=Company+Logo'}" class="logo" alt="Company Logo">
          </div>
          <div class="header-section company-info-en">
            <div>${companyData.englishName || ''}</div>
            <div>${companyData.companyType || ''}</div>
            <div>Commercial Reg.: ${companyData.commercialRegistration || ''}</div>
            <div>Tax File: ${companyData.taxFile || ''}</div>
            <div>Address: ${companyData.city || ''} ${companyData.region || ''} ${companyData.street || ''} ${companyData.district || ''} ${companyData.buildingNumber || ''}</div>
            <div>Postal Code: ${companyData.postalCode || ''}</div>
            <div>Phone: ${companyData.phone || ''}</div>
            <div>Mobile: ${companyData.mobile || ''}</div>
          </div>
        </div>
        
        <div class="header">
          <h1>
            <svg style="display: inline-block; vertical-align: middle; width: 28px; height: 28px; margin-left: 8px;" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
            طلبات التوصيل - السائق ${driver.name}
          </h1>
          <p>نظام إدارة الموارد ERP90</p>
        </div>
        
        <div class="driver-info">
          <div><strong>اسم السائق:</strong> ${driver.name}</div>
          <div><strong>رقم الهاتف:</strong> ${driver.phone || 'غير متوفر'}</div>
          <div><strong>عدد الطلبات:</strong> ${driver.ordersCount} طلب</div>
          <div><strong>تاريخ الطباعة:</strong> ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 40px;">م</th>
              <th style="width: 90px;">رقم الفاتورة</th>
              <th style="width: 120px;">اسم العميل</th>
              <th style="width: 85px;">هاتف العميل</th>
              <th style="width: 70px;">الحي</th>
              <th style="width: 70px;">المنطقة</th>
              <th style="width: 100px;">الملاحظات</th>
              <th style="width: 50px;">التركيب</th>
              <th style="width: 80px;">حالة التوصيل</th>
              <th style="width: 80px;">تاريخ التسليم</th>
            </tr>
          </thead>
          <tbody>
            ${driver.orders.map((order, index) => {
              const formatDate = (dateStr) => {
                if (!dateStr) return '-';
                try {
                  const date = new Date(dateStr);
                  return date.toLocaleDateString('en-GB');
                } catch {
                  return dateStr;
                }
              };
              
              const getStatusClass = (status) => {
                if (status === 'تم التسليم' || status === 'تم التوصيل') return 'status-delivered';
                if (status === 'ملغي') return 'status-cancelled';
                return 'status-pending';
              };
              
              return `
              <tr>
                <td>${index + 1}</td>
                <td><strong>${order.fullInvoiceNumber}</strong></td>
                <td>${order.customerName || '-'}</td>
                <td>${order.customerPhone || '-'}</td>
                <td>${order.districtName || '-'}</td>
                <td>${order.regionName || '-'}</td>
                <td style="font-size: 9px; text-align: right; padding-right: 6px;">${order.notes || '-'}</td>
                <td>${order.requiresInstallation ? '<span class="installation-badge">نعم ⚙️</span>' : 'لا'}</td>
                <td class="${getStatusClass(order.status)}">${order.status || 'قيد الانتظار'}</td>
                <td>${formatDate(order.deliveryDate)}</td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
        
        <div class="footer">
          <p><strong>نظام ERP90 - إدارة الموارد</strong> | تم الطباعة بواسطة: ${driver.name}</p>
          <p style="margin-top: 5px; font-size: 10px;">تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}</p>
        </div>
        
        <!-- Signature Section -->
        <div style="
          margin-top: 40px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0 20px;
          page-break-inside: avoid;
        ">
          <div style="flex: 1; text-align: right; font-size: 12px; font-weight: 500;">
            <div style="margin-bottom: 6px;">السائق: ___________________</div>
            <div>التوقيع: ___________________</div>
          </div>
          <div style="flex: 1; text-align: center; position: relative;">
            <div style="
              margin-top: 10px;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 160px;
              height: 60px;
              border: 3px dashed #000;
              border-radius: 50%;
              box-shadow: 0 3px 10px 0 rgba(0,0,0,0.12);
              opacity: 0.9;
              background: repeating-linear-gradient(135deg, #f3f4f6 0 10px, #fff 10px 20px);
              font-family: 'Tajawal', Arial, sans-serif;
              font-size: 14px;
              font-weight: bold;
              color: #000;
              letter-spacing: 1px;
              text-align: center;
              margin-left: auto;
              margin-right: auto;
              z-index: 2;
            ">
              <div style="width: 100%;">
                <div style="font-size: 16px; font-weight: 700; line-height: 1.2;">${companyData.arabicName || 'الشركة'}</div>
                <div style="font-size: 12px; font-weight: 500; margin-top: 4px; line-height: 1.1;">${companyData.phone ? 'هاتف: ' + companyData.phone : ''}</div>
              </div>
            </div>
          </div>
          <div style="flex: 1; text-align: left; font-size: 12px; font-weight: 500;">
            <div style="margin-bottom: 6px;">مشرف التوصيل: ___________________</div>
            <div>التاريخ: ${new Date().toLocaleDateString('en-GB')}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // أعمدة الجدول
  const columns = [
    {
      title: 'السائق',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      sorter: (a: DriverData, b: DriverData) => a.name.localeCompare(b.name, 'ar'),
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800">{text}</span>
        </div>
      ),
    },
    {
      title: 'رقم الهاتف',
      dataIndex: 'phone',
      key: 'phone',
      width: 150,
      render: (phone: string, record: DriverData) => (
        <div className="flex flex-col items-center">
          <span className="font-medium text-gray-700">{phone}</span>
          <span className="text-xs text-gray-500">رقم السائق</span>
        </div>
      ),
    },
    {
      title: 'عدد الطلبات',
      dataIndex: 'ordersCount',
      key: 'ordersCount',
      width: 120,
      sorter: (a: DriverData, b: DriverData) => a.ordersCount - b.ordersCount,
      render: (count: number) => (
        <div className="flex items-center justify-center gap-2">
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold">
            {count}
          </div>
        </div>
      ),
    },
    {
      title: 'الإجراءات',
      key: 'actions',
      width: 280,
      render: (_: unknown, record: DriverData) => (
        <div className="flex gap-2 justify-center">
          <Button
            type="primary"
            icon={<WhatsAppOutlined />}
            onClick={() => handleSendWhatsApp(record)}
            className="bg-green-500 hover:bg-green-600"
            size="middle"
          >
            واتساب
          </Button>
          <Button
            type="default"
            icon={<FilePdfOutlined />}
            onClick={async () => {
              try {
                message.loading({ content: 'جاري إنشاء PDF...', key: 'pdf-download' });
                const pdfBlob = await generatePDF(record);
                const url = URL.createObjectURL(pdfBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `طلبات_${record.name}_${new Date().getTime()}.pdf`;
                link.click();
                URL.revokeObjectURL(url);
                message.success({ content: 'تم تحميل PDF بنجاح', key: 'pdf-download' });
              } catch (error) {
                console.error('Error generating PDF:', error);
                message.error({ content: 'حدث خطأ أثناء إنشاء PDF', key: 'pdf-download' });
              }
            }}
            size="middle"
          >
            PDF
          </Button>
          <Button
            type="default"
            icon={<PrinterOutlined />}
            onClick={() => handlePrint(record)}
            size="middle"
          >
            طباعة
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <Helmet>
        <title>إشعارات السائقين | ERP90 Dashboard</title>
        <meta name="description" content="إدارة إشعارات السائقين وطلبات التوصيل، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, سائقين, إشعارات, توصيل, واتساب, Drivers, Notifications, Delivery" />
      </Helmet>

      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
        {/* Header */}
        <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <svg className="h-8 w-8 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إشعارات السائقين</h1>
                <p className="text-gray-600 dark:text-gray-400">إدارة ومتابعة طلبات التوصيل للسائقين</p>
              </div>
            </div>

            {/* فلتر الحالة */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
              <span className="flex items-center gap-2">
                <label className="text-base font-medium text-gray-700 dark:text-gray-300">فلتر الحالة:</label>
              </span>
              <div className="min-w-[160px]">
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ 
                    width: 160, 
                    height: 40, 
                    fontSize: 16, 
                    borderRadius: 8, 
                    background: '#fff',
                    textAlign: 'right'
                  }}
                  size="middle"
                >
                  <Option value="الكل">الكل</Option>
                  <Option value="قيد الانتظار">قيد الانتظار</Option>
                  <Option value="تحت التنفيذ">تحت التنفيذ</Option>
                  <Option value="تم التسليم">تم التسليم</Option>
                  <Option value="ملغي">ملغي</Option>
                </Select>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>
        </div>

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "إدارة التوصيلات", to: "/management/outputs" },
            { label: "طلبات التوصيل", to: "/management/orders" },
            { label: "إشعارات السائقين" }
          ]}
        />

        {/* قسم التصفية */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-6 rounded-lg border border-gray-200 shadow-sm mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <FilterOutlined className="text-purple-600 text-xl" />
            <h3 className="text-lg font-semibold text-gray-700">تصفية البيانات</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* تصفية السائق */}
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-medium text-gray-700">السائق</label>
              <Select
                value={selectedDriverId || undefined}
                onChange={setSelectedDriverId}
                placeholder="جميع السائقين"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                }
                style={{ 
                  width: '100%', 
                  height: 42,
                  borderRadius: 8,
                }}
                size="large"
              >
                {allDriversList.map(driver => (
                  <Option key={driver.id} value={driver.id}>
                    {driver.name}
                  </Option>
                ))}
              </Select>
            </div>

            {/* تصفية تاريخ التسليم */}
            <div className="flex flex-col">
              <label className="mb-2 text-sm font-medium text-gray-700">تاريخ التسليم</label>
              <DatePicker
                value={selectedDeliveryDate}
                onChange={setSelectedDeliveryDate}
                placeholder="جميع التواريخ"
                format="YYYY-MM-DD"
                locale={arEG}
                allowClear
                style={{ 
                  width: '100%', 
                  height: 42,
                  borderRadius: 8,
                }}
                size="large"
              />
            </div>

            {/* زر إعادة التعيين */}
            <div className="flex flex-col justify-end">
              <Button
                onClick={handleResetFilters}
                size="large"
                className="h-[42px]"
                icon={<ReloadOutlined />}
              >
                إعادة تعيين التصفية
              </Button>
            </div>
          </div>

          {/* عرض نتائج التصفية */}
          {(selectedDriverId || selectedDeliveryDate) && (
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold text-purple-700">التصفية النشطة:</span>
                {selectedDriverId && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                    السائق: {allDriversList.find(d => d.id === selectedDriverId)?.name}
                  </span>
                )}
                {selectedDeliveryDate && (
                  <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                    التاريخ: {selectedDeliveryDate.format('YYYY-MM-DD')}
                  </span>
                )}
                <span className="mr-auto font-semibold text-purple-700">
                  النتائج: {filteredDrivers.length} سائق - {filteredDrivers.reduce((sum, d) => sum + d.ordersCount, 0)} طلب
                </span>
              </div>
            </div>
          )}
        </motion.div>

        {/* الجدول */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full bg-white p-4 rounded-lg shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              السائقين ({filteredDrivers.length})
              {filteredDrivers.length > 0 && (
                <span className="text-sm text-gray-500 mr-2">
                  - إجمالي الطلبات: {filteredDrivers.reduce((sum, d) => sum + d.ordersCount, 0)}
                </span>
              )}
            </h3>
            
            <Button
              type="primary"
              onClick={fetchDriverData}
              loading={loading}
              className="bg-purple-500 hover:bg-purple-600"
              icon={<ReloadOutlined />}
            >
              تحديث البيانات
            </Button>
          </div>

          <Table
            columns={columns}
            dataSource={filteredDrivers}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showTotal: (total, range) => `${range[0]}-${range[1]} من ${total} سائق`,
              showSizeChanger: true,
            }}
            locale={{
              emptyText: (
                <div className="py-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-gray-500 text-lg font-semibold mb-2">لا توجد طلبات توصيل</p>
                  <p className="text-gray-400 text-sm">لا توجد طلبات بحالة "{statusFilter}"</p>
                  <p className="text-gray-400 text-sm mt-2">جرب تغيير الفلتر أعلاه لعرض طلبات أخرى</p>
                </div>
              )
            }}
            className="[&_.ant-table-thead_>_tr_>_th]:bg-purple-100 [&_.ant-table-thead_>_tr_>_th]:text-purple-900 [&_.ant-table-thead_>_tr_>_th]:border-purple-200 [&_.ant-table-thead_>_tr_>_th]:font-bold [&_.ant-table-tbody_>_tr:hover_>_td]:bg-purple-50"
          />
        </motion.div>
      </div>
    </>
  );
};

export default DriverNotifications;

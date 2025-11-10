import React, { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, addDoc, updateDoc, query, where, orderBy, limit, doc, getDoc } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { motion } from "framer-motion";
import { DatePicker, Input, Select, Button, Upload, Checkbox, message, UploadFile } from "antd";
import { UploadOutlined, SaveOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch as BranchType } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { useAuth } from "@/contexts/useAuth";
import dayjs from 'dayjs';
import styles from './ReceiptVoucher.module.css';
import { Select as AntdSelect } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

interface Branch {
  id: string;
  name?: string;
  code?: string;
  number?: string;
  branchNumber?: string;
  balance?: number;
}

interface Warehouse {
  id: string;
  name?: string;
  keeper?: string;
  phone?: string;
  address?: string;
}

interface BranchWarehouseLink {
  id: string;
  branchId: string;
  branchName: string;
  warehouseId: string;
  warehouseName: string;
}

interface BranchStatus {
  id: string;
  branchId: string;
  branchName: string;
  amount: number;
}

interface Driver {
  id: string;
  name?: string;
  nameAr?: string;
  phone?: string;
  mobile?: string;
}

interface Governorate {
  id: string;
  name?: string;
  nameAr?: string;
}

interface Region {
  id: string;
  name?: string;
  nameAr?: string;
  governorate?: string;
}

interface District {
  id: string;
  name?: string;
  nameAr?: string;
  regionId?: string;
  regionName?: string;
  governorateId?: string;
  governorateName?: string;
}

interface DeliverySettings {
  maxOrdersPerRegion: number;
  allowZeroLimit: boolean;
  enableDriverAssignment: boolean;
  requireDriverForOrder: boolean;
}

const EditDeliveryOrder: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  
  // حالة تحميل بيانات الطلب
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [originalFileUrl, setOriginalFileUrl] = useState<string>("");
  
  // بيانات المستخدم الحالي من localStorage
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    fullName: string;
    position: string;
    branchId?: string;
    branchName?: string;
    warehouseId?: string;
    warehouseName?: string;
    permissions?: string[];
  } | null>(null);
  
  // حالات البيانات الأساسية
  const [branches, setBranches] = useState<Branch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [branchLinks, setBranchLinks] = useState<BranchWarehouseLink[]>([]);
  const [branchStatuses, setBranchStatuses] = useState<BranchStatus[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  
  // حالات النموذج
  const [branchId, setBranchId] = useState<string>("");
  const [branchBalance, setBranchBalance] = useState<number>(0);
  const [invoiceNumberPart, setInvoiceNumberPart] = useState<string>("");
  const [fullInvoiceNumber, setFullInvoiceNumber] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [districtId, setDistrictId] = useState<string>("");
  const [regionId, setRegionId] = useState<string>("");
  const [governorateId, setGovernorateId] = useState<string>("");
  const [driverId, setDriverId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [warehouseKeeper, setWarehouseKeeper] = useState<string>("");
  const [status, setStatus] = useState<string>("قيد الانتظار");
  const [deliveryDate, setDeliveryDate] = useState<dayjs.Dayjs | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [notes, setNotes] = useState<string>("");
  const [requiresInstallation, setRequiresInstallation] = useState<boolean>(false);
  
  // حالات التحكم
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [invoiceExists, setInvoiceExists] = useState(false);
  const [checkingInvoice, setCheckingInvoice] = useState(false);
  
  // إعدادات التوصيل
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings | null>(null);
  const [maxOrdersReached, setMaxOrdersReached] = useState(false);
  const [currentOrdersCount, setCurrentOrdersCount] = useState(0);
  const [shouldAutoAdjustDate, setShouldAutoAdjustDate] = useState(false);

  // السنة المالية
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  // تحميل بيانات المستخدم الحالي من localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
        console.log('👤 Current User:', user);
        
        // إذا كان مدير فرع، تعيين الفرع تلقائياً
        if (user.position === 'مدير فرع' && user.branchId) {
          setBranchId(user.branchId);
          console.log('🏪 Auto-selected branch for مدير فرع:', user.branchId);
        }
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
  }, [currentFinancialYear]);

  const handleFiscalYearChange = (value: string) => {
    setFiscalYear(value);
    const selectedYear = activeYears.find(y => y.year.toString() === value);
    if (selectedYear) {
      setCurrentFinancialYear(selectedYear);
    }
  };

  // ستايل الحقول
  const largeControlStyle = {
    height: 48,
    fontSize: 18,
    borderRadius: 8,
    padding: "8px 16px",
    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
    background: "#fff",
    border: "1.5px solid #d9d9d9",
    transition: "border-color 0.3s",
  };
  const labelStyle = { fontSize: 18, fontWeight: 500 };

  // دالة التحقق من وجود رقم الفاتورة
  const checkInvoiceExists = useCallback(async (invoiceNumber: string) => {
    if (!invoiceNumber) {
      setInvoiceExists(false);
      return;
    }

    setCheckingInvoice(true);
    try {
      const invoiceQuery = query(
        collection(db, 'delivery_orders'),
        where('fullInvoiceNumber', '==', invoiceNumber),
        limit(1)
      );
      const invoiceSnapshot = await getDocs(invoiceQuery);
      
      // استثناء الطلب الحالي من التحقق
      if (!invoiceSnapshot.empty && orderId) {
        const foundDoc = invoiceSnapshot.docs[0];
        setInvoiceExists(foundDoc.id !== orderId);
      } else {
        setInvoiceExists(!invoiceSnapshot.empty);
      }
    } catch (error) {
      console.error('Error checking invoice:', error);
      setInvoiceExists(false);
    } finally {
      setCheckingInvoice(false);
    }
  }, [orderId]);

  // دالة توليد رقم الفاتورة الكامل
  const generateFullInvoiceNumber = useCallback((branchIdValue: string, numberPart: string) => {
    if (!branchIdValue || !numberPart) return;

    const branchObj = branches.find(b => b.id === branchIdValue);
    const branchCode = branchObj?.code || '1';
    const year = new Date().getFullYear();
    const shortYear = year.toString().slice(-2); // آخر رقمين من السنة
    
    // إزالة الأصفار من البداية
    const invoiceNumber = parseInt(numberPart, 10).toString();
    
    const fullNumber = `INV-${branchCode}-${shortYear}-${invoiceNumber}`;
    setFullInvoiceNumber(fullNumber);
    
    // التحقق من وجود الفاتورة
    checkInvoiceExists(fullNumber);
  }, [branches, checkInvoiceExists]);

  // جلب الفروع
  useEffect(() => {
    const fetchBranchesData = async () => {
      try {
        setBranchesLoading(true);
        const branchesData = await fetchBranches();
        const mappedBranches = branchesData.map(b => ({
          id: b.id || '',
          name: b.name,
          code: b.code
        }));
        setBranches(mappedBranches);
      } catch (error) {
        console.error('Error fetching branches:', error);
        message.error('حدث خطأ في تحميل الفروع');
      } finally {
        setBranchesLoading(false);
      }
    };
    fetchBranchesData();
  }, []);

  // جلب المخازن من delivery_warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const warehousesSnapshot = await getDocs(collection(db, 'delivery_warehouses'));
        const warehousesData = warehousesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Warehouse[];
        setWarehouses(warehousesData);
      } catch (error) {
        console.error('Error fetching warehouses:', error);
      }
    };
    fetchWarehouses();
  }, []);

  // جلب ربط الفروع بالمستودعات
  useEffect(() => {
    const fetchBranchLinks = async () => {
      try {
        const linksSnapshot = await getDocs(collection(db, 'branch_warehouse_links'));
        const linksData = linksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BranchWarehouseLink[];
        setBranchLinks(linksData);
      } catch (error) {
        console.error('Error fetching branch links:', error);
      }
    };
    fetchBranchLinks();
  }, []);

  // جلب حالة الفروع
  useEffect(() => {
    const fetchBranchStatuses = async () => {
      try {
        const statusesSnapshot = await getDocs(collection(db, 'branch_statuses'));
        const statusesData = statusesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as BranchStatus[];
        setBranchStatuses(statusesData);
      } catch (error) {
        console.error('Error fetching branch statuses:', error);
      }
    };
    fetchBranchStatuses();
  }, []);

  // جلب السائقين
  useEffect(() => {
    const fetchDrivers = async () => {
      try {
        const driversSnapshot = await getDocs(collection(db, 'drivers'));
        const driversData = driversSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Driver[];
        setDrivers(driversData);
      } catch (error) {
        console.error('Error fetching drivers:', error);
      }
    };
    fetchDrivers();
  }, []);

  // جلب المحافظات
  useEffect(() => {
    const fetchGovernorates = async () => {
      try {
        const governoratesSnapshot = await getDocs(collection(db, 'governorates'));
        const governoratesData = governoratesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Governorate[];
        setGovernorates(governoratesData);
      } catch (error) {
        console.error('Error fetching governorates:', error);
      }
    };
    fetchGovernorates();
  }, []);

  // جلب المناطق
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const regionsSnapshot = await getDocs(collection(db, 'regions'));
        const regionsData = regionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Region[];
        setRegions(regionsData);
      } catch (error) {
        console.error('Error fetching regions:', error);
      }
    };
    fetchRegions();
  }, []);

  // جلب الأحياء
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const districtsSnapshot = await getDocs(collection(db, 'districts'));
        const districtsData = districtsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as District[];
        setDistricts(districtsData);
      } catch (error) {
        console.error('Error fetching districts:', error);
      }
    };
    fetchDistricts();
  }, []);

  // جلب بيانات الطلب الحالي للتعديل
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId) {
        message.warning('لم يتم تحديد رقم الطلب. سيتم إعادة التوجيه...');
        setTimeout(() => {
          navigate('/management/delivery-orders');
        }, 2000);
        setLoadingOrder(false);
        return;
      }

      try {
        setLoadingOrder(true);
        const orderDoc = await getDoc(doc(db, 'delivery_orders', orderId));
        
        if (orderDoc.exists()) {
          const orderData = orderDoc.data();
          
          // تعبئة الحقول بالبيانات الموجودة
          setBranchId(orderData.branchId || '');
          setInvoiceNumberPart(orderData.invoiceNumberPart || '');
          setFullInvoiceNumber(orderData.fullInvoiceNumber || '');
          setCustomerName(orderData.customerName || '');
          setCustomerPhone(orderData.customerPhone || '');
          setDistrictId(orderData.districtId || '');
          setRegionId(orderData.regionId || '');
          setGovernorateId(orderData.governorateId || '');
          setDriverId(orderData.driverId || '');
          setWarehouseId(orderData.warehouseId || '');
          setWarehouseKeeper(orderData.warehouseKeeper || '');
          setStatus(orderData.status || 'قيد الانتظار');
          setDeliveryDate(orderData.deliveryDate ? dayjs(orderData.deliveryDate) : null);
          setNotes(orderData.notes || '');
          setRequiresInstallation(orderData.requiresInstallation || false);
          setBranchBalance(orderData.branchBalance || 0);
          
          // حفظ رابط الملف الأصلي
          if (orderData.fileUrl) {
            setOriginalFileUrl(orderData.fileUrl);
            // إضافة الملف الموجود للقائمة
            if (orderData.fileName) {
              setFileList([{
                uid: '-1',
                name: orderData.fileName,
                status: 'done',
                url: orderData.fileUrl
              } as UploadFile]);
            }
          }
          
          message.success('تم تحميل بيانات الطلب بنجاح');
        } else {
          message.error('لم يتم العثور على الطلب');
          navigate('/management/delivery-orders');
        }
      } catch (error) {
        console.error('Error fetching order data:', error);
        message.error('حدث خطأ في تحميل بيانات الطلب');
      } finally {
        setLoadingOrder(false);
      }
    };

    fetchOrderData();
  }, [orderId, navigate]);

  // جلب إعدادات التوصيل
  useEffect(() => {
    const fetchDeliverySettings = async () => {
      if (!currentFinancialYear) return;
      
      try {
        const settingsRef = doc(db, `financialYears/${currentFinancialYear.id}/settings`, 'delivery');
        const settingsDoc = await getDoc(settingsRef);
        
        if (settingsDoc.exists()) {
          setDeliverySettings(settingsDoc.data() as DeliverySettings);
        }
      } catch (error) {
        console.error('Error fetching delivery settings:', error);
      }
    };
    fetchDeliverySettings();
  }, [currentFinancialYear]);

  // فحص عدد الطلبات الحالية للمنطقة في التاريخ المحدد
  useEffect(() => {
    const checkCurrentOrders = async () => {
      if (!regionId || !deliveryDate || !deliverySettings) return;

      try {
        const selectedDate = deliveryDate.format('YYYY-MM-DD');

        const ordersQuery = query(
          collection(db, 'delivery_orders'),
          where('regionId', '==', regionId),
          where('deliveryDate', '==', selectedDate)
        );

        const ordersSnapshot = await getDocs(ordersQuery);
        // استثناء الطلب الحالي من العد
        const count = ordersSnapshot.docs.filter(doc => doc.id !== orderId).length;
        setCurrentOrdersCount(count);

        // التحقق من الوصول للحد الأقصى
        if (deliverySettings.maxOrdersPerRegion > 0) {
          if (!deliverySettings.allowZeroLimit && count >= deliverySettings.maxOrdersPerRegion) {
            setMaxOrdersReached(true);
            setShouldAutoAdjustDate(true);
          } else {
            setMaxOrdersReached(false);
            setShouldAutoAdjustDate(false);
          }
        } else if (deliverySettings.maxOrdersPerRegion === 0 && !deliverySettings.allowZeroLimit) {
          setMaxOrdersReached(true);
          setShouldAutoAdjustDate(true);
        } else {
          setMaxOrdersReached(false);
          setShouldAutoAdjustDate(false);
        }
      } catch (error) {
        console.error('Error checking current orders:', error);
      }
    };
    checkCurrentOrders();
  }, [regionId, deliveryDate, deliverySettings, orderId]);

  // تحويل التاريخ تلقائياً عند الوصول للحد الأقصى
  useEffect(() => {
    if (shouldAutoAdjustDate && deliveryDate && regionId) {
      const nextDay = deliveryDate.add(1, 'day');
      setDeliveryDate(nextDay);
      setShouldAutoAdjustDate(false);
      
      const region = regions.find(r => r.id === regionId);
      const regionName = region?.nameAr || region?.name || 'المنطقة';
      
      message.warning({
        content: `تم الوصول للحد الأقصى في ${regionName}! تم تغيير التاريخ تلقائياً إلى ${nextDay.format('YYYY-MM-DD')}`,
        duration: 3
      });
    }
  }, [shouldAutoAdjustDate, deliveryDate, regionId, regions]);

  // عند اختيار الفرع
  useEffect(() => {
    if (!branchId || !branches.length) return;

    const selectedBranch = branches.find(b => b.id === branchId);
    if (selectedBranch) {
      // 1. تعيين رصيد الفرع من branch_statuses
      const branchStatus = branchStatuses.find(bs => bs.branchId === branchId);
      if (branchStatus) {
        setBranchBalance(branchStatus.amount || 0);
      } else {
        setBranchBalance(0);
      }

      // 2. تحديد المخزن المرتبط بالفرع من branch_warehouse_links
      const branchLink = branchLinks.find(link => link.branchId === branchId);
      if (branchLink) {
        setWarehouseId(branchLink.warehouseId);
        
        // 3. جلب تفاصيل المستودع
        const warehouse = warehouses.find(w => w.id === branchLink.warehouseId);
        if (warehouse) {
          setWarehouseKeeper(warehouse.keeper || '');
        }
      } else {
        setWarehouseId('');
        setWarehouseKeeper('');
      }
    }

    // توليد رقم الفاتورة
    if (invoiceNumberPart) {
      generateFullInvoiceNumber(branchId, invoiceNumberPart);
    }
  }, [branchId, branches, branchStatuses, branchLinks, warehouses, invoiceNumberPart, generateFullInvoiceNumber]);

  // عند اختيار الحي
  useEffect(() => {
    if (!districtId || !districts.length) {
      // إعادة تعيين المنطقة والمحافظة إذا لم يتم اختيار حي
      setRegionId('');
      setGovernorateId('');
      return;
    }

    const selectedDistrict = districts.find(d => d.id === districtId);
    console.log('Selected District:', selectedDistrict);
    
    if (selectedDistrict) {
      // تعيين المنطقة تلقائياً
      if (selectedDistrict.regionId) {
        console.log('Setting regionId:', selectedDistrict.regionId);
        setRegionId(selectedDistrict.regionId);
      } else {
        console.log('No regionId found in district');
        setRegionId('');
      }
      
      // تعيين المحافظة تلقائياً
      if (selectedDistrict.governorateId) {
        console.log('Setting governorateId:', selectedDistrict.governorateId);
        setGovernorateId(selectedDistrict.governorateId);
      } else {
        console.log('No governorateId found in district');
        setGovernorateId('');
      }
    }
  }, [districtId, districts]);

  // معالجة تغيير رقم الفاتورة
  const handleInvoiceNumberChange = (value: string) => {
    // السماح بالأرقام فقط
    const numbersOnly = value.replace(/[^0-9]/g, '');
    setInvoiceNumberPart(numbersOnly);
    
    if (branchId) {
      generateFullInvoiceNumber(branchId, numbersOnly);
    }
  };

  // معالجة تغيير رقم الهاتف
  const handlePhoneChange = (value: string) => {
    // السماح بالأرقام فقط وحد أقصى 10 أرقام
    const numbersOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
    setCustomerPhone(numbersOnly);
  };

  // معالجة رفع الملف
  const handleFileUpload = (info: { fileList: UploadFile[] }) => {
    let newFileList = [...info.fileList];
    
    // السماح بملف واحد فقط
    newFileList = newFileList.slice(-1);
    
    // تحديد الحجم الأقصى 1MB
    newFileList = newFileList.map(file => {
      if (file.size && file.size > 1024 * 1024) {
        message.error('حجم الملف يجب أن يكون أقل من 1MB');
        return null;
      }
      return file;
    }).filter((file): file is UploadFile => file !== null);

    setFileList(newFileList);
  };

  // دالة الحفظ (التحديث)
  const handleSave = async () => {
    if (!orderId) {
      message.error('خطأ: معرف الطلب غير موجود');
      return;
    }

    // التحقق من الحقول المطلوبة
    if (!branchId) {
      message.error('يرجى اختيار الفرع');
      return;
    }
    if (!invoiceNumberPart) {
      message.error('يرجى إدخال رقم الفاتورة');
      return;
    }
    if (!fullInvoiceNumber) {
      message.error('يرجى إدخال رقم فاتورة صحيح');
      return;
    }
    if (!customerPhone || customerPhone.length !== 10) {
      message.error('يرجى إدخال رقم هاتف صحيح (10 أرقام)');
      return;
    }
    if (!districtId) {
      message.error('يرجى اختيار الحي');
      return;
    }
    if (!warehouseId) {
      message.error('يرجى اختيار المستودع');
      return;
    }
    if (!deliveryDate) {
      message.error('يرجى تحديد تاريخ التسليم');
      return;
    }
    if (fileList.length === 0 && !originalFileUrl) {
      message.error('يرجى إرفاق ملف');
      return;
    }

    // التحقق من الحد الأقصى للطلبات في المنطقة
    if (maxOrdersReached) {
      const region = regions.find(r => r.id === regionId);
      const regionName = region?.nameAr || region?.name || 'هذه المنطقة';
      
      if (deliverySettings?.maxOrdersPerRegion === 0) {
        message.error(`لا يمكن إضافة طلبات في ${regionName} (الحد الأقصى مغلق)`);
      } else {
        message.error(`تم الوصول للحد الأقصى للطلبات في ${regionName} (${deliverySettings?.maxOrdersPerRegion} طلب)`);
      }
      return;
    }

    setSaving(true);

    try {
      let fileUrl = originalFileUrl; // استخدام الملف الأصلي إذا لم يتم رفع ملف جديد
      
      // رفع الملف إلى Firebase Storage إذا تم اختيار ملف جديد
      if (fileList.length > 0 && fileList[0].originFileObj) {
        const file = fileList[0].originFileObj;
        const timestamp = new Date().getTime();
        const fileName = `delivery-orders/${fullInvoiceNumber}_${timestamp}_${file.name}`;
        const storageRef = ref(storage, fileName);
        
        // رفع الملف
        await uploadBytes(storageRef, file);
        
        // الحصول على رابط التحميل
        fileUrl = await getDownloadURL(storageRef);
      }

      // إعداد بيانات الطلب المحدثة
      const orderData = {
        fullInvoiceNumber,
        invoiceNumberPart,
        branchId,
        branchName: branches.find(b => b.id === branchId)?.name || '',
        branchBalance,
        customerName,
        customerPhone,
        districtId,
        districtName: districts.find(d => d.id === districtId)?.nameAr || districts.find(d => d.id === districtId)?.name || '',
        regionId,
        regionName: regions.find(r => r.id === regionId)?.nameAr || regions.find(r => r.id === regionId)?.name || '',
        governorateId,
        governorateName: governorates.find(g => g.id === governorateId)?.nameAr || governorates.find(g => g.id === governorateId)?.name || '',
        driverId: driverId || null,
        driverName: driverId ? (drivers.find(d => d.id === driverId)?.nameAr || drivers.find(d => d.id === driverId)?.name || '') : '',
        warehouseId,
        warehouseName: warehouses.find(w => w.id === warehouseId)?.name || '',
        warehouseKeeper,
        status,
        deliveryDate: deliveryDate.format('YYYY-MM-DD'),
        notes,
        requiresInstallation,
        fileName: fileList[0]?.name || '',
        fileSize: fileList[0]?.size || 0,
        fileUrl: fileUrl || '',
        updatedBy: user?.uid || '',
        updatedByName: user?.displayName || user?.email || '',
        updatedAt: new Date().toISOString(),
      };

      // تحديث الطلب في Firebase
      const orderRef = doc(db, 'delivery_orders', orderId);
      await updateDoc(orderRef, orderData);
      
      message.success(`تم تحديث طلب التوصيل بنجاح - رقم الطلب: ${fullInvoiceNumber}`);
      
      // إعادة التوجيه لصفحة طلبات التوصيل
      setTimeout(() => {
        navigate('/management/delivery-orders');
      }, 1500);
      
    } catch (error) {
      console.error('خطأ في تحديث طلب التوصيل:', error);
      message.error('حدث خطأ أثناء تحديث طلب التوصيل. يرجى المحاولة مرة أخرى');
    } finally {
      setSaving(false);
    }
  };



  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      <Helmet>
        <title>تعديل طلب توصيل | ERP90 Dashboard</title>
        <meta name="description" content="تعديل طلب توصيل موجود، إدارة طلبات التوصيل والشحن" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
              <svg className="h-8 w-8 text-amber-600 dark:text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">تعديل طلب توصيل</h1>
              <p className="text-gray-600 dark:text-gray-400">قم بتعديل بيانات طلب التوصيل</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <label className="text-base font-medium text-gray-700 dark:text-gray-300">السنة المالية:</label>
            </span>
            <div className="min-w-[160px]">
              <AntdSelect
                value={fiscalYear}
                onChange={handleFiscalYearChange}
                style={{ 
                  width: 160, 
                  height: 40, 
                  fontSize: 16, 
                  borderRadius: 8, 
                  background: '#fff', 
                  textAlign: 'right', 
                  boxShadow: '0 1px 6px rgba(0,0,0,0.07)', 
                  border: '1px solid #e2e8f0'
                }}
                dropdownStyle={{ textAlign: 'right', fontSize: 16 }}
                size="middle"
                placeholder="السنة المالية"
              >
                {activeYears && activeYears.map(y => (
                  <AntdSelect.Option key={y.id} value={y.year.toString()}>{y.year}</AntdSelect.Option>
                ))}
              </AntdSelect>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التوصيلات", to: "/management/outputs" },
          { label: "طلبات التوصيل", to: "/management/delivery-orders" },
          { label: "تعديل طلب توصيل" }
        ]}
      />

      {/* مؤشر التحميل */}
      {loadingOrder ? (
        <div className="flex justify-center items-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">جاري تحميل بيانات الطلب...</p>
          </div>
        </div>
      ) : (
        <>
          {/* النموذج */}
          <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-6 rounded-lg border border-emerald-100 flex flex-col gap-6 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-200"></div>

        {/* معلومات الفرع والفاتورة */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* الفرع */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              الفرع <span className="text-red-500">*</span>
            </label>
            <Select
              value={branchId}
              onChange={setBranchId}
              placeholder="اختر الفرع"
              style={{
                ...largeControlStyle,
                backgroundColor: currentUser?.position === 'مدير فرع' ? '#f0f9ff' : '#fff',
                cursor: currentUser?.position === 'مدير فرع' ? 'not-allowed' : 'pointer'
              }}
              size="large"
              className={styles.noAntBorder}
              loading={branchesLoading}
              disabled={currentUser?.position === 'مدير فرع'}
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {branches.map(branch => (
                <Option key={branch.id} value={branch.id}>
                  {branch.name}
                </Option>
              ))}
            </Select>
            {currentUser?.position === 'مدير فرع' && branchId && (
              <span className="text-blue-600 text-sm mt-1 font-medium">
                ✓ تم تحديد فرعك تلقائياً: {currentUser?.branchName || branches.find(b => b.id === branchId)?.name}
              </span>
            )}
          </div>

          {/* حالة الفرع */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              حالة الفرع (ريال)
            </label>
            <Input
              value={branchBalance ? `${branchBalance.toLocaleString()} ريال` : 'يظهر تلقائياً عند اختيار الفرع'}
              disabled
              style={largeControlStyle}
              size="large"
              className="bg-gray-100"
            />
          </div>

          {/* رقم الفاتورة (الجزء الأخير) */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              رقم الفاتورة <span className="text-red-500">*</span>
            </label>
            <Input
              value={invoiceNumberPart}
              onChange={(e) => handleInvoiceNumberChange(e.target.value)}
              placeholder="أدخل رقم الفاتورة (مثال: 201)"
              style={{
                ...largeControlStyle,
                backgroundColor: '#f9fafb',
                cursor: 'not-allowed'
              }}
              size="large"
              maxLength={6}
              disabled
            />
            {orderId && (
              <span className="text-blue-600 text-sm mt-1">
                ℹ️ لا يمكن تعديل رقم الفاتورة في وضع التحديث
              </span>
            )}
          </div>

          {/* رقم الفاتورة الكامل */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              رقم الفاتورة الكامل <span className="text-red-500">*</span>
            </label>
            <Input
              value={fullInvoiceNumber || 'صيغة: INV-رقم_الفرع-السنة-الرقم (مثال: INV-2-25-201)'}
              disabled
              style={{
                ...largeControlStyle, 
                backgroundColor: '#f9fafb',
                color: '#059669',
                fontWeight: 600
              }}
              size="large"
              className="bg-gray-100"
            />
          </div>

          {/* اسم العميل */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              اسم العميل
            </label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="أدخل اسم العميل"
              style={largeControlStyle}
              size="large"
            />
          </div>

          {/* رقم الهاتف */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              رقم الهاتف <span className="text-red-500">*</span>
            </label>
            <Input
              value={customerPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              placeholder="يجب أن يكون 10 أرقام بالضبط"
              style={largeControlStyle}
              size="large"
              maxLength={10}
            />
            {customerPhone && customerPhone.length !== 10 && (
              <span className="text-red-500 text-sm mt-1">يجب أن يكون رقم الهاتف 10 أرقام</span>
            )}
          </div>

          {/* الحي */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              الحي <span className="text-red-500">*</span>
            </label>
            <Select
              value={districtId || undefined}
              onChange={setDistrictId}
              placeholder="اختر الحي"
              style={largeControlStyle}
              size="large"
              className={styles.noAntBorder}
              showSearch
              allowClear
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {districts.map(district => (
                <Option key={district.id} value={district.id}>
                  {district.nameAr || district.name}
                </Option>
              ))}
            </Select>
            
            {/* عرض عدد الطلبات الحالية */}
            {regionId && deliveryDate && deliverySettings && deliverySettings.maxOrdersPerRegion > 0 && (
              <div className={`mt-2 p-2 rounded ${maxOrdersReached ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                <span className={`text-sm ${maxOrdersReached ? 'text-red-600' : 'text-blue-600'}`}>
                  عدد الطلبات في المنطقة: {currentOrdersCount} / {deliverySettings.maxOrdersPerRegion}
                  {maxOrdersReached && ' (تم الوصول للحد الأقصى)'}
                </span>
              </div>
            )}
            
            {regionId && deliveryDate && deliverySettings && deliverySettings.maxOrdersPerRegion === 0 && !deliverySettings.allowZeroLimit && (
              <div className="mt-2 p-2 rounded bg-red-50 border border-red-200">
                <span className="text-sm text-red-600">
                  هذه المنطقة مغلقة حالياً
                </span>
              </div>
            )}
          </div>

          {/* المنطقة */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              المنطقة
            </label>
            <Input
              value={
                regionId 
                  ? (regions.find(r => r.id === regionId)?.nameAr || regions.find(r => r.id === regionId)?.name || 'غير محدد') 
                  : 'يتم تحديدها تلقائياً عند اختيار الحي'
              }
              disabled
              style={{...largeControlStyle, backgroundColor: '#f9fafb', color: regionId ? '#059669' : '#6b7280', fontWeight: regionId ? 600 : 400}}
              size="large"
            />
          </div>

          {/* المحافظة */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              المحافظة
            </label>
            <Input
              value={
                governorateId 
                  ? (governorates.find(g => g.id === governorateId)?.nameAr || governorates.find(g => g.id === governorateId)?.name || 'غير محدد') 
                  : 'يتم تحديدها تلقائياً عند اختيار الحي'
              }
              disabled
              style={{...largeControlStyle, backgroundColor: '#f9fafb', color: governorateId ? '#059669' : '#6b7280', fontWeight: governorateId ? 600 : 400}}
              size="large"
            />
          </div>

          {/* السائق */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              السائق
            </label>
            <Select
              value={driverId || undefined}
              onChange={setDriverId}
              placeholder="اختياري - يمكن تركه فارغاً"
              style={largeControlStyle}
              size="large"
              className={styles.noAntBorder}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option?.children?.toString().toLowerCase().includes(input.toLowerCase())
              }
            >
              {drivers.map(driver => (
                <Option key={driver.id} value={driver.id}>
                  {driver.nameAr || driver.name}
                </Option>
              ))}
            </Select>
          </div>

          {/* المستودع */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              المستودع <span className="text-red-500">*</span>
            </label>
            <Input
              value={warehouseId ? (warehouses.find(w => w.id === warehouseId)?.name || 'يتم تحديده تلقائياً عند اختيار الفرع') : 'يتم تحديده تلقائياً عند اختيار الفرع'}
              disabled
              style={largeControlStyle}
              size="large"
              className="bg-gray-100"
            />
          </div>

          {/* أمين المستودع */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              أمين المستودع
            </label>
            <Input
              value={warehouseKeeper || 'يتم تحديده تلقائياً عند اختيار الفرع'}
              disabled
              style={largeControlStyle}
              size="large"
              className="bg-gray-100"
            />
          </div>

          {/* الحالة */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              الحالة
            </label>
            <Input
              value={status}
              disabled
              style={largeControlStyle}
              size="large"
              className="bg-gray-100"
            />
          </div>

          {/* تاريخ التسليم */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              تاريخ التسليم <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={deliveryDate}
              onChange={setDeliveryDate}
              placeholder="حدد تاريخ التسليم المتوقع"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
              locale={arEG}
            />
          </div>

          {/* إرفاق ملف */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              إرفاق ملف <span className="text-red-500">*</span>
            </label>
            <Upload
              fileList={fileList}
              onChange={handleFileUpload}
              beforeUpload={() => false}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              maxCount={1}
            >
              <Button 
                icon={<UploadOutlined />} 
                style={largeControlStyle}
                size="large"
                className="w-full"
              >
                PDF, Word, Excel, صور | الحد الأقصى: 1MB
              </Button>
            </Upload>
            {fileList.length > 0 && (
              <span className="text-green-600 text-sm mt-1">تم اختيار: {fileList[0].name}</span>
            )}
          </div>
        </div>

        {/* الملاحظات */}
        <div className="flex flex-col">
          <label style={labelStyle} className="mb-2">
            الملاحظات
          </label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أدخل أي ملاحظات إضافية"
            rows={4}
            maxLength={500}
            showCount
            style={{ 
              fontSize: 18,
              borderRadius: 8,
              padding: "12px 16px",
              boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
              border: "1.5px solid #d9d9d9",
            }}
          />
        </div>

        {/* التركيب */}
        <div className="flex items-center gap-3">
          <Checkbox
            checked={requiresInstallation}
            onChange={(e) => setRequiresInstallation(e.target.checked)}
            style={{ fontSize: 18 }}
          >
            <span style={labelStyle}>يتطلب تركيب</span>
          </Checkbox>
          <span className="text-gray-500 text-sm">حدد إذا كان الطلب يتطلب تركيب</span>
        </div>

        {/* الأزرار */}
        <div className="flex gap-4 justify-end mt-6">
          <Button
            type="default"
            size="large"
            onClick={() => navigate('/management/delivery-orders')}
            style={{ height: 48, fontSize: 18, minWidth: 120 }}
          >
            إلغاء
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            size="large"
            onClick={handleSave}
            loading={saving}
            className="bg-green-600 hover:bg-green-700"
            style={{ height: 48, fontSize: 18, minWidth: 120 }}
          >
            {saving ? 'جاري التحديث...' : 'تحديث'}
          </Button>
        </div>
      </motion.div>
      </>
      )}
    </div>
  );
};

export default EditDeliveryOrder;

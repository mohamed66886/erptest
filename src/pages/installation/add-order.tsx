import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { 
  Button, 
  Input, 
  Select, 
  message, 
  DatePicker,
  Checkbox,
  Modal,
  Table,
  Badge
} from 'antd';
import { 
  SaveOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  UserOutlined,
  EnvironmentOutlined,
  ToolOutlined,
  SettingOutlined,
  BuildOutlined,
  SyncOutlined,
  ImportOutlined
} from '@ant-design/icons';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import dayjs from 'dayjs';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { motion } from 'framer-motion';
import Breadcrumb from '@/components/Breadcrumb';
import { useContext } from 'react';
import { FinancialYearContext } from '@/hooks/useFinancialYear';

const { Option } = Select;
const { TextArea } = Input;

// Types
interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
}

interface Technician {
  id: string;
  name: string;
  phone: string;
  email?: string;
  status: string;
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

interface DeliveryOrder {
  id: string;
  fullInvoiceNumber: string;
  branchName: string;
  customerName: string;
  customerPhone: string;
  districtId?: string;
  districtName: string;
  regionId?: string;
  regionName: string;
  governorateId?: string;
  governorateName: string;
  status: string;
  requiresInstallation: boolean;
  deliveryDate?: string;
  completedAt?: string;
  archivedAt?: string;
}

const AddInstallationOrder: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  
  // Form states
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [date, setDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [createdTime, setCreatedTime] = useState<string>(dayjs().format('HH:mm:ss'));
  const [documentNumber, setDocumentNumber] = useState<string>("");
  const [installationDate, setInstallationDate] = useState<dayjs.Dayjs | null>(null);
  const [responsibleEntity, setResponsibleEntity] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [technicianId, setTechnicianId] = useState<string>("");
  const [technicianName, setTechnicianName] = useState<string>("");
  const [technicianPhone, setTechnicianPhone] = useState<string>("");
  const [districtId, setDistrictId] = useState<string>("");
  const [regionId, setRegionId] = useState<string>("");
  const [governorateId, setGovernorateId] = useState<string>("");
  const [serviceType, setServiceType] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>("");

  // Import modal states
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [importedOrderIds, setImportedOrderIds] = useState<string[]>([]);

  // Financial Year
  const financialYearContext = useContext(FinancialYearContext);
  if (!financialYearContext) {
    throw new Error('FinancialYearContext must be used within FinancialYearProvider');
  }
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = financialYearContext;
  const [fiscalYear, setFiscalYear] = useState<string>("");

  // Style definitions
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

  useEffect(() => {
    const init = async () => {
      const newOrderNumber = await generateOrderNumber();
      setOrderNumber(newOrderNumber);
    };
    
    init();
    fetchBranches();
    fetchTechnicians();
    fetchGovernorates();
    fetchRegions();
    fetchDistricts();
    fetchDeliveryOrders(); // تحميل طلبات التوصيل عند تحميل الصفحة
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Fetch technicians
  const fetchTechnicians = async () => {
    try {
      const techniciansSnapshot = await getDocs(collection(db, 'technicians'));
      const techniciansData = techniciansSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Technician[];
      // فقط الفنيين النشطين
      const activeTechnicians = techniciansData.filter(t => t.status === 'نشط');
      setTechnicians(activeTechnicians);
    } catch (error) {
      console.error('Error fetching technicians:', error);
      message.error('حدث خطأ في جلب بيانات الفنيين');
    }
  };

  // Fetch governorates
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

  // Fetch regions
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

  // Fetch districts
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

  // Fetch delivery orders with installation requirement
  const fetchDeliveryOrders = async () => {
    setLoadingOrders(true);
    try {
      const ordersSnapshot = await getDocs(collection(db, 'delivery_orders'));
      const ordersData = ordersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as DeliveryOrder[];
      
      // فلترة الطلبات المكتملة أو المؤرشفة التي تحتاج تركيب ولم يتم استيرادها
      const filteredOrders = ordersData.filter(order => 
        (order.status === 'مكتمل' || order.status === 'مؤرشف') &&
        order.requiresInstallation === true &&
        !importedOrderIds.includes(order.id)
      );
      
      setDeliveryOrders(filteredOrders);
    } catch (error) {
      console.error('Error fetching delivery orders:', error);
      message.error('حدث خطأ في جلب طلبات التوصيل');
    } finally {
      setLoadingOrders(false);
    }
  };

  // Handle phone change
  const handlePhoneChange = (value: string, setter: (val: string) => void) => {
    const numbersOnly = value.replace(/[^0-9]/g, '').slice(0, 10);
    setter(numbersOnly);
  };

  // Handle technician name change
  const handleTechnicianNameChange = (name: string) => {
    const selectedTechnician = technicians.find(t => t.name === name);
    if (selectedTechnician) {
      setTechnicianId(selectedTechnician.id);
      setTechnicianName(selectedTechnician.name);
      setTechnicianPhone(selectedTechnician.phone);
    }
  };

  // Handle technician phone change
  const handleTechnicianPhoneChange = (phone: string) => {
    const selectedTechnician = technicians.find(t => t.phone === phone);
    if (selectedTechnician) {
      setTechnicianId(selectedTechnician.id);
      setTechnicianName(selectedTechnician.name);
      setTechnicianPhone(selectedTechnician.phone);
    }
  };

  // Handle service type change
  const handleServiceTypeChange = (type: string) => {
    const newServiceType = serviceType.includes(type)
      ? serviceType.filter(t => t !== type)
      : [...serviceType, type];
    setServiceType(newServiceType);
  };

  // Import order data
  const handleImportOrder = (order: DeliveryOrder) => {
    setDocumentNumber(order.fullInvoiceNumber);
    setResponsibleEntity(order.branchName);
    setCustomerName(order.customerName);
    setPhone(order.customerPhone);
    
    let addressImported = false;
    
    // Set address data
    if (order.districtId) {
      setDistrictId(order.districtId);
      addressImported = true;
    } else if (order.districtName) {
      // إذا لم يكن هناك districtId، ابحث عن الحي بالاسم
      const district = districts.find(d => 
        (d.nameAr === order.districtName || d.name === order.districtName)
      );
      if (district) {
        setDistrictId(district.id);
        addressImported = true;
      }
    }
    
    if (order.regionId) {
      setRegionId(order.regionId);
    }
    
    if (order.governorateId) {
      setGovernorateId(order.governorateId);
    }
    
    // إضافة الطلب للقائمة المستوردة
    setImportedOrderIds([...importedOrderIds, order.id]);
    
    setImportModalVisible(false);
    
    if (addressImported) {
      message.success(`تم استيراد بيانات الطلب بنجاح: ${order.fullInvoiceNumber}`);
    } else {
      message.warning(`تم استيراد بيانات الطلب: ${order.fullInvoiceNumber} - يرجى تحديد العنوان يدوياً`);
    }
  };

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

  // Handle submit
  const handleSave = async () => {
    // Validation
    if (!orderNumber) {
      message.error('يرجى إدخال رقم الطلب');
      return;
    }
    if (!documentNumber) {
      message.error('يرجى إدخال رقم المستند');
      return;
    }
    if (!installationDate) {
      message.error('يرجى تحديد تاريخ التركيب');
      return;
    }
    if (!responsibleEntity) {
      message.error('يرجى اختيار الجهة المسؤولة');
      return;
    }
    if (!customerName) {
      message.error('يرجى إدخال اسم العميل');
      return;
    }
    if (!phone || phone.length !== 10) {
      message.error('يرجى إدخال رقم هاتف صحيح (10 أرقام)');
      return;
    }
    if (!districtId) {
      message.error('يرجى اختيار الحي');
      return;
    }
    if (!regionId) {
      message.error('يرجى اختيار المنطقة');
      return;
    }
    if (!governorateId) {
      message.error('يرجى اختيار المحافظة');
      return;
    }
    if (!technicianName) {
      message.error('يرجى اختيار الفني');
      return;
    }
    if (!technicianPhone) {
      message.error('يرجى اختيار رقم هاتف الفني');
      return;
    }
    if (serviceType.length === 0) {
      message.error('يرجى اختيار نوع الخدمة');
      return;
    }

    setSaving(true);

    try {
      const orderData = {
        orderNumber,
        date: date?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD'),
        createdTime,
        documentNumber,
        installationDate: installationDate.format('YYYY-MM-DD'),
        responsibleEntity,
        customerName,
        phone,
        technicianId,
        technicianName,
        technicianPhone,
        districtId,
        districtName: districts.find(d => d.id === districtId)?.nameAr || districts.find(d => d.id === districtId)?.name || '',
        regionId,
        regionName: regions.find(r => r.id === regionId)?.nameAr || regions.find(r => r.id === regionId)?.name || '',
        governorateId,
        governorateName: governorates.find(g => g.id === governorateId)?.nameAr || governorates.find(g => g.id === governorateId)?.name || '',
        serviceType,
        notes,
        status: 'جديد',
        createdAt: serverTimestamp(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'installation_orders'), orderData);
      message.success(`تم حفظ طلب التركيب بنجاح - رقم الطلب: ${orderNumber}`);
      
      setTimeout(() => {
        navigate('/installation/orders');
      }, 1500);
      
    } catch (error) {
      console.error('خطأ في حفظ طلب التركيب:', error);
      message.error('حدث خطأ أثناء حفظ طلب التركيب. يرجى المحاولة مرة أخرى');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-6 font-['Tajawal'] bg-gray-50 min-h-screen">
      <Helmet>
        <title>إضافة طلب تركيب جديد | ERP90 Dashboard</title>
        <meta name="description" content="إضافة طلب تركيب جديد، إدارة طلبات التركيب والصيانة" />
      </Helmet>

      {/* Header */}
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <CheckCircleOutlined style={{ fontSize: 32, color: '#667eea' }} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-1">
                إضافة طلب تركيب جديد
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-base">
                املأ جميع البيانات المطلوبة لإنشاء طلب تركيب جديد
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <CalendarOutlined style={{ fontSize: 18, color: '#667eea' }} />
              <span className="text-gray-700 dark:text-gray-300 font-semibold">السنة المالية:</span>
            </span>
            <div className="min-w-[160px]">
              <Select
                value={fiscalYear}
                onChange={handleFiscalYearChange}
                style={{ width: '100%' }}
                size="large"
              >
                {activeYears.map(year => (
                  <Option key={year.id} value={year.year.toString()}>
                    {year.year}
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التركيبات", to: "/installation" },
          { label: "طلبات التركيب", to: "/installation/orders" },
          { label: "إضافة طلب جديد" }
        ]}
      />

      {/* Form */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-6 rounded-lg border border-purple-100 flex flex-col gap-6 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-purple-200"></div>

        {/* البيانات الأساسية */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* رقم الطلب */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              رقم الطلب <span className="text-red-500">*</span>
            </label>
            <Input
              value={orderNumber}
              disabled
              style={{...largeControlStyle, backgroundColor: '#f9fafb', fontWeight: 600, color: '#059669'}}
              size="large"
            />
          </div>

          {/* التاريخ */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              التاريخ <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="حدد التاريخ"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
              locale={arEG}
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </div>

          {/* وقت الإنشاء */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              وقت الإنشاء
            </label>
            <Input
              value={createdTime}
              disabled
              style={{...largeControlStyle, backgroundColor: '#f9fafb'}}
              size="large"
            />
          </div>

          {/* رقم المستند */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              رقم المستند <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="أدخل رقم المستند"
                style={{...largeControlStyle, flex: 1}}
                size="large"
              />
              <Badge 
                count={deliveryOrders.filter(order => !importedOrderIds.includes(order.id)).length} 
                showZero
                style={{ backgroundColor: '#059669' }}
              >
                <Button
                  type="primary"
                  icon={<ImportOutlined />}
                  onClick={() => {
                    setImportModalVisible(true);
                    fetchDeliveryOrders();
                  }}
                  className="bg-green-600 hover:bg-green-700"
                  style={{ height: 48, fontSize: 16 }}
                >
                  استيراد من طلب توصيل
                </Button>
              </Badge>
            </div>
          </div>

          {/* تاريخ التركيب */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              تاريخ التركيب <span className="text-red-500">*</span>
            </label>
            <DatePicker
              value={installationDate}
              onChange={setInstallationDate}
              placeholder="حدد تاريخ التركيب"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
              locale={arEG}
            />
          </div>

          {/* الجهة المسؤولة */}
          <div className="flex flex-col">
            <label style={labelStyle} className="mb-2">
              الجهة المسؤولة (الفرع) <span className="text-red-500">*</span>
            </label>
            <Select
              value={responsibleEntity || undefined}
              onChange={setResponsibleEntity}
              placeholder="اختر الفرع"
              style={largeControlStyle}
              size="large"
              showSearch
              optionFilterProp="children"
            >
              {branches.map(branch => (
                <Option key={branch.id} value={branch.name}>
                  {branch.name}
                </Option>
              ))}
            </Select>
          </div>
        </div>

        {/* بيانات العميل */}
        <div className="mt-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserOutlined style={{ fontSize: 24, color: '#667eea' }} />
            بيانات العميل
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* اسم العميل */}
            <div className="flex flex-col">
              <label style={labelStyle} className="mb-2">
                اسم العميل <span className="text-red-500">*</span>
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
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value, setPhone)}
                placeholder="05xxxxxxxx (10 أرقام)"
                style={largeControlStyle}
                size="large"
                maxLength={10}
                dir="ltr"
              />
            </div>
          </div>
        </div>

        {/* بيانات العنوان */}
        <div className="mt-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <EnvironmentOutlined style={{ fontSize: 24, color: '#667eea' }} />
            بيانات العنوان
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                showSearch
                optionFilterProp="children"
              >
                {districts.map(dist => (
                  <Option key={dist.id} value={dist.id}>
                    {dist.nameAr || dist.name}
                  </Option>
                ))}
              </Select>
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
          </div>
        </div>

        {/* بيانات الفني */}
        <div className="mt-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <ToolOutlined style={{ fontSize: 24, color: '#667eea' }} />
            بيانات الفني
          </h3>
          
          {technicians.length === 0 && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-base">
                ⚠️ لا يوجد فنيين نشطين متاحين حالياً. يرجى إضافة فني من صفحة <a href="/installation/technicians" className="text-blue-600 underline font-semibold">إدارة الفنيين</a>
              </p>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* اسم الفني */}
            <div className="flex flex-col">
              <label style={labelStyle} className="mb-2">
                اسم الفني <span className="text-red-500">*</span>
              </label>
              <Select
                value={technicianName || undefined}
                onChange={handleTechnicianNameChange}
                placeholder="اختر الفني"
                style={largeControlStyle}
                size="large"
                showSearch
                optionFilterProp="children"
              >
                {technicians.map(technician => (
                  <Option key={technician.id} value={technician.name}>
                    {technician.name}
                  </Option>
                ))}
              </Select>
            </div>

            {/* هاتف الفني */}
            <div className="flex flex-col">
              <label style={labelStyle} className="mb-2">
                هاتف الفني <span className="text-red-500">*</span>
              </label>
              <Select
                value={technicianPhone || undefined}
                onChange={handleTechnicianPhoneChange}
                placeholder="اختر رقم هاتف الفني"
                style={largeControlStyle}
                size="large"
                showSearch
                optionFilterProp="children"
              >
                {technicians.map(technician => (
                  <Option key={technician.id} value={technician.phone}>
                    {technician.phone} - {technician.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* نوع الخدمة */}
        <div className="mt-4">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <SettingOutlined style={{ fontSize: 24, color: '#667eea' }} />
            نوع الخدمة <span className="text-red-500">*</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* تركيب */}
            <div 
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                serviceType.includes('تركيب') 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => handleServiceTypeChange('تركيب')}
            >
              <Checkbox
                checked={serviceType.includes('تركيب')}
                onChange={() => handleServiceTypeChange('تركيب')}
                className="w-full"
              >
                <div className="flex flex-col items-center gap-2">
                  <BuildOutlined style={{ fontSize: 40, color: serviceType.includes('تركيب') ? '#667eea' : '#888' }} />
                  <span className="text-lg font-semibold">تركيب</span>
                </div>
              </Checkbox>
            </div>

            {/* فك */}
            <div 
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                serviceType.includes('فك') 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => handleServiceTypeChange('فك')}
            >
              <Checkbox
                checked={serviceType.includes('فك')}
                onChange={() => handleServiceTypeChange('فك')}
                className="w-full"
              >
                <div className="flex flex-col items-center gap-2">
                  <ToolOutlined style={{ fontSize: 40, color: serviceType.includes('فك') ? '#667eea' : '#888' }} />
                  <span className="text-lg font-semibold">فك</span>
                </div>
              </Checkbox>
            </div>

            {/* فك وتركيب */}
            <div 
              className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                serviceType.includes('فك وتركيب') 
                  ? 'border-purple-500 bg-purple-50' 
                  : 'border-gray-200 hover:border-purple-300'
              }`}
              onClick={() => handleServiceTypeChange('فك وتركيب')}
            >
              <Checkbox
                checked={serviceType.includes('فك وتركيب')}
                onChange={() => handleServiceTypeChange('فك وتركيب')}
                className="w-full"
              >
                <div className="flex flex-col items-center gap-2">
                  <SyncOutlined style={{ fontSize: 40, color: serviceType.includes('فك وتركيب') ? '#667eea' : '#888' }} />
                  <span className="text-lg font-semibold">فك وتركيب</span>
                </div>
              </Checkbox>
            </div>
          </div>
        </div>

        {/* الملاحظات */}
        <div className="flex flex-col mt-4">
          <label style={labelStyle} className="mb-2">
            ملاحظات إضافية
          </label>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="أدخل أي ملاحظات إضافية حول الطلب..."
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

        {/* الأزرار */}
        <div className="flex gap-4 justify-end mt-6">
          <Button
            type="default"
            size="large"
            onClick={() => navigate('/installation/orders')}
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
            className="bg-purple-600 hover:bg-purple-700"
            style={{ height: 48, fontSize: 18, minWidth: 120 }}
          >
            حفظ الطلب
          </Button>
        </div>
      </motion.div>

      {/* Import Modal */}
      <Modal
        title={
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xl">
              <ImportOutlined style={{ color: '#059669' }} />
              <span>استيراد من طلبات التوصيل المكتملة</span>
            </div>
            <Badge 
              count={deliveryOrders.filter(order => !importedOrderIds.includes(order.id)).length}
              showZero
              style={{ backgroundColor: '#059669' }}
            />
          </div>
        }
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-base text-gray-700">
              ✨ اختر طلب توصيل مكتمل أو مؤرشف يحتاج تركيب لاستيراد بياناته إلى نموذج إضافة طلب التركيب
            </p>
            <p className="text-sm text-gray-600 mt-2">
              💡 سيتم نقل: رقم الفاتورة، الفرع، اسم العميل، رقم الهاتف، والعنوان الكامل
            </p>
          </div>

          <Table
            dataSource={deliveryOrders.filter(order => !importedOrderIds.includes(order.id))}
            loading={loadingOrders}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '30'],
              showTotal: (total) => `إجمالي ${total} طلب`,
            }}
            locale={{
              emptyText: 'لا توجد طلبات توصيل متاحة للاستيراد',
            }}
            scroll={{ x: 1000 }}
            columns={[
              {
                title: '#',
                key: 'index',
                width: 50,
                render: (_text, _record, index) => index + 1,
              },
              {
                title: 'رقم الفاتورة',
                dataIndex: 'fullInvoiceNumber',
                key: 'fullInvoiceNumber',
                width: 180,
                render: (text: string) => (
                  <span className="font-semibold text-blue-600">{text}</span>
                ),
              },
              {
                title: 'الفرع',
                dataIndex: 'branchName',
                key: 'branchName',
                width: 120,
              },
              {
                title: 'اسم العميل',
                dataIndex: 'customerName',
                key: 'customerName',
                width: 150,
              },
              {
                title: 'رقم الهاتف',
                dataIndex: 'customerPhone',
                key: 'customerPhone',
                width: 120,
                render: (text: string) => (
                  <span className="font-mono">{text}</span>
                ),
              },
              {
                title: 'العنوان',
                key: 'address',
                width: 200,
                render: (_text, record: DeliveryOrder) => (
                  <div className="text-sm">
                    <div>{record.districtName}</div>
                    <div className="text-gray-500">{record.regionName} - {record.governorateName}</div>
                  </div>
                ),
              },
              {
                title: 'الحالة',
                dataIndex: 'status',
                key: 'status',
                width: 100,
                render: (status: string) => {
                  const color = status === 'مكتمل' ? 'green' : 'gray';
                  return <Badge status={color === 'green' ? 'success' : 'default'} text={status} />;
                },
              },
              {
                title: 'التاريخ',
                key: 'date',
                width: 120,
                render: (_text, record: DeliveryOrder) => {
                  const date = record.completedAt || record.archivedAt || record.deliveryDate;
                  return date ? dayjs(date).format('DD/MM/YYYY') : '-';
                },
              },
              {
                title: 'الإجراء',
                key: 'action',
                width: 120,
                fixed: 'right' as const,
                render: (_text, record: DeliveryOrder) => (
                  <Button
                    type="primary"
                    size="small"
                    icon={<ImportOutlined />}
                    onClick={() => handleImportOrder(record)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    استيراد
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Modal>
    </div>
  );
};

export default AddInstallationOrder;

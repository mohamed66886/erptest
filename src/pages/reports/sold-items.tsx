import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DatePicker, Input, Select, Table, Button } from "antd";
import { SearchOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import arEG from 'antd/es/date-picker/locale/ar_EG';
import { fetchBranches, Branch } from "@/lib/branches";
import Breadcrumb from "@/components/Breadcrumb";
import dayjs, { Dayjs } from 'dayjs';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { BarChartOutlined, TableOutlined, PrinterOutlined } from '@ant-design/icons';
import { Helmet } from "react-helmet";
import styles from './ReceiptVoucher.module.css';

const { Option } = Select;

interface WarehouseOption {
  id: string;
  name: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface ItemOption {
  id: string;
  name: string;
  itemNumber: string;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
}

interface ChartDataItem {
  itemName: string;
  totalQuantity: number;
  totalAmount: number;
}

// بيانات الأصناف المباعة
interface SoldItemRecord {
  key: string;
  itemNumber: string;
  itemName: string;
  category: string;
  unit: string;
  salePrice: number;
  quantity: number;
  totalAmount: number;
  baseTotal: number; // المبلغ الأساسي قبل الخصم
  discountValue: number; // قيمة الخصم
  invoiceNumber: string;
  date: string;
  branch: string;
  customer: string;
  warehouse: string;
  supplier: string;
}

const SoldItems: React.FC = () => {
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  
  // ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة أمر البيع
  const largeControlStyle = {
    height: 48,
    fontSize: 18,
    borderRadius: 8,
    padding: '8px 16px',
    boxShadow: '0 1px 6px rgba(0,0,0,0.07)',
    background: '#fff',
    border: '1.5px solid #d9d9d9',
    transition: 'border-color 0.3s',
  };
  const labelStyle = { fontSize: 18, fontWeight: 500, marginBottom: 2, display: 'block' };

  // خيارات البحث
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<Dayjs | null>(null);
  const [dateTo, setDateTo] = useState<Dayjs | null>(null);
  const [branchId, setBranchId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");

  // السنة المالية من السياق
  const { currentFinancialYear } = useFinancialYear();

  // تعيين التواريخ الافتراضية حسب السنة المالية
  useEffect(() => {
    if (currentFinancialYear) {
      const start = dayjs(currentFinancialYear.startDate);
      const end = dayjs(currentFinancialYear.endDate);
      setDateFrom(start);
      setDateTo(end);
    }
  }, [currentFinancialYear]);

  // قوائم الخيارات
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  // بيانات التقرير
  const [soldItems, setSoldItems] = useState<SoldItemRecord[]>([]);
  const [filteredItems, setFilteredItems] = useState<SoldItemRecord[]>([]);

  // بيانات الرسم البياني
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);

  // بيانات الشركة
  const [companyData, setCompanyData] = useState<Record<string, unknown>>({});

  useEffect(() => {
    fetchBranches().then(data => {
      setBranches(data);
      setBranchesLoading(false);
    });
    
    // جلب بيانات الشركة
    const fetchCompany = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // قائمة أسماء المجموعات المحتملة
        const possibleCollections = ['companies', 'company', 'company_settings'];
        let snapshot;
        let foundData = false;
        
        // جرب كل اسم مجموعة حتى تجد البيانات
        for (const collectionName of possibleCollections) {
          try {
            console.log(`جاري البحث في مجموعة: ${collectionName}`);
            snapshot = await getDocs(collection(db, collectionName));
            
            if (!snapshot.empty) {
              console.log(`تم العثور على بيانات في مجموعة: ${collectionName}`);
              foundData = true;
              break;
            } else {
              console.log(`مجموعة ${collectionName} فارغة`);
            }
          } catch (error) {
            console.log(`خطأ في الوصول إلى مجموعة ${collectionName}:`, error);
          }
        }
        
        if (foundData && snapshot && !snapshot.empty) {
          const companyDoc = snapshot.docs[0];
          const data = companyDoc.data();
          console.log('تم تحميل بيانات الشركة بنجاح:', data);
          setCompanyData(data);
        } else {
          console.log('لا توجد بيانات شركة في أي من المجموعات المحتملة');
          // تعيين بيانات افتراضية
          setCompanyData(createDefaultCompanyData());
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات الشركة:', error);
        // تعيين بيانات افتراضية في حالة الخطأ
        setCompanyData(createDefaultCompanyData());
      }
    };
    fetchCompany();
    
    // اختبار الاتصال بـ Firebase
    const testFirebaseConnection = async () => {
      try {
        const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        console.log('Firebase DB متصل:', !!db);
      } catch (error) {
        console.error('خطأ في الاتصال بـ Firebase:', error);
      }
    };
    testFirebaseConnection();
  }, []);

  // جلب المخازن من قاعدة البيانات
  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'warehouses'));
        const options = snap.docs.map(doc => {
          const data = doc.data();
          let name = '';
          if (data.nameAr && typeof data.nameAr === 'string') name = data.nameAr;
          else if (data.name && typeof data.name === 'string') name = data.name;
          else if (data.nameEn && typeof data.nameEn === 'string') name = data.nameEn;
          else name = doc.id;
          return {
            id: doc.id,
            name: name
          };
        });
        setWarehouses(options);
      } catch {
        setWarehouses([]);
      }
    };
    fetchWarehouses();
  }, []);

  // جلب العملاء من قاعدة البيانات
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'customers'));
        const options = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.customerName || doc.id
          };
        });
        setCustomers(options);
      } catch {
        setCustomers([]);
      }
    };
    fetchCustomers();
  }, []);

  // جلب الأصناف من قاعدة البيانات (نفس طريقة صفحة المبيعات)
  useEffect(() => {
    const fetchItems = async () => {
      setItemsLoading(true);
      console.log('بدء جلب الأصناف...');
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const snap = await getDocs(collection(db, 'inventory_items'));
        const options = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || data.itemName || doc.id,
            itemNumber: data.itemNumber || data.itemCode || data.number || doc.id
          };
        });
        console.log('عدد الأصناف المحملة:', options.length);
        setItems(options);
        
      } catch (error) {
        console.error('خطأ مفصل في جلب الأصناف:', error);
        console.error('تفاصيل الخطأ:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        setItems([]);
      } finally {
        setItemsLoading(false);
        console.log('انتهاء جلب الأصناف');
      }
    };
    
    // تأخير طفيف للتأكد من تحميل Firebase
    setTimeout(fetchItems, 100);
  }, []);

  // جلب الفئات من قاعدة البيانات
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // أولاً، جرب جلب الفئات من مجموعة categories المنفصلة
        let options: CategoryOption[] = [];
        try {
          const snap = await getDocs(collection(db, 'categories'));
          options = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || data.categoryName || doc.id
            };
          });
        } catch (error) {
          console.log('لا توجد مجموعة categories منفصلة، جاري جلب الفئات من inventory_items');
        }
        
        // إذا لم نجد فئات منفصلة، جلب الفئات من inventory_items
        if (options.length === 0) {
          const snap = await getDocs(collection(db, 'inventory_items'));
          const categorySet = new Set<string>();
          
          snap.docs.forEach(doc => {
            const data = doc.data();
            // جلب الأصناف الرئيسية والمستوى الأول كفئات
            if (data.type === 'رئيسي' || data.type === 'مستوى أول') {
              if (data.name) {
                categorySet.add(data.name);
              }
            }
          });
          
          options = Array.from(categorySet).map((name, index) => ({
            id: `category_${index}`,
            name
          }));
        }
        
        console.log('عدد الفئات المحملة:', options.length);
        setCategories(options);
      } catch (error) {
        console.error('خطأ في جلب الفئات:', error);
        setCategories([]);
      }
    };
    fetchCategories();
  }, []);

  // جلب الموردين من قاعدة البيانات
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        let options: SupplierOption[] = [];
        
        // أولاً، جرب جلب الموردين من مجموعة suppliers المنفصلة
        try {
          const snap = await getDocs(collection(db, 'suppliers'));
          options = snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || data.supplierName || doc.id
            };
          });
        } catch (error) {
          console.log('لا توجد مجموعة suppliers منفصلة');
        }
        
        // إذا لم نجد موردين منفصلين، جلب الموردين من inventory_items
        if (options.length === 0) {
          const snap = await getDocs(collection(db, 'inventory_items'));
          const supplierSet = new Set<string>();
          
          snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.supplier && typeof data.supplier === 'string') {
              supplierSet.add(data.supplier);
            }
          });
          
          options = Array.from(supplierSet).map((name, index) => ({
            id: `supplier_${index}`,
            name
          }));
        }
        
        console.log('عدد الموردين المحملة:', options.length);
        setSuppliers(options);
      } catch (error) {
        console.error('خطأ في جلب الموردين:', error);
        setSuppliers([]);
      }
    };
    fetchSuppliers();
  }, []);

  // جلب بيانات الأصناف المباعة من Firebase
  const fetchSoldItems = async () => {
    setIsLoading(true);
    try {
      const { getDocs, collection, query, where, doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      
      const baseQuery = collection(db, 'sales_invoices');
      const constraints = [];
      
      if (branchId) constraints.push(where('branch', '==', branchId));
      if (invoiceNumber) constraints.push(where('invoiceNumber', '==', invoiceNumber));
      if (dateFrom) constraints.push(where('date', '>=', dayjs(dateFrom).format('YYYY-MM-DD')));
      if (dateTo) constraints.push(where('date', '<=', dayjs(dateTo).format('YYYY-MM-DD')));
      if (warehouseId) constraints.push(where('warehouse', '==', warehouseId));
      
      const finalQuery = constraints.length > 0 ? query(baseQuery, ...constraints) : baseQuery;
      
      const snapshot = await getDocs(finalQuery);
      const records: SoldItemRecord[] = [];
      
      // جلب بيانات الأصناف لاستخراج الفئات الرئيسية
      const inventorySnapshot = await getDocs(collection(db, 'inventory_items'));
      const inventoryItems = inventorySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        name: doc.data().name,
        parentId: doc.data().parentId,
        ...doc.data() 
      }));
      
      // جلب بيانات الأصناف لاستخراج الأسعار الأصلية
      const itemPrices: { [key: string]: { price: number; unit: string; category: string; name: string } } = {};
      
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const invoiceNumber = data.invoiceNumber || '';
        const date = data.date || '';
        const branch = data.branch || '';
        const customer = data.customerName || data.customer || '';
        const warehouse = data.warehouse || '';
        const items = Array.isArray(data.items) ? data.items : [];
        
        for (const item of items) {
          // تطبيق فلاتر إضافية على مستوى الصنف
          let includeItem = true;
          
          // فلتر العميل - التحقق من الاسم والـ ID
          if (customerId) {
            const customerMatch = data.customerId === customerId || 
                                data.customerName === customerId || 
                                data.customer === customerId;
            if (!customerMatch) includeItem = false;
          }
          
          // فلتر الصنف - التحقق من رقم الصنف ورمز الصنف
          if (itemId) {
            const itemMatch = (item.itemNumber as string) === itemId || 
                            (item.itemCode as string) === itemId ||
                            (item.itemName as string) === itemId;
            if (!itemMatch) includeItem = false;
          }
          
          // فلتر الفئة - البحث في الفئة الرئيسية والفئة المحددة في البيانات
          if (categoryId) {
            // جلب اسم الفئة الرئيسية (الأب) من inventory_items
            let parentName = '';
            const foundItem = inventoryItems.find(i => 
              i.name === item.itemName || 
              (i as Record<string, unknown>).itemCode === item.itemNumber ||
              (i as Record<string, unknown>).itemNumber === item.itemNumber
            );
            if (foundItem && foundItem.parentId) {
              const parentItem = inventoryItems.find(i => i.id === foundItem.parentId || i.id === String(foundItem.parentId));
              parentName = parentItem?.name || '';
            }
            
            const categoryMatch = (item.mainCategory as string) === categoryId ||
                                 parentName === categoryId ||
                                 (item.category as string) === categoryId;
            if (!categoryMatch) includeItem = false;
          }
          
          // فلتر المورد
          if (supplierId) {
            const supplierMatch = (item.supplier as string) === supplierId;
            if (!supplierMatch) includeItem = false;
          }
          
          if (includeItem) {
            // جلب اسم الفئة الرئيسية (الأب) من inventory_items
            let parentName = '';
            const foundItem = inventoryItems.find(i => 
              i.name === item.itemName || 
              (i as Record<string, unknown>).itemCode === item.itemNumber ||
              (i as Record<string, unknown>).itemNumber === item.itemNumber
            );
            if (foundItem && foundItem.parentId) {
              const parentItem = inventoryItems.find(i => i.id === foundItem.parentId || i.id === String(foundItem.parentId));
              parentName = parentItem?.name || '';
            }
            
            // حساب الإجمالي الأساسي قبل الخصم
            const baseTotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
            // جلب قيمة الخصم من البيانات
            const discountValue = parseFloat(item.discountValue) || 0;
            // حساب الإجمالي بعد الخصم
            const totalAfterDiscount = baseTotal - discountValue;
            
            const record: SoldItemRecord = {
              key: `${docSnapshot.id}-${item.itemNumber}-${Math.random()}`,
              itemNumber: item.itemNumber || '',
              itemName: item.itemName || '',
              category: parentName || item.mainCategory || '',
              unit: item.unit || '',
              salePrice: parseFloat(item.price) || 0,
              quantity: parseFloat(item.quantity) || 0,
              totalAmount: totalAfterDiscount, // استخدام الإجمالي بعد الخصم
              baseTotal: baseTotal, // المبلغ الأساسي قبل الخصم
              discountValue: discountValue, // قيمة الخصم
              invoiceNumber,
              date,
              branch,
              customer,
              warehouse,
              supplier: item.supplier || ''
            };
            records.push(record);
          }
        }
      }
      
      setSoldItems(records);
      setFilteredItems(records);
      
      // تجميع الأصناف لتجنب التكرار
      const groupedItems: { [key: string]: SoldItemRecord } = {};
      
      records.forEach(item => {
        const key = item.itemNumber;
        if (groupedItems[key]) {
          // إضافة الكمية والمبالغ إلى الصنف الموجود
          groupedItems[key].quantity += item.quantity;
          groupedItems[key].baseTotal += item.baseTotal; // جمع المبلغ الأساسي
          groupedItems[key].discountValue += item.discountValue; // جمع الخصم
          // إعادة حساب الإجمالي بعد الخصم
          groupedItems[key].totalAmount = groupedItems[key].baseTotal - groupedItems[key].discountValue;
          // تحديث متوسط سعر البيع بعد الخصم
          groupedItems[key].salePrice = groupedItems[key].quantity > 0 ? 
            groupedItems[key].totalAmount / groupedItems[key].quantity : 0;
        } else {
          // إضافة صنف جديد
          groupedItems[key] = { ...item };
        }
      });
      
      // تحويل إلى مصفوفة
      const groupedRecords = Object.values(groupedItems);
      
      setSoldItems(groupedRecords);
      setFilteredItems(groupedRecords);
      
      // إعداد بيانات الرسم البياني
      const chartData: ChartDataItem[] = groupedRecords.map(item => ({
        itemName: item.itemName,
        totalQuantity: item.quantity,
        totalAmount: item.totalAmount
      }));
      
      // ترتيب البيانات حسب الكمية وأخذ أفضل 10 أصناف
      const sortedData = chartData
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 10);
      
      setChartData(sortedData);
      
    } catch (err) {
      setSoldItems([]);
      setFilteredItems([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  };

  // عند الضغط على بحث
  const handleSearch = () => {
    fetchSoldItems();
  };

  // دالة لجلب اسم الفرع من القائمة
  const getBranchName = (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    return branch ? branch.name : branchId;
  };

  // دالة لإنشاء بيانات شركة افتراضية
  const createDefaultCompanyData = () => ({
    arabicName: 'شركة تجريبية للتجارة',
    englishName: 'Sample Trading Company',
    companyType: 'شركة ذات مسؤولية محدودة',
    commercialRegistration: '1234567890',
    taxFile: '987654321',
    city: 'الرياض',
    region: 'منطقة الرياض',
    street: 'شارع الملك فهد',
    district: 'حي العليا',
    buildingNumber: '123',
    postalCode: '12345',
    phone: '011-1234567',
    mobile: '0501234567',
    logoUrl: 'https://via.placeholder.com/100x50?text=شعار+الشركة'
  });

  // دالة الطباعة
  const handlePrint = async () => {
    if (filteredItems.length === 0) {
      return;
    }

    // تأكد من تحميل بيانات الشركة قبل الطباعة
    let currentCompanyData = companyData;
    if (!currentCompanyData || !currentCompanyData.arabicName) {
      try {
        const { getDocs, collection } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        
        // قائمة أسماء المجموعات المحتملة
        const possibleCollections = ['companies', 'company', 'company_settings'];
        let snapshot;
        let foundData = false;
        
        // جرب كل اسم مجموعة حتى تجد البيانات
        for (const collectionName of possibleCollections) {
          try {
            console.log(`جاري البحث في مجموعة: ${collectionName}`);
            snapshot = await getDocs(collection(db, collectionName));
            
            if (!snapshot.empty) {
              console.log(`تم العثور على بيانات في مجموعة: ${collectionName}`);
              foundData = true;
              break;
            } else {
              console.log(`مجموعة ${collectionName} فارغة`);
            }
          } catch (error) {
            console.log(`خطأ في الوصول إلى مجموعة ${collectionName}:`, error);
          }
        }
        
        if (foundData && snapshot && !snapshot.empty) {
          const companyDoc = snapshot.docs[0];
          const data = companyDoc.data();
          currentCompanyData = data;
          setCompanyData(data);
          console.log('تم تحميل بيانات الشركة للطباعة:', data);
        } else {
          console.log('لا توجد بيانات شركة في أي من المجموعات للطباعة');
        }
      } catch (error) {
        console.error('خطأ في جلب بيانات الشركة للطباعة:', error);
      }
      
      // تعيين بيانات افتراضية في حالة عدم وجود بيانات أو خطأ
      if (!currentCompanyData || !currentCompanyData.arabicName) {
        currentCompanyData = createDefaultCompanyData();
        console.log('استخدام البيانات الافتراضية للطباعة');
      }
    }

    // حساب الإجماليات
    const totalQuantity = filteredItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const totalAmount = filteredItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
    const avgPrice = filteredItems.length > 0 ? totalAmount / totalQuantity : 0;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('يرجى السماح للنوافذ المنبثقة لتتمكن من الطباعة');
      return;
    }

    // انتظار قليل للتأكد من تحديث البيانات
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('بيانات الشركة المستخدمة في الطباعة:', currentCompanyData);

    // التحقق من أن البيانات ليست افتراضية
    if (currentCompanyData.arabicName === 'شركة تجريبية للتجارة') {
      console.warn('⚠️ يتم استخدام بيانات شركة افتراضية في الطباعة. يرجى إدخال بيانات الشركة الصحيحة في النظام.');
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>طباعة تقرير الأصناف المباعة</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700&display=swap');
          @page { 
            size: A4 landscape; 
            margin: 15mm; 
          }
          body { 
            font-family: 'Tajawal', Arial, sans-serif; 
            direction: rtl; 
            padding: 10px; 
            font-size: 11px;
            line-height: 1.3;
            margin: 0;
          }
          .company-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #000;
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
            font-size: 11px;
            font-weight: 500;
            line-height: 1.4;
          }
          .company-info-en {
            text-align: left;
            font-family: Arial, sans-serif;
            direction: ltr;
            font-size: 10px;
            font-weight: 500;
            line-height: 1.4;
          }
          .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .header h1 {
            color: #000;
            margin: 0;
            font-size: 20px;
            font-weight: 700;
          }
          .header p {
            color: #000;
            margin: 3px 0 0 0;
            font-size: 12px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            font-size: 10px;
          }
          th, td { 
            border: 1px solid #d1d5db; 
            padding: 4px 2px; 
            text-align: center;
            vertical-align: middle;
            font-size: 9px;
          }
          th { 
            background-color: #bbbbbc !important;
            color: #fff;
            font-weight: 600;
            font-size: 9px;
            padding: 6px 4px;
          }
          tbody tr:nth-child(even) {
            background-color: #f5f5f5;
          }
          tbody tr:hover {
            background-color: #e5e5e5;
          }
          .print-date {
            text-align: left;
            margin-top: 15px;
            font-size: 9px;
            color: #000;
          }
          .print-last-page-only {
            display: none;
          }
          .totals-container {
            margin-top: 20px;
            display: flex;
            justify-content: flex-start;
            direction: rtl;
          }
          .totals-table {
            width: 300px;
            font-size: 12px;
            overflow: hidden;
          }
          .totals-table th {
            background-color: #000;
            color: #fff;
            padding: 10px;
            text-align: center;
            font-size: 14px;
          }
          .totals-table .total-label {
            background-color: #f8f9fa;
            padding: 8px 12px;
            text-align: right;
            width: 60%;
          }
          .totals-table .total-value {
            background-color: #fff;
            padding: 8px 12px;
            text-align: left;
            width: 40%;
          }
          .totals-table .final-total .total-label {
            background-color: #e9ecef;
            color: #000;
          }
          .totals-table .final-total .total-value {
            background-color: #f1f3f4;
            color: #000;
            font-size: 13px;
          }
          @media print {
            body { margin: 0; padding: 10px; }
            .no-print { display: none; }
            .print-last-page-only {
              display: block;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            table {
              page-break-inside: auto;
            }
            tbody {
              page-break-inside: auto;
            }
            .print-last-page-only {
              page-break-before: avoid;
              break-before: avoid;
            }
          }
        </style>
      </head>
      <body>
        <!-- Company Header Section -->
        <div class="company-header">
          <div class="header-section company-info-ar">
            <div>${currentCompanyData.arabicName || 'اسم الشركة'}</div>
            <div>${currentCompanyData.companyType || ''}</div>
            <div>السجل التجاري: ${currentCompanyData.commercialRegistration || 'غير متوفر'}</div>
            <div>الملف الضريبي: ${currentCompanyData.taxFile || 'غير متوفر'}</div>
            <div>العنوان: ${currentCompanyData.city || ''} ${currentCompanyData.region || ''} ${currentCompanyData.street || ''} ${currentCompanyData.district || ''} ${currentCompanyData.buildingNumber || ''}</div>
            <div>الرمز البريدي: ${currentCompanyData.postalCode || ''}</div>
            <div>الهاتف: ${currentCompanyData.phone || ''}</div>
            <div>الجوال: ${currentCompanyData.mobile || ''}</div>
          </div>
          <div class="header-section center">
            <img src="${currentCompanyData.logoUrl || 'https://via.placeholder.com/100x50?text=Company+Logo'}" class="logo" alt="Company Logo">
          </div>
          <div class="header-section company-info-en">
            <div>${currentCompanyData.englishName || 'Company Name'}</div>
            <div>${currentCompanyData.companyType || ''}</div>
            <div>Commercial Reg.: ${currentCompanyData.commercialRegistration || 'Not Available'}</div>
            <div>Tax File: ${currentCompanyData.taxFile || 'Not Available'}</div>
            <div>Address: ${currentCompanyData.city || ''} ${currentCompanyData.region || ''} ${currentCompanyData.street || ''} ${currentCompanyData.district || ''} ${currentCompanyData.buildingNumber || ''}</div>
            <div>Postal Code: ${currentCompanyData.postalCode || ''}</div>
            <div>Phone: ${currentCompanyData.phone || ''}</div>
            <div>Mobile: ${currentCompanyData.mobile || ''}</div>
          </div>
        </div>
        
        <div class="header">
          <h1>تقرير الأصناف المباعة</h1>
          <p class="font-weight-bold">نظام إدارة الموارد ERP90</p>
          ${dateFrom && dateTo ? `
          <div style="margin-top: 10px; font-size: 14px; color: #333;">
            الفترة: من ${dateFrom.format('DD/MM/YYYY')} إلى ${dateTo.format('DD/MM/YYYY')}
          </div>
          ` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th style="width: 120px;">رقم الصنف</th>
              <th style="width: 200px;">اسم الصنف</th>
              <th style="width: 100px;">الفئة</th>
              <th style="width: 80px;">الوحدة</th>
              <th style="width: 100px;">سعر البيع (بعد الخصم)</th>
              <th style="width: 120px;">الكمية المباعة</th>
              <th style="width: 120px;">الإجمالي بعد الخصم</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => `
              <tr>
                <td>${item.itemNumber || '-'}</td>
                <td>${item.itemName || '-'}</td>
                <td>${item.category || '-'}</td>
                <td>${item.unit || 'قطعة'}</td>
                <td>${(item.salePrice || 0).toLocaleString()} ر.س</td>
                <td>${(item.quantity || 0).toLocaleString()}</td>
                <td>${(item.totalAmount || 0).toLocaleString()} ر.س</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <!-- جدول الإجماليات المنفصل -->
        <div class="print-last-page-only totals-container">
          <table class="totals-table">
            <thead>
              <tr>
                <th colspan="2">الإجماليات النهائية</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="total-label">عدد الأصناف:</td>
                <td class="total-value">${filteredItems.length.toLocaleString()} صنف</td>
              </tr>
              <tr>
                <td class="total-label">إجمالي الكمية:</td>
                <td class="total-value">${totalQuantity.toLocaleString()}</td>
              </tr>
              <tr>
                <td class="total-label">متوسط السعر:</td>
                <td class="total-value">${avgPrice.toLocaleString()} ر.س</td>
              </tr>
              <tr class="final-total">
                <td class="total-label">إجمالي القيمة بعد الخصم:</td>
                <td class="total-value">${totalAmount.toLocaleString()} ر.س</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="print-date">
          تاريخ الطباعة: ${new Date().toLocaleDateString('en-GB')} - ${new Date().toLocaleTimeString('en-GB')}
        </div>
        
        <!-- Signature Section at the end of the page -->
        <div style="
          margin-top: 50px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding: 0 20px;
          page-break-inside: avoid;
        ">
          <div style="
            flex: 1;
            text-align: right;
            font-size: 14px;
            font-weight: 500;
          ">
            <div style="margin-bottom: 8px;">المسؤول المالي: ___________________</div>
            <div>التوقيع: ___________________</div>
          </div>
          <div style="
            flex: 1;
            text-align: center;
            position: relative;
          ">
            <!-- Decorative Company Stamp -->
            <div style="
              margin-top: 10px;
              display: flex;
              justify-content: center;
              align-items: center;
              width: 180px;
              height: 70px;
              border: 3px dashed #000;
              border-radius: 50%;
              box-shadow: 0 3px 10px 0 rgba(0,0,0,0.12);
              opacity: 0.9;
              background: repeating-linear-gradient(135deg, #f8f8f8 0 10px, #fff 10px 20px);
              font-family: 'Tajawal', Arial, sans-serif;
              font-size: 16px;
              font-weight: bold;
              color: #000;
              letter-spacing: 1px;
              text-align: center;
              margin-left: auto;
              margin-right: auto;
              z-index: 2;
            ">
              <div style="width: 100%;">
                <div style="font-size: 18px; font-weight: 700; line-height: 1.2;">${currentCompanyData.arabicName || 'الشركة'}</div>
                <div style="font-size: 14px; font-weight: 500; margin-top: 4px; line-height: 1.1;">${currentCompanyData.phone ? 'هاتف: ' + currentCompanyData.phone : ''}</div>
              </div>
            </div>
          </div>
          <div style="
            flex: 1;
            text-align: left;
            font-size: 14px;
            font-weight: 500;
          ">
            <div style="margin-bottom: 8px;">مدير المبيعات: ___________________</div>
            <div>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</div>
          </div>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    
    // انتظار تحميل الصور والخطوط
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 1000);
  };

  // دالة تصدير البيانات إلى ملف Excel
  const handleExport = async () => {
    // تحميل exceljs من CDN إذا لم يكن موجوداً في window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ExcelJS = (window as any).ExcelJS;
    if (!ExcelJS) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/exceljs@4.3.0/dist/exceljs.min.js';
        script.onload = () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ExcelJS = (window as any).ExcelJS;
          resolve(null);
        };
        script.onerror = reject;
        document.body.appendChild(script);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ExcelJS = (window as any).ExcelJS;
    }

    const exportData = filteredItems.map(item => [
      item.itemNumber,
      item.itemName,
      item.category,
      item.unit,
      item.salePrice,
      item.quantity,
      item.totalAmount,
  
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('تقرير الأصناف المباعة');

    // إعداد الأعمدة
    sheet.columns = [
      { header: 'رقم الصنف', key: 'itemNumber', width: 20 },
      { header: 'اسم الصنف', key: 'itemName', width: 40 },
      { header: 'الفئة', key: 'category', width: 15 },
      { header: 'الوحدة', key: 'unit', width: 10 },
      { header: 'سعر البيع (بعد الخصم)', key: 'salePrice', width: 12 },
      { header: 'الكمية المباعة', key: 'quantity', width: 15 },
      { header: 'الإجمالي بعد الخصم', key: 'totalAmount', width: 15 },

    ];

    // إضافة البيانات
    sheet.addRows(exportData);

    // تنسيق رأس الجدول
    sheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FF305496' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDDEBF7' }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
      };
    });

    // تنسيق بقية الصفوف
    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          bottom: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          left: { style: 'thin', color: { argb: 'FFAAAAAA' } },
          right: { style: 'thin', color: { argb: 'FFAAAAAA' } },
        };
        if (i % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7F9FC' }
          };
        }
      });
    }

    // Freeze header row
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: sheet.columnCount }
    };

    // إنشاء ملف وحفظه
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_الأصناف_المباعة_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 100);
  };

  // ألوان الرسم البياني
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#387908', '#00ff00'];

  // Load font dynamically
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('tajawal-font')) {
      const link = document.createElement('link');
      link.id = 'tajawal-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap';
      document.head.appendChild(link);
    }
  }, []);

  // CSS للجدول
  const tableStyle = `
    .ant-table-thead > tr > th {
      text-align: center !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      color: white !important;
      background: linear-gradient(135deg, #059669 0%, #10b981 100%) !important;
      border: 1px solid rgba(255,255,255,0.2) !important;
    }
    .ant-table-tbody > tr > td {
      text-align: center !important;
      font-size: 13px !important;
      border: 1px solid #e5e7eb !important;
    }
    .ant-table-tbody > tr:hover > td {
      background-color: #f0fdf4 !important;
    }
    .ant-table-summary > tr > td {
      text-align: center !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      background-color: #f9fafb !important;
      border: 1px solid #d1d5db !important;
    }
    .ant-table-summary > tr:hover > td {
      background-color: #f3f4f6 !important;
    }
  `;

  return (
    <>
      <Helmet>
        <title>تقرير الأصناف المباعة | ERP90 Dashboard</title>
        <meta name="description" content="تقرير الأصناف المباعة، عرض وإدارة الأصناف المباعة، ERP90 Dashboard" />
        <meta name="keywords" content="ERP, أصناف, مبيعات, تقرير, عملاء, مخازن, Sales, Items, Report" />
      </Helmet>
      <div className="w-full min-h-screen p-4 md:p-6 flex flex-col gap-6 bg-gray-50" dir="rtl">
 
        {/* العنوان الرئيسي */}
        <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
          <div className="flex items-center">
            <BarChartOutlined className="h-5 w-5 sm:h-8 sm:w-8 text-emerald-600 ml-1 sm:ml-3" />
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">تقرير الأصناف المباعة</h1>
          </div>
          <p className="text-xs sm:text-base text-gray-600 mt-2">عرض وإدارة تقرير الأصناف المباعة</p>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-400 to-green-500"></div>
        </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "تقرير الأصناف المباعة" }
        ]}
      />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
        
        <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <SearchOutlined className="text-emerald-600" /> خيارات البحث
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="flex flex-col">
            <span style={labelStyle}>من تاريخ</span>
            <DatePicker 
              value={dateFrom}
              onChange={setDateFrom}
              placeholder="اختر التاريخ"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
              locale={arEG}
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>إلى تاريخ</span>
            <DatePicker 
              value={dateTo}
              onChange={setDateTo}
              placeholder="اختر التاريخ"
              style={largeControlStyle}
              size="large"
              format="YYYY-MM-DD"
              locale={arEG}
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>رقم الفاتورة</span>
            <Input 
              value={invoiceNumber}
              onChange={e => setInvoiceNumber(e.target.value)}
              placeholder="ادخل رقم الفاتورة"
              style={largeControlStyle}
              size="large"
              allowClear
            />
          </div>
          
          <div className="flex flex-col">
            <span style={labelStyle}>الفرع</span>
            <Select
              value={branchId}
              onChange={setBranchId}
              placeholder="اختر الفرع"
              style={{ width: '100%', ...largeControlStyle }}
              size="large"
              className={styles.noAntBorder}
              optionFilterProp="label"
              allowClear
              showSearch
              loading={branchesLoading}
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
          </div>
        </div>

        <AnimatePresence>
          {showMore && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                <div className="flex flex-col">
                  <span style={labelStyle}>العميل</span>
                  <Select
                    value={customerId || undefined}
                    onChange={setCustomerId}
                    placeholder="اختر العميل"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    <Option value="">جميع العملاء</Option>
                    {customers.map(customer => (
                      <Option key={customer.id} value={customer.id}>{customer.name}</Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>المخزن</span>
                  <Select
                    value={warehouseId || undefined}
                    onChange={setWarehouseId}
                    placeholder="اختر المخزن"
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                  >
                    <Option value="">جميع المخازن</Option>
                    {warehouses.map(warehouse => (
                      <Option key={warehouse.id} value={warehouse.id}>{warehouse.name}</Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>الصنف</span>
                  {itemsLoading && (
                    <div className="text-xs text-gray-500 mb-1">
                      التحميل: {itemsLoading ? "جاري التحميل..." : "مكتمل"} | الأصناف: {items.length}
                    </div>
                  )}
                  <Select
                    value={itemId || undefined}
                    onChange={setItemId}
                    placeholder={items.length > 0 ? "اختر الصنف" : "لا توجد أصناف"}
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    loading={itemsLoading}
                    filterOption={(input, option) =>
                      String(option?.children || '').toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={itemsLoading ? "جاري تحميل الأصناف..." : items.length === 0 ? "لا توجد أصناف في قاعدة البيانات" : "لا توجد أصناف متاحة"}
                    onDropdownVisibleChange={(open) => {
                      if (open && items.length === 0 && !itemsLoading) {
                        console.log('إعادة محاولة تحميل الأصناف عند فتح القائمة');
                      }
                    }}
                  >
                    <Option value="">جميع الأصناف ({items.length})</Option>
                    {items.map(item => (
                      <Option key={item.id} value={item.itemNumber}>
                        {item.name} - {item.itemNumber}
                      </Option>
                    ))}
                  </Select>
                </div>
                
                <div className="flex flex-col">
                  <span style={labelStyle}>الفئة</span>
                  <Select
                    value={categoryId || undefined}
                    onChange={setCategoryId}
                    placeholder={categories.length > 0 ? "اختر الفئة" : "لا توجد فئات"}
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={categories.length === 0 ? "لا توجد فئات في قاعدة البيانات" : "لا توجد فئات متاحة"}
                  >
                    <Option value="">جميع الفئات ({categories.length})</Option>
                    {categories.map(category => (
                      <Option key={category.id} value={category.name}>
                        {category.name}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                <div className="flex flex-col">
                  <span style={labelStyle}>المورد</span>
                  <Select
                    value={supplierId || undefined}
                    onChange={setSupplierId}
                    placeholder={suppliers.length > 0 ? "اختر المورد" : "لا توجد موردين"}
                    style={{ width: '100%', ...largeControlStyle }}
                    size="large"
                    className={styles.noAntBorder}
                    optionFilterProp="label"
                    allowClear
                    showSearch
                    filterOption={(input, option) =>
                      option?.children?.toString().toLowerCase().includes(input.toLowerCase())
                    }
                    notFoundContent={suppliers.length === 0 ? "لا توجد موردين في قاعدة البيانات" : "لا توجد موردين متاحين"}
                  >
                    <Option value="">جميع الموردين ({suppliers.length})</Option>
                    {suppliers.map(supplier => (
                      <Option key={supplier.id} value={supplier.name}>
                        {supplier.name}
                      </Option>
                    ))}
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="flex items-center gap-4 mt-4">
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={isLoading}
            className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
            size="large"
          >
            {isLoading ? "جاري البحث..." : "بحث"}
          </Button>
          <span className="text-gray-500 text-sm">نتائج البحث: {filteredItems.length}</span>
        </div>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="absolute left-4 top-4 flex items-center gap-2 cursor-pointer text-blue-600 select-none"
          onClick={() => setShowMore((prev) => !prev)}
        >
          <span className="text-sm font-medium">{showMore ? "إخفاء الخيارات الإضافية" : "عرض خيارات أكثر"}</span>
          <motion.svg
            animate={{ rotate: showMore ? 180 : 0 }}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-4 h-4 transition-transform"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </motion.svg>
        </motion.div>
      </motion.div>

      {/* نتائج البحث */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm overflow-x-auto relative"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
        
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            نتائج البحث ({filteredItems.length} صنف)
          </h3>
          <div className="flex items-center gap-2">
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleExport}
              disabled={filteredItems.length === 0}
              className="bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
              size="large"
            >
              تصدير Excel
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrint}
              disabled={filteredItems.length === 0}
              className="bg-blue-600 hover:bg-blue-700 border-blue-600 hover:border-blue-700"
              size="large"
            >
              طباعة
            </Button>
          </div>
        </div>

  

        <Table  
          style={{ direction: 'rtl' }}
          dataSource={filteredItems}
          columns={[
            {
              title: 'رقم الصنف',
              dataIndex: 'itemNumber',
              key: 'itemNumber',
              minWidth: 130,
              sorter: (a: SoldItemRecord, b: SoldItemRecord) => (a.itemNumber || '').localeCompare(b.itemNumber || ''),
              render: (text: string) => (
                <span className="text-blue-700 font-medium">{text || 'غير محدد'}</span>
              ),
            },
            {
              title: 'اسم الصنف',
              dataIndex: 'itemName',
              key: 'itemName',
              minWidth: 220,
              sorter: (a: SoldItemRecord, b: SoldItemRecord) => (a.itemName || '').localeCompare(b.itemName || ''),
              render: (text: string) => (
                <span className="text-gray-800 font-medium">{text || 'غير محدد'}</span>
              ),
            },
            {
              title: 'الفئة',
              dataIndex: 'category',
              key: 'category',
              minWidth: 120,
              sorter: (a: SoldItemRecord, b: SoldItemRecord) => (a.category || '').localeCompare(b.category || ''),
              render: (text: string) => (
                <span className="text-gray-600">{text || 'غير محدد'}</span>
              ),
            },
            {
              title: 'الوحدة',
              dataIndex: 'unit',
              key: 'unit',
              minWidth: 80,
              render: (text: string) => (
                <span className="text-gray-600">{text || 'قطعة'}</span>
              ),
            },
            {
              title: 'سعر البيع (بعد الخصم)',
              dataIndex: 'salePrice',
              key: 'salePrice',
              minWidth: 120,
              sorter: (a: SoldItemRecord, b: SoldItemRecord) => (a.salePrice || 0) - (b.salePrice || 0),
              render: (value: number) => (
                <span className="text-green-700 font-semibold">
                  {(value || 0).toLocaleString()}
                </span>
              ),
            },
            {
              title: 'الكمية المباعة',
              dataIndex: 'quantity',
              key: 'quantity',
              minWidth: 130,
              sorter: (a: SoldItemRecord, b: SoldItemRecord) => (a.quantity || 0) - (b.quantity || 0),
              render: (value: number) => (
                <span className="text-blue-700 font-semibold">
                  {(value || 0).toLocaleString()}
                </span>
              ),
            },
            {
              title: 'الإجمالي بعد الخصم',
              dataIndex: 'totalAmount',
              key: 'totalAmount',
              minWidth: 140,
              sorter: (a: SoldItemRecord, b: SoldItemRecord) => (a.totalAmount || 0) - (b.totalAmount || 0),
              render: (value: number) => (
                <span className="text-emerald-700 font-bold">
                  {(value || 0).toLocaleString()}
                </span>
              ),
            },
          ]}
          rowKey="key"
          pagination={false}
          loading={isLoading}
          scroll={{ x: 1200 }}
          size="small"
          bordered
          className="[&_.ant-table-thead_>_tr_>_th]:bg-blue-200 [&_.ant-table-thead_>_tr_>_th]:text-blue-800 [&_.ant-table-thead_>_tr_>_th]:border-blue-200 [&_.ant-table-tbody_>_tr:hover_>_td]:bg-emerald-50"
          locale={{
            emptyText: isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-4 py-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-400">لا توجد بيانات</div>
            )
          }}
          summary={() => {
            if (filteredItems.length === 0) return null;
            
            const totalQuantity = filteredItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalAmount = filteredItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);
            const avgPrice = filteredItems.length > 0 ? totalAmount / totalQuantity : 0;

            return (
              <Table.Summary fixed>
                <Table.Summary.Row className=" font-bold">
                  <Table.Summary.Cell index={0} className=" text-gray-800 font-bold">
                    الإجماليات
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} className=" text-gray-800 font-bold">
                    {filteredItems.length} صنف
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}></Table.Summary.Cell>
                  <Table.Summary.Cell index={4} className=" text-green-700 font-bold">
                    {avgPrice.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} className=" text-blue-700 font-bold">
                    {totalQuantity.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} className=" text-emerald-700 font-bold">
                    {totalAmount.toLocaleString()}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            );
          }}
        />
      </motion.div>

      {/* Charts Section */}
      {chartData.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="w-full bg-white p-2 sm:p-4 rounded-lg border border-emerald-100 flex flex-col gap-4 shadow-sm relative"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-500"></div>
          
          <h3 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            الرسوم البيانية
          </h3>

          {/* رسم بياني بعرض الشاشة الكامل */}
          <div className="w-full">
            <div className="bg-gradient-to-br from-blue-50 to-emerald-50 p-6 rounded-lg border border-blue-100">
              <h3 className="text-xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-2">
                <BarChartOutlined className="text-emerald-600" />
                أكثر الأصناف مبيعاً (الكمية والمبلغ)
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <defs>
                    <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="itemName" 
                    tick={{ fontSize: 12, fill: '#374151' }}
                    angle={-25}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#374151' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      typeof value === 'number' ? value.toLocaleString() : value, 
                      name === 'totalQuantity' ? 'الكمية المباعة' : 'إجمالي المبلغ (ر.س)'
                    ]}
                    labelFormatter={(label) => `الصنف: ${label}`}
                  />
                  <Legend 
                    formatter={(value) => value === 'totalQuantity' ? 'الكمية المباعة' : 'إجمالي المبلغ (ر.س)'}
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalQuantity" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorQuantity)" 
                    strokeWidth={3}
                    name="totalQuantity"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="totalAmount" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorAmount)" 
                    strokeWidth={3}
                    name="totalAmount"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* رسم خطي إضافي للمقارنة */}
          <div className="w-full mt-6">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-100">
              <h3 className="text-xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-2">
                <TableOutlined className="text-purple-600" />
                مقارنة الأصناف - رسم خطي
              </h3>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="itemName" 
                    tick={{ fontSize: 12, fill: '#374151' }}
                    angle={-25}
                    textAnchor="end"
                    height={80}
                    interval={0}
                  />
                  <YAxis tick={{ fontSize: 12, fill: '#374151' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value, name) => [
                      typeof value === 'number' ? value.toLocaleString() : value, 
                      name === 'totalQuantity' ? 'الكمية المباعة' : 'إجمالي المبلغ (ر.س)'
                    ]}
                    labelFormatter={(label) => `الصنف: ${label}`}
                  />
                  <Legend 
                    formatter={(value) => value === 'totalQuantity' ? 'الكمية المباعة' : 'إجمالي المبلغ (ر.س)'}
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalQuantity" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                    name="totalQuantity"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalAmount" 
                    stroke="#ec4899" 
                    strokeWidth={3}
                    dot={{ fill: '#ec4899', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#ec4899', strokeWidth: 2 }}
                    name="totalAmount"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      )}
    </div>
    </>
  );
};

export default SoldItems;

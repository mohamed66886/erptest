import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Percent, Save } from 'lucide-react';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { Select as AntdSelect, DatePicker } from 'antd';
import styles from '../ReceiptVoucher.module.css';
import { Helmet } from "react-helmet";
import Breadcrumb from "@/components/Breadcrumb";
import { fetchBranches } from '@/utils/branches';
import { getAllCustomers } from '@/lib/customerService';
import { getDocs, collection, query, where, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { message } from 'antd';
import dayjs from 'dayjs';

const EditDiscountOffer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // السنة المالية
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  // بيانات النموذج
  const [formData, setFormData] = useState({
    offerName: '',
    validFrom: null as dayjs.Dayjs | null,
    validTo: null as dayjs.Dayjs | null,
    requiredQuantity: 1,
    discountValue: 0,
    isActive: true
  });

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
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // نفس ستايل صفحة سند القبض
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
  // حالة نوع العرض
  const [offerType, setOfferType] = useState<string>("خصم على الأصناف");
  // حالة النوع (الكل/الأصناف)
  const [itemType, setItemType] = useState<string>("الكل");
  // حالة نوع الخصم
  const [discountType, setDiscountType] = useState<string>("مبلغ");
  // العملاء الحقيقية من قاعدة البيانات
  const [customers, setCustomers] = useState<{ value: string; label: string }[]>([]);
  // العملاء المحددين
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  useEffect(() => {
    async function loadCustomers() {
      const data = await getAllCustomers();
      setCustomers(data.map(c => ({ value: c.id, label: c.nameAr })));
    }
    loadCustomers();
  }, []);

  // الفروع الحقيقية من قاعدة البيانات
  const [branches, setBranches] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    async function loadBranches() {
      const data = await fetchBranches();
      setBranches(data.map(b => ({ value: b.id || b.code, label: b.name })));
    }
    loadBranches();
  }, []);
  // الفروع المحددة
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);

  // الأصناف من المستوى الثاني
  const [levelTwoItems, setLevelTwoItems] = useState<{ value: string; label: string }[]>([]);
  // المجموعات
  const [groups, setGroups] = useState<{ value: string; label: string }[]>([]);
  // البند المحدد
  const [selectedLevelTwoItems, setSelectedLevelTwoItems] = useState<string[]>([]);
  // المجموعات المحددة
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    async function loadLevelTwoItems() {
      const q = query(collection(db, 'inventory_items'), where('type', '==', 'مستوى ثاني'));
      const snapshot = await getDocs(q);
      setLevelTwoItems(snapshot.docs.map(doc => ({ value: doc.id, label: doc.data().name })));
    }
    loadLevelTwoItems();
    // تحميل المجموعات من أصناف المستوى الأول
    async function loadGroups() {
      const q = query(collection(db, 'inventory_items'), where('type', '==', 'مستوى أول'));
      const snapshot = await getDocs(q);
      setGroups(snapshot.docs.map(doc => ({ value: doc.id, label: doc.data().name })));
    }
    loadGroups();
  }, []);

  // دوال تحديد الكل وإلغاء التحديد للعملاء
  // دوال تحديد الكل وإلغاء التحديد للبنود
  const handleSelectAllLevelTwoItems = () => {
    setSelectedLevelTwoItems(levelTwoItems.map(i => i.value));
  };
  const handleDeselectAllLevelTwoItems = () => {
    setSelectedLevelTwoItems([]);
  };
  // دوال تحديد الكل وإلغاء التحديد للمجموعات
  const handleSelectAllGroups = () => {
    setSelectedGroups(groups.map(g => g.value));
  };
  const handleDeselectAllGroups = () => {
    setSelectedGroups([]);
  };
  const handleSelectAllCustomers = () => {
    setSelectedCustomers(customers.map(c => c.value));
  };
  const handleDeselectAllCustomers = () => {
    setSelectedCustomers([]);
  }

  // دوال تحديد الكل وإلغاء التحديد للفروع
  const handleSelectAllBranches = () => {
    setSelectedBranches(branches.map(b => b.value));
  };
  const handleDeselectAllBranches = () => {
    setSelectedBranches([]);
  }

  // دالة لتعطيل التواريخ خارج السنة المالية

  // تحميل البيانات عند تحميل الصفحة
  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        message.error('معرف العرض غير صحيح');
        navigate('/management/discounts-offers');
        return;
      }

      try {
        setIsLoading(true);
        const offerDoc = await getDoc(doc(db, 'discounts_offers', id));
        
        if (!offerDoc.exists()) {
          message.error('العرض غير موجود');
          navigate('/management/discounts-offers');
          return;
        }

        const offerData = offerDoc.data();
        
        // تحميل بيانات النموذج
        setFormData({
          offerName: offerData.name || '',
          validFrom: offerData.validFrom ? dayjs(offerData.validFrom) : null,
          validTo: offerData.validTo ? dayjs(offerData.validTo) : null,
          requiredQuantity: offerData.requiredQuantity || 1,
          discountValue: offerData.discountValue || 0,
          isActive: offerData.isActive !== undefined ? offerData.isActive : true
        });

        // تحميل الحقول الأخرى
        setOfferType(offerData.type || "خصم على الأصناف");
        setDiscountType(offerData.discountType || "مبلغ");
        setItemType(offerData.itemType || "الكل");
        setSelectedCustomers(offerData.customers || []);
        setSelectedBranches(offerData.branches || []);
        setSelectedLevelTwoItems(offerData.selectedLevelTwoItems || []);
        setSelectedGroups(offerData.selectedGroups || []);
        setFiscalYear(offerData.fiscalYear || "");

      } catch (error) {
        console.error('Error loading offer data:', error);
        message.error('حدث خطأ أثناء تحميل بيانات العرض');
        navigate('/management/discounts-offers');
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      loadData();
    }
  }, [id, navigate]);

  // دالة لتعطيل التواريخ خارج السنة المالية
  const disableOutsideFiscalYear = (current: dayjs.Dayjs) => {
    if (!currentFinancialYear) return false;
    const start = currentFinancialYear.startDate;
    const end = currentFinancialYear.endDate;
    return current.isBefore(start, 'day') || current.isAfter(end, 'day');
  };

  // دالة الحفظ
  const handleSave = async () => {
    if (!id) {
      message.error('معرف العرض غير صحيح');
      return;
    }

    try {
      setIsSaving(true);

      // التحقق من صحة البيانات
      if (!formData.offerName.trim()) {
        message.error('يرجى إدخال اسم العرض');
        return;
      }

      if (!formData.validFrom || !formData.validTo) {
        message.error('يرجى تحديد تواريخ العرض');
        return;
      }

      if (formData.discountValue <= 0) {
        message.error('يرجى إدخال قيمة الخصم');
        return;
      }

      if (selectedCustomers.length === 0) {
        message.error('يرجى اختيار عميل واحد على الأقل');
        return;
      }

      if (selectedBranches.length === 0) {
        message.error('يرجى اختيار فرع واحد على الأقل');
        return;
      }

      // جمع الأصناف المختارة
      let selectedItems: string[] = [];
      
      if (itemType === "الكل") {
        // جلب جميع الأصناف من قاعدة البيانات
        const itemsQuery = query(collection(db, 'inventory_items'));
        const itemsSnapshot = await getDocs(itemsQuery);
        selectedItems = itemsSnapshot.docs.map(doc => doc.id);
      } else if (itemType === "الأصناف") {
        selectedItems = selectedLevelTwoItems;
      } else if (itemType === "الفئة") {
        // جلب الأصناف التي تنتمي للمجموعات المختارة
        for (const groupId of selectedGroups) {
          const itemsQuery = query(
            collection(db, 'inventory_items'), 
            where('parentId', '==', groupId)
          );
          const itemsSnapshot = await getDocs(itemsQuery);
          selectedItems.push(...itemsSnapshot.docs.map(doc => doc.id));
        }
      }

      if (selectedItems.length === 0 && itemType !== "الكل") {
        message.error('يرجى اختيار أصناف أو مجموعات');
        return;
      }

      // إنشاء كائن العرض
      const offerData = {
        name: formData.offerName,
        type: offerType,
        discountType,
        discountValue: formData.discountValue,
        validFrom: formData.validFrom.format('YYYY-MM-DD'),
        validTo: formData.validTo.format('YYYY-MM-DD'),
        requiredQuantity: offerType === "خصم على الكميات" ? formData.requiredQuantity : null,
        customers: selectedCustomers,
        branches: selectedBranches,
        items: selectedItems,
        itemType,
        selectedGroups: itemType === "الفئة" ? selectedGroups : [],
        selectedLevelTwoItems: itemType === "الأصناف" ? selectedLevelTwoItems : [],
        isActive: formData.isActive,
        fiscalYear: fiscalYear,
        updatedAt: new Date()
      };

      // تحديث العرض في قاعدة البيانات
      await updateDoc(doc(db, 'discounts_offers', id), offerData);

      message.success('تم تحديث العرض بنجاح');
      navigate('/management/discounts-offers');

    } catch (error) {
      console.error('Error updating offer:', error);
      message.error('حدث خطأ أثناء تحديث العرض');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      {isLoading ? (
        <div className="flex justify-center items-center min-h-screen">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <>
          <Helmet>
            <title>تعديل العرض أو الخصم | ERP90 Dashboard</title>
            <meta name="description" content="تعديل عرض أو خصم موجود في نظام ERP90" />
          </Helmet>
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-yellow-100 dark:bg-blue-900 rounded-lg">
              <Percent className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">تعديل العرض أو الخصم</h1>
              <p className="text-gray-600 dark:text-gray-400">صفحة تعديل عرض أو خصم موجود للعملاء</p>
            </div>
          </div>
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <Percent className="text-purple-600 dark:text-purple-300 w-6 h-6" />
              <label className="text-base font-medium text-gray-700 dark:text-gray-300">السنة المالية:</label>
            </span>
            <div className="min-w-[160px]">
              <AntdSelect
                className={`w-full ${styles.selectDropdown}`}
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-pink-500"></div>
      </div>
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات", to: "/management/sales" },
          { label: "الخصومات والعروض", to: "/management/discounts-offers" },
          { label: "تعديل" },
        ]}
      />
      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        <form className="space-y-6">
          {/* اسم العرض + صالح من + صالح إلى في صف واحد */}
          <div className="flex gap-4">
            {/* اسم العرض */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">اسم العرض</label>
              <input
                type="text"
                className="w-full focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                style={largeControlStyle}
                placeholder="ادخل اسم العرض"
                name="offerName"
                value={formData.offerName}
                onChange={(e) => setFormData({...formData, offerName: e.target.value})}
              />
            </div>
            {/* صالح من */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">صالح من</label>
              <DatePicker
                className="w-full"
                style={largeControlStyle}
                placeholder="اختر تاريخ البداية"
                format="YYYY-MM-DD"
                name="validFrom"
                inputReadOnly
                disabledDate={disableOutsideFiscalYear}
                value={formData.validFrom}
                onChange={(date) => setFormData({...formData, validFrom: date})}
              />
            </div>
            {/* صالح إلى */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">صالح إلى</label>
              <DatePicker
                className="w-full"
                style={largeControlStyle}
                placeholder="اختر تاريخ النهاية"
                format="YYYY-MM-DD"
                name="validTo"
                inputReadOnly
                disabledDate={disableOutsideFiscalYear}
                value={formData.validTo}
                onChange={(date) => setFormData({...formData, validTo: date})}
              />
            </div>
          </div>

          {/* نوع العرض + الكمية المطلوبة للعرض في صف واحد */}
          <div className="flex gap-4">
            {/* نوع العرض */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">نوع العرض</label>
              <AntdSelect
                className={`w-full ${styles.selectDropdown}`}
                placeholder="اختر النوع"
                size="large"
                style={largeControlStyle}
                value={offerType}
                onChange={setOfferType}
                options={[ 
                  { value: "خصم على الأصناف", label: "خصم على الأصناف" },
                  { value: "خصم على الكميات", label: "خصم على الكميات" },
                ]}
              />
            </div>
            {/* الكمية المطلوبة للعرض */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">الكمية المطلوبة للعرض</label>
              <input
                type="number"
                min={1}
                className={`w-full focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white ${offerType !== "خصم على الكميات" ? "bg-gray-200 text-gray-500 cursor-not-allowed" : ""}`}
                style={offerType !== "خصم على الكميات" ? { ...largeControlStyle, background: '#e5e7eb' } : largeControlStyle}
                placeholder="ادخل الكمية"
                name="requiredQuantity"
                disabled={offerType !== "خصم على الكميات"}
                value={formData.requiredQuantity}
                onChange={(e) => setFormData({...formData, requiredQuantity: parseInt(e.target.value) || 1})}
              />
            </div>
            {/* اختيار الفرع */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">الفروع</label>
              <AntdSelect
                className={`w-full ${styles.selectDropdown}`}
                placeholder="اختر الفروع"
                size="large"
                mode="multiple"
                showSearch
                filterOption={(input, option) => {
                  const labelText = typeof option.label === 'string' ? option.label : option.label?.props?.children?.[1] || '';
                  return labelText && labelText.toLowerCase().includes(input.toLowerCase());
                }}
                style={largeControlStyle}
                value={selectedBranches}
                onChange={setSelectedBranches}
                dropdownRender={menu => (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                      <button type="button" onClick={handleSelectAllBranches} style={{ color: '#7c3aed', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>تحديد الكل</button>
                      <button type="button" onClick={handleDeselectAllBranches} style={{ color: '#ef4444', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء التحديد</button>
                    </div>
                    <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                    {menu}
                  </div>
                )}
                options={branches.map(b => ({ ...b, label: <span><input type="checkbox" checked={selectedBranches.includes(b.value)} readOnly style={{ marginLeft: 6 }} />{b.label}</span> }))}
                maxTagCount={0}
                maxTagPlaceholder={() => selectedBranches.length > 0 ? <span style={{background: 'none', padding: 0}}>{`تم اختيار ${selectedBranches.length}`}</span> : null}
              />
            </div>
          </div>
          {/* نوع الخصم + قيمة الخصم + العميل في صف واحد */}
          <div className="flex gap-4">
            {/* نوع الخصم */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">نوع الخصم</label>
              <AntdSelect
                className={`w-full ${styles.selectDropdown}`}
                placeholder="اختر نوع الخصم"
                size="large"
                style={largeControlStyle}
                value={discountType}
                onChange={setDiscountType}
                options={[ 
                  { value: "نسبة", label: "نسبة %" },
                  { value: "مبلغ", label: "مبلغ ثابت" },
                ]}
              />
            </div>
            {/* قيمة الخصم */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300 flex items-center gap-2">
                {discountType === "نسبة" ? "نسبة الخصم" : "قيمة الخصم"}
                {discountType === "نسبة" && <span style={{ marginRight: 6 }}>%</span>}
                {discountType === "مبلغ" && (
                  <span style={{ marginRight: 6, color: '#7c3aed', fontWeight: 'bold', fontFamily: 'Tajawal, Arial', fontSize: 22 }}>
                    ﷼
                  </span>
                )}
              </label>
              <input
                type="number"
                min={0}
                className="w-full focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-800 dark:text-white"
                style={largeControlStyle}
                placeholder={discountType === "نسبة" ? "ادخل نسبة الخصم" : "ادخل قيمة الخصم بالريال"}
                name={discountType === "نسبة" ? "discountPercent" : "discountValue"}
                value={formData.discountValue}
                onChange={(e) => setFormData({...formData, discountValue: parseFloat(e.target.value) || 0})}
              />
            </div>
            {/* تحديد العميل */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">العميل</label>
              <AntdSelect
                className={`w-full ${styles.selectDropdown}`}
                placeholder="اختر العملاء"
                size="large"
                mode="multiple"
                showSearch
                filterOption={(input, option) => {
                  // يدعم البحث بالنص العربي أو الرقم
                  const labelText = typeof option.label === 'string' ? option.label : option.label?.props?.children?.[1] || '';
                  return labelText && labelText.toLowerCase().includes(input.toLowerCase());
                }}
                style={largeControlStyle}
                value={selectedCustomers}
                onChange={setSelectedCustomers}
                dropdownRender={menu => (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                      <button type="button" onClick={handleSelectAllCustomers} style={{ color: '#7c3aed', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>تحديد الكل</button>
                      <button type="button" onClick={handleDeselectAllCustomers} style={{ color: '#ef4444', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء التحديد</button>
                    </div>
                    <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                    {menu}
                  </div>
                )}
                options={customers.map(c => ({ ...c, label: <span><input type="checkbox" checked={selectedCustomers.includes(c.value)} readOnly style={{ marginLeft: 6 }} />{c.label}</span> }))}
                maxTagCount={0}
                maxTagPlaceholder={() => selectedCustomers.length > 0 ? <span style={{background: 'none', padding: 0}}>{`تم اختيار ${selectedCustomers.length}`}</span> : null}
              />
            </div>
          </div>
          {/* زر سويتش نشط أو لا */}
          <div className="flex items-center gap-3">
            <label style={labelStyle} className="text-gray-700 dark:text-gray-300">نشط</label>
            <input
              type="checkbox"
              style={{ width: 18, height: 18, border: 'none', outline: 'none' }}
              checked={formData.isActive}
              name="isActive"
              className="accent-purple-600"
              onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
            />
          </div>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border space-y-6">
        <form className="space-y-6">
          <div className="flex gap-4">
            {/* النوع */}
            <div className="flex-1">
              <label style={labelStyle} className="text-gray-700 dark:text-gray-300">النوع</label>
              <AntdSelect
                    className={`w-full ${styles.selectDropdown}`}
                placeholder="اختر النوع"
                size="large"
                style={largeControlStyle}
                value={itemType}
                onChange={setItemType}
                options={[ 
                  { value: "الكل", label: "الكل" },
                  { value: "الأصناف", label: "الأصناف" },
                  { value: "الفئة", label: "الفئة" },
                ]}
              />
            </div>
            {/* البند أو المجموعة حسب النوع */}
            {itemType === "الأصناف" && (
              <div className="flex-1 flex items-end gap-2">
                <div className="w-full">
                  <label style={labelStyle} className="text-gray-700 dark:text-gray-300">البند</label>
                  <AntdSelect
                    className={`w-full ${styles.selectDropdown}`}
                    placeholder="اختر البند"
                    size="large"
                    mode="multiple"
                    showSearch
                    style={largeControlStyle}
                    value={selectedLevelTwoItems}
                    onChange={setSelectedLevelTwoItems}
                    dropdownRender={menu => (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                          <button type="button" onClick={handleSelectAllLevelTwoItems} style={{ color: '#7c3aed', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>تحديد الكل</button>
                          <button type="button" onClick={handleDeselectAllLevelTwoItems} style={{ color: '#ef4444', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء التحديد</button>
                        </div>
                        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                        {menu}
                      </div>
                    )}
                    options={levelTwoItems.map(i => ({ ...i, label: <span><input type="checkbox" checked={selectedLevelTwoItems.includes(i.value)} readOnly style={{ marginLeft: 6 }} />{i.label}</span> }))}
                    maxTagCount={0}
                    maxTagPlaceholder={() => selectedLevelTwoItems.length > 0 ? <span style={{background: 'none', padding: 0}}>{`تم اختيار ${selectedLevelTwoItems.length}`}</span> : null}
                  />
                </div>
              </div>
            )}
            {itemType === "الفئة" && (
              <div className="flex-1 flex items-end gap-2">
                <div className="w-full">
                  <label style={labelStyle} className="text-gray-700 dark:text-gray-300">المجموعة</label>
                  <AntdSelect
                    className="w-full"
                    placeholder="اختر المجموعة"
                    size="large"
                    mode="multiple"
                    showSearch
                    style={largeControlStyle}
                    value={selectedGroups}
                    onChange={setSelectedGroups}
                    dropdownRender={menu => (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px' }}>
                          <button type="button" onClick={handleSelectAllGroups} style={{ color: '#7c3aed', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>تحديد الكل</button>
                          <button type="button" onClick={handleDeselectAllGroups} style={{ color: '#ef4444', fontWeight: 'bold', background: 'none', border: 'none', cursor: 'pointer' }}>إلغاء التحديد</button>
                        </div>
                        <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }} />
                        {menu}
                      </div>
                    )}
                    options={groups.map(g => ({ ...g, label: <span><input type="checkbox" checked={selectedGroups.includes(g.value)} readOnly style={{ marginLeft: 6 }} />{g.label}</span> }))}
                    maxTagCount={0}
                    maxTagPlaceholder={() => selectedGroups.length > 0 ? <span style={{background: 'none', padding: 0}}>{`تم اختيار ${selectedGroups.length}`}</span> : null}
                  />
                </div>
              </div>
            )}
            {/* زر الإضافة يظهر دائماً */}
            <div className="flex items-end">
              <button
                type="button"
                className={`bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg mb-1 flex items-center gap-2 ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                disabled={isSaving}
                onClick={handleSave}
              >
                <span className={isSaving ? 'animate-spin' : ''} style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Save size={20} className="inline-block" />
                </span>
                {isSaving ? 'جاري التحديث...' : 'تحديث'}
              </button>
            </div>
          </div>
        </form>
      </div>
        </>
      )}
    </div>
  );
};

export default EditDiscountOffer;



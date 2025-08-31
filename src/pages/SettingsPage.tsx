import React, { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { getDocs, query, collection, doc, setDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Helmet } from "react-helmet";
import { ShoppingBag, Settings } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import { Select as AntdSelect } from 'antd';
import { useFinancialYear } from "@/hooks/useFinancialYear";

const initialData = {
  arabicName: "",
  englishName: "",
  logoUrl: "",
  commercialRegistration: "",
  taxFile: "",
  registrationDate: "",
  issuingAuthority: "",
  companyType: "",
  activityType: "",
  nationality: "",
  city: "",
  region: "",
  street: "",
  district: "",
  buildingNumber: "",
  postalCode: "",
  countryCode: "SA",
  phone: "",
  mobile: "",
  fiscalYear: "",
  taxRate: ""
};

const SettingsPage = () => {
  const [formData, setFormData] = useState(initialData);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState("");
  const [saving, setSaving] = useState(false);

  // Financial year dropdown context (like Header)
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const [fiscalYear, setFiscalYear] = useState<string>("");

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

  useEffect(() => {
    const fetchCompany = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "companies"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setFormData({ ...initialData, ...docData.data() });
          setCompanyId(docData.id);
        }
      } catch (e) {
        toast.error("حدث خطأ أثناء جلب بيانات الشركة");
        console.error("Error fetching company: ", e);
      }
      setLoading(false);
    };
    fetchCompany();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!companyId) {
        toast.error("لا يوجد معرف شركة");
        setSaving(false);
        return;
      }
      await setDoc(doc(db, "companies", companyId), formData);
      setEditMode(false);
      toast.success("تم تحديث بيانات الشركة بنجاح");
    } catch (e) {
      toast.error("حدث خطأ أثناء حفظ التعديلات");
      console.error("Error saving company data: ", e);
    }
    setSaving(false);
  };

  const handleCancel = () => {
    // إعادة تحميل البيانات الأصلية
    const fetchOriginalData = async () => {
      try {
        const q = query(collection(db, "companies"));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          setFormData({ ...initialData, ...docData.data() });
        }
      } catch (e) {
        console.error("Error fetching original data: ", e);
      }
    };
    
    fetchOriginalData();
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-600 font-medium">جاري تحميل بيانات الشركة...</p>
        </div>
      </div>
    );
  }

  // ستايل موحد لعناصر الإدخال والدروب داون مثل صفحة تقارير الفواتير
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

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <Helmet>
        <title>الإعدادات | ERP90 </title>
        <meta name="description" content="إدارة المبيعات والعملاء وفريق المبيعات ERP90 Dashboard" />
        <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, عملاء, ضريبة, طباعة, Sales, Invoice, Report, Tax, Customer" />
      </Helmet>
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
          <Settings className="h-8 w-8 text-purple-600 dark:text-purple-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">اعدادات الشركة</h1>
          <p className="text-gray-600 dark:text-gray-400">إدارة بيانات الشركة ومعلومات التواصل</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
            <Settings className="text-purple-600 dark:text-purple-300 w-6 h-6" />
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>

      <Breadcrumb
        items={[ 
          { label: "الرئيسية", to: "/" },
          { label: "اعدادات الشركة " }, 
        ]}
      />

      <div className="p-3 sm:p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)]">
        <form className="space-y-8 p-6" onSubmit={e => { e.preventDefault(); handleSave(); }}>
            {/* Basic Info Section */}
            <div className="border-b border-gray-200 pb-8">
              <div className="flex items-center mb-6">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
      <div className="flex items-center justify-between w-full">
        <h2 className="text-xl font-semibold text-gray-800 mr-3">المعلومات الأساسية</h2>
        {/* زر التعديل بجانب العنوان */}
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow transition-colors border border-blue-500 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-2.828 0L9 13zm-6 6v-3a2 2 0 012-2h3" />
            </svg>
            تعديل
          </button>
        )}
      </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label style={labelStyle}>الاسم بالعربي *</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.arabicName} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("arabicName", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>الاسم بالإنجليزي</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.englishName} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("englishName", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>رابط لوجو الشركة</label>
                  <input
                    type="url"
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors mb-2"
                    value={formData.logoUrl || ""}
                    disabled={!editMode}
                    onChange={e => handleInputChange("logoUrl", e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  {/* رفع صورة */}
                  {editMode && (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        className="block w-full mt-2 border border-gray-300 rounded-lg p-2"
                        onChange={e => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = ev => {
                              handleInputChange("logoUrl", ev.target.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      {/* معاينة الصورة */}
                      {formData.logoUrl && formData.logoUrl.startsWith("data:image") && (
                        <img src={formData.logoUrl} alt="معاينة اللوجو" className="mt-2 rounded shadow h-16 mx-auto" />
                      )}
                    </>
                  )}
                </div>
                {/* تم حذف السنة المالية */}
                <div>
                  <label style={labelStyle}>نسبة الضريبة (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.taxRate}
                    disabled={!editMode}
                    onChange={e => handleInputChange("taxRate", e.target.value)}
                    placeholder="مثال: 15"
                  />
                </div>
                <div>
                  <label style={labelStyle}>السجل التجاري *</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.commercialRegistration} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("commercialRegistration", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>الملف الضريبي</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.taxFile} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("taxFile", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>تاريخ السجل</label>
                  <input 
                    type="date" 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.registrationDate} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("registrationDate", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>جهة الإصدار</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.issuingAuthority} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("issuingAuthority", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>نوع الشركة</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.companyType} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("companyType", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>النشاط الرئيسي</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.activityType} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("activityType", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label style={labelStyle}>الجنسية</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.nationality} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("nationality", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="border-b border-gray-200 pb-8">
              <div className="flex items-center mb-6">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mr-3">العنوان</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label style={labelStyle}>المدينة</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.city} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("city", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>المنطقة</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.region} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("region", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>اسم الشارع</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.street} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("street", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>اسم الحي</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.district} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("district", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>رقم المبنى</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.buildingNumber} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("buildingNumber", e.target.value)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الرمز البريدي</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.postalCode} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("postalCode", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Contact Section */}
            <div className="pb-8">
              <div className="flex items-center mb-6">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-800 mr-3">معلومات الاتصال</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label style={labelStyle}>كود الدولة</label>
                  <input 
                    style={{ ...largeControlStyle, background: '#f3f4f6', cursor: 'not-allowed' }}
                    className="w-full"
                    value={formData.countryCode} 
                    disabled 
                    readOnly 
                  />
                </div>
                <div>
                  <label style={labelStyle}>رقم الهاتف</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.phone} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("phone", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label style={labelStyle}>رقم الجوال *</label>
                  <input 
                    style={largeControlStyle}
                    className="w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    value={formData.mobile} 
                    disabled={!editMode} 
                    onChange={e => handleInputChange("mobile", e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {editMode && (
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                  disabled={saving}
                >
                  إلغاء
                </button>
                <button 
                  type="submit" 
                  className={`px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors flex items-center justify-center ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-blue-500 rounded-full"></span>
                      جاري الحفظ...
                    </span>
                  ) : (
                    "حفظ التغييرات"
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
  );
};

export default SettingsPage;
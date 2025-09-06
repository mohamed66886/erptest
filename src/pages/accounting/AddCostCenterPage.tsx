import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addCostCenter, getCostCenters } from '@/lib/costCenterService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import Typography from 'antd/lib/typography';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, Plus, Target } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';

interface CostCenter {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  description?: string;
  type: 'رئيسي' | 'فرعي' | 'وحدة';
  level: number;
  parentId?: string;
  status: 'نشط' | 'غير نشط';
  hasSubCenters: boolean;
  manager?: string;
  department?: string;
  location?: string;
  budget?: number;
  actualCost?: number;
  variance?: number;
  startDate?: string;
  endDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AddCostCenterPageProps {
  onBack?: () => void;
  existingCodes?: string[];
}

const AddCostCenterPage: React.FC<AddCostCenterPageProps> = ({ 
  onBack, 
  existingCodes = [] 
}) => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    code: '', // إضافة حقل الكود
    nameAr: '',
    nameEn: '',
    description: '',
    type: 'رئيسي' as const, // النوع الافتراضي ولا يمكن تغييره
    status: 'نشط' as 'نشط' | 'غير نشط',
    manager: '',
    department: '',
    location: '',
    budget: 0,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Validate code (required)
    if (!formData.code.trim()) {
      newErrors.code = 'كود مركز التكلفة مطلوب';
    } else if (!/^\d+$/.test(formData.code.trim())) {
      newErrors.code = 'كود مركز التكلفة يجب أن يحتوي على أرقام فقط';
    }

    // Validate Arabic name
    if (!formData.nameAr.trim()) {
      newErrors.nameAr = 'اسم مركز التكلفة بالعربية مطلوب';
    } else if (formData.nameAr.trim().length < 2) {
      newErrors.nameAr = 'اسم مركز التكلفة بالعربية يجب أن يكون حرفين على الأقل';
    }

    // Validate English name
    if (!formData.nameEn.trim()) {
      newErrors.nameEn = 'اسم مركز التكلفة بالإنجليزية مطلوب';
    } else if (formData.nameEn.trim().length < 2) {
      newErrors.nameEn = 'اسم مركز التكلفة بالإنجليزية يجب أن يكون حرفين على الأقل';
    }

    // Validate type
    if (!formData.type) {
      newErrors.type = 'نوع مركز التكلفة مطلوب';
    }

    // Validate budget
    if (formData.budget < 0) {
      newErrors.budget = 'الموازنة لا يمكن أن تكون سالبة';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateCostCenterCode = async (): Promise<string> => {
    try {
      const costCenters = await getCostCenters();
      // فلترة مراكز التكلفة المستوى الأول فقط
      const level1CostCenters = costCenters.filter(costCenter => costCenter.level === 1);
      
      if (level1CostCenters.length === 0) {
        return '100'; // الكود الأول
      }
      
      // الحصول على جميع الأكواد الموجودة وتحويلها لأرقام
      const codes = level1CostCenters
        .map(costCenter => parseInt(costCenter.code))
        .filter(code => !isNaN(code))
        .sort((a, b) => a - b); // ترتيب تصاعدي
      
      if (codes.length === 0) {
        return '100';
      }
      
      // البحث عن أول فجوة في التسلسل أو إضافة رقم جديد
      let nextCode = 100;
      for (const code of codes) {
        if (code === nextCode) {
          nextCode += 100;
        } else {
          break;
        }
      }
      
      return nextCode.toString();
    } catch (error) {
      console.error('Error generating cost center code:', error);
      return '100'; // القيمة الافتراضية في حالة حدوث خطأ
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }
    setIsSubmitting(true);
    try {
      // جلب جميع مراكز التكلفة الرئيسية للتحقق من التكرار
      const allCostCenters = await getCostCenters();
      const level1CostCenters = allCostCenters.filter(cc => cc.level === 1);
      const existsAr = level1CostCenters.some(cc => cc.nameAr.trim() === formData.nameAr.trim());
      const existsEn = level1CostCenters.some(cc => cc.nameEn.trim().toLowerCase() === formData.nameEn.trim().toLowerCase());
      
      if (existsAr || existsEn) {
        toast.error('يوجد مركز تكلفة رئيسي بنفس الاسم العربي أو الإنجليزي بالفعل');
        setIsSubmitting(false);
        return;
      }
      
      // استخدام الكود المدخل من المستخدم مباشرة
      const finalCode = formData.code.trim();
      
      // التحقق من عدم تكرار الكود
      const codeExists = allCostCenters.some(cc => cc.code === finalCode);
      if (codeExists) {
        toast.error('هذا الكود مستخدم بالفعل، يرجى اختيار كود آخر');
        setIsSubmitting(false);
        return;
      }
      
      // إضافة مركز التكلفة مباشرة إلى Firebase كمستوى أول
      const newCostCenter = {
        code: finalCode,
        nameAr: formData.nameAr,
        nameEn: formData.nameEn,
        description: formData.description,
        type: formData.type as 'رئيسي' | 'فرعي' | 'وحدة',
        level: 1,
        status: formData.status,
        hasSubCenters: false,
        manager: formData.manager,
        department: formData.department,
        location: formData.location,
        budget: formData.budget,
        actualCost: 0,
        variance: 0,
        notes: formData.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await addCostCenter(newCostCenter);
      toast.success('تم حفظ مركز التكلفة بنجاح');
      setTimeout(() => {
        navigate('/accounting/cost-center-classification');
      }, 800);
    } catch (error) {
      console.error('Error adding cost center:', error);
      toast.error('حدث خطأ أثناء حفظ مركز التكلفة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onBack) {
      onBack();
    }
  };

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
        <div className="flex items-center">
          <Target className="h-8 w-8 text-blue-600 ml-3" />
          <h1 className="text-2xl font-bold text-gray-800">إضافة مركز تكلفة جديد</h1>
        </div>
        <p className="text-gray-600 mt-2">إضافة مركز تكلفة جديد إلى نظام مراكز التكلفة</p>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "الادارة الماليه", to: "/management/financial" }, 
          { label: "تصنيف مراكز التكلفة", to: "/accounting/cost-center-classification" },
          { label: "إضافة مركز تكلفة جديد" },
        ]}
      />

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات مركز التكلفة</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cost Center Code & Type */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">كود مركز التكلفة *</Typography.Text>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('code', e.target.value)}
                    placeholder="أدخل كود مركز التكلفة"
                    size="large"
                    status={errors.code ? 'error' : ''}
                  />
                  {errors.code && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{errors.code}</AlertDescription>
                    </Alert>
                  )}
                  <Typography.Text className="text-xs text-gray-500">
                    يجب إدخال كود رقمي مميز لمركز التكلفة
                  </Typography.Text>
                </div>
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">نوع مركز التكلفة *</Typography.Text>
                  <Select
                    value={formData.type}
                    disabled
                    style={{ width: '100%' }}
                    size="large"
                  >
                    <Select.Option value="رئيسي">رئيسي</Select.Option>
                  </Select>
                  {errors.type && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{errors.type}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Arabic Name & English Name */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">اسم مركز التكلفة (عربي) *</Typography.Text>
                  <Input
                    id="nameAr"
                    value={formData.nameAr}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('nameAr', e.target.value)}
                    placeholder="مثال: الإدارة العامة"
                    size="large"
                    status={errors.nameAr ? 'error' : ''}
                  />
                  {errors.nameAr && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{errors.nameAr}</AlertDescription>
                    </Alert>
                  )}
                </div>
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">اسم مركز التكلفة (انجليزي) *</Typography.Text>
                  <Input
                    id="nameEn"
                    value={formData.nameEn}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('nameEn', e.target.value)}
                    placeholder="Example: General Administration"
                    size="large"
                    status={errors.nameEn ? 'error' : ''}
                  />
                  {errors.nameEn && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{errors.nameEn}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">الحالة</Typography.Text>
                  <Select
                    value={formData.status}
                    onChange={(value) => handleInputChange('status', value)}
                    placeholder="اختر حالة مركز التكلفة"
                    style={{ width: '100%' }}
                    size="large"
                  >
                    <Select.Option value="نشط">نشط</Select.Option>
                    <Select.Option value="غير نشط">غير نشط</Select.Option>
                  </Select>
                </div>
              </div>

              {/* Manager & Department */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">المدير المسؤول</Typography.Text>
                  <Input
                    id="manager"
                    value={formData.manager}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('manager', e.target.value)}
                    placeholder="اسم المدير المسؤول"
                    size="large"
                  />
                </div>
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">القسم</Typography.Text>
                  <Input
                    id="department"
                    value={formData.department}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('department', e.target.value)}
                    placeholder="اسم القسم"
                    size="large"
                  />
                </div>
              </div>

              {/* Location & Budget */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">الموقع</Typography.Text>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('location', e.target.value)}
                    placeholder="موقع مركز التكلفة"
                    size="large"
                  />
                </div>
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">الموازنة المخططة</Typography.Text>
                  <Input
                    id="budget"
                    type="number"
                    value={formData.budget}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('budget', parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    size="large"
                    status={errors.budget ? 'error' : ''}
                  />
                  {errors.budget && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{errors.budget}</AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2 w-full md:col-span-2">
                <Typography.Text className="text-sm font-medium text-gray-700">الوصف</Typography.Text>
                <Input.TextArea
                  id="description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('description', e.target.value)}
                  placeholder="وصف مركز التكلفة والأنشطة المتعلقة به"
                  rows={3}
                  size="large"
                />
              </div>

              {/* Notes */}
              <div className="space-y-2 w-full md:col-span-2">
                <Typography.Text className="text-sm font-medium text-gray-700">ملاحظات</Typography.Text>
                <Input.TextArea
                  id="notes"
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleInputChange('notes', e.target.value)}
                  placeholder="ملاحظات إضافية"
                  rows={2}
                  size="large"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ مركز التكلفة'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddCostCenterPage;

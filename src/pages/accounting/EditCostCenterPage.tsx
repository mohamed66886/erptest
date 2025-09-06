import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { updateCostCenter, getCostCenters, type CostCenter } from '@/lib/costCenterService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import Typography from 'antd/lib/typography';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, Save, Target, Edit } from 'lucide-react';
import Breadcrumb from '@/components/Breadcrumb';

interface EditCostCenterPageProps {
  onBack?: () => void;
  costCenter?: CostCenter;
  onSave?: (costCenter: CostCenter) => void;
}

const EditCostCenterPage: React.FC<EditCostCenterPageProps> = ({ 
  onBack, 
  costCenter: externalCostCenter,
  onSave 
}) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  
  // Get cost center from location state or props
  const initialCostCenter = location.state?.costCenter || externalCostCenter;
  
  const [costCenter, setCostCenter] = useState<CostCenter | null>(initialCostCenter || null);
  const [isLoading, setIsLoading] = useState(!initialCostCenter);
  
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    description: '',
    type: '' as 'رئيسي' | 'فرعي' | 'وحدة' | '',
    status: 'نشط' as 'نشط' | 'غير نشط',
    manager: '',
    department: '',
    location: '',
    budget: 0,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load cost center data if not provided
  useEffect(() => {
    const loadCostCenter = async () => {
      if (!costCenter && id) {
        try {
          setIsLoading(true);
          const costCenters = await getCostCenters();
          const foundCostCenter = costCenters.find(cc => cc.id === id);
          
          if (foundCostCenter) {
            setCostCenter(foundCostCenter);
          } else {
            toast.error('لم يتم العثور على مركز التكلفة المطلوب');
            navigate('/accounting/cost-center-classification');
            return;
          }
        } catch (error) {
          console.error('Error loading cost center:', error);
          toast.error('فشل في تحميل بيانات مركز التكلفة');
          navigate('/accounting/cost-center-classification');
          return;
        } finally {
          setIsLoading(false);
        }
      }
    };

    loadCostCenter();
  }, [id, costCenter, navigate]);

  // Populate form data when cost center is available
  useEffect(() => {
    if (costCenter) {
      setFormData({
        nameAr: costCenter.nameAr || '',
        nameEn: costCenter.nameEn || '',
        description: costCenter.description || '',
        type: costCenter.type || '',
        status: costCenter.status || 'نشط',
        manager: costCenter.manager || '',
        department: costCenter.department || '',
        location: costCenter.location || '',
        budget: costCenter.budget || 0,
        notes: costCenter.notes || ''
      });
    }
  }, [costCenter]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !costCenter) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Check for duplicate names (excluding current cost center)
      const allCostCenters = await getCostCenters();
      const level1CostCenters = allCostCenters.filter(cc => cc.level === 1 && cc.id !== costCenter.id);
      const existsAr = level1CostCenters.some(cc => cc.nameAr.trim() === formData.nameAr.trim());
      const existsEn = level1CostCenters.some(cc => cc.nameEn.trim().toLowerCase() === formData.nameEn.trim().toLowerCase());
      
      if (existsAr || existsEn) {
        toast.error('يوجد مركز تكلفة آخر بنفس الاسم العربي أو الإنجليزي');
        setIsSubmitting(false);
        return;
      }
      
      // Prepare update data
      const updateData = {
        nameAr: formData.nameAr.trim(),
        nameEn: formData.nameEn.trim(),
        description: formData.description.trim(),
        type: formData.type as 'رئيسي' | 'فرعي' | 'وحدة',
        status: formData.status,
        manager: formData.manager.trim(),
        department: formData.department.trim(),
        location: formData.location.trim(),
        budget: formData.budget,
        notes: formData.notes.trim(),
        updatedAt: new Date().toISOString()
      };
      
      // Update cost center in Firebase
      await updateCostCenter(costCenter.id, updateData);
      
      // Update local cost center object
      const updatedCostCenter = { ...costCenter, ...updateData };
      setCostCenter(updatedCostCenter);
      
      toast.success(`تم تحديث مركز التكلفة "${formData.nameAr}" بنجاح`);
      
      // Call onSave callback if provided
      if (onSave) {
        onSave(updatedCostCenter);
      }
      
      // Navigate back after a short delay
      setTimeout(() => {
        if (onBack) {
          onBack();
        } else {
          navigate('/accounting/cost-center-classification');
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error updating cost center:', error);
      toast.error('حدث خطأ أثناء تحديث مركز التكلفة');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/accounting/cost-center-classification');
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

  if (isLoading) {
    return (
      <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">جاري تحميل بيانات مركز التكلفة...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!costCenter) {
    return (
      <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg text-gray-600">لم يتم العثور على مركز التكلفة المطلوب</p>
            <Button 
              onClick={handleCancel}
              className="mt-4"
            >
              العودة إلى القائمة الرئيسية
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
      {/* Header */}
      <div className="p-4 font-['Tajawal'] bg-white mb-4 rounded-lg shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden">
        <div className="flex items-center">
          <Edit className="h-8 w-8 text-blue-600 ml-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">تعديل مركز التكلفة</h1>
            <p className="text-gray-600 mt-1">
              تعديل بيانات مركز التكلفة: <span className="font-semibold text-blue-600">{costCenter.nameAr}</span>
              <span className="text-sm text-gray-500 mr-2">(كود: {costCenter.code})</span>
            </p>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "الادارة الماليه", to: "/management/financial" }, 
          { label: "تصنيف مراكز التكلفة", to: "/accounting/cost-center-classification" },
          { label: `تعديل مركز التكلفة: ${costCenter.nameAr}` },
        ]}
      />

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            بيانات مركز التكلفة
          </CardTitle>
          <div className="text-sm text-gray-500">
            كود مركز التكلفة: <span className="font-mono bg-blue-50 px-2 py-1 rounded">{costCenter.code}</span>
            <span className="mx-2">•</span>
            المستوى: <span className="font-semibold">{costCenter.level}</span>
            <span className="mx-2">•</span>
            تاريخ الإنشاء: <span className="font-mono">{costCenter.createdAt ? new Date(costCenter.createdAt).toLocaleDateString('ar-SA') : 'غير محدد'}</span>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cost Center Type & Arabic Name */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">نوع مركز التكلفة *</Typography.Text>
                  <Select
                    value={formData.type || undefined}
                    onChange={(value) => handleInputChange('type', value)}
                    placeholder="اختر نوع مركز التكلفة"
                    style={{ width: '100%' }}
                    size="large"
                    allowClear
                  >
                    <Select.Option value="رئيسي">رئيسي</Select.Option>
                    <Select.Option value="فرعي">فرعي</Select.Option>
                    <Select.Option value="وحدة">وحدة</Select.Option>
                  </Select>
                  {errors.type && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{errors.type}</AlertDescription>
                    </Alert>
                  )}
                </div>
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
              </div>

              {/* English Name & Status */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
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

            {/* Additional Info */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="text-sm font-semibold text-blue-800 mb-2">معلومات إضافية</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">التكلفة الفعلية:</span>
                  <span className="font-mono mr-2 text-blue-700">
                    {(costCenter.actualCost || 0).toLocaleString('ar-SA')} ريال
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">الانحراف:</span>
                  <span className="font-mono mr-2 text-blue-700">
                    {(costCenter.variance || 0).toLocaleString('ar-SA')} ريال
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">آخر تحديث:</span>
                  <span className="font-mono mr-2 text-blue-700">
                    {costCenter.updatedAt ? new Date(costCenter.updatedAt).toLocaleDateString('ar-SA') : 'غير محدد'}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Save className="h-4 w-4 ml-2" />
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="flex-1 md:flex-none"
              >
                <ArrowRight className="h-4 w-4 ml-2" />
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditCostCenterPage;

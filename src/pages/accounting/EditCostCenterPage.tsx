import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { updateCostCenter, getCostCenters } from '@/lib/costCenterService';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Input from 'antd/lib/input';
import Select from 'antd/lib/select';
import Typography from 'antd/lib/typography';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, Edit, Target } from 'lucide-react';
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

interface EditCostCenterPageProps {
  onBack?: () => void;
  costCenter?: CostCenter;
}

const EditCostCenterPage: React.FC<EditCostCenterPageProps> = ({ 
  onBack,
  costCenter: propCostCenter
}) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  
  // Get cost center data from props, route state, or URL params
  const initialCostCenter = propCostCenter || location.state?.costCenter;
  
  const departments = [
    'الإدارة',
    'الموارد البشرية',
    'المالية',
    'الإنتاج',
    'المبيعات',
    'التسويق',
    'المشتريات',
    'المخازن',
    'تكنولوجيا المعلومات',
    'الصيانة',
    'الجودة',
    'الأمن والسلامة'
  ];
  
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    description: '',
    type: 'رئيسي' as 'رئيسي' | 'فرعي' | 'وحدة',
    status: 'نشط' as 'نشط' | 'غير نشط',
    manager: '',
    department: '',
    location: '',
    budget: 0,
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [costCenter, setCostCenter] = useState<CostCenter | null>(null);

  // Load cost center data on component mount
  useEffect(() => {
    const loadCostCenter = async () => {
      try {
        setIsLoading(true);
        
        if (initialCostCenter) {
          // Use provided cost center data
          setCostCenter(initialCostCenter);
          setFormData({
            nameAr: initialCostCenter.nameAr || '',
            nameEn: initialCostCenter.nameEn || '',
            description: initialCostCenter.description || '',
            type: initialCostCenter.type || 'رئيسي',
            status: initialCostCenter.status || 'نشط',
            manager: initialCostCenter.manager || '',
            department: initialCostCenter.department || '',
            location: initialCostCenter.location || '',
            budget: initialCostCenter.budget || 0,
            notes: initialCostCenter.notes || ''
          });
        } else if (id) {
          // Load cost center by ID from database
          const allCostCenters = await getCostCenters();
          const foundCostCenter = allCostCenters.find(cc => cc.id === id);
          
          if (foundCostCenter) {
            setCostCenter(foundCostCenter);
            setFormData({
              nameAr: foundCostCenter.nameAr || '',
              nameEn: foundCostCenter.nameEn || '',
              description: foundCostCenter.description || '',
              type: foundCostCenter.type || 'رئيسي',
              status: foundCostCenter.status || 'نشط',
              manager: foundCostCenter.manager || '',
              department: foundCostCenter.department || '',
              location: foundCostCenter.location || '',
              budget: foundCostCenter.budget || 0,
              notes: foundCostCenter.notes || ''
            });
          } else {
            toast.error('لم يتم العثور على مركز التكلفة المطلوب');
            navigate('/accounting/cost-center-classification');
          }
        } else {
          toast.error('معرف مركز التكلفة غير صحيح');
          navigate('/accounting/cost-center-classification');
        }
      } catch (error) {
        console.error('Error loading cost center:', error);
        toast.error('فشل في تحميل بيانات مركز التكلفة');
        navigate('/accounting/cost-center-classification');
      } finally {
        setIsLoading(false);
      }
    };

    loadCostCenter();
  }, [id, initialCostCenter, navigate]);

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
      // جلب جميع مراكز التكلفة للتحقق من التكرار (باستثناء مركز التكلفة الحالي)
      const allCostCenters = await getCostCenters();
      const otherCostCenters = allCostCenters.filter(cc => cc.id !== costCenter.id);
      const existsAr = otherCostCenters.some(cc => cc.nameAr.trim() === formData.nameAr.trim());
      const existsEn = otherCostCenters.some(cc => cc.nameEn.trim().toLowerCase() === formData.nameEn.trim().toLowerCase());
      
      if (existsAr || existsEn) {
        toast.error('يوجد مركز تكلفة آخر بنفس الاسم العربي أو الإنجليزي');
        setIsSubmitting(false);
        return;
      }
      
      // تحديث مركز التكلفة
      const updatedCostCenter = {
        ...costCenter,
        nameAr: formData.nameAr,
        nameEn: formData.nameEn,
        description: formData.description,
        type: formData.type,
        status: formData.status,
        manager: formData.manager,
        department: formData.department,
        location: formData.location,
        budget: formData.budget,
        notes: formData.notes,
        updatedAt: new Date().toISOString()
      };
      
      await updateCostCenter(costCenter.id, updatedCostCenter);
      toast.success('تم تحديث مركز التكلفة بنجاح');
      setTimeout(() => {
        navigate('/accounting/cost-center-classification');
      }, 800);
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
          <Edit className="h-8 w-8 text-blue-600 ml-3" />
          <h1 className="text-2xl font-bold text-gray-800">تعديل مركز التكلفة</h1>
        </div>
        <p className="text-gray-600 mt-2">
          {costCenter ? `تعديل بيانات مركز التكلفة: ${costCenter.nameAr} (كود: ${costCenter.code})` : 'تعديل بيانات مركز التكلفة'}
        </p>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-purple-500"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "الادارة الماليه", to: "/management/financial" }, 
          { label: "تصنيف مراكز التكلفة", to: "/accounting/cost-center-classification" },
          { label: "تعديل مركز التكلفة" },
        ]}
      />

      {/* Form Card */}
      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <Typography.Text className="text-gray-600">جاري تحميل بيانات مركز التكلفة...</Typography.Text>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>بيانات مركز التكلفة</CardTitle>
            {costCenter && (
              <Typography.Text type="secondary">
                كود مركز التكلفة: {costCenter.code} | المستوى: {costCenter.level}
              </Typography.Text>
            )}
          </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type */}
              <div className="flex flex-col md:flex-row gap-6 w-full md:col-span-2">
                <div className="space-y-2 w-full">
                  <Typography.Text className="text-sm font-medium text-gray-700">نوع مركز التكلفة *</Typography.Text>
                  <Select
                    value={formData.type}
                    disabled
                    style={{ width: '100%' }}
                    size="large"
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
                  <Typography.Text className="text-xs text-gray-500">
                    يمكن تغيير نوع مركز التكلفة حسب الحاجة
                  </Typography.Text>
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
                  <Select
                    value={formData.department}
                    onChange={(value) => handleInputChange('department', value)}
                    placeholder="اختر القسم"
                    style={{ width: '100%' }}
                    size="large"
                    allowClear
                  >
                    {departments.map((dept) => (
                      <Select.Option key={dept} value={dept}>
                        {dept}
                      </Select.Option>
                    ))}
                  </Select>
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
                {isSubmitting ? 'جاري التحديث...' : 'تحديث مركز التكلفة'}
              </Button>
              <Button 
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex-1 md:flex-none"
              >
                إلغاء
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
};

export default EditCostCenterPage;

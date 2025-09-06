import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, ConfigProvider } from "antd";
const { TextArea } = Input;
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Breadcrumb from "@/components/Breadcrumb";
import { toast } from "sonner";
import {
  Target,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  Building,
  Users,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Save,
  X,
  RefreshCw,
  Loader2,
  Folder,
  File
} from 'lucide-react';
import {
  CostCenter,
  getCostCenters,
  addCostCenter,
  updateCostCenter,
  deleteCostCenter
} from '@/lib/costCenterService';

// CSS للـ Ant Design components
const antdStyles = {
  fontFamily: 'Tajawal, sans-serif',
  direction: 'rtl' as const,
};

const CostCentersPage: React.FC = () => {
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['100', '200', '300']));
  const [showAddForm, setShowAddForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);

  // Form states
  const [newCostCenter, setNewCostCenter] = useState<Partial<CostCenter>>({
    nameAr: '',
    nameEn: '',
    description: '',
    type: 'رئيسي',
    status: 'نشط',
    hasSubCenters: true, // افتراضياً يقبل مراكز تحليلية للمراكز الرئيسية
    level: 1,
    budget: 0,
    actualCost: 0,
    variance: 0
  });

  const [editForm, setEditForm] = useState<Partial<CostCenter>>({});

  // Cost center types and departments
  const costCenterTypes = ['رئيسي', 'فرعي', 'وحدة'];
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

  // Load cost centers from Firebase with timeout and retry
  const loadCostCenters = async (retryCount = 0) => {
    try {
      setIsLoading(true);
      console.log(`Loading cost centers from Firebase... (attempt ${retryCount + 1})`);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('انتهت مهلة التحميل')), 5000)
      );
      
      const costCentersPromise = getCostCenters();
      
      const firebaseCostCenters = await Promise.race([costCentersPromise, timeoutPromise]) as CostCenter[];
      console.log('Cost centers loaded:', firebaseCostCenters);
      
      // Build hierarchical structure
      const hierarchicalCostCenters = buildCostCenterHierarchy(firebaseCostCenters);
      setCostCenters(hierarchicalCostCenters);
      
      if (firebaseCostCenters.length === 0) {
        toast.info('لا توجد مراكز تكلفة في قاعدة البيانات. يمكنك إضافة مراكز تكلفة جديدة.');
      } else {
        toast.success(`تم تحميل ${firebaseCostCenters.length} مركز تكلفة من قاعدة البيانات`);
      }
    } catch (error) {
      console.error('Error loading cost centers:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      
      // Retry logic
      if (retryCount < 2) {
        console.log(`Retrying to load cost centers... (${retryCount + 1}/2)`);
        toast.warning(`فشل في التحميل، جاري المحاولة مرة أخرى... (${retryCount + 1}/2)`);
        setTimeout(() => loadCostCenters(retryCount + 1), 2000);
        return;
      }
      
      toast.error(`فشل في تحميل مراكز التكلفة بعد عدة محاولات: ${errorMessage}`);
      setCostCenters([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Build hierarchical structure for cost centers
  const buildCostCenterHierarchy = (flatCostCenters: CostCenter[]): CostCenter[] => {
    const costCenterMap = new Map<string, CostCenter>();
    const rootCostCenters: CostCenter[] = [];
    
    // First pass: create map of all cost centers
    flatCostCenters.forEach(costCenter => {
      costCenterMap.set(costCenter.id, { ...costCenter, children: [] });
    });
    
    // Second pass: build hierarchy and update hasSubCenters
    flatCostCenters.forEach(costCenter => {
      const costCenterWithChildren = costCenterMap.get(costCenter.id)!;
      if (costCenter.parentId && costCenterMap.has(costCenter.parentId)) {
        const parent = costCenterMap.get(costCenter.parentId)!;
        if (!parent.children) parent.children = [];
        parent.children.push(costCenterWithChildren);
        // تحديث hasSubCenters للحساب الأب
        parent.hasSubCenters = true;
      } else {
        rootCostCenters.push(costCenterWithChildren);
      }
    });
    
    // Sort root cost centers by code
    rootCostCenters.sort((a, b) => {
      const codeA = parseInt(a.code) || 0;
      const codeB = parseInt(b.code) || 0;
      return codeA - codeB;
    });
    
    // Sort children recursively
    const sortChildren = (costCenters: CostCenter[]) => {
      costCenters.forEach(costCenter => {
        if (costCenter.children && costCenter.children.length > 0) {
          costCenter.children.sort((a, b) => {
            const codeA = parseInt(a.code) || 0;
            const codeB = parseInt(b.code) || 0;
            return codeA - codeB;
          });
          sortChildren(costCenter.children);
        }
      });
    };
    
    sortChildren(rootCostCenters);
    
    return rootCostCenters;
  };

  // Flatten hierarchical cost centers to flat array
  const flattenCostCenterHierarchy = (hierarchicalCostCenters: CostCenter[]): CostCenter[] => {
    const result: CostCenter[] = [];
    
    const flatten = (costCenters: CostCenter[]) => {
      costCenters.forEach(costCenter => {
        result.push(costCenter);
        if (costCenter.children) {
          flatten(costCenter.children);
        }
      });
    };
    
    flatten(hierarchicalCostCenters);
    return result;
  };

  // Load cost centers on component mount
  useEffect(() => {
    loadCostCenters();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Generate automatic code for cost centers
  const generateCostCenterCode = async (parentCostCenter?: CostCenter): Promise<string> => {
    try {
      const allCostCenters = await getCostCenters();
      
      if (!parentCostCenter) {
        // للمراكز الرئيسية - نفس منطق AddCostCenterPage
        const level1CostCenters = allCostCenters.filter(cc => cc.level === 1);
        
        if (level1CostCenters.length === 0) {
          return '1000';
        }
        
        const codes = level1CostCenters
          .map(cc => parseInt(cc.code))
          .filter(code => !isNaN(code))
          .sort((a, b) => a - b);
        
        if (codes.length === 0) {
          return '1000';
        }
        
        let nextCode = 1000;
        for (const code of codes) {
          if (code === nextCode) {
            nextCode += 1000;
          } else {
            break;
          }
        }
        
        return nextCode.toString();
      } else {
        // للمراكز الفرعية - كود الأب + أرقام متتالية
        const parentCode = parentCostCenter.code;
        const subCostCenters = allCostCenters.filter(cc => 
          cc.parentId === parentCostCenter.id && cc.code.startsWith(parentCode)
        );
        
        if (subCostCenters.length === 0) {
          return `${parentCode}01`; // أول مركز فرعي
        }
        
        // استخراج الأرقام التتالية من نهاية الكود
        const subCodes = subCostCenters
          .map(cc => {
            const suffix = cc.code.replace(parentCode, '');
            return parseInt(suffix) || 0;
          })
          .filter(code => !isNaN(code))
          .sort((a, b) => a - b);
        
        if (subCodes.length === 0) {
          return `${parentCode}01`;
        }
        
        // البحث عن أول فجوة في التسلسل أو إضافة رقم جديد
        let nextSuffix = 1;
        for (const suffix of subCodes) {
          if (suffix === nextSuffix) {
            nextSuffix += 1;
          } else {
            break;
          }
        }
        
        // تنسيق الرقم بحيث يكون رقمين على الأقل
        const formattedSuffix = nextSuffix.toString().padStart(2, '0');
        return `${parentCode}${formattedSuffix}`;
      }
    } catch (error) {
      console.error('Error generating cost center code:', error);
      return parentCostCenter ? `${parentCostCenter.code}01` : '1000';
    }
  };

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleCostCenterSelect = (costCenter: CostCenter) => {
    setSelectedCostCenter(costCenter);
    setIsEditing(false);
    setEditForm(costCenter);
    setShowDeleteWarning(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (!selectedCostCenter) return;
    
    // Check for sub cost centers
    const flatCostCenters = flattenCostCenterHierarchy(costCenters);
    const subCostCenters = flatCostCenters.filter(costCenter => costCenter.parentId === selectedCostCenter.id);
    const hasSubCostCenters = subCostCenters.length > 0;
    
    if (hasSubCostCenters) {
      setShowDeleteWarning(true);
      
      let errorMessage = `🚫 تحذير: لا يمكن حذف هذا المركز لأنه يحتوي على ${subCostCenters.length} مركز فرعي.\n\n`;
      
      if (subCostCenters.length <= 3) {
        errorMessage += `المراكز الفرعية:\n`;
        subCostCenters.forEach(subCostCenter => {
          errorMessage += `• ${subCostCenter.code} - ${subCostCenter.nameAr}\n`;
        });
        errorMessage += `\n`;
      } else {
        errorMessage += `راجع تفاصيل المركز لمشاهدة قائمة المراكز الفرعية.\n\n`;
      }
      
      errorMessage += `يجب حذف جميع المراكز الفرعية أولاً قبل حذف هذا المركز.`;
      
      toast.error(errorMessage, {
        duration: 8000,
        style: {
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#991b1b',
          whiteSpace: 'pre-line',
          maxWidth: '500px',
        },
      });
      return;
    }
    
    const confirmMessage = `هل أنت متأكد من حذف مركز التكلفة "${selectedCostCenter.nameAr}" (${selectedCostCenter.code})؟\n\nهذا الإجراء لا يمكن التراجع عنه.`;
    const confirmDelete = window.confirm(confirmMessage);
    
    if (!confirmDelete) return;
    
    try {
      await deleteCostCenter(selectedCostCenter.id);
      toast.success(`تم حذف مركز التكلفة "${selectedCostCenter.nameAr}" بنجاح`);
      
      await loadCostCenters();
      setSelectedCostCenter(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error deleting cost center:', error);
      toast.error(`فشل في حذف مركز التكلفة: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const handleAddClick = () => {
    if (selectedCostCenter && !selectedCostCenter.hasSubCenters) {
      toast.error(`لا يمكن إضافة مركز فرعي تحت "${selectedCostCenter.nameAr}" - المركز ليس له مراكز تحليلية`);
      return;
    }

    setShowAddForm(true);
    
    if (selectedCostCenter) {
      setNewCostCenter({
        nameAr: '',
        nameEn: '',
        description: '',
        type: 'فرعي',
        status: 'نشط',
        hasSubCenters: false,
        level: (selectedCostCenter.level || 1) + 1,
        parentId: selectedCostCenter.id,
        budget: 0,
        actualCost: 0,
        variance: 0,
        department: selectedCostCenter.department
      });
    } else {
      setNewCostCenter({
        nameAr: '',
        nameEn: '',
        description: '',
        type: 'رئيسي',
        status: 'نشط',
        hasSubCenters: true, // افتراضياً يقبل مراكز تحليلية للمراكز الرئيسية
        level: 1,
        budget: 0,
        actualCost: 0,
        variance: 0
      });
    }
  };

  const handleAddCostCenter = async () => {
    if (!newCostCenter.nameAr || !newCostCenter.nameEn) {
      toast.error('يرجى إدخال اسم المركز بالعربي والإنجليزي');
      return;
    }
    
    try {
      // توليد الكود التلقائي
      const autoCode = await generateCostCenterCode(selectedCostCenter || undefined);
      
      const costCenterToAdd: Omit<CostCenter, 'id'> = {
        code: autoCode,
        nameAr: newCostCenter.nameAr!,
        nameEn: newCostCenter.nameEn!,
        description: newCostCenter.description || '',
        type: newCostCenter.type!,
        level: newCostCenter.level || 1,
        status: 'نشط',
        hasSubCenters: newCostCenter.hasSubCenters ?? (newCostCenter.type === 'رئيسي' ? true : false), // افتراضياً true للمراكز الرئيسية
        department: newCostCenter.department || '',
        manager: newCostCenter.manager || '',
        location: newCostCenter.location || '',
        budget: newCostCenter.budget || 0,
        actualCost: newCostCenter.actualCost || 0,
        variance: newCostCenter.variance || 0,
        startDate: newCostCenter.startDate || '',
        endDate: newCostCenter.endDate || '',
        notes: newCostCenter.notes || '',
        ...(newCostCenter.parentId && { parentId: newCostCenter.parentId })
      };
      
      await addCostCenter(costCenterToAdd);
      
      if (newCostCenter.parentId && selectedCostCenter) {
        toast.success(`تم إضافة المركز الفرعي بنجاح تحت ${selectedCostCenter.nameAr} بالكود ${autoCode}`);
      } else {
        toast.success(`تم إضافة المركز الرئيسي بنجاح بالكود ${autoCode}`);
      }
      
      setShowAddForm(false);
      await loadCostCenters();
      
      if (newCostCenter.parentId) {
        setExpandedNodes(prev => new Set([...prev, newCostCenter.parentId!]));
      }
    } catch (error) {
      console.error('Error adding cost center:', error);
      toast.error(`فشل في إضافة مركز التكلفة: ${error.message || 'خطأ غير معروف'}`);
    }
  };

  const handleCancelAdd = () => {
    setShowAddForm(false);
    setNewCostCenter({
      nameAr: '',
      nameEn: '',
      description: '',
      type: 'رئيسي',
      status: 'نشط',
      hasSubCenters: true, // افتراضياً يقبل مراكز تحليلية للمراكز الرئيسية
      level: 1,
      budget: 0,
      actualCost: 0,
      variance: 0
    });
  };

  const handleSave = async () => {
    if (!selectedCostCenter || !editForm.nameAr || !editForm.nameEn) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    try {
      setIsSaving(true);
      
      await updateCostCenter(selectedCostCenter.id, editForm);
      
      setIsEditing(false);
      setSelectedCostCenter(editForm as CostCenter);
      
      await loadCostCenters();
      
      toast.success('تم حفظ التعديلات بنجاح');
    } catch (error) {
      console.error('Error saving cost center:', error);
      toast.error(`فشل في حفظ التعديلات: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm(selectedCostCenter || {});
    setIsSaving(false);
    setShowDeleteWarning(false);
  };

  const renderCostCenterTree = (costCenterList: CostCenter[], level = 0) => {
    return costCenterList.map((costCenter, idx) => {
      const isLast = idx === costCenterList.length - 1;
      const hasChildren = costCenter.children && costCenter.children.length > 0;
      const isExpanded = expandedNodes.has(costCenter.id);
      
      return (
        <div key={costCenter.id} className="select-none relative">
          {/* خطوط طولية */}
          {level > 0 && (
            <div
              className="absolute top-0 right-0"
              style={{
                width: '20px',
                right: `${(level - 1) * 20 + 2}px`,
                height: isLast ? '36px' : '100%',
                borderRight: isLast ? '2px solid transparent' : '2px solid #e5e7eb',
                zIndex: 0,
              }}
            />
          )}
          
          <div
            className={`flex items-center py-2 px-2 hover:bg-gray-50 cursor-pointer rounded ${
              selectedCostCenter?.id === costCenter.id ? 'bg-red-50 border-r-4 border-red-500' : ''
            }`}
            style={{ paddingRight: `${level * 20 + 8}px`, position: 'relative', zIndex: 1 }}
            onClick={() => handleCostCenterSelect(costCenter)}
          >
            <div className="flex items-center flex-1">
              {hasChildren || costCenter.hasSubCenters ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 mr-2 font-bold text-lg bg-gray-200 hover:bg-gray-300 rounded-full transition-colors duration-150"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNode(costCenter.id);
                  }}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? '-' : '+'}
                </Button>
              ) : (
                <div className="w-6 mr-2" />
              )}
              <div className="flex items-center">
                {hasChildren || costCenter.hasSubCenters ? (
                  <Folder className="h-4 w-4 text-orange-600 mr-2" />
                ) : (
                  <File className="h-4 w-4 text-blue-600 mr-2" />
                )}
                <span className="text-sm font-medium">{costCenter.code}</span>
                <span className="text-sm text-gray-600 mr-2">-</span>
                <span className="text-sm">{costCenter.nameAr}</span>
                {/* عرض النوع للمراكز الرئيسية */}
                {costCenter.level === 1 && (
                  <Badge 
                    variant="outline" 
                    className="mr-2 text-xs"
                    style={{
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      borderColor: '#fca5a5'
                    }}
                  >
                    {costCenter.type}
                  </Badge>
                )}
                {/* عرض القسم إن وجد */}
                {costCenter.department && (
                  <Badge 
                    variant="outline" 
                    className="mr-2 text-xs"
                    style={{
                      backgroundColor: '#f0f9ff',
                      color: '#0369a1',
                      borderColor: '#7dd3fc'
                    }}
                  >
                    {costCenter.department}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* المراكز الفرعية */}
          {hasChildren && isExpanded && (
            <div>{renderCostCenterTree(costCenter.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="w-full p-6 space-y-6 min-h-screen" dir="rtl">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">جاري تحميل مراكز التكلفة...</p>
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
          <Target className="h-8 w-8 text-red-600 ml-3" />
          <h1 className="text-2xl font-bold text-gray-800">مراكز التكلفة</h1>
        </div>
        <p className="text-gray-600 mt-2">إدارة مراكز التكلفة والأقسام</p>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-orange-500"></div>
      </div>

      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "الادارة الماليه", to: "/management/financial" }, 
          { label: "مراكز التكلفة" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cost Center Tree - Right Side */}
        <div className="lg:col-span-1">
          <Card className="h-[700px]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>شجرة مراكز التكلفة</span>
                <Button 
                  size="sm" 
                  className="h-8 bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-400" 
                  onClick={() => loadCostCenters(0)}
                  disabled={isLoading}
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'جاري التحميل...' : 'تحديث'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto h-[600px] p-4">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full space-y-4">
                    <div className="relative">
                      <Loader2 className="h-12 w-12 text-red-600 animate-spin" />
                      <div className="absolute inset-0 h-12 w-12 border-2 border-red-200 rounded-full animate-pulse"></div>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-medium mb-2">جاري تحميل مراكز التكلفة...</p>
                      <p className="text-gray-500 text-sm">يرجى الانتظار قليلاً</p>
                    </div>
                    <div className="w-48 bg-gray-200 rounded-full h-2">
                      <div className="bg-red-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
                    </div>
                  </div>
                ) : costCenters.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <Target className="h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد مراكز تكلفة</h3>
                    <p className="text-gray-500 mb-4">يبدو أن قاعدة البيانات فارغة أو لم يتم الاتصال بها بعد</p>
                    <div className="space-y-2">
                      <p className="text-red-600 text-sm">💡 يمكنك إضافة مراكز تكلفة رئيسية من هنا</p>
                      <p className="text-orange-600 text-sm">🔄 أو جرب الضغط على زر "تحديث" أعلاه</p>
                    </div>
                    <Button 
                      className="mt-4 bg-red-500 hover:bg-red-600 text-white"
                      onClick={() => loadCostCenters(0)}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                      إعادة تحميل
                    </Button>
                  </div>
                ) : (
                  renderCostCenterTree(costCenters)
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Center Details - Left Side */}
        <div className="lg:col-span-2">
          <Card className="h-[700px]">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>تفاصيل مركز التكلفة</span>
                {selectedCostCenter && (
                  <div className="flex gap-2">
                    {!isEditing && !showAddForm ? (
                      <>
                        <Button 
                          size="sm" 
                          onClick={handleAddClick} 
                          className="h-8 bg-red-500 hover:bg-red-600 text-white disabled:bg-gray-400 disabled:cursor-not-allowed"
                          disabled={!selectedCostCenter.hasSubCenters}
                          title={
                            selectedCostCenter.hasSubCenters 
                              ? `إضافة مركز فرعي تحت: ${selectedCostCenter.nameAr}` 
                              : `لا يمكن إضافة مركز فرعي تحت: ${selectedCostCenter.nameAr} - المركز ليس له مراكز تحليلية`
                          }
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          إضافة مركز فرعي
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleEdit} 
                          className="h-8 bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          تعديل
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleDelete} 
                          className={`h-8 text-white ${
                            (() => {
                              const flatCostCenters = flattenCostCenterHierarchy(costCenters);
                              const hasSubCenters = flatCostCenters.some(costCenter => costCenter.parentId === selectedCostCenter.id);
                              return hasSubCenters 
                                ? 'bg-gray-400 cursor-not-allowed' 
                                : 'bg-red-500 hover:bg-red-600';
                            })()
                          }`}
                          disabled={(() => {
                            const flatCostCenters = flattenCostCenterHierarchy(costCenters);
                            return flatCostCenters.some(costCenter => costCenter.parentId === selectedCostCenter.id);
                          })()}
                          title={(() => {
                            const flatCostCenters = flattenCostCenterHierarchy(costCenters);
                            const hasSubCenters = flatCostCenters.some(costCenter => costCenter.parentId === selectedCostCenter.id);
                            if (hasSubCenters) {
                              const subCentersCount = flatCostCenters.filter(costCenter => costCenter.parentId === selectedCostCenter.id).length;
                              return `لا يمكن حذف "${selectedCostCenter.nameAr}" - يحتوي على ${subCentersCount} مركز فرعي`;
                            }
                            return `حذف مركز التكلفة "${selectedCostCenter.nameAr}"`;
                          })()}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          حذف
                        </Button>
                      </>
                    ) : isEditing ? (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={handleSave} 
                          className="h-8 bg-blue-500 hover:bg-blue-600 text-white" 
                          disabled={isSaving}
                        >
                          {isSaving ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4 mr-1" />
                          )}
                          {isSaving ? 'جاري الحفظ...' : 'حفظ التعديل'}
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={handleCancel} 
                          className="h-8 bg-blue-100 hover:bg-blue-200 text-blue-700 border-none" 
                          disabled={isSaving}
                        >
                          <X className="h-4 w-4 mr-1" />
                          إلغاء
                        </Button>
                      </div>
                    ) : showAddForm ? (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddCostCenter} className="h-8 bg-red-500 hover:bg-red-600 text-white">
                          <Save className="h-4 w-4 mr-1" />
                          إضافة
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={handleCancelAdd} 
                          className="h-8"
                        >
                          <X className="h-4 w-4 mr-1" />
                          إلغاء
                        </Button>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4 overflow-auto h-[600px]">
              {selectedCostCenter ? (
                <div className="space-y-6">
                  {/* رسالة تحذيرية للمراكز التي ليس لها مراكز تحليلية */}
                  {!selectedCostCenter.hasSubCenters && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="text-yellow-800">
                          <span className="font-medium">تنبيه:</span> هذا المركز ليس له مراكز تحليلية، لذا لا يمكن إضافة مراكز فرعية تحته.
                        </div>
                      </div>
                      <div className="text-sm text-yellow-700 mt-2">
                        💡 لتمكين إضافة مراكز فرعية، قم بتعديل المركز وتفعيل خيار "له مراكز تحليلية"
                      </div>
                    </div>
                  )}

                  {showAddForm ? (
                    /* نموذج إضافة مركز جديد */
                    <div className="space-y-6">
                      {selectedCostCenter && (
                        <div className="bg-red-50 p-4 rounded-lg">
                          <p className="text-sm text-red-800">
                            <strong>المركز الأب:</strong> {selectedCostCenter.nameAr} ({selectedCostCenter.code})
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label>نوع المركز</Label>
                          <Select
                            value={newCostCenter.type || 'رئيسي'}
                            onChange={(value) => setNewCostCenter({...newCostCenter, type: value as 'رئيسي' | 'فرعي' | 'وحدة'})}
                            style={{ width: '100%', height: '38px', textAlign: 'right' }}
                            disabled={!!selectedCostCenter}
                            options={costCenterTypes.map(type => ({ value: type, label: type }))}
                          />
                          <div className="text-xs text-gray-500">
                            💡 سيتم توليد كود المركز تلقائياً
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>اسم المركز (عربي) *</Label>
                          <Input
                            value={newCostCenter.nameAr || ''}
                            onChange={(e) => setNewCostCenter({...newCostCenter, nameAr: e.target.value})}
                            placeholder="اسم مركز التكلفة بالعربي"
                            style={{ textAlign: 'right', height: '38px' }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>اسم المركز (إنجليزي) *</Label>
                          <Input
                            value={newCostCenter.nameEn || ''}
                            onChange={(e) => setNewCostCenter({...newCostCenter, nameEn: e.target.value})}
                            placeholder="Cost Center Name in English"
                            style={{ textAlign: 'left', height: '38px' }}
                            dir="ltr"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>القسم</Label>
                          <Select
                            value={newCostCenter.department || ''}
                            onChange={(value) => setNewCostCenter({...newCostCenter, department: value})}
                            style={{ width: '100%', height: '38px', textAlign: 'right' }}
                            placeholder="اختر القسم"
                            allowClear
                            options={departments.map(department => ({ value: department, label: department }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>المدير المسؤول</Label>
                          <Input
                            value={newCostCenter.manager || ''}
                            onChange={(e) => setNewCostCenter({...newCostCenter, manager: e.target.value})}
                            placeholder="اسم المدير المسؤول"
                            style={{ textAlign: 'right', height: '38px' }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>الموقع</Label>
                          <Input
                            value={newCostCenter.location || ''}
                            onChange={(e) => setNewCostCenter({...newCostCenter, location: e.target.value})}
                            placeholder="موقع مركز التكلفة"
                            style={{ textAlign: 'right', height: '38px' }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>الميزانية (ريال)</Label>
                          <Input
                            type="number"
                            value={newCostCenter.budget || 0}
                            onChange={(e) => setNewCostCenter({...newCostCenter, budget: parseFloat(e.target.value) || 0})}
                            placeholder="0"
                            style={{ textAlign: 'right', height: '38px' }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>تاريخ البداية</Label>
                          <Input
                            type="date"
                            value={newCostCenter.startDate || ''}
                            onChange={(e) => setNewCostCenter({...newCostCenter, startDate: e.target.value})}
                            style={{ textAlign: 'right', height: '38px' }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>الوصف</Label>
                        <TextArea
                          value={newCostCenter.description || ''}
                          onChange={(e) => setNewCostCenter({...newCostCenter, description: e.target.value})}
                          placeholder="وصف مركز التكلفة..."
                          style={{ textAlign: 'right' }}
                          rows={3}
                        />
                      </div>

                      <div className="flex items-center space-x-2 space-x-reverse">
                        <input
                          type="checkbox"
                          id="hasSubCenters"
                          checked={newCostCenter.hasSubCenters || false}
                          onChange={(e) => setNewCostCenter({...newCostCenter, hasSubCenters: e.target.checked})}
                          className="rounded"
                        />
                        <Label htmlFor="hasSubCenters">له مراكز تحليلية</Label>
                      </div>

                      {selectedCostCenter ? (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                          💡 سيتم إنشاء كود المركز الفرعي تلقائياً بناءً على كود المركز الأب: {selectedCostCenter.code} 
                          <br />
                          (مثال: {selectedCostCenter.code}01, {selectedCostCenter.code}02, {selectedCostCenter.code}03...)
                        </div>
                      ) : (
                        <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                          💡 سيتم إنشاء كود المركز الرئيسي تلقائياً (1000, 2000, 3000...)
                        </div>
                      )}
                    </div>
                  ) : (
                    /* تفاصيل المركز الحالي */
                    <div className="space-y-6">
                      {/* الصف الأول: 3 أعمدة */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* نوع المركز */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">نوع المركز</div>
                          {isEditing ? (
                            <Select
                              value={editForm.type || 'رئيسي'}
                              onChange={(value) => setEditForm({...editForm, type: value as 'رئيسي' | 'فرعي' | 'وحدة'})}
                              style={{ width: '100%', height: '38px', textAlign: 'right' }}
                              options={costCenterTypes.map(type => ({ value: type, label: type }))}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              <Badge style={{ 
                                background: selectedCostCenter.type === 'رئيسي' ? '#fef2f2' : 
                                           selectedCostCenter.type === 'فرعي' ? '#f0fdf4' : '#fefbf0', 
                                color: selectedCostCenter.type === 'رئيسي' ? '#dc2626' : 
                                       selectedCostCenter.type === 'فرعي' ? '#16a34a' : '#d97706',
                                borderColor: selectedCostCenter.type === 'رئيسي' ? '#fca5a5' : 
                                             selectedCostCenter.type === 'فرعي' ? '#86efac' : '#fed7aa'
                              }}>
                                {selectedCostCenter.type}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* المركز الأب */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">المركز الأب</div>
                          <div className="p-2 bg-gray-50 rounded border">
                            {selectedCostCenter.parentId ? (
                              <span className="text-sm">
                                {flattenCostCenterHierarchy(costCenters).find(center => center.id === selectedCostCenter.parentId)?.nameAr || 'غير محدد'}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">مركز رئيسي</span>
                            )}
                          </div>
                        </div>

                        {/* مستوى المركز */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">المستوى</div>
                          <div className="p-2 bg-gray-50 rounded border">
                            <Badge style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }}>المستوى {selectedCostCenter.level}</Badge>
                          </div>
                        </div>
                      </div>

                      {/* الصف الثاني: 3 أعمدة */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* رقم المركز */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">رقم المركز</div>
                          <div className="p-2 bg-gray-50 rounded border font-mono">
                            {selectedCostCenter.code}
                          </div>
                        </div>

                        {/* اسم المركز (عربي) */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">اسم المركز (عربي)</div>
                          {isEditing ? (
                            <Input
                              value={editForm.nameAr || ''}
                              onChange={(e) => setEditForm({ ...editForm, nameAr: e.target.value })}
                              style={{ textAlign: 'right', height: '38px' }}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              {selectedCostCenter.nameAr}
                            </div>
                          )}
                        </div>

                        {/* اسم المركز (إنجليزي) */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">اسم المركز (إنجليزي)</div>
                          {isEditing ? (
                            <Input
                              value={editForm.nameEn || ''}
                              onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                              style={{ textAlign: 'left', height: '38px' }}
                              dir="ltr"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border text-left" dir="ltr">
                              {selectedCostCenter.nameEn}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* الصف الثالث: 3 أعمدة */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* القسم */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">القسم</div>
                          {isEditing ? (
                            <Select
                              value={editForm.department || ''}
                              onChange={(value) => setEditForm({ ...editForm, department: value })}
                              style={{ width: '100%', height: '38px', textAlign: 'right' }}
                              placeholder="اختر القسم"
                              allowClear
                              options={departments.map(department => ({ value: department, label: department }))}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              {selectedCostCenter.department || 'غير محدد'}
                            </div>
                          )}
                        </div>

                        {/* حالة المركز */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">حالة المركز</div>
                          {isEditing ? (
                            <Select
                              value={editForm.status || 'نشط'}
                              onChange={(value) => setEditForm({...editForm, status: value as 'نشط' | 'غير نشط'})}
                              style={{ width: '100%', height: '38px', textAlign: 'right' }}
                              options={[
                                { value: 'نشط', label: 'نشط' },
                                { value: 'غير نشط', label: 'غير نشط' }
                              ]}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              <Badge style={{ 
                                background: selectedCostCenter.status === 'نشط' ? '#f0fdf4' : '#f5f5f5', 
                                color: selectedCostCenter.status === 'نشط' ? '#16a34a' : '#757575',
                                borderColor: selectedCostCenter.status === 'نشط' ? '#86efac' : '#d6d3d1'
                              }}>
                                {selectedCostCenter.status}
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* المدير المسؤول */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">المدير المسؤول</div>
                          {isEditing ? (
                            <Input
                              value={editForm.manager || ''}
                              onChange={(e) => setEditForm({ ...editForm, manager: e.target.value })}
                              style={{ textAlign: 'right', height: '38px' }}
                              placeholder="اسم المدير المسؤول"
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              {selectedCostCenter.manager || 'غير محدد'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* الصف الرابع: معلومات مالية */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* الميزانية */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">الميزانية (ريال)</div>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.budget || 0}
                              onChange={(e) => setEditForm({ ...editForm, budget: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right', height: '38px' }}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              {selectedCostCenter.budget?.toLocaleString() || '0'} ريال
                            </div>
                          )}
                        </div>

                        {/* التكلفة الفعلية */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">التكلفة الفعلية (ريال)</div>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.actualCost || 0}
                              onChange={(e) => setEditForm({ ...editForm, actualCost: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right', height: '38px' }}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              {selectedCostCenter.actualCost?.toLocaleString() || '0'} ريال
                            </div>
                          )}
                        </div>

                        {/* الانحراف */}
                        <div className="space-y-2">
                          <div className="font-semibold mb-1">الانحراف (ريال)</div>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.variance || 0}
                              onChange={(e) => setEditForm({ ...editForm, variance: parseFloat(e.target.value) || 0 })}
                              style={{ textAlign: 'right', height: '38px' }}
                            />
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border">
                              <span className={`font-medium ${
                                (selectedCostCenter.variance || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {selectedCostCenter.variance?.toLocaleString() || '0'} ريال
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* الصف الخامس: له مراكز تحليلية (مركز) */}
                      <div className="flex justify-center">
                        <div className="w-full max-w-sm space-y-2">
                          <div className="font-semibold mb-1">له مراكز تحليلية</div>
                          {isEditing ? (
                            <div className="flex items-center justify-center space-x-2 space-x-reverse p-2">
                              <input
                                type="checkbox"
                                checked={editForm.hasSubCenters || false}
                                onChange={(e) => setEditForm({ ...editForm, hasSubCenters: e.target.checked })}
                                className="rounded"
                              />
                              <Label>له مراكز فرعية</Label>
                            </div>
                          ) : (
                            <div className="p-2 bg-gray-50 rounded border text-center">
                              <Badge style={{ 
                                background: selectedCostCenter.hasSubCenters ? '#fef2f2' : '#f5f5f5', 
                                color: selectedCostCenter.hasSubCenters ? '#dc2626' : '#757575',
                                borderColor: selectedCostCenter.hasSubCenters ? '#fca5a5' : '#d6d3d1'
                              }}>
                                {selectedCostCenter.hasSubCenters ? 'نعم' : 'لا'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* نسبة استهلاك الميزانية */}
                      {selectedCostCenter.budget && selectedCostCenter.budget > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <DollarSign className="h-5 w-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-blue-800">نسبة استهلاك الميزانية</h3>
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                            <div 
                              className={`h-3 rounded-full transition-all duration-300 ${
                                ((selectedCostCenter.actualCost || 0) / selectedCostCenter.budget) > 0.9 
                                  ? 'bg-red-600' 
                                  : ((selectedCostCenter.actualCost || 0) / selectedCostCenter.budget) > 0.7 
                                    ? 'bg-yellow-500' 
                                    : 'bg-green-600'
                              }`}
                              style={{
                                width: `${Math.min(((selectedCostCenter.actualCost || 0) / selectedCostCenter.budget) * 100, 100)}%`
                              }}
                            ></div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">النسبة المستهلكة:</span>
                              <span className="font-bold text-blue-800 mr-2">
                                {((selectedCostCenter.actualCost || 0) / selectedCostCenter.budget * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">المتبقي:</span>
                              <span className="font-bold text-green-600 mr-2">
                                {(selectedCostCenter.budget - (selectedCostCenter.actualCost || 0)).toLocaleString()} ريال
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* قسم الوصف والملاحظات */}
                      {(selectedCostCenter.description || selectedCostCenter.notes || isEditing) && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="h-5 w-5 text-gray-600" />
                            <h3 className="text-lg font-semibold text-gray-800">الوصف والملاحظات</h3>
                          </div>
                          
                          <div className="space-y-4">
                            {(selectedCostCenter.description || isEditing) && (
                              <div className="space-y-2">
                                <div className="font-semibold text-gray-700">الوصف</div>
                                {isEditing ? (
                                  <TextArea
                                    value={editForm.description || ''}
                                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                                    style={{ textAlign: 'right' }}
                                    rows={3}
                                    placeholder="وصف مركز التكلفة..."
                                  />
                                ) : (
                                  <div className="p-2 bg-white rounded border">
                                    {selectedCostCenter.description || 'لا يوجد وصف'}
                                  </div>
                                )}
                              </div>
                            )}

                            {(selectedCostCenter.notes || isEditing) && (
                              <div className="space-y-2">
                                <div className="font-semibold text-gray-700">ملاحظات</div>
                                {isEditing ? (
                                  <TextArea
                                    value={editForm.notes || ''}
                                    onChange={(e) => setEditForm({...editForm, notes: e.target.value})}
                                    style={{ textAlign: 'right' }}
                                    rows={2}
                                    placeholder="ملاحظات إضافية..."
                                  />
                                ) : (
                                  <div className="p-2 bg-white rounded border">
                                    {selectedCostCenter.notes || 'لا توجد ملاحظات'}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Target className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">اختر مركز تكلفة من الشجرة</h3>
                  <p className="text-gray-500">قم بالنقر على أي مركز من الشجرة لعرض تفاصيله</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CostCentersPage;


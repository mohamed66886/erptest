import React, { useState, useEffect } from 'react';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { usePermissions } from "@/hooks/usePermissions";
import { Select as AntdSelect } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";


import { 
  Settings, 
  FileText, 
  Wrench,
  HardHat,
  ClipboardList,
  CheckCircle,
  Archive,
  FileBarChart,
  Package,
  PackageCheck,
  UserCog,
  Users,
  Calendar,
  Clock,
  ShoppingCart
} from 'lucide-react';

const InstallationPage: React.FC = () => {
  // السنة المالية
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const { hasPermission, currentUser } = usePermissions();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  // عرض بيانات المستخدم الحالي للتأكد من الصلاحيات
  useEffect(() => {
    console.log('👤 Current User in InstallationPage:', currentUser);
    console.log('📋 User Permissions:', currentUser?.permissions);
    console.log('💼 User Position:', currentUser?.position);
  }, [currentUser]);

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
  const navigate = useNavigate();

  const settingsCards = [
    {
      title: "إعدادات عامة",
      description: "إعدادات النظام العامة",
      icon: <Settings className="h-6 w-6" />,
      color: "bg-indigo-500",
      permissionId: "installation-settings",
      onClick: () => {
        navigate('/installation/settings');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "المستخدمين",
      description: "إدارة مستخدمي النظام",
      icon: <UserCog className="h-6 w-6" />,
      color: "bg-amber-500",
      permissionId: "users-management",
      onClick: () => {
        navigate('/installation/users');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "إدارة الفنيين",
      description: "إضافة وتعديل بيانات الفنيين",
      icon: <Users className="h-6 w-6" />,
      color: "bg-blue-500",
      permissionId: "technicians",
      onClick: () => {
        navigate('/installation/technicians');
        window.scrollTo(0, 0);
      }
    }
  ];

  const operationsCards = [
    {
      title: "الطلبات",
      description: "عرض جميع طلبات التركيب",
      icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-purple-600",
      permissionId: "installation-orders",
      onClick: () => {
        navigate('/installation/orders');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "الطلبات المؤكدة",
      description: "عرض طلبات التركيب المؤكدة",
      icon: <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-green-600",
      permissionId: "installation-confirmed-orders",
      onClick: () => {
        navigate('/installation/confirmed-orders');
        window.scrollTo(0, 0);
      }
    },

    {
      title: "الطلبات المكتملة",
      description: "عرض طلبات التركيب المكتملة",
      icon: <PackageCheck className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-teal-600",
      permissionId: "installation-completed-orders",
      onClick: () => {
        navigate('/installation/completed-orders');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "الطلبات المؤرشفة",
      description: "أرشيف طلبات التركيب القديمة",
      icon: <Archive className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-gray-600",
      permissionId: "installation-archived-orders",
      onClick: () => {
        navigate('/installation/archived-orders');
        window.scrollTo(0, 0);
      }
    }
  ];



  interface CardType {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    permissionId?: string;
    onClick?: () => void;
  }

  const CardComponent = ({ card, index }: { card: CardType, index: number }) => {
    // التحقق من الصلاحية: إذا كان هناك permissionId، يجب أن يكون لديه الصلاحية
    const isAllowed = card.permissionId ? hasPermission(card.permissionId) : true;
    
    console.log(`🎴 Card: ${card.title}, permissionId: ${card.permissionId}, isAllowed: ${isAllowed}`);
    
    // إذا لم يكن لديه صلاحية، لا تظهر الكارت نهائياً
    if (!isAllowed) {
      return null;
    }
    
    return (
      <Card 
        key={index}
        className="group transition-all duration-300 hover:shadow-lg cursor-pointer hover:scale-105"
        onClick={card.onClick}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className={`p-1 sm:p-2 rounded-lg ${card.color} text-white flex items-center justify-center`}>
              {card.icon}
            </div>
            <CardTitle className="text-xs sm:text-sm text-right">{card.title}</CardTitle>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      {/* Header */}
      <Helmet>
        <title>إدارة التركيب | ERP90 Dashboard</title>
        <meta name="description" content="إدارة طلبات التركيب والفنيين ERP90 Dashboard" />
        <meta name="keywords" content="ERP, تركيب, فنيين, طلبات, Installation, Technicians, Orders" />
      </Helmet>

      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Wrench className="h-8 w-8 text-indigo-600 dark:text-indigo-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إدارة التركيب</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة طلبات التركيب والفنيين والتقارير</p>
            </div>
          </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <Wrench className="text-indigo-600 dark:text-indigo-300 w-6 h-6" />
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-400 to-purple-500"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة التركيب" }, 
        ]}
      />

      {/* الإعدادات Section */}
      {settingsCards.filter(card => !card.permissionId || hasPermission(card.permissionId)).length > 0 && (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">الإعدادات</h2>
              <p className="text-sm sm:text-base text-gray-600">إعدادات الفنيين وإدارة التركيب</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {settingsCards
              .filter(card => !card.permissionId || hasPermission(card.permissionId))
              .map((card, index) => (
                <CardComponent key={`settings-${index}`} card={card} index={index} />
              ))}
          </div>
        </div>
      )}

      {/* العمليات Section */}
      {operationsCards.filter(card => !card.permissionId || hasPermission(card.permissionId)).length > 0 && (
        <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">العمليات</h2>
              <p className="text-sm sm:text-base text-gray-600">عمليات طلبات التركيب اليومية</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {operationsCards
              .filter(card => !card.permissionId || hasPermission(card.permissionId))
              .map((card, index) => (
                <CardComponent key={`operations-${index}`} card={card} index={index} />
              ))}
          </div>
        </div>
      )}

      {/* رسالة في حالة عدم وجود صلاحيات */}
      {settingsCards.filter(card => !card.permissionId || hasPermission(card.permissionId)).length === 0 &&
       operationsCards.filter(card => !card.permissionId || hasPermission(card.permissionId)).length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-full">
              <Settings className="h-8 w-8 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">لا توجد صفحات متاحة</h3>
              <p className="text-yellow-700">
                لا تملك صلاحيات للوصول إلى أي من صفحات إدارة التركيب. 
                يرجى التواصل مع المدير لمنحك الصلاحيات اللازمة.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InstallationPage;

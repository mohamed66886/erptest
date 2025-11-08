import React, { useState, useEffect } from 'react';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { usePermissions } from "@/hooks/usePermissions";
import { Select as AntdSelect } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";
import { Tooltip } from 'antd';

import { 
  Settings, 
  FileText, 
  MapPin,
  Map,
  Building,
  Building2,
  Warehouse,
  ClipboardList,
  Truck,
  Package,
  CheckCircle,
  Archive,
  FileBarChart,
  TrendingUp,
  BarChart3,
  Plus,
  Edit,
  Eye,
  Users,
  Target,
  Calendar,
  Clock,
  ShoppingCart,
  PackageCheck,
  PackageX,
  PackagePlus,
  TruckIcon,
  MapPinned,
  Home,
  Store,
  BoxIcon,
  UserCog
} from 'lucide-react';

const OutputsManagement: React.FC = () => {
  // السنة المالية
  const { currentFinancialYear, activeYears, setCurrentFinancialYear } = useFinancialYear();
  const { hasPermission, currentUser } = usePermissions();
  const [fiscalYear, setFiscalYear] = useState<string>("");

  // عرض بيانات المستخدم الحالي للتأكد من الصلاحيات
  useEffect(() => {
    console.log('👤 Current User in OutputsManagement:', currentUser);
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
      title: "إدارة المحافظات",
      description: "إضافة وتعديل المحافظات",
      icon: <Map className="h-6 w-6" />,
      color: "bg-blue-500",
      permissionId: "governorates",
      onClick: () => {
        navigate('/management/governorates');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "إدارة المناطق",
      description: "إضافة وتعديل المناطق",
      icon: <MapPin className="h-6 w-6" />,
      color: "bg-green-500",
      permissionId: "regions",
      onClick: () => {
        navigate('/management/regions');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "إدارة الأحياء",
      description: "إضافة وتعديل الأحياء",
      icon: <MapPinned className="h-6 w-6" />,
      color: "bg-purple-500",
      permissionId: "districts",
      onClick: () => {
        navigate('/management/districts');
        window.scrollTo(0, 0);
      }
    },

    {
      title: "إدارة السائقين",
      description: "إضافة وتعديل بيانات السائقين",
      icon: <Truck className="h-6 w-6" />,
      color: "bg-cyan-500",
      permissionId: "drivers",
      onClick: () => {
        navigate('/management/drivers');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "حالة الفرع",
      description: "متابعة وإدارة حالة الفروع",
      icon: <Store className="h-6 w-6" />,
      color: "bg-orange-500",
      permissionId: "branch-status",
      onClick: () => {
        navigate('/management/branch-status');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "مستودعات التوصيل",
      description: "إدارة مستودعات التوصيل",
      icon: <Warehouse className="h-6 w-6" />,
      color: "bg-indigo-500",
      permissionId: "delivery-warehouses",
      onClick: () => {
        navigate('/management/delivery-warehouses');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "ربط الفروع",
      description: "ربط الفروع بالمناطق والأحياء",
      icon: <Building2 className="h-6 w-6" />,
      color: "bg-pink-500",
      permissionId: "link-branches",
      onClick: () => {
        navigate('/management/link-branches');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "إعدادات التوصيل",
      description: "إدارة إعدادات وخيارات التوصيل",
      icon: <Settings className="h-6 w-6" />,
      color: "bg-teal-500",
      permissionId: "delivery-settings",
      onClick: () => {
        navigate('/management/delivery-settings');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "إدارة المستخدمين",
      description: "إدارة حسابات وصلاحيات المستخدمين",
      icon: <UserCog className="h-6 w-6" />,
      color: "bg-violet-500",
      permissionId: "users",
      onClick: () => {
        navigate('/management/users');
        window.scrollTo(0, 0);
      }
    }

  ];

  const operationsCards = [
    // {
    //   title: "طلبات المستودع",
    //   description: "عرض وإدارة طلبات المستودعات",
    //   icon: <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-blue-700",
    //   onClick: () => {
    //     navigate('/management/warehouse-orders');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "إنشاء طلب مستودع",
    //   description: "إنشاء طلب مستودع جديد",
    //   icon: <PackagePlus className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-green-600",
    //   onClick: () => {
    //     navigate('/management/create-warehouse-order');
    //     window.scrollTo(0, 0);
    //   }
    // },
    {
      title: "الطلبات",
      description: "عرض جميع الطلبات",
      icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-purple-600",
      permissionId: "delivery-orders",
      onClick: () => {
        navigate('/management/delivery-orders');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تأكيد الطلبات",
      description: "تأكيد ومراجعة الطلبات",
      icon: <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-emerald-600",
      permissionId: "confirm-orders",
      onClick: () => {
        navigate('/management/confirm-orders');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "الطلبات المكتملة",
      description: "عرض الطلبات المكتملة",
      icon: <PackageCheck className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-teal-600",
      permissionId: "completed-orders",
      onClick: () => {
        navigate('/management/completed-orders');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "الطلبات المؤرشفة",
      description: "أرشيف الطلبات القديمة",
      icon: <Archive className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-gray-600",
      permissionId: "archived-orders",
      onClick: () => {
        navigate('/management/archived-orders');
        window.scrollTo(0, 0);
      }
    },
    // {
    //   title: "إدارة التوصيل",
    //   description: "إدارة عمليات التوصيل والشحن",
    //   icon: <TruckIcon className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-blue-600",
    //   onClick: () => {
    //     navigate('/management/delivery');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تتبع الطلبات",
    //   description: "متابعة حالة الطلبات",
    //   icon: <Eye className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-indigo-600",
    //   onClick: () => {
    //     navigate('/management/track-orders');
    //     window.scrollTo(0, 0);
    //   }
    // }
  ];

  const reportsCards = [
    {
      title: "التقارير الشاملة",
      description: "تقارير شاملة عن جميع العمليات",
      icon: <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-blue-700",
      permissionId: "comprehensive-reports",
      onClick: () => {
        navigate('/reports/comprehensive-reports');
        window.scrollTo(0, 0);
      }
    },
    // {
    //   title: "تقرير المستودع",
    //   description: "تقرير شامل عن حركة المستودع",
    //   icon: <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-blue-700",
    //   onClick: () => {
    //     navigate('/reports/warehouse-report');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير المستودعات التفصيلي",
    //   description: "تقرير تفصيلي لجميع المستودعات",
    //   icon: <Warehouse className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-green-700",
    //   onClick: () => {
    //     navigate('/reports/warehouse-detailed');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير السائقين",
    //   description: "تقرير شامل عن أداء السائقين",
    //   icon: <Truck className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-purple-700",
    //   onClick: () => {
    //     navigate('/reports/drivers-report');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير توصيلات السائقين",
    //   description: "تقرير مفصل عن عمليات التوصيل",
    //   icon: <TruckIcon className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-cyan-700",
    //   onClick: () => {
    //     navigate('/reports/driver-deliveries');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير الطلبات حسب الحالة",
    //   description: "تقرير الطلبات مصنفة حسب الحالة",
    //   icon: <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-orange-700",
    //   onClick: () => {
    //     navigate('/reports/orders-by-status');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير الطلبات حسب الفترة",
    //   description: "تقرير الطلبات خلال فترة زمنية محددة",
    //   icon: <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-pink-700",
    //   onClick: () => {
    //     navigate('/reports/orders-by-period');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير أداء المستودعات",
    //   description: "تحليل أداء المستودعات",
    //   icon: <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-emerald-700",
    //   onClick: () => {
    //     navigate('/reports/warehouse-performance');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير حركة المخزون",
    //   description: "تقرير حركة المخزون بين المستودعات",
    //   icon: <PackageCheck className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-indigo-700",
    //   onClick: () => {
    //     navigate('/reports/inventory-movement');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير المناطق والفروع",
    //   description: "تقرير شامل عن المناطق والفروع",
    //   icon: <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-lime-700",
    //   onClick: () => {
    //     navigate('/reports/regions-branches');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقرير توزيع الطلبات",
    //   description: "توزيع الطلبات حسب المناطق",
    //   icon: <Map className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-teal-700",
    //   onClick: () => {
    //     navigate('/reports/orders-distribution');
    //     window.scrollTo(0, 0);
    //   }
    // }
  ];

  const locationManagementCards = [
    // {
    //   title: "دليل المحافظات",
    //   description: "قائمة بجميع المحافظات",
    //   icon: <Map className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-blue-600",
    //   onClick: () => {
    //     navigate('/management/governorates-directory');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "دليل المناطق",
    //   description: "قائمة بجميع المناطق",
    //   icon: <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-green-600",
    //   onClick: () => {
    //     navigate('/management/regions-directory');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "دليل الأحياء",
    //   description: "قائمة بجميع الأحياء",
    //   icon: <MapPinned className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-purple-600",
    //   onClick: () => {
    //     navigate('/management/districts-directory');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "دليل الفروع",
    //   description: "قائمة بجميع الفروع",
    //   icon: <Building className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-indigo-600",
    //   onClick: () => {
    //     navigate('/management/branches-directory');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "دليل المستودعات",
    //   description: "قائمة بجميع المستودعات",
    //   icon: <Warehouse className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-orange-600",
    //   onClick: () => {
    //     navigate('/management/warehouses-directory');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "ربط المواقع",
    //   description: "ربط المحافظات بالمناطق والأحياء",
    //   icon: <MapPinned className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-cyan-600",
    //   onClick: () => {
    //     navigate('/management/link-locations');
    //     window.scrollTo(0, 0);
    //   }
    // }
  ];

  const driversManagementCards = [
    // {
    //   title: "دليل السائقين",
    //   description: "قائمة بجميع السائقين",
    //   icon: <Truck className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-cyan-600",
    //   onClick: () => {
    //     navigate('/management/drivers-directory');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "إضافة سائق",
    //   description: "تسجيل سائق جديد",
    //   icon: <Plus className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-blue-600",
    //   onClick: () => {
    //     navigate('/management/add-driver');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تعديل بيانات السائق",
    //   description: "تحديث معلومات السائقين",
    //   icon: <Edit className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-green-600",
    //   onClick: () => {
    //     navigate('/management/edit-driver');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "أهداف السائقين",
    //   description: "تحديد ومتابعة أهداف السائقين",
    //   icon: <Target className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-purple-600",
    //   onClick: () => {
    //     navigate('/management/driver-targets');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقييم السائقين",
    //   description: "تقييم أداء السائقين",
    //   icon: <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-orange-600",
    //   onClick: () => {
    //     navigate('/management/driver-evaluation');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "جدولة التوصيل",
    //   description: "جدولة مواعيد التوصيل للسائقين",
    //   icon: <Calendar className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-pink-600",
    //   onClick: () => {
    //     navigate('/management/delivery-schedule');
    //     window.scrollTo(0, 0);
    //   }
    // }
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
    
    const cardContent = (
      <Card 
        key={index}
        className={`group transition-all duration-300 ${
          isAllowed 
            ? 'hover:shadow-lg cursor-pointer hover:scale-105' 
            : 'opacity-50 cursor-not-allowed bg-gray-100'
        }`}
        onClick={isAllowed ? card.onClick : undefined}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center space-x-2 space-x-reverse">
            <div className={`p-1 sm:p-2 rounded-lg ${card.color} text-white flex items-center justify-center ${!isAllowed && 'grayscale'}`}>
              {card.icon}
            </div>
            <CardTitle className="text-xs sm:text-sm text-right">{card.title}</CardTitle>
          </div>
        </CardContent>
      </Card>
    );

    if (!isAllowed) {
      return (
        <Tooltip title="ليس لديك صلاحية للوصول إلى هذه الصفحة" placement="top">
          {cardContent}
        </Tooltip>
      );
    }

    return cardContent;
  };

  return (
    <div className="w-full p-4 sm:p-6 space-y-8 min-h-screen" dir="rtl">
      {/* Header */}
      <Helmet>
        <title>إدارة المخرجات | ERP90 Dashboard</title>
        <meta name="description" content="إدارة المخرجات والمستودعات والطلبات والتوصيل ERP90 Dashboard" />
        <meta name="keywords" content="ERP, مستودعات, طلبات, توصيل, سائقين, فروع, مناطق, Warehouse, Orders, Delivery, Drivers" />
      </Helmet>

      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
              <Warehouse className="h-8 w-8 text-orange-600 dark:text-orange-300" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">إدارة المخرجات</h1>
              <p className="text-gray-600 dark:text-gray-400">إدارة المستودعات والطلبات والتوصيل والسائقين</p>
            </div>
          </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <Warehouse className="text-orange-600 dark:text-orange-300 w-6 h-6" />
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
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-orange-400 to-red-500"></div>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المخرجات" }, 
        ]}
      />

      {/* الإعدادات Section */}
      <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">الإعدادات</h2>
            <p className="text-sm sm:text-base text-gray-600">إعدادات المستودعات والمواقع والسائقين</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {settingsCards.map((card, index) => (
            <CardComponent key={`settings-${index}`} card={card} index={index} />
          ))}
        </div>
      </div>

      {/* العمليات Section */}
      <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-green-100 rounded-lg">
            <Package className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">العمليات</h2>
            <p className="text-sm sm:text-base text-gray-600">عمليات الطلبات والتوصيل اليومية</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {operationsCards.map((card, index) => (
            <CardComponent key={`operations-${index}`} card={card} index={index} />
          ))}
        </div>
      </div>

      {/* التقارير Section */}
      <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-purple-100 rounded-lg">
            <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">التقارير</h2>
            <p className="text-sm sm:text-base text-gray-600">تقارير المستودعات والسائقين والطلبات</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {reportsCards.map((card, index) => (
            <CardComponent key={`reports-${index}`} card={card} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default OutputsManagement;

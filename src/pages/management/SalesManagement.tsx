import React, { useState, useEffect } from 'react';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { Select as AntdSelect } from 'antd';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Breadcrumb from "@/components/Breadcrumb";
import { Helmet } from "react-helmet";

import { 
  Settings, 
  FileText, 
  TreePine, 
  Calendar, 
  Clock, 
  Target, 
  CreditCard, 
  Wallet, 
  DollarSign,
  Calculator,
  BookOpen,
  TrendingUp,
  BarChart3,
  PiggyBank,
  Receipt,
  ArrowUpCircle,
  ArrowDownCircle,
  FileBarChart,
  Users,
  Building,
  UserCheck,
  ClipboardList,
  Package,
  TrendingDown,
  ShoppingCart,
  Plus,
  FileCheck,
  UserCog,
  Crown,
  ShoppingBag,
  UserPlus,
  Phone,
  Mail,
  MapPin,
  Star,
  Tag,
  Percent,
  Gift,
  Truck,
  CreditCardIcon,
  QrCode,
  PieChart,
  Eye,
  Edit,
  Trash2,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUpIcon,
  DollarSignIcon
} from 'lucide-react';

const SalesManagement: React.FC = () => {
  // السنة المالية
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
  const navigate = useNavigate();

  const settingsCards = [
    {
      title: "باقات أسعار خاصة",
      description: "إدارة باقات الأسعار الخاصة للعملاء",
      icon: <Tag className="h-6 w-6" />,
      color: "bg-yellow-500",
      onClick: () => {
        navigate('/management/special-price-packages');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "الخصومات والعروض",
      description: "إدارة نظام الخصومات والعروض",
      icon: <Percent className="h-6 w-6" />,
      color: "bg-red-500",
      onClick: () => {
        navigate('/management/discounts-offers');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "إضافة حسابات مبيعات",
      description: "إضافة حسابات مبيعات جديدة",
      icon: <Plus className="h-6 w-6" />,
      color: "bg-blue-500",
      onClick: () => {
        navigate('/management/add-sales-accounts');
        window.scrollTo(0, 0);
      }
    },

    
    {
      title: "إعدادات الضرائب",
      description: "إعدادات نظام الضرائب",
      icon: <DollarSignIcon className="h-6 w-6" />,
      color: "bg-gray-500",
      onClick: () => {
        navigate('/management/tax-settings');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تكلفة المبيعات",
      description: "إدارة وتحديث تكلفة المبيعات",
      icon: <Calculator className="h-6 w-6" />,
      color: "bg-teal-500",
      onClick: () => {
        navigate('/management/sales-cost');
        window.scrollTo(0, 0);
      }
    },
    // {
    //   title: "إدارة العملاء",
    //   description: "إضافة وتعديل بيانات العملاء",
    //   icon: <Users className="h-6 w-6" />,
    //   color: "bg-blue-500",
    //   onClick: () => {
    //     navigate('/customers');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "فئات العملاء",
    //   description: "تصنيف العملاء حسب النوع والأهمية",
    //   icon: <Star className="h-6 w-6" />,
    //   color: "bg-yellow-500"
    // },
    // {
    //   title: "إدارة المنتجات",
    //   description: "إضافة وتعديل المنتجات والخدمات",
    //   icon: <Package className="h-6 w-6" />,
    //   color: "bg-green-500"
    // },
    // {
    //   title: "فئات المنتجات",
    //   description: "تصنيف المنتجات والخدمات",
    //   icon: <Tag className="h-6 w-6" />,
    //   color: "bg-purple-500"
    // },
    // {
    //   title: "قوائم الأسعار",
    //   description: "إدارة أسعار المنتجات والخدمات",
    //   icon: <DollarSign className="h-6 w-6" />,
    //   color: "bg-emerald-500"
    // },
    // {
    //   title: "الخصومات والعروض",
    //   description: "إدارة نظام الخصومات والعروض",
    //   icon: <Percent className="h-6 w-6" />,
    //   color: "bg-red-500"
    // },
    // {
    //   title: "نقاط الولاء",
    //   description: "برنامج نقاط الولاء للعملاء",
    //   icon: <Gift className="h-6 w-6" />,
    //   color: "bg-pink-500"
    // },
    // {
    //   title: "طرق الدفع",
    //   description: "إعداد طرق الدفع المختلفة",
    //   icon: <CreditCard className="h-6 w-6" />,
    //   color: "bg-indigo-500"
    // },
    // {
    //   title: "طرق الشحن",
    //   description: "إدارة طرق الشحن والتوصيل",
    //   icon: <Truck className="h-6 w-6" />,
    //   color: "bg-orange-500"
    // },
    // {
    //   title: "إدارة المندوبين",
    //   description: "إضافة وإدارة مندوبي المبيعات",
    //   icon: <UserCog className="h-6 w-6" />,
    //   color: "bg-cyan-500",
    //   onClick: () => {
    //     navigate('/management/sales-representatives');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "أهداف المبيعات",
    //   description: "تحديد ومتابعة أهداف المندوبين",
    //   icon: <Target className="h-6 w-6" />,
    //   color: "bg-teal-500",
    //   onClick: () => {
    //     navigate('/management/sales-targets');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "عمولات المبيعات",
    //   description: "حساب وإدارة عمولات المندوبين",
    //   icon: <Crown className="h-6 w-6" />,
    //   color: "bg-amber-500",
    //   onClick: () => {
    //     navigate('/management/sales-commissions');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "تقييم الأداء",
    //   description: "تقييم أداء مندوبي المبيعات",
    //   icon: <BarChart3 className="h-6 w-6" />,
    //   color: "bg-violet-500",
    //   onClick: () => {
    //     navigate('/management/performance-evaluation');
    //     window.scrollTo(0, 0);
    //   }
    // },
    // {
    //   title: "إعدادات عامة",
    //   description: "الإعدادات العامة لنظام المبيعات",
    //   icon: <Settings className="h-6 w-6" />,
    //   color: "bg-gray-500"
    // }
  ];

  const operationsCards = [
    {
      title: "فاتورة مبيعات",
      description: "إنشاء فواتير المبيعات الجديدة",
      icon: <FileText className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-blue-600",
      onClick: () => {
        navigate('/management/sale');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "عرض أسعار",
      description: "إعداد عروض الأسعار للعملاء",
      icon: <FileCheck className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-green-600",
      onClick: () => {
        navigate('/stores/quotations');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "أمر بيع",
      description: "إصدار أوامر البيع للعملاء",
      icon: <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-emerald-600",
      onClick: () => {
        navigate('/stores/sales-order');
        window.scrollTo(0, 0);
      }
    },
        {
      title: "مجموعة الأسعار",
      description: "إدارة مجموعات الأسعار للمنتجات والخدمات",
      icon: <DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />, 
      color: "bg-yellow-600",
      onClick: () => {
        navigate('/stores/price-lists');
        window.scrollTo(0, 0);
      }
    },
    // {
    //   title: "إذن بيع",
    //   description: "إصدار أذونات البيع والتسليم",
    //   icon: <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6" />,
    //   color: "bg-emerald-600"
    // },
    {
      title: "مرتجع مبيعات",
      description: "معالجة مرتجعات المبيعات",
      icon: <ArrowDownCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
     color: "bg-blue-600",
      onClick: () => {
        navigate('/stores/sales-return');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تعديل فاتورة مبيعات",
      description: "تعديل وإدارة فواتير المبيعات الموجودة",
      icon: <Edit className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-green-600",
      onClick: () => {
        navigate('/stores/edit-sales-invoice');
        window.scrollTo(0, 0);
      }
    },
 
    {
      title: "دليل سندات القبض",
      description: "عرض جميع سندات القبض المسجلة",
      icon: <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />, 
      color: "bg-indigo-600",
      onClick: () => {
        navigate('/management/receipt-vouchers-directory');
        window.scrollTo(0, 0);
      }
    },
    // {
    //   title: "طلب شراء",
    //   description: "طلبات الشراء من العملاء",
    //   icon: <ShoppingCart className="h-6 w-6" />,
    //   color: "bg-teal-600"
    // },
    // {
    //   title: "فاتورة مرتجع",
    //   description: "إصدار فواتير المرتجعات",
    //   icon: <RefreshCw className="h-6 w-6" />,
    //   color: "bg-orange-600"
    // },
    // {
    //   title: "نقطة البيع",
    //   description: "نظام نقطة البيع السريع",
    //   icon: <QrCode className="h-6 w-6" />,
    //   color: "bg-indigo-600"
    // }
  ];

  const reportsCards = [
    {
      title: "تقارير فواتير المبيعات",
      description: "تقرير شامل بجميع فواتير المبيعات",
      icon: <FileText className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-blue-700",
      onClick: () => {
        navigate('/reports/invoice');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقارير المبيعات اليومية",
      description: "مبيعات اليوم والفترة الحالية",
      icon: <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-green-700",
      onClick: () => {
        navigate('/reports/daily-sales');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقارير أرباح الفواتير",
      description: "تقرير أرباح فواتير المبيعات",
      icon: <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-emerald-700",
      onClick: () => {
        navigate('/reports/invoice-profits');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقرير فواتير المبيعات التفصيلي",
      description: "تقرير تفصيلي لجميع فواتير المبيعات",
      icon: <FileBarChart className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-purple-700",
      onClick: () => {
        navigate('/reports/invoice-preferred');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقرير الأصناف المباعة",
      description: "تقرير مفصل عن الأصناف المباعة خلال فترة محددة",
      icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" />, 
      color: "bg-orange-700",
      onClick: () => {
        navigate('/reports/sold-items');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "مبيعات الفروع",
      description: "تقرير مبيعات الفروع خلال فترة محددة",
      icon: <Building className="h-5 w-5 sm:h-6 sm:w-6" />, 
      color: "bg-cyan-700",
      onClick: () => {
        navigate('/reports/branch-sales');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقرير مبيعات بائع",
      description: "تقرير مفصل عن مبيعات كل مندوب خلال فترة محددة",
      icon: <UserCog className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-pink-700",
      onClick: () => {
        navigate('/reports/sales-representative-sales');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقرير أسعار الأصناف",
      description: "تقرير مفصل بأسعار جميع الأصناف",
      icon: <Tag className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-lime-700",
      onClick: () => {
        navigate('/reports/item-prices');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقرير الأصناف المباعة حسب الفئة",
      description: "تقرير مفصل عن الأصناف المباعة لكل فئة خلال فترة محددة",
      icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" />, 
      color: "bg-orange-800",
      onClick: () => {
        navigate('/reports/sold-items-by-category');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقرير الأصناف المباعة حسب التصنيف",
      description: "تقرير مفصل عن الأصناف المباعة لكل تصنيف خلال فترة محددة",
      icon: <Package className="h-5 w-5 sm:h-6 sm:w-6" />, 
      color: "bg-orange-900",
      onClick: () => {
        navigate('/reports/sold-items-by-type');
        window.scrollTo(0, 0);
      }
    },
  ];

  const customerManagementCards = [
    {
      title: "إضافة عميل جديد",
      description: "تسجيل عميل جديد في النظام",
      icon: <UserPlus className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-blue-600",
      onClick: () => {
        navigate('/customers/add');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تعديل بيانات العميل",
      description: "تحديث معلومات العملاء الحاليين",
      icon: <Edit className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-green-600",
      onClick: () => {
        navigate('/customers/directory');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "دليل العملاء",
      description: "قائمة شاملة بجميع العملاء",
      icon: <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-purple-600",
      onClick: () => {
        navigate('/customers/directory');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تفعيل/إلغاء العميل",
      description: "إدارة حالة العملاء النشطة",
      icon: <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-emerald-600",
      onClick: () => {
        navigate('/customers/status');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تصنيف العملاء",
      description: "تصنيف العملاء حسب النوع والقيمة",
      icon: <Star className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-yellow-600",
      onClick: () => {
        navigate('/customers/classification');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "متابعة العملاء",
      description: "متابعة وتقييم العملاء",
      icon: <Eye className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-indigo-600",
      onClick: () => {
        navigate('/customers/follow-up');
        window.scrollTo(0, 0);
      }
    }
  ];

  const salesTeamCards = [
    {
      title: "إدارة المندوبين",
      description: "إدارة فريق المبيعات والمندوبين",
      icon: <UserCog className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-purple-600",
      onClick: () => {
        navigate('/management/sales-representatives');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "أهداف المبيعات",
      description: "تحديد ومتابعة أهداف المبيعات",
      icon: <Target className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-orange-600",
      onClick: () => {
        navigate('/management/sales-targets');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "عمولات المبيعات",
      description: "حساب وإدارة عمولات المندوبين",
      icon: <Crown className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-amber-600",
      onClick: () => {
        navigate('/management/sales-commissions');
        window.scrollTo(0, 0);
      }
    },
    {
      title: "تقييم الأداء",
      description: "تقييم أداء فريق المبيعات",
      icon: <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6" />,
      color: "bg-teal-600",
      onClick: () => {
        navigate('/management/performance-evaluation');
        window.scrollTo(0, 0);
      }
    }
  ];

  interface CardType {
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    onClick?: () => void;
  }

  const CardComponent = ({ card, index }: { card: CardType, index: number }) => {
    return (
      <Card 
        key={index}
        className="group hover:shadow-lg transition-all duration-300 cursor-pointer hover:scale-105"
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
              <title>إدارة المبيعات | ERP90 Dashboard</title>
              <meta name="description" content="إدارة المبيعات والعملاء وفريق المبيعات ERP90 Dashboard" />
              <meta name="keywords" content="ERP, فواتير, مبيعات, تقرير, عملاء, ضريبة, طباعة, Sales, Invoice, Report, Tax, Customer" />
            </Helmet>

            <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <ShoppingBag className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">ادارة المبيعات</h1>
          <p className="text-gray-600 dark:text-gray-400">ادارة المبيعات والعملاء وفريق المبيعات</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
              <ShoppingBag className="text-purple-600 dark:text-purple-300 w-6 h-6" />
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
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
          { label: "إدارة المبيعات" }, 
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
            <p className="text-sm sm:text-base text-gray-600">إعدادات نظام المبيعات والعملاء</p>
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
            <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">العمليات</h2>
            <p className="text-sm sm:text-base text-gray-600">عمليات المبيعات والفواتير اليومية</p>
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
            <p className="text-sm sm:text-base text-gray-600">تقارير المبيعات والعملاء الشاملة</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {reportsCards.map((card, index) => (
            <CardComponent key={`reports-${index}`} card={card} index={index} />
          ))}
        </div>
      </div>

      {/* إدارة العملاء Section */}
      <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">إدارة العملاء</h2>
            <p className="text-sm sm:text-base text-gray-600">إدارة بيانات ومعلومات العملاء</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {customerManagementCards.map((card, index) => (
            <CardComponent key={`customer-management-${index}`} card={card} index={index} />
          ))}
        </div>
      </div>

      {/* فريق المبيعات Section */}
      <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-3 space-x-reverse">
          <div className="p-2 bg-purple-100 rounded-lg">
            <UserCog className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
          </div>
          <div>
            <h2 className="text-lg sm:text-2xl font-semibold text-gray-800">فريق المبيعات</h2>
            <p className="text-sm sm:text-base text-gray-600">إدارة فريق المبيعات والأهداف</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {salesTeamCards.map((card, index) => (
            <CardComponent key={`sales-team-${index}`} card={card} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SalesManagement;
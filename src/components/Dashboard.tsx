import { useEffect } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { motion, useAnimation } from 'framer-motion';
import { 
  Users, FileText, ShoppingCart, Settings,
  CreditCard, Package, Truck, ArrowRight,
  Building2, Wrench
} from 'lucide-react';
import { useSidebar } from '../hooks/useSidebar';
import { useFinancialYear } from "@/hooks/useFinancialYear";
import { SectionType } from '../contexts/SidebarContext';
import { Calendar } from 'lucide-react';
import { Select as AntdSelect } from 'antd';
import Breadcrumb from './Breadcrumb';
import DeliveryCard from '@/pages/delivery/DeliveryCard';

const ERP90Dashboard = () => {
  // السنة المالية من السياق العام
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
  const { setCurrentSection } = useSidebar();
  const controls = useAnimation();

  // ربط الروابط بأقسام القائمة الجانبية
  const routeToSectionMap: Record<string, SectionType> = {
    '/management/financial': 'financial',
    '/management/hr': 'hr',
    '/management/warehouse': 'warehouse',
    '/management/projects': 'projects',
    '/management/sales': 'sales',
    '/management/purchase': 'purchase',
    '/management/installation': 'equipment',
    '/management/outputs': 'delivery',
  };

  const handleQuickActionClick = (route: string) => {
    const section = routeToSectionMap[route] || 'default';
    setCurrentSection(section);
    navigate(route);
  };

  const quickActions = [
    { title: "الإدارة المالية", icon: <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />, color: "bg-gradient-to-br from-blue-500 to-blue-600", hoverColor: "hover:from-blue-600 hover:to-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200", description: "إدارة الحسابات والميزانيات", route: "/management/financial" },
    { title: "الموارد البشرية", icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />, color: "bg-gradient-to-br from-emerald-500 to-emerald-600", hoverColor: "hover:from-emerald-600 hover:to-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", description: "إدارة الموظفين والرواتب", route: "/management/hr" },
    { title: "إدارة المخازن", icon: <Package className="w-4 h-4 sm:w-5 sm:h-5" />, color: "bg-gradient-to-br from-orange-500 to-orange-600", hoverColor: "hover:from-orange-600 hover:to-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200", description: "إدارة المخزون والمستودعات", route: "/management/warehouse" },
    { title: "إدارة المشاريع", icon: <FileText className="w-4 h-4 sm:w-5 sm:h-5" />, color: "bg-gradient-to-br from-purple-500 to-purple-600", hoverColor: "hover:from-purple-600 hover:to-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-200", description: "متابعة وإدارة المشاريع", route: "/management/projects" },
    { title: "إدارة المبيعات والعملاء", icon: <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />, color: "bg-gradient-to-br from-rose-500 to-rose-600", hoverColor: "hover:from-rose-600 hover:to-rose-700", bgColor: "bg-rose-50", borderColor: "border-rose-200", description: "إدارة العملاء والمبيعات", route: "/management/sales" },
    { title: "إدارة المشتريات والموردين", icon: <Truck className="w-4 h-4 sm:w-5 sm:h-5" />, color: "bg-gradient-to-br from-teal-500 to-teal-600", hoverColor: "hover:from-teal-600 hover:to-teal-700", bgColor: "bg-teal-50", borderColor: "border-teal-200", description: "إدارة الموردين والمشتريات", route: "/management/purchase" },
  ];

  useEffect(() => {
    controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    });
    AOS.init({ duration: 700, once: true });
    
    setCurrentSection('default');
  }, [controls, setCurrentSection]);

  return (
    <div className="min-h-screen bg-gray-50 rtl" dir="rtl">
      {/* Main Content */}
      <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-8xl mx-auto">
        {/* Page Title */}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={controls}
          className="mb-6 md:mb-8"
          data-aos="fade-up"
        >
      <div className="p-6 font-['Tajawal'] bg-white dark:bg-gray-800 mb-6 rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.1)] relative overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
          <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-300" />
        </div>
        <div className="flex flex-col ">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">مرحبًا بك في ERP90</h1>
          <p className="text-gray-600 dark:text-gray-400">اختر الخدمة التي تريد الوصول إليها</p>
        </div>
      </div>
          
          {/* السنة المالية Dropdown */}
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
            <span className="flex items-center gap-2">
            <Calendar className="text-purple-600 dark:text-purple-300 w-6 h-6" />
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
 
        </motion.div>
                               <Breadcrumb
        items={[
          { label: "الرئيسية", to: "/" },
        ]}
      />
        {/* Quick Actions */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={controls}
          transition={{ delay: 0.3 }}
          className="mb-6 md:mb-8"
          data-aos="fade-up"
        >
          <div className="bg-white p-4 sm:p-5 md:p-6 rounded-xl shadow-sm border border-gray-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
              {quickActions.map((action, index) => (
                <motion.button
                  key={index}
                  disabled={action.route !== '/management/installation'}
                  onClick={() => action.route === '/management/installation' && handleQuickActionClick(action.route)}
                  className={`flex flex-col items-center justify-center text-center gap-3 sm:gap-4 p-4 sm:p-6 md:p-8 rounded-2xl border-2 ${action.borderColor} ${action.bgColor} transition-all duration-300 group relative overflow-hidden min-h-[150px] sm:min-h-[180px] ${action.route === '/management/installation' ? 'cursor-pointer hover:shadow-xl hover:scale-105' : 'cursor-not-allowed opacity-50'}`}
                >
                  {/* Background Pattern */}
                  <div className="absolute inset-0 opacity-5 transition-opacity">
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-current transform translate-x-6 -translate-y-6"></div>
                    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-current transform -translate-x-4 translate-y-4"></div>
                  </div>
                  
                  {/* Icon */}
                  <div 
                    className={`${action.color} p-3 sm:p-4 rounded-2xl text-white shadow-lg transition-all duration-300 relative z-10`}
                  >
                    {action.icon}
                  </div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 mb-1 sm:mb-2 transition-colors leading-tight">
                      {action.title}
                    </h3>
                    <p className="text-xs md:text-sm text-gray-600 leading-relaxed transition-colors">
                      {action.description}
                    </p>
                  </div>
                </motion.button>
              ))}
              
              {/* Outputs Card - قبل التركيب */}
              <DeliveryCard onClick={() => handleQuickActionClick('/management/outputs')} />
              
              {/* التركيب والصيانة Card */}
              <motion.button
                onClick={() => handleQuickActionClick('/management/installation')}
                className="flex flex-col items-center justify-center text-center gap-3 sm:gap-4 p-4 sm:p-6 md:p-8 rounded-2xl border-2 border-indigo-200 bg-indigo-50 transition-all duration-300 group relative overflow-hidden min-h-[150px] sm:min-h-[180px] cursor-pointer hover:shadow-xl hover:scale-105"
              >
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 transition-opacity">
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-current transform translate-x-6 -translate-y-6"></div>
                  <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-current transform -translate-x-4 translate-y-4"></div>
                </div>
                
                {/* Icon */}
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-3 sm:p-4 rounded-2xl text-white shadow-lg transition-all duration-300 relative z-10">
                  <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                
                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 mb-1 sm:mb-2 transition-colors leading-tight">
                    التركيب والصيانة
                  </h3>
                  <p className="text-xs md:text-sm text-gray-600 leading-relaxed transition-colors">
                    إدارة أعمال التركيب والصيانة
                  </p>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default ERP90Dashboard;
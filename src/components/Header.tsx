import { LogOut, Menu, X, Calendar, Search, Bell, User, Settings, HelpCircle, Sun, Moon, PieChart } from "lucide-react";
import MobileSidebar from "./MobileSidebar";
import SafeAvatar from "./SafeAvatar";
import { BiSolidBadgeCheck } from "react-icons/bi";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select as AntdSelect } from 'antd';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/utils/utils";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/useAuth";
import { db } from "@/services/firebase";
import { getDocs, collection, query, where } from "firebase/firestore";
import { getActiveFinancialYears, FinancialYear } from '@/services/financialYearsService';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useFinancialYear } from "@/hooks/useFinancialYear";

interface HeaderProps {
  onLogout: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  companyName?: string;
  className?: string;
}

const Header = ({
  onLogout,
  onToggleSidebar,
  isSidebarCollapsed,
  companyName,
  className,
}: HeaderProps) => {
  const { user: userData } = useAuth();
  const navigate = useNavigate();
  const isDesktop = !useIsMobile();
  const [scrolled, setScrolled] = useState(false);
  
  // بيانات المستخدم من localStorage
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    username: string;
    fullName: string;
    position: string;
    branchName?: string;
    warehouseName?: string;
    permissions?: string[];
  } | null>(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
      } catch (error) {
        console.error('Error parsing user from localStorage:', error);
      }
    }
    
    // الاستماع لتحديثات localStorage
    const handleStorageChange = () => {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          setCurrentUser(JSON.parse(storedUser));
        } catch (error) {
          console.error('Error parsing user:', error);
        }
      } else {
        setCurrentUser(null);
      }
    };
    
    window.addEventListener('localStorageUpdated', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('localStorageUpdated', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);
  
  // استخدام السياق للسنة المالية
  const { 
    currentFinancialYear, 
    activeYears, 
    setCurrentFinancialYear 
  } = useFinancialYear();
  
  const [fiscalYear, setFiscalYear] = useState<string>("");
  
  // مزامنة السنة المالية مع السياق
  useEffect(() => {
    if (currentFinancialYear) {
      setFiscalYear(currentFinancialYear.year.toString());
    }
    console.log('السنة المالية الحالية:', currentFinancialYear);
    console.log('جميع السنوات المالية النشطة:', activeYears);
  }, [currentFinancialYear, activeYears]);

  // تحديث السنة المالية في السياق عند التغيير
  const handleFiscalYearChange = (value: string) => {
    setFiscalYear(value);
    const selectedYear = activeYears.find(y => y.year.toString() === value);
    if (selectedYear) {
      setCurrentFinancialYear(selectedYear);
    }
  };
  const [taxRate, setTaxRate] = useState<string>("");
  const [todayInvoices, setTodayInvoices] = useState<number>(0);
  const [todayRevenue, setTodayRevenue] = useState<number>(0);
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const companyQuery = query(collection(db, "companies"));
        const companySnapshot = await getDocs(companyQuery);
        if (!companySnapshot.empty) {
          const docData = companySnapshot.docs[0].data();
          setLogoUrl(docData.logoUrl || "");
        }
      } catch (error) {
        console.error("Error fetching company logo:", error);
      }
    };
    fetchLogo();
  }, []);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch company settings (معدل لتجنب التداخل مع السياق)
        const companyQuery = query(collection(db, "companies"));
        const companySnapshot = await getDocs(companyQuery);
        
        if (!companySnapshot.empty) {
          const docData = companySnapshot.docs[0].data();
          // إزالة setFiscalYear لأنه يدار بواسطة السياق الآن
          setTaxRate(docData.taxRate || "");
        }

        // Fetch today's invoices and revenue
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const invoicesQuery = query(
          collection(db, "sales_invoices"),
          where("date", ">=", today),
          where("date", "<", tomorrow)
        );
        const invoicesSnapshot = await getDocs(invoicesQuery);
        setTodayInvoices(invoicesSnapshot.size);
        
        // Calculate today's revenue
        let revenue = 0;
        invoicesSnapshot.forEach(doc => {
          revenue += doc.data().total || 0;
        });
        setTodayRevenue(revenue);

        // Fetch unread notifications
        const notificationsQuery = query(
          collection(db, "notifications"),
          where("read", "==", false)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        setUnreadNotifications(notificationsSnapshot.size);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleMobileSearch = () => {
    setShowMobileSearch(!showMobileSearch);
  };

  const markNotificationsAsRead = async () => {
    // Implement notification marking logic here
    setUnreadNotifications(0);
  };

  const formatCurrency = (amount: number) => {
    // تحويل الأرقام الإنجليزية إلى فارسية
    const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
    
    // تحويل الأرقام إلى فارسية
    const persianFormatted = formatted.replace(/\d/g, (digit) => persianDigits[parseInt(digit)]);
    return `${persianFormatted} ﷼`;
  };

  // دالة لعرض المنصب مع اسم الفرع أو المستودع
  const getPositionDisplay = () => {
    if (!currentUser) return "موظف";
    
    const { fullName, position, branchName, warehouseName } = currentUser;
    
    let displayText = fullName || "";
    
    if (position) {
      displayText += displayText ? ` - ${position}` : position;
      
      // إضافة اسم الفرع إذا كان مدير فرع
      if (position === 'مدير فرع' && branchName) {
        displayText += ` (${branchName})`;
      }
      // إضافة اسم المستودع إذا كان مدير مستودع
      else if (position === 'مدير مستودع' && warehouseName) {
        displayText += ` (${warehouseName})`;
      }
    }
    
    return displayText || "موظف";
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 transition-all duration-300 dark:bg-gray-900/95 dark:border-gray-800 w-full",
          scrolled ? "shadow-sm dark:shadow-gray-800/50" : "",
          className
        )}
      >
        <div className="w-full px-2 sm:px-4 mx-0">
          {/* Main Header Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4 w-full py-3 sm:py-4">
            {/* Left Section - Logo and (Mobile) Menu Icon */}
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
              {/* Mobile Menu Icon */}
              {!isDesktop && !showMobileSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  onClick={() => setShowMobileSidebar(true)}
                  aria-label="فتح القائمة الجانبية"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              {/* Logo and Company Name */}
              <motion.div 
                className="flex items-center gap-3 flex-1 sm:flex-none"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                  <div className="w-8 h-8 sm:w-[3.5rem] sm:h-10 rounded-lg flex items-center justify-center  flex-shrink-0 ">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="شعار الشركة"
                        width={60}
                        height={60}
                        className="object-contain rounded-md dark:brightness-90"
                        loading="eager"
                      />
                    ) : (
                      <PieChart className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div className="flex flex-col justify-center">
                    <h1 className="font-bold text-gray-900 dark:text-white text-right text-base sm:text-lg leading-tight">
                      نظام | ERP90
                    </h1>

                    {companyName && (
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-right truncate max-w-[120px] sm:max-w-[200px]">
                        {companyName}
                      </p>
                    )}
                  </div>
                </Link>
              </motion.div>
              {/* Mobile Actions */}
              {!isDesktop && (
                <div className="flex items-center gap-2">
                  {/* Search Toggle Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                    onClick={toggleMobileSearch}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  {/* User Avatar */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="h-10 w-10 p-0 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <SafeAvatar 
                          src="" 
                          alt={currentUser?.username || "مستخدم"}
                          name={currentUser?.username || "مستخدم"}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {currentUser?.username || "مستخدم"}
                          </p>
                          <p className="text-xs leading-none text-gray-500 dark:text-gray-400">
                            {getPositionDisplay()}
                          </p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/profile" className="w-full">
                          <User className="mr-2 h-4 w-4" />
                          الملف الشخصي
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to="/settings" className="w-full">
                          <Settings className="mr-2 h-4 w-4" />
                          الإعدادات
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        تسجيل الخروج
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            {/* Middle Section - Search (Desktop) - Disabled */}
            {isDesktop && (
              <motion.div 
                className="flex-1 max-w-xl mx-4 relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الفواتير، العملاء، المنتجات..."
                  className="w-full text-right"
                  disabled
                  style={{
                    direction: 'rtl',
                    textAlign: 'right',
                    cursor: 'not-allowed',
                    opacity: 0.6
                  }}
                />
              </motion.div>
            )}
            {/* Right Section - User and Actions */}
            <div className={`hidden sm:flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end ${showMobileSearch ? '!flex' : ''}`}>
              {/* Financial Information */}
              {isDesktop && (
                <motion.div 
                  className="hidden md:flex items-center gap-4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {/* Today's Revenue */}
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                        <PieChart className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        {isLoading ? (
                          <Skeleton className="h-5 w-20" />
                        ) : (
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-300">
                            {formatCurrency(todayRevenue)}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs font-medium">
                      إيرادات اليوم
                    </TooltipContent>
                  </Tooltip>
                  {/* Today's Invoices */}
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 rounded-lg">
                        <PieChart className="h-4 w-4 text-green-600 dark:text-green-300" />
                        {isLoading ? (
                          <Skeleton className="h-5 w-8" />
                        ) : (
                          <span className="text-sm font-medium text-green-600 dark:text-green-300">
                            {todayInvoices}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs font-medium">
                      فواتير اليوم
                    </TooltipContent>
                  </Tooltip>
                  {/* Fiscal Year Dropdown */}
                  <Tooltip delayDuration={300}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                        <Calendar className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                        {isLoading ? (
                          <Skeleton className="h-5 w-16" />
                        ) : (
                          <AntdSelect
                            value={fiscalYear}
                            onChange={handleFiscalYearChange}
                            style={{ width: 100, background: 'transparent' }}
                            popupClassName="text-right"
                            size="small"
                            variant="borderless"
                            placeholder="السنة المالية"
                          >
                            {activeYears.map(y => (
                              <AntdSelect.Option key={y.id} value={y.year.toString()}>{y.year}</AntdSelect.Option>
                            ))}
                          </AntdSelect>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs font-medium">
                      السنة المالية
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              )}
              {/* Actions */}
              <motion.div 
                className="flex items-center gap-1 sm:gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {/* Notifications Button */}
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      onClick={markNotificationsAsRead}
                    >
                      <span className="relative">
                        <Bell className="h-5 w-5" />
                        {unreadNotifications > 0 && (
                          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] flex items-center justify-center border-2 border-white dark:border-gray-900 z-10">
                            {unreadNotifications}
                          </span>
                        )}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs font-medium">
                    إشعارات
                  </TooltipContent>
                </Tooltip>
                {/* User Name (Desktop) */}
                {isDesktop && (
                  <div className="flex items-center gap-4 mx-3">
                  <div className="flex flex-col items-end">
                    <span className="font-normal text-gray-900 dark:text-white flex items-center gap-1">
                      {currentUser?.username || "مستخدم"}
                      <BiSolidBadgeCheck className="text-blue-500" />
                    </span>
                    <span className="text-xs text-blue-500 dark:text-blue-300 mt-0">
                      {getPositionDisplay()}
                    </span>
                  </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <div className="flex items-center cursor-pointer relative">
                          <SafeAvatar 
                            src="" 
                            alt={currentUser?.username || "مستخدم"}
                            name={currentUser?.username || "مستخدم"}
                          />
                          {/* Badge for notifications */}
                          {unreadNotifications > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[18px] flex items-center justify-center border-2 border-white dark:border-gray-900">
                              {unreadNotifications}
                            </span>
                          )}
                          <svg className="w-4 h-4 mr-2 text-gray-500 dark:text-gray-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-44" align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/profile"
                            className="w-full flex items-center transition-colors"
                            style={{ '--tw-bg-opacity': '1' } as React.CSSProperties}
                            onMouseOver={e => {
                              e.currentTarget.style.backgroundColor = '#DBEAFE';
                            }}
                            onMouseOut={e => {
                              e.currentTarget.style.backgroundColor = '';
                            }}
                          >
                            <User className="mr-2 h-4 w-4" />
                            الملف الشخصي
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={onLogout} className="text-red-600 dark:text-red-400">
                          <LogOut className="mr-2 h-4 w-4" />
                          تسجيل الخروج
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
          {/* Mobile Search Bar (shown when activated) - Disabled */}
          <AnimatePresence>
            {!isDesktop && showMobileSearch && (
              <motion.div 
                className="pb-3 px-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في الفواتير، العملاء..."
                  className="w-full text-right"
                  disabled
                  autoFocus
                  style={{
                    direction: 'rtl',
                    textAlign: 'right',
                    cursor: 'not-allowed',
                    opacity: 0.6
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
      {/* Mobile Sidebar Overlay خارج الهيدر */}
      {!isDesktop && (
        <MobileSidebar open={showMobileSidebar} onClose={() => setShowMobileSidebar(false)} />
      )}
    </>
  );
};

export default Header;
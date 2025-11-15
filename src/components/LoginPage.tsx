import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, User, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Select } from 'antd';
import { collection, getDocs } from 'firebase/firestore';

const { Option } = Select;

interface LoginPageProps {
  onLogin: () => void;
}

interface SystemUser {
  id: string;
  originalId?: string; // المعرف الأصلي لمستخدمي التركيب
  username: string;
  fullName: string;
  password: string;
  position: string;
  branchId?: string;
  branchName?: string;
  warehouseId?: string;
  warehouseName?: string;
  permissions?: string[];
  accessType?: string;
  userType?: 'delivery' | 'installation';
  financialYearId?: string;
  financialYear?: number; // رقم السنة المالية
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [password, setPassword] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [inputFocus, setInputFocus] = useState({
    user: false,
    password: false
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true);
        
        console.log('🚀 Starting to fetch users...');
        
        // جلب مستخدمي التوصيل من مجموعة users
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const deliveryUsers = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          username: doc.data().username,
          fullName: doc.data().fullName,
          password: doc.data().password,
          position: doc.data().position,
          branchId: doc.data().branchId,
          branchName: doc.data().branchName,
          warehouseId: doc.data().warehouseId,
          warehouseName: doc.data().warehouseName,
          permissions: doc.data().permissions,
          accessType: doc.data().accessType || 'delivery',
          userType: 'delivery' // تمييز نوع المستخدم
        })) as SystemUser[];
        
        console.log(`✅ Loaded ${deliveryUsers.length} delivery users`);

        // جلب السنوات المالية النشطة فقط للوصول إلى مستخدمي التركيب
        console.log('📅 Fetching financial years...');
        const financialYearsSnapshot = await getDocs(collection(db, 'financialYears')); // تغيير من financial_years إلى financialYears
        console.log(`📊 Found ${financialYearsSnapshot.size} financial years`);
        
        const installationUsers: SystemUser[] = [];
        const installationUserIds = new Set<string>(); // لتجنب التكرار
        
        for (const yearDoc of financialYearsSnapshot.docs) {
          const yearData = yearDoc.data();
          
          console.log(`📋 Year ${yearData.year}:`, {
            id: yearDoc.id,
            activeStatus: yearData.activeStatus,
            startDate: yearData.startDate,
            endDate: yearData.endDate
          });
          
          // فقط السنوات المالية النشطة
          if (yearData.activeStatus !== 'نشطة') {
            console.log(`⏭️ Skipping inactive year: ${yearData.year}`);
            continue;
          }
          
          console.log(`🔍 Checking financial year: ${yearData.year} (${yearDoc.id})`);
          
          try {
            const installationUsersPath = `financialYears/${yearDoc.id}/installation_users`; // تغيير من financial_years
            console.log(`📂 Path: ${installationUsersPath}`);
            
            const installationUsersSnapshot = await getDocs(
              collection(db, installationUsersPath)
            );
            
            console.log(`📋 Found ${installationUsersSnapshot.size} installation users in year ${yearData.year}`);
            
            if (installationUsersSnapshot.size > 0) {
              installationUsersSnapshot.docs.forEach(doc => {
                console.log(`👤 User document:`, doc.id, doc.data());
                
                const userId = `${doc.id}-${yearDoc.id}`; // معرف فريد يجمع بين ID المستخدم والسنة
                
                // تجنب التكرار
                if (!installationUserIds.has(userId)) {
                  installationUserIds.add(userId);
                  
                  const userData = {
                    id: userId, // استخدام المعرف الفريد
                    originalId: doc.id, // حفظ المعرف الأصلي
                    username: doc.data().username,
                    fullName: doc.data().fullName,
                    password: doc.data().password,
                    position: doc.data().position,
                    branchId: doc.data().branchId,
                    permissions: doc.data().permissions,
                    accessType: doc.data().accessType || 'installation',
                    userType: 'installation' as const,
                    financialYearId: yearDoc.id,
                    financialYear: yearData.year
                  };
                  
                  installationUsers.push(userData);
                  console.log(`✅ Added installation user: ${userData.fullName} (${userData.position})`);
                }
              });
            } else {
              console.log(`⚠️ No users found in ${installationUsersPath}`);
            }
          } catch (error) {
            console.error(`❌ Error loading users from year ${yearData.year}:`, error);
          }
        }

        // دمج المستخدمين
        const allUsers = [...deliveryUsers, ...installationUsers];
        setUsers(allUsers);
        
        console.log('📊 Total users loaded:', allUsers.length);
        console.log('🚚 Delivery users:', deliveryUsers.length);
        console.log('🔧 Installation users:', installationUsers.length);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('خطأ في تحميل المستخدمين');
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        onLogin();
      }
    });
    
    return () => {
      window.removeEventListener("resize", handleResize);
      unsubscribe();
    };
  }, [onLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      toast.error('يرجى اختيار المستخدم');
      return;
    }

    if (!password) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setLoading(true);
    
    try {
      const user = users.find(u => u.id === selectedUser);
      
      if (!user) {
        toast.error('المستخدم غير موجود');
        setLoading(false);
        return;
      }

      if (user.password === password) {
        toast.success('تم تسجيل الدخول بنجاح!');
        
        const userData = {
          id: user.originalId || user.id, // استخدام المعرف الأصلي لمستخدمي التركيب
          username: user.username,
          fullName: user.fullName,
          position: user.position,
          branchId: user.branchId,
          branchName: user.branchName,
          warehouseId: user.warehouseId,
          warehouseName: user.warehouseName,
          permissions: user.permissions || [],
          accessType: user.accessType,
          userType: user.userType,
          financialYearId: user.financialYearId
        };
        
        console.log('💾 Saving user to localStorage:', userData);
        console.log('👤 User type:', user.userType);
        console.log('📅 Financial year:', user.financialYear);
        
        localStorage.setItem('currentUser', JSON.stringify(userData));
        
        // إطلاق حدث مخصص لإعلام المكونات الأخرى بتحديث localStorage
        window.dispatchEvent(new Event('localStorageUpdated'));
        
        onLogin();
      } else {
        toast.error('كلمة المرور غير صحيحة');
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('حدث خطأ أثناء تسجيل الدخول');
      setLoading(false);
    }
  };

  return (
    <div 
      className={`min-h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center rtl ${isMobile ? 'p-0' : 'p-4'}`}
      dir="rtl"
    >
      <div className="container mx-auto flex items-center justify-center flex-row-reverse">
        {!isMobile && (
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="hidden md:flex w-1/2 items-center justify-center p-8"
          >
            <div className="relative w-full h-[32rem] rounded-2xl overflow-hidden bg-white shadow-[0_24px_32px_-12px_rgba(0,0,0,0.18)]">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <div className="w-full h-full">
                  <img 
                    src="/logo.png" 
                    alt="شعار" 
                    className="w-full h-full object-contain"
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className={isMobile ? 'w-full flex items-center justify-center p-0 min-h-screen' : 'w-1/2 flex items-center justify-center p-4 md:p-8 min-h-screen'}
          style={{ minHeight: '100vh' }}
        >
          <Card
            className={isMobile ? 'w-full relative z-10 shadow-2xl border-0 bg-white/95 backdrop-blur-md rounded-2xl py-6' : 'w-full max-w-md relative z-10 shadow-xl border-0 bg-white/95 backdrop-blur-sm'}
          >
            <CardHeader className={isMobile ? 'text-center space-y-3 pb-2' : 'text-center space-y-4'}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <CardTitle className="text-2xl font-bold text-gray-800 font-arabic tracking-tight">
                  مرحباً بعودتك
                </CardTitle>
                <CardDescription className="text-gray-500 font-arabic mt-2">
                  سجل الدخول للوصول إلى لوحة التحكم الخاصة بك
                </CardDescription>
              </motion.div>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className={isMobile ? 'space-y-5' : 'space-y-6'}>
                <div className={isMobile ? 'space-y-1.5' : 'space-y-2'}>
                  <Label htmlFor="user" className={isMobile ? 'font-arabic font-medium text-gray-700 text-base' : 'font-arabic font-medium text-gray-700'}>
                    اختر المستخدم
                  </Label>
                  <Select
                    id="user"
                    placeholder="اختر اسم المستخدم"
                    value={selectedUser || undefined}
                    onChange={(value) => setSelectedUser(value)}
                    loading={loadingUsers}
                    className="w-full"
                    style={{
                      height: isMobile ? '48px' : '44px',
                    }}
                    popupMatchSelectWidth={true}
                    showSearch
                    optionFilterProp="children"
                  >
                    {users.map(user => (
                      <Option key={user.id} value={user.id}>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{user.fullName}</span>
                            {user.userType && (
                              <span 
                                className={`text-xs px-2 py-0.5 rounded ${
                                  user.userType === 'installation' 
                                    ? 'bg-amber-100 text-amber-700' 
                                    : 'bg-violet-100 text-violet-700'
                                }`}
                              >
                                {user.userType === 'installation' ? 'تركيب' : 'توصيل'}
                              </span>
                            )}
                            {user.financialYear && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {user.financialYear}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{user.position}</span>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </div>
                
                <div className={isMobile ? 'space-y-1.5' : 'space-y-2'}>
                  <Label htmlFor="password" className={isMobile ? 'font-arabic font-medium text-gray-700 text-base' : 'font-arabic font-medium text-gray-700'}>
                    كلمة المرور
                  </Label>
                  <motion.div
                    animate={{
                      borderColor: inputFocus.password ? '#6366f1' : '#d1d5db',
                      boxShadow: inputFocus.password ? '0 4px 24px 0 rgba(99,102,241,0.10)' : '0 1px 4px 0 rgba(0,0,0,0.04)',
                      backgroundColor: inputFocus.password ? 'rgba(243,244,255,0.7)' : 'rgba(255,255,255,0.7)'
                    }}
                    transition={{ duration: 0.25 }}
                    className="relative rounded-xl border-2 flex items-center transition-all duration-200"
                  >
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="كلمة المرور"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setInputFocus({...inputFocus, password: true})}
                      onBlur={() => setInputFocus({...inputFocus, password: false})}
                      className={isMobile ? 'pr-10 pl-10 font-arabic border-none bg-transparent focus:ring-0 text-base py-3 rounded-xl transition-all duration-200' : 'pr-10 pl-10 font-arabic border-none bg-transparent focus:ring-0 transition-all duration-200'}
                      required
                      style={{ boxShadow: 'none', outline: 'none' }}
                    />
                    <motion.span
                      animate={{ color: inputFocus.password ? '#6366f1' : '#a3a3a3' }}
                      transition={{ duration: 0.2 }}
                      className={isMobile ? 'absolute right-3 top-1/2 -translate-y-1/2' : 'absolute right-3 top-1/2 -translate-y-1/2'}
                    >
                      <Lock className="w-4 h-4" />
                    </motion.span>
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      animate={{ color: showPassword ? '#6366f1' : (inputFocus.password ? '#6366f1' : '#a3a3a3') }}
                      transition={{ duration: 0.2 }}
                      className={isMobile ? 'absolute left-3 top-1/2 -translate-y-1/2 hover:text-indigo-600 transition-colors' : 'absolute left-3 top-1/2 -translate-y-1/2 hover:text-indigo-600 transition-colors'}
                      aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      style={{ background: 'none', border: 'none', padding: 0 }}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </motion.button>
                  </motion.div>
                </div>
                
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className={isMobile ? 'w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white font-arabic font-medium text-base py-4 shadow-lg hover:shadow-xl transition-all rounded-lg' : 'w-full bg-gradient-to-r from-indigo-600 to-blue-500 hover:from-indigo-700 hover:to-blue-600 text-white font-arabic font-medium text-lg py-6 shadow-md hover:shadow-lg transition-all'}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        جاري تسجيل الدخول
                      </>
                    ) : "تسجيل الدخول"}
                  </Button>
                </motion.div>
              </form>
            </CardContent>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="text-center pb-4"
            >
              <p className="text-xs text-gray-400 font-arabic">
                © {new Date().getFullYear()} كودكسا. جميع الحقوق محفوظة.
              </p>
            </motion.div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;

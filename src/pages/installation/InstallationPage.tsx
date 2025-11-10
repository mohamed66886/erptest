import { motion } from "framer-motion";
import { Wrench, Construction, Clock, ArrowRight, ClipboardList, Calendar, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "@/components/Breadcrumb";

const InstallationPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 rtl" dir="rtl">
      <main className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "الرئيسية", to: "/" },
            { label: "التركيب والصيانة", to: "/management/installation" },
          ]}
        />

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center min-h-[70vh]"
        >
          {/* Icon Container */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ 
              delay: 0.2, 
              type: "spring", 
              stiffness: 200, 
              damping: 15 
            }}
            className="relative mb-8"
          >
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full blur-3xl opacity-20 scale-150"></div>
            
            {/* Main Icon Circle */}
            <div className="relative bg-gradient-to-br from-indigo-500 to-indigo-600 p-8 rounded-full shadow-2xl">
              <Wrench className="w-20 h-20 text-white" strokeWidth={1.5} />
              
              {/* Floating Icons */}
              <motion.div
                animate={{ 
                  y: [0, -10, 0],
                  rotate: [0, 5, 0]
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  ease: "easeInOut" 
                }}
                className="absolute -top-2 -right-2 bg-white p-2 rounded-full shadow-lg"
              >
                <Construction className="w-6 h-6 text-indigo-600" />
              </motion.div>
              
              <motion.div
                animate={{ 
                  y: [0, 10, 0],
                  rotate: [0, -5, 0]
                }}
                transition={{ 
                  duration: 2.5, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: 0.3
                }}
                className="absolute -bottom-2 -left-2 bg-white p-2 rounded-full shadow-lg"
              >
                <Clock className="w-6 h-6 text-purple-600" />
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-bold text-gray-800 mb-4 text-center"
          >
            التركيب والصيانة
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="h-1 w-12 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"></div>
            <p className="text-xl md:text-2xl text-gray-600 font-medium">
              تحت الإنشاء
            </p>
            <div className="h-1 w-12 bg-gradient-to-l from-indigo-500 to-purple-500 rounded-full"></div>
          </motion.div>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-gray-600 text-center max-w-2xl mb-8 text-lg leading-relaxed px-4"
          >
            نعمل حالياً على تطوير نظام شامل لإدارة عمليات التركيب والصيانة.
            <br />
            سيتضمن النظام إدارة الطلبات، جدولة الفنيين، متابعة الأعمال، والتقارير التفصيلية.
          </motion.p>

          {/* Features Coming Soon */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 w-full max-w-4xl px-4"
          >
            {[
              { title: "إدارة طلبات التركيب", icon: ClipboardList, color: "text-blue-600", bgColor: "bg-blue-100" },
              { title: "جدولة الصيانة الدورية", icon: Calendar, color: "text-green-600", bgColor: "bg-green-100" },
              { title: "تقارير الأداء", icon: BarChart3, color: "text-purple-600", bgColor: "bg-purple-100" },
            ].map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center hover:shadow-md transition-shadow"
                >
                  <div className={`${feature.bgColor} w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <IconComponent className={`w-8 h-8 ${feature.color}`} />
                  </div>
                  <p className="text-gray-700 font-medium">{feature.title}</p>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Back Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            onClick={() => navigate("/")}
            className="group flex items-center gap-3 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <span className="text-lg font-medium">العودة للرئيسية</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.button>

          {/* Progress Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-12 flex items-center gap-2"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5]
                  }}
                  transition={{ 
                    duration: 1.5, 
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                  className="w-2 h-2 bg-indigo-500 rounded-full"
                />
              ))}
            </div>
            <span className="text-sm text-gray-500 mr-2">جاري العمل على التطوير</span>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
};

export default InstallationPage;

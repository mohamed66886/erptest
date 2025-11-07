import { motion } from 'framer-motion';
import { TrendingDown, ArrowUpRight } from 'lucide-react';

interface OutputsCardProps {
  onClick?: () => void;
}

const OutputsCard = ({ onClick }: OutputsCardProps) => {
  return (
    <motion.button
      whileHover={{ y: -8, scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="flex flex-col items-center justify-center text-center gap-3 sm:gap-4 p-4 sm:p-6 md:p-8 rounded-2xl border-2 border-red-200 bg-red-50 hover:shadow-xl transition-all duration-300 group relative overflow-hidden min-h-[150px] sm:min-h-[180px] cursor-pointer"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity">
        <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-current transform translate-x-6 -translate-y-6"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-current transform -translate-x-4 translate-y-4"></div>
      </div>
      
      {/* Icon */}
      <motion.div 
        whileHover={{ rotate: 10, scale: 1.15 }}
        className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 p-3 sm:p-4 rounded-2xl text-white shadow-lg group-hover:shadow-xl transition-all duration-300 relative z-10"
      >
        <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
      </motion.div>
      
      {/* Content */}
      <div className="relative z-10">
        <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-800 mb-1 sm:mb-2 group-hover:text-gray-900 transition-colors leading-tight">
          المخرجات
        </h3>
        <p className="text-xs md:text-sm text-gray-600 leading-relaxed group-hover:text-gray-700 transition-colors">
          إدارة ومتابعة المخرجات
        </p>
      </div>
      
      {/* Arrow */}
      <motion.div 
        className="absolute bottom-3 sm:bottom-4 left-1/2 transform -translate-x-1/2"
        whileHover={{ y: -2 }}
      >
        <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
      </motion.div>
    </motion.button>
  );
};

export default OutputsCard;

import React from 'react';
import { 
  FaHome, FaCog, FaExchangeAlt, FaChartBar, FaFileInvoiceDollar, 
  FaUndo, FaFileInvoice, FaUndoAlt, FaWarehouse, FaBoxes, FaCubes, 
  FaUsers, FaUserTie, FaUserFriends, FaUserCheck, FaUserShield, 
  FaBuilding, FaMoneyCheckAlt, FaSlidersH, FaServer, FaCloudUploadAlt, 
  FaQuestionCircle, FaTasks, FaWallet, FaChartPie, FaMoneyBillWave,
  FaCalculator, FaProjectDiagram, FaClipboardList, FaCalendarAlt,
  FaShoppingCart, FaFileContract, FaHandshake, FaGavel,
  FaCog as FaGear, FaWrench, FaIndustry, FaFileAlt
} from "react-icons/fa";
import { SectionType } from '../contexts/SidebarContext';

export interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path?: string;
  hasSubmenu?: boolean;
  submenu?: MenuItem[];
}

export interface SidebarMenus {
  [key: string]: MenuItem[];
}

// دالة لتحديد القسم بناءً على URL بشكل مفصل أكثر
export const getSectionFromPath = (pathname: string): SectionType => {
  // فحص المسارات المختلفة وتحديد القسم المناسب
  if (pathname.startsWith('/financial') || 
      pathname.includes('accounts') ||
      pathname.includes('balance-sheet') ||
      pathname.includes('income-statement') ||
      pathname.includes('cash-flow')) {
    return 'financial';
  }
  
  if (pathname.startsWith('/hr') || 
      pathname.includes('employees') ||
      pathname.includes('payroll') ||
      pathname.includes('attendance')) {
    return 'hr';
  }
  
  if (pathname.startsWith('/warehouse') || 
      pathname.startsWith('/stores') ||
      pathname.includes('inventory') ||
      pathname.includes('items') ||
      pathname.includes('stock')) {
    return 'warehouse';
  }
  
  if (pathname.startsWith('/projects') ||
      pathname.includes('tasks') ||
      pathname.includes('milestones')) {
    return 'projects';
  }
  
  if (pathname.startsWith('/sales') ||
      pathname.includes('invoices') && pathname.includes('sales') ||
      pathname.includes('customers') ||
      pathname.includes('quotations')) {
    return 'sales';
  }
  
  if (pathname.startsWith('/purchase') ||
      pathname.includes('suppliers') ||
      pathname.includes('purchases')) {
    return 'purchase';
  }
  
  if (pathname.startsWith('/contracts') ||
      pathname.includes('tenders')) {
    return 'contracts';
  }
  
  if (pathname.startsWith('/equipment') ||
      pathname.includes('maintenance') ||
      pathname.includes('production')) {
    return 'equipment';
  }
  
  if (pathname.startsWith('/management/outputs') ||
      pathname.startsWith('/management/governorates') ||
      pathname.startsWith('/management/regions') ||
      pathname.startsWith('/management/districts') ||
      pathname.startsWith('/management/drivers') ||
      pathname.startsWith('/management/branch-status') ||
      pathname.startsWith('/management/delivery-warehouses') ||
      pathname.startsWith('/management/link-branches') ||
      pathname.startsWith('/management/delivery-settings') ||
      pathname.startsWith('/management/delivery-orders') ||
      pathname.startsWith('/management/confirm-orders') ||
      pathname.startsWith('/management/completed-orders') ||
      pathname.startsWith('/management/archived-orders') ||
      pathname.startsWith('/reports/comprehensive-reports')) {
    return 'outputs';
  }
  
  return 'default';
};

export const getSidebarMenus = (section: SectionType): MenuItem[] => {
  const commonItems = [
    { label: "الصفحة الرئيسية", icon: React.createElement(FaHome), path: "/" }
  ];

  switch (section) {
    case 'financial':
      return [
        ...commonItems,
        { 
          label: "الحسابات المالية", 
          icon: React.createElement(FaWallet, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "دليل الحسابات", icon: React.createElement(FaFileAlt), path: "/financial/accounts" },
            { label: "حسابات العملاء", icon: React.createElement(FaUsers), path: "/financial/customers-accounts" },
            { label: "حسابات الموردين", icon: React.createElement(FaUserTie), path: "/financial/suppliers-accounts" },
            { label: "الخزائن والبنوك", icon: React.createElement(FaBuilding), path: "/financial/treasuries" }
          ]
        },
        { 
          label: "العمليات المالية", 
          icon: React.createElement(FaMoneyBillWave, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "قيد يومية", icon: React.createElement(FaFileInvoiceDollar), path: "/financial/daily-entry" },
            { label: "قيد تسوية", icon: React.createElement(FaCalculator), path: "/financial/adjustment" },
            { label: "قيد إقفال", icon: React.createElement(FaFileInvoice), path: "/financial/closing" },
            { label: "سندات قبض", icon: React.createElement(FaMoneyCheckAlt), path: "/financial/receipts" },
            { label: "سندات صرف", icon: React.createElement(FaMoneyBillWave), path: "/financial/payments" }
          ]
        },
        { 
          label: "التقارير المالية", 
          icon: React.createElement(FaChartPie, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "الميزان العمومي", icon: React.createElement(FaChartBar), path: "/financial/balance-sheet" },
            { label: "قائمة الدخل", icon: React.createElement(FaChartPie), path: "/financial/income-statement" },
            { label: "قائمة التدفقات النقدية", icon: React.createElement(FaMoneyBillWave), path: "/financial/cash-flow" },
            { label: "كشف حساب", icon: React.createElement(FaFileInvoice), path: "/financial/account-statement" }
          ]
        }
      ];

    case 'hr':
      return [
        ...commonItems,
        { 
          label: "إدارة الموظفين", 
          icon: React.createElement(FaUserTie, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "بيانات الموظفين", icon: React.createElement(FaUsers), path: "/hr/employees" },
            { label: "الأقسام والوظائف", icon: React.createElement(FaBuilding), path: "/hr/departments" },
            { label: "الحضور والانصراف", icon: React.createElement(FaCalendarAlt), path: "/hr/attendance" },
            { label: "الإجازات", icon: React.createElement(FaCalendarAlt), path: "/hr/leaves" }
          ]
        },
        { 
          label: "الرواتب والمكافآت", 
          icon: React.createElement(FaMoneyBillWave, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "إعداد الرواتب", icon: React.createElement(FaCalculator), path: "/hr/salary-setup" },
            { label: "صرف الرواتب", icon: React.createElement(FaMoneyCheckAlt), path: "/hr/payroll" },
            { label: "البدلات والخصومات", icon: React.createElement(FaMoneyBillWave), path: "/hr/allowances" },
            { label: "المكافآت والحوافز", icon: React.createElement(FaFileInvoiceDollar), path: "/hr/bonuses" }
          ]
        },
        { 
          label: "تقارير الموارد البشرية", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقرير الحضور", icon: React.createElement(FaCalendarAlt), path: "/hr/attendance-report" },
            { label: "تقرير الرواتب", icon: React.createElement(FaMoneyBillWave), path: "/hr/payroll-report" },
            { label: "تقرير الإجازات", icon: React.createElement(FaFileAlt), path: "/hr/leaves-report" }
          ]
        }
      ];

      return [
        ...commonItems,
        { 
          label: "إدارة المخازن", 
          icon: React.createElement(FaWarehouse, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "المخازن", icon: React.createElement(FaWarehouse), path: "/warehouse/stores" },
            { label: "إدارة المخازن المتقدمة", icon: React.createElement(FaWarehouse), path: "/stores/advanced-warehouse" },
            { label: "الأصناف", icon: React.createElement(FaBoxes), path: "/warehouse/items" },
            { label: "المخزون", icon: React.createElement(FaCubes), path: "/warehouse/inventory" },
            { label: "حركة المخزون", icon: React.createElement(FaExchangeAlt), path: "/warehouse/movements" }
          ]
        },
        { 
          label: "عمليات المخزون", 
          icon: React.createElement(FaExchangeAlt, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "أذن إدخال", icon: React.createElement(FaFileInvoice), path: "/warehouse/inward" },
            { label: "أذن إخراج", icon: React.createElement(FaFileInvoice), path: "/warehouse/outward" },
            { label: "تحويل بين المخازن", icon: React.createElement(FaExchangeAlt), path: "/warehouse/transfer" },
            { label: "جرد المخزون", icon: React.createElement(FaClipboardList), path: "/warehouse/stock-take" }
          ]
        },
        { 
          label: "تقارير المخازن", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقرير المخزون الحالي", icon: React.createElement(FaCubes), path: "/warehouse/current-stock" },
            { label: "تقرير حركة الأصناف", icon: React.createElement(FaExchangeAlt), path: "/warehouse/item-movements" },
            { label: "تقرير الأصناف الناقصة", icon: React.createElement(FaBoxes), path: "/warehouse/low-stock" }
          ]
        }
      ];

    case 'projects':
      return [
        ...commonItems,
        { 
          label: "إدارة المشاريع", 
          icon: React.createElement(FaProjectDiagram, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "المشاريع", icon: React.createElement(FaProjectDiagram), path: "/projects/list" },
            { label: "المهام", icon: React.createElement(FaTasks), path: "/projects/tasks" },
            { label: "الموارد", icon: React.createElement(FaUsers), path: "/projects/resources" },
            { label: "الجدول الزمني", icon: React.createElement(FaCalendarAlt), path: "/projects/timeline" }
          ]
        },
        { 
          label: "متابعة المشاريع", 
          icon: React.createElement(FaClipboardList, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "حالة المشاريع", icon: React.createElement(FaClipboardList), path: "/projects/status" },
            { label: "المراحل المنجزة", icon: React.createElement(FaCalendarAlt), path: "/projects/milestones" },
            { label: "التكاليف والميزانية", icon: React.createElement(FaMoneyBillWave), path: "/projects/budget" }
          ]
        },
        { 
          label: "تقارير المشاريع", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقرير أداء المشاريع", icon: React.createElement(FaChartPie), path: "/projects/performance" },
            { label: "تقرير التكاليف", icon: React.createElement(FaMoneyBillWave), path: "/projects/costs" },
            { label: "تقرير الموارد", icon: React.createElement(FaUsers), path: "/projects/resources-report" }
          ]
        }
      ];

    case 'sales':
      return [
        ...commonItems,
        { 
          label: "الإعدادات", 
          icon: React.createElement(FaCog, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "إدارة العملاء", icon: React.createElement(FaUsers), path: "/customers" },
            { label: "فئات العملاء", icon: React.createElement(FaUserCheck), path: "/sales/customer-categories" },
            { label: "إدارة المنتجات", icon: React.createElement(FaBoxes), path: "/sales/products" },
            { label: "فئات المنتجات", icon: React.createElement(FaClipboardList), path: "/sales/product-categories" },
            { label: "قوائم الأسعار", icon: React.createElement(FaMoneyBillWave), path: "/sales/price-lists" },
            { label: "الخصومات والعروض", icon: React.createElement(FaFileAlt), path: "/sales/discounts" },
            { label: "نقاط الولاء", icon: React.createElement(FaUserFriends), path: "/sales/loyalty-points" },
            { label: "طرق الدفع", icon: React.createElement(FaMoneyCheckAlt), path: "/business/payment-methods" },
            { label: "طرق الشحن", icon: React.createElement(FaShoppingCart), path: "/sales/shipping-methods" },
            { label: "إعدادات عامة", icon: React.createElement(FaCog), path: "/sales/general-settings" }
          ]
        },
        { 
          label: "العمليات", 
          icon: React.createElement(FaShoppingCart, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "فاتورة مبيعات", icon: React.createElement(FaFileInvoiceDollar), path: "/stores/sales" },
            { label: "مرتجع مبيعات", icon: React.createElement(FaUndo), path: "/stores/sales-return" },
            { label: "سند قبض", icon: React.createElement(FaMoneyCheckAlt), path: "/sales/receipts" }
          ]
        },
        { 
          label: "التقارير", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقارير فواتير المبيعات", icon: React.createElement(FaFileInvoice), path: "/reports/invoice" },
            { label: "تقارير المبيعات اليومية", icon: React.createElement(FaChartBar), path: "/reports/daily-sales" },
            { label: "تقارير أرباح الفواتير", icon: React.createElement(FaMoneyBillWave), path: "/reports/invoice-profits" },
            { label: "تقرير فواتير المبيعات التفصيلي", icon: React.createElement(FaFileAlt), path: "/reports/invoice-preferred" }
          ]
        },
        { 
          label: "إدارة العملاء", 
          icon: React.createElement(FaUserFriends, { className: "text-indigo-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "إضافة عميل جديد", icon: React.createElement(FaUsers), path: "/customers/add" },
            { label: "تعديل بيانات العميل", icon: React.createElement(FaFileAlt), path: "/customers/directory" },
            { label: "دليل العملاء", icon: React.createElement(FaUserFriends), path: "/customers/directory" },
            { label: "تفعيل/إلغاء العميل", icon: React.createElement(FaUserCheck), path: "/customers/status" },
            { label: "تصنيف العملاء", icon: React.createElement(FaUserCheck), path: "/customers/classification" },
            { label: "متابعة العملاء", icon: React.createElement(FaClipboardList), path: "/customers/follow-up" }
          ]
        },
        { 
          label: "فريق المبيعات", 
          icon: React.createElement(FaUserTie, { className: "text-orange-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "إدارة المندوبين", icon: React.createElement(FaUserTie), path: "/sales/representatives" },
            { label: "أهداف المبيعات", icon: React.createElement(FaChartBar), path: "/sales/targets" },
            { label: "عمولات المبيعات", icon: React.createElement(FaMoneyBillWave), path: "/sales/commissions" },
            { label: "تقييم الأداء", icon: React.createElement(FaChartPie), path: "/sales/performance" }
          ]
        }
      ];

    case 'purchase':
      return [
        ...commonItems,
        { 
          label: "إدارة المشتريات", 
          icon: React.createElement(FaShoppingCart, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "فواتير المشتريات", icon: React.createElement(FaFileInvoice), path: "/purchase/invoices" },
            { label: "طلبات الشراء", icon: React.createElement(FaClipboardList), path: "/purchase/orders" },
            { label: "عروض الموردين", icon: React.createElement(FaFileAlt), path: "/purchase/supplier-quotes" },
            { label: "مرتجع المشتريات", icon: React.createElement(FaUndoAlt), path: "/purchase/returns" }
          ]
        },
        { 
          label: "إدارة الموردين", 
          icon: React.createElement(FaUserCheck, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "بيانات الموردين", icon: React.createElement(FaUserTie), path: "/purchase/suppliers" },
            { label: "كشف حساب مورد", icon: React.createElement(FaFileInvoice), path: "/purchase/supplier-statement" },
            { label: "تقييم الموردين", icon: React.createElement(FaChartBar), path: "/purchase/supplier-evaluation" }
          ]
        },
        { 
          label: "تقارير المشتريات", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقرير المشتريات", icon: React.createElement(FaFileInvoice), path: "/purchase/purchase-report" },
            { label: "تقرير الموردين", icon: React.createElement(FaUserTie), path: "/purchase/supplier-report" },
            { label: "تحليل المشتريات", icon: React.createElement(FaChartPie), path: "/purchase/analysis" }
          ]
        }
      ];

    case 'contracts':
      return [
        ...commonItems,
        { 
          label: "إدارة العقود", 
          icon: React.createElement(FaFileContract, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "العقود", icon: React.createElement(FaFileContract), path: "/contracts/list" },
            { label: "أنواع العقود", icon: React.createElement(FaFileAlt), path: "/contracts/types" },
            { label: "بنود العقود", icon: React.createElement(FaClipboardList), path: "/contracts/terms" },
            { label: "تجديد العقود", icon: React.createElement(FaUndo), path: "/contracts/renewals" }
          ]
        },
        { 
          label: "إدارة المناقصات", 
          icon: React.createElement(FaGavel, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "المناقصات", icon: React.createElement(FaGavel), path: "/contracts/tenders" },
            { label: "عروض المناقصات", icon: React.createElement(FaFileAlt), path: "/contracts/tender-offers" },
            { label: "تقييم العروض", icon: React.createElement(FaChartBar), path: "/contracts/offer-evaluation" }
          ]
        },
        { 
          label: "تقارير العقود", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقرير العقود", icon: React.createElement(FaFileContract), path: "/contracts/report" },
            { label: "العقود المنتهية", icon: React.createElement(FaCalendarAlt), path: "/contracts/expired" },
            { label: "العقود القريبة من الانتهاء", icon: React.createElement(FaCalendarAlt), path: "/contracts/expiring" }
          ]
        }
      ];

    case 'equipment':
      return [
        ...commonItems,
        { 
          label: "إدارة المعدات", 
          icon: React.createElement(FaGear, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "المعدات", icon: React.createElement(FaGear), path: "/equipment/list" },
            { label: "أنواع المعدات", icon: React.createElement(FaWrench), path: "/equipment/types" },
            { label: "مواقع المعدات", icon: React.createElement(FaBuilding), path: "/equipment/locations" },
            { label: "حالة المعدات", icon: React.createElement(FaClipboardList), path: "/equipment/status" }
          ]
        },
        { 
          label: "الصيانة والإصلاح", 
          icon: React.createElement(FaWrench, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "جدولة الصيانة", icon: React.createElement(FaCalendarAlt), path: "/equipment/maintenance-schedule" },
            { label: "أوامر العمل", icon: React.createElement(FaClipboardList), path: "/equipment/work-orders" },
            { label: "قطع الغيار", icon: React.createElement(FaBoxes), path: "/equipment/spare-parts" },
            { label: "تاريخ الصيانة", icon: React.createElement(FaFileAlt), path: "/equipment/maintenance-history" }
          ]
        },
        { 
          label: "الوحدات الإنتاجية", 
          icon: React.createElement(FaIndustry, { className: "text-orange-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "خطوط الإنتاج", icon: React.createElement(FaIndustry), path: "/equipment/production-lines" },
            { label: "أداء الإنتاج", icon: React.createElement(FaChartBar), path: "/equipment/production-performance" },
            { label: "التوقفات", icon: React.createElement(FaCalendarAlt), path: "/equipment/downtime" }
          ]
        },
        { 
          label: "تقارير المعدات", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "تقرير حالة المعدات", icon: React.createElement(FaGear), path: "/equipment/status-report" },
            { label: "تقرير الصيانة", icon: React.createElement(FaWrench), path: "/equipment/maintenance-report" },
            { label: "تقرير الإنتاجية", icon: React.createElement(FaChartPie), path: "/equipment/productivity-report" }
          ]
        }
      ];

    case 'outputs':
      return [
        ...commonItems,
        { 
          label: "الإعدادات", 
          icon: React.createElement(FaCog, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "إدارة المحافظات", icon: React.createElement(FaBuilding), path: "/management/governorates" },
            { label: "إدارة المناطق", icon: React.createElement(FaBuilding), path: "/management/regions" },
            { label: "إدارة الأحياء", icon: React.createElement(FaBuilding), path: "/management/districts" },
            { label: "إدارة السائقين", icon: React.createElement(FaUserTie), path: "/management/drivers" },
            { label: "حالة الفرع", icon: React.createElement(FaBuilding), path: "/management/branch-status" },
            { label: "مستودعات التوصيل", icon: React.createElement(FaWarehouse), path: "/management/delivery-warehouses" },
            { label: "ربط الفروع", icon: React.createElement(FaBuilding), path: "/management/link-branches" },
            { label: "إعدادات التوصيل", icon: React.createElement(FaCog), path: "/management/delivery-settings" },
            { label: "إدارة المستخدمين", icon: React.createElement(FaUsers), path: "/management/users" }
          ]
        },
        { 
          label: "العمليات", 
          icon: React.createElement(FaShoppingCart, { className: "text-green-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "الطلبات", icon: React.createElement(FaClipboardList), path: "/management/delivery-orders" },
            { label: "تأكيد الطلبات", icon: React.createElement(FaFileInvoice), path: "/management/confirm-orders" },
            { label: "الطلبات المكتملة", icon: React.createElement(FaBoxes), path: "/management/completed-orders" },
            { label: "الطلبات المؤرشفة", icon: React.createElement(FaFileAlt), path: "/management/archived-orders" }
          ]
        },
        { 
          label: "التقارير", 
          icon: React.createElement(FaChartBar, { className: "text-purple-500" }), 
          hasSubmenu: true,
          submenu: [
            { label: "التقارير الشاملة", icon: React.createElement(FaChartPie), path: "/reports/comprehensive-reports" }
          ]
        }
      ];

    default:
      return [
        ...commonItems,
        { 
          label: "الإعدادات الأساسية", 
          icon: React.createElement(FaCog, { className: "text-blue-500" }), 
          hasSubmenu: true,
          submenu: [
            // { label: "ادارة الفروع", icon: React.createElement(FaBuilding), path: "/business/branches" },
            // { label: "اداره طرق الدفع", icon: React.createElement(FaMoneyCheckAlt), path: "/business/payment-methods" },
            { label: "الاعدادات العامة", icon: React.createElement(FaSlidersH), path: "/settings" },
            // { label: "النظام", icon: React.createElement(FaServer), path: "/system" },
            // { label: "النسخ الاحطياطي", icon: React.createElement(FaCloudUploadAlt), path: "/backup" },
            { label: "الاسئله الشائعه", icon: React.createElement(FaQuestionCircle), path: "/help" }
          ]
        },
        
      ];
  }
};

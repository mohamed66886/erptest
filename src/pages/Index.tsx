import { useState, useEffect } from "react";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LoginPage from "@/components/LoginPage";
import DataCompletionPage from "@/components/DataCompletionPage";
import Dashboard from "@/components/Dashboard";
import ProfessionalLoader from "@/components/ProfessionalLoader";
import Sidebar from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import ProfilePage from "./ProfilePage";
import Header from "@/components/Header";
import Managers from "./admin/admins";
import PurchasesPage from "./stores/purchases";
import HelpPage from "./help";
import { Routes, Route } from "react-router-dom";
import DailySales from "./reports/daily-sales";
import PurchasesReturnPage from "./stores/purchases-return";
import EditSalesPage from "./edit/editsales";
import EditReturnPage from "./edit/edit-return";
import Stockpage from "./stores/stock";
import InvoiceProfitsReport from "./reports/invoice-profits";
import Footer from "@/components/Footer";
import InvoicePreferred from "./reports/invoice-preferred";
import CustomersPage from "./CustomersPage";
import Invoice from "./reports/invoice";
import SettingsPage from "./SettingsPage";
import ItemCardPage from "./stores/item";
import SalesPage from "./stores/sales";
import Quotations from "./stores/quotations";
import AddQuotationPage from "./stores/addquotations";
import EditQuotationPage from "./stores/EditQuotation";
import WarehouseManagementOld from "./stores/manage";
import AdvancedWarehouseManagement from "./stores/AdvancedWarehouseManagement";
import SalesReturnPage from "./stores/sales-return";
import SalesOrder from "./stores/sales-order";
import Branches from "./business/branches";
import PaymentMethodsPage from "./business/payment-methods";
import Suppliers from "./suppliers";
import NotFound from "./NotFound";
import { useAuth } from "@/contexts/useAuth";
import SalesRepresentativesManagement from "./management/SalesRepresentativesManagement";
import SalesTargetsPage from "./management/SalesTargetsPage";
import SalesCommissionsPage from "./management/SalesCommissionsPage";
import PerformanceEvaluationPage from "./management/PerformanceEvaluationPage";
import SpecialPricePackages from "./management/SpecialPricePackages";
import AddSpecialPricePackage from "./management/AddSpecialPricePackage";
import EditSpecialPricePackage from "./management/EditSpecialPricePackage";
import {
  FinancialManagement,
  HumanResources,
  ProjectManagement,
  SalesManagement,
  PurchaseManagement,
  EquipmentManagement,
  WarehouseManagement,
} from "../pages/management";

import { Player } from '@lottiefiles/react-lottie-player';
import IssueWarehousePage from "./warehouses/issue-warehouse";
import ListWarehouse from "./warehouses/ListWarehouse";
// Accounting Pages
import AccountsSettlementPage from "./accounting/AccountsSettlementPage";
import AddAccountPage from "./accounting/AddAccountPage";
import EditAccountPage from "./accounting/EditAccountPage";
import ChartOfAccountsPage from "./accounting/ChartOfAccountsPage";
import FinancialYearsPage from "./accounting/FinancialYearsPage";
import BankAccountsPage from "./accounting/BankAccountsPage";
import CashBoxesPage from "./management/CashBoxesPage";
import CostCentersPage from "./accounting/CostCentersPage";

// Customer Management Pages
import AddCustomerPage from "./customers/AddCustomerPage";
import CustomersDirectoryPage from "./customers/CustomersDirectoryPage";
import EditCustomerPage from "./customers/EditCustomerPage";
import ViewCustomerPage from "./customers/ViewCustomerPage";
import CustomerStatusPage from "./customers/CustomerStatusPage";
import CustomerClassificationPage from "./customers/CustomerClassificationPage";
import CustomerFollowUpPage from "./customers/CustomerFollowUpPage";
import SalesRepresentativesPage from "./management/SalesRepresentativesPageFixed";
import EditSalesInvoice from "./stores/EditSalesInvoicePage";
import EditSalesInvoiceDetailPage from "./stores/edit-sales-invoice-detail";
import ReceiptVoucher from "./stores/ReceiptVoucher";
import AddSalesOrderPage from "./stores/add-order-sales";
import ReceiptVouchersDirectory from "./stores/ReceiptVouchersDirectory";
import SoldItems from "./reports/sold-items";
import BranchSales from "./reports/branch-sales";
import SalesRepresentativeSales from "./reports/sales-representative-sales";
import DiscountsOffers from "./management/discounts-offers";
import AddDiscountOffer from "./management/discounts-offers/add";
type AppState = "login" | "data-completion" | "dashboard";

interface CompanyData {
  arabicName?: string;
  englishName?: string;
  [key: string]: unknown;
}

const Index = () => {
  const { user, loading } = useAuth();
  const [appState, setAppState] = useState<AppState>("login");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);

  useEffect(() => {
    const fetchCompany = async () => {
      setCompanyLoading(true);
      const q = collection(db, "companies");
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        setCompanyData(snapshot.docs[0].data());
        setAppState("dashboard");
      }
      setCompanyLoading(false);
    };
    fetchCompany();
  }, []);

  const handleLogin = () => {
    if (companyData) {
      setAppState("dashboard");
    } else {
      setAppState("data-completion");
    }
  };

  const handleDataCompletion = (data?: CompanyData) => {
    if (data) setCompanyData(data);
    setAppState("dashboard");
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
    setAppState("login");
    setSidebarCollapsed(false);
    setCompanyData(null);
  };

  if (loading || companyLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="flex flex-col items-center space-y-6">
          {/* رسمة تحميل محاسبية */}
          <div className="relative">
            <Player
              autoplay
              loop
              src="https://assets9.lottiefiles.com/packages/lf20_myejiggj.json"
              style={{ height: '200px', width: '200px' }}
              className="drop-shadow-lg"
            />
            {/* بديل CSS في حالة عدم عمل Lottie */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin opacity-50"></div>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 drop-shadow-lg">
            جاري تحميل النظام المحاسبي...
          </h2>
          <p className="text-gray-600 max-w-md text-center">
            يتم الآن تحميل البيانات المالية وتجهيز التقارير
          </p>
          <div className="w-64 bg-gray-300 rounded-full h-2 mt-4">
            <div 
              className="bg-blue-500 h-2 rounded-full animate-pulse" 
              style={{ width: '70%' }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (appState === "data-completion" && !companyData) {
    return <DataCompletionPage onComplete={data => handleDataCompletion(data)} />;
  }

  return (
    <div className="bg-background rtl" dir="rtl">
      <Header
        onLogout={handleLogout}
        onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        isSidebarCollapsed={sidebarCollapsed}
        companyName={companyData?.arabicName}
      />
      <div className="flex">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-y-auto min-h-screen">
          <main className="flex-1">
            <Routes>
            <Route path="/customers" element={<CustomersPage />} />

              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/stores/item" element={<ItemCardPage />} />
              <Route path="/management/sale" element={<SalesPage />} />
              <Route path="/stores/manage" element={<WarehouseManagementOld />} />
              <Route path="/stores/advanced-warehouse" element={<AdvancedWarehouseManagement />} />
              <Route path="/stores/sales-return" element={<SalesReturnPage />} />
              <Route path="/stores/edit-sales-invoice" element={<EditSalesInvoice />} />
              <Route path="/stores/edit-sales-invoice/:id" element={<EditSalesInvoiceDetailPage />} />
              <Route path="/stores/receipt-voucher" element={<ReceiptVoucher />} />
              <Route path="/management/receipt-vouchers-directory" element={<ReceiptVouchersDirectory />} />
              <Route path="/stores/quotations" element={<Quotations />} />
              <Route path="/stores/quotations/new" element={<AddQuotationPage />} />
              <Route path="/stores/quotations/edit/:id" element={<EditQuotationPage />} />
              <Route path="/business/branches" element={<Branches />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/stores/stock" element={<Stockpage />} />
              <Route path="/stores/purchases" element={<PurchasesPage />} />
              <Route path="/reports/invoice-profits" element={<InvoiceProfitsReport />} />
              <Route path="/stores/sales-order" element={<SalesOrder />} />
              <Route path="/reports/invoice-preferred" element={<InvoicePreferred />} />
              <Route path="/stores/purchases-return" element={<PurchasesReturnPage />} />
              <Route path="/stores/sales-order/new" element={<AddSalesOrderPage />} />

              <Route path="/edit/editsales" element={<EditSalesPage />} />
              {/* صفحة إدارة المخازن الجديدة */}
              <Route path="/management/warehouse" element={<WarehouseManagement />} />
              <Route path="/edit/edit-return/:id" element={<EditReturnPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/admin/admins" element={<Managers />} />
              <Route path="/business/payment-methods" element={<PaymentMethodsPage />} />
              <Route path="/reports/daily-sales" element={<DailySales />} />
              <Route path="/reports/invoice" element={<Invoice />} />
              <Route path="/reports/sold-items" element={<SoldItems />} />
              <Route path="/reports/branch-sales" element={<BranchSales />} />
              <Route path="/reports/sales-representative-sales" element={<SalesRepresentativeSales />} />
              
              {/* Management Routes */}
              <Route path="/management/financial" element={<FinancialManagement />} />
              <Route path="/management/hr" element={<HumanResources />} />
              <Route path="/management/warehouse" element={<WarehouseManagement />} />
              <Route path="/management/projects" element={<ProjectManagement />} />
              <Route path="/management/sales" element={<SalesManagement />} />
            <Route path="/management/special-price-packages" element={<SpecialPricePackages />} />
            <Route path="/management/sales/add-special-price-package" element={<AddSpecialPricePackage />} />
            <Route path="/management/sales/edit-special-price-package/:id" element={<EditSpecialPricePackage />} />
              <Route path="/management/sales-representatives" element={<SalesRepresentativesPage />} />
              <Route path="/management/sales-targets" element={<SalesTargetsPage />} />
              <Route path="/management/sales-commissions" element={<SalesCommissionsPage />} />
              <Route path="/management/performance-evaluation" element={<PerformanceEvaluationPage />} />
              <Route path="/management/purchase" element={<PurchaseManagement />} />
              <Route path="/management/equipment" element={<EquipmentManagement />} />
              <Route path="/management/discounts-offers" element={<DiscountsOffers />} />
              
              {/* Financial Management Sub-Routes */}
              <Route path="/accounting/accounts-settlement" element={<AccountsSettlementPage />} />
              <Route path="/accounting/add-account" element={<AddAccountPage />} />
              <Route path="/accounting/edit-account/:id" element={<EditAccountPage />} />
              <Route path="/accounting/chart-of-accounts" element={<ChartOfAccountsPage />} />
              <Route path="/accounting/financial-years" element={<FinancialYearsPage />} />
              <Route path="/accounting/bank-accounts" element={<BankAccountsPage />} />
              <Route path="/accounting/cash-boxes" element={<CashBoxesPage />} />
              <Route path="/accounting/cost-centers" element={<CostCentersPage />} />
              
              {/* Customer Management Routes */}
              <Route path="/customers/add" element={<AddCustomerPage />} />
              <Route path="/customers/directory" element={<CustomersDirectoryPage />} />
              <Route path="/customers/edit/:customerId" element={<EditCustomerPage />} />
              <Route path="/customers/view/:customerId" element={<ViewCustomerPage />} />
              <Route path="/customers/status" element={<CustomerStatusPage />} />
              <Route path="/customers/classification" element={<CustomerClassificationPage />} />
              <Route path="/customers/follow-up" element={<CustomerFollowUpPage />} />
              
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="*" element={<NotFound />} />

              {/* warehouse Management Routes */}
              <Route path="/warehouses/issue-warehouse" element={<IssueWarehousePage />} />
              <Route path="/warehouses/list-warehouse" element={<ListWarehouse />} />
              <Route path="/management/discounts-offers/add" element={<AddDiscountOffer />} />

            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </div>
  );
};

export default Index;
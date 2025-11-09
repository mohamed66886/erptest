import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthProvider";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { FinancialYearProvider } from "@/contexts/FinancialYearProvider";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
// import FloatingAvatarButton from "./components/FloatingAvatarButton";
import ScrollToTop from "./components/ScrollToTop";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import FirebaseTestPage from "./pages/accounting/FirebaseTestPage";
import FirebaseDirectTest from "./pages/accounting/FirebaseDirectTest";
import ViewOrder from "./pages/orders/ViewOrder";
import CompleteOrder from "./pages/orders/CompleteOrder";


const queryClient = new QueryClient();

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <HelmetProvider>
          <FinancialYearProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <SidebarProvider>
              <Routes>
                <Route path="/*" element={<Index />} />
                <Route path="/firebase-test" element={<FirebaseTestPage />} />
                <Route path="/firebase-direct" element={<FirebaseDirectTest />} />
                
                {/* صفحات الطلبات المنفصلة للسائقين */}
                <Route path="/orders/view" element={<ViewOrder />} />
                <Route path="/orders/complete" element={<CompleteOrder />} />
                
                {/* صفحة طباعة طلبات المستودع */}
     
                
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </SidebarProvider>
          </BrowserRouter>
         {/* <FloatingAvatarButton /> */}
        </FinancialYearProvider>
        </HelmetProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;

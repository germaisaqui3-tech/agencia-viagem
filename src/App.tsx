import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Packages from "./pages/Packages";
import Customers from "./pages/Customers";
import CustomerView from "./pages/CustomerView";
import CustomerEdit from "./pages/CustomerEdit";
import Orders from "./pages/Orders";
import OrderView from "./pages/OrderView";
import OrderEdit from "./pages/OrderEdit";
import Payments from "./pages/Payments";
import Birthdays from "./pages/Birthdays";
import Delinquency from "./pages/Delinquency";
import OrganizationSettings from "./pages/OrganizationSettings";
import CreateOrganization from "./pages/CreateOrganization";
import AcceptInvite from "./pages/AcceptInvite";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerView />} />
          <Route path="/customers/:id/edit" element={<CustomerEdit />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderView />} />
          <Route path="/orders/:id/edit" element={<OrderEdit />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/birthdays" element={<Birthdays />} />
          <Route path="/delinquency" element={<Delinquency />} />
          <Route path="/organization/settings" element={<OrganizationSettings />} />
          <Route path="/organization/create" element={<CreateOrganization />} />
          <Route path="/invite/:token" element={<AcceptInvite />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

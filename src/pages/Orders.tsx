import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, ShoppingCart, Pencil, Eye } from "lucide-react";
import { toast } from "sonner";
import { orderSchema } from "@/lib/validations";
import { z } from "zod";
import { FilterBar } from "@/components/filters/FilterBar";
import { SearchInput } from "@/components/filters/SearchInput";
import { DateRangeFilter } from "@/components/filters/DateRangeFilter";
import { StatusFilter } from "@/components/filters/StatusFilter";
import { ValueRangeFilter } from "@/components/filters/ValueRangeFilter";
import { QuickAddCustomer } from "@/components/orders/QuickAddCustomer";
import { QuickAddPackage } from "@/components/orders/QuickAddPackage";
import { useOrganization } from "@/hooks/useOrganization";

const Orders = () => {
  const navigate = useNavigate();
  const { organizationId, loading: orgLoading } = useOrganization();
  const [orders, setOrders] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [formData, setFormData] = useState({
    customer_id: "",
    package_id: "",
    number_of_travelers: "1",
    travel_date: "",
    special_requests: "",
  });
  const [editFormData, setEditFormData] = useState({
    customer_id: "",
    package_id: "",
    number_of_travelers: "1",
    travel_date: "",
    special_requests: "",
    status: "pending" as "pending" | "confirmed" | "completed" | "cancelled",
  });
  const [filters, setFilters] = useState({
    search: "",
    status: "all",
    dateStart: "",
    dateEnd: "",
    minValue: "",
    maxValue: "",
  });
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [addPackageOpen, setAddPackageOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const [ordersRes, customersRes, packagesRes] = await Promise.all([
      supabase
        .from("orders")
        .select("*, customers(full_name), travel_packages(name)")
        .eq("created_by", session.user.id)
        .order("created_at", { ascending: false }),
      supabase.from("customers").select("*").eq("created_by", session.user.id),
      supabase.from("travel_packages").select("*").eq("created_by", session.user.id),
    ]);

    if (ordersRes.error || customersRes.error || packagesRes.error) {
      toast.error("Erro ao carregar dados");
      return;
    }

    setOrders(ordersRes.data || []);
    setCustomers(customersRes.data || []);
    setPackages(packagesRes.data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate form data
      const validatedData = orderSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const selectedPackage = packages.find((p) => p.id === validatedData.package_id);
      if (!selectedPackage) {
        toast.error("Pacote selecionado não encontrado");
        setLoading(false);
        return;
      }

      if (!organizationId) {
        toast.error("Organização não encontrada");
        setLoading(false);
        return;
      }

      const totalAmount = Number(selectedPackage.price) * parseInt(validatedData.number_of_travelers);
      const orderNumber = `ORD-${Date.now()}`;

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([
          {
            order_number: orderNumber,
            customer_id: validatedData.customer_id,
            package_id: validatedData.package_id,
            number_of_travelers: parseInt(validatedData.number_of_travelers),
            total_amount: totalAmount,
            travel_date: validatedData.travel_date,
            special_requests: validatedData.special_requests,
            organization_id: organizationId,
            created_by: session.user.id,
          },
        ])
        .select()
        .single();

      if (orderError || !orderData) {
        toast.error("Erro ao criar pedido");
        setLoading(false);
        return;
      }

      // Criar pagamento automaticamente
      const { error: paymentError } = await supabase.from("payments").insert([
        {
          order_id: orderData.id,
          amount: totalAmount,
          due_date: validatedData.travel_date,
          status: "pending",
          organization_id: organizationId,
          created_by: session.user.id,
        },
      ]);

      if (paymentError) {
        toast.error("Pedido criado, mas erro ao criar pagamento");
        setLoading(false);
        return;
      }

      toast.success("Pedido e pagamento criados com sucesso!");
      setOpen(false);
      setFormData({
        customer_id: "",
        package_id: "",
        number_of_travelers: "1",
        travel_date: "",
        special_requests: "",
      });
      loadData();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error("Erro ao validar dados do formulário");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (order: any) => {
    setSelectedOrder(order);
    setEditFormData({
      customer_id: order.customer_id,
      package_id: order.package_id,
      number_of_travelers: order.number_of_travelers.toString(),
      travel_date: order.travel_date,
      special_requests: order.special_requests || "",
      status: order.status,
    });
    setEditOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !selectedOrder) return;

      const selectedPackage = packages.find((p) => p.id === editFormData.package_id);
      if (!selectedPackage) {
        toast.error("Pacote selecionado não encontrado");
        setLoading(false);
        return;
      }

      const totalAmount = Number(selectedPackage.price) * parseInt(editFormData.number_of_travelers);

      const { error } = await supabase
        .from("orders")
        .update({
          customer_id: editFormData.customer_id,
          package_id: editFormData.package_id,
          number_of_travelers: parseInt(editFormData.number_of_travelers),
          total_amount: totalAmount,
          travel_date: editFormData.travel_date,
          special_requests: editFormData.special_requests,
          status: editFormData.status,
        })
        .eq("id", selectedOrder.id)
        .eq("created_by", session.user.id);

      if (error) {
        toast.error("Erro ao atualizar pedido");
        setLoading(false);
        return;
      }

      toast.success("Pedido atualizado com sucesso!");
      setEditOpen(false);
      setSelectedOrder(null);
      loadData();
    } catch (error) {
      toast.error("Erro ao atualizar pedido");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "secondary",
      confirmed: "default",
      cancelled: "destructive",
      completed: "outline",
    };
    const labels: any = {
      pending: "Pendente",
      confirmed: "Confirmado",
      cancelled: "Cancelado",
      completed: "Concluído",
    };
    return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
  };

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        order.order_number?.toLowerCase().includes(searchLower) ||
        order.customers?.full_name?.toLowerCase().includes(searchLower) ||
        order.travel_packages?.name?.toLowerCase().includes(searchLower);

      const matchesStatus = filters.status === "all" || order.status === filters.status;

      const orderDate = new Date(order.travel_date);
      const matchesDateStart =
        !filters.dateStart || orderDate >= new Date(filters.dateStart);
      const matchesDateEnd =
        !filters.dateEnd || orderDate <= new Date(filters.dateEnd);

      const orderAmount = Number(order.total_amount);
      const matchesMinValue =
        !filters.minValue || orderAmount >= Number(filters.minValue);
      const matchesMaxValue =
        !filters.maxValue || orderAmount <= Number(filters.maxValue);

      return (
        matchesSearch &&
        matchesStatus &&
        matchesDateStart &&
        matchesDateEnd &&
        matchesMinValue &&
        matchesMaxValue
      );
    });
  }, [orders, filters]);

  const activeFiltersCount = Object.entries(filters).filter(
    ([key, value]) => value && value !== "all" && value !== ""
  ).length;

  const clearFilters = () => {
    setFilters({
      search: "",
      status: "all",
      dateStart: "",
      dateEnd: "",
      minValue: "",
      maxValue: "",
    });
  };

  const handleCustomerCreated = async (newCustomerId: string) => {
    await loadData();
    setFormData({ ...formData, customer_id: newCustomerId });
    setAddCustomerOpen(false);
  };

  const handlePackageCreated = async (newPackageId: string) => {
    await loadData();
    setFormData({ ...formData, package_id: newPackageId });
    setAddPackageOpen(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-10 h-10 bg-gradient-to-r from-secondary to-primary rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pedidos</h1>
              <p className="text-sm text-muted-foreground">Gerencie suas vendas</p>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="w-4 h-4 mr-2" />
                Novo Pedido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Pedido</DialogTitle>
                <DialogDescription>Registre uma nova venda</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="customer">Cliente</Label>
                      <QuickAddCustomer
                        open={addCustomerOpen}
                        onOpenChange={setAddCustomerOpen}
                        onCustomerCreated={handleCustomerCreated}
                      />
                    </div>
                    <Select
                      value={formData.customer_id}
                      onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="package">Pacote</Label>
                      <QuickAddPackage
                        open={addPackageOpen}
                        onOpenChange={setAddPackageOpen}
                        onPackageCreated={handlePackageCreated}
                      />
                    </div>
                    <Select
                      value={formData.package_id}
                      onValueChange={(value) => setFormData({ ...formData, package_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um pacote" />
                      </SelectTrigger>
                      <SelectContent>
                        {packages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.name} - R$ {Number(pkg.price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="travelers">Número de Viajantes</Label>
                    <Input
                      id="travelers"
                      type="number"
                      min="1"
                      value={formData.number_of_travelers}
                      onChange={(e) => setFormData({ ...formData, number_of_travelers: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="travel_date">Data da Viagem</Label>
                    <Input
                      id="travel_date"
                      type="date"
                      value={formData.travel_date}
                      onChange={(e) => setFormData({ ...formData, travel_date: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} variant="gradient">
                  {loading ? "Criando..." : "Criar Pedido"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Editar Pedido</DialogTitle>
                <DialogDescription>Atualize os dados do pedido</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit_customer">Cliente</Label>
                    <Select
                      value={editFormData.customer_id}
                      onValueChange={(value) => setEditFormData({ ...editFormData, customer_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_package">Pacote</Label>
                    <Select
                      value={editFormData.package_id}
                      onValueChange={(value) => setEditFormData({ ...editFormData, package_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um pacote" />
                      </SelectTrigger>
                      <SelectContent>
                        {packages.map((pkg) => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.name} - R$ {Number(pkg.price).toFixed(2)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_travelers">Número de Viajantes</Label>
                    <Input
                      id="edit_travelers"
                      type="number"
                      min="1"
                      value={editFormData.number_of_travelers}
                      onChange={(e) => setEditFormData({ ...editFormData, number_of_travelers: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit_travel_date">Data da Viagem</Label>
                    <Input
                      id="edit_travel_date"
                      type="date"
                      value={editFormData.travel_date}
                      onChange={(e) => setEditFormData({ ...editFormData, travel_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit_status">Status</Label>
                    <Select
                      value={editFormData.status}
                      onValueChange={(value) => setEditFormData({ ...editFormData, status: value as "pending" | "confirmed" | "completed" | "cancelled" })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="edit_special_requests">Solicitações Especiais</Label>
                    <Input
                      id="edit_special_requests"
                      value={editFormData.special_requests}
                      onChange={(e) => setEditFormData({ ...editFormData, special_requests: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading} variant="gradient">
                  {loading ? "Atualizando..." : "Atualizar Pedido"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <FilterBar
          onClear={clearFilters}
          activeFiltersCount={activeFiltersCount}
          resultsCount={filteredOrders.length}
          totalCount={orders.length}
        >
          <SearchInput
            value={filters.search}
            onChange={(value) => setFilters({ ...filters, search: value })}
            placeholder="Buscar por pedido, cliente ou pacote..."
          />
          <StatusFilter
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              { value: "all", label: "Todos" },
              { value: "pending", label: "Pendente" },
              { value: "confirmed", label: "Confirmado" },
              { value: "completed", label: "Concluído" },
              { value: "cancelled", label: "Cancelado" },
            ]}
          />
          <DateRangeFilter
            label="Data da Viagem"
            startDate={filters.dateStart}
            endDate={filters.dateEnd}
            onStartChange={(value) => setFilters({ ...filters, dateStart: value })}
            onEndChange={(value) => setFilters({ ...filters, dateEnd: value })}
          />
          <ValueRangeFilter
            minValue={filters.minValue}
            maxValue={filters.maxValue}
            onMinChange={(value) => setFilters({ ...filters, minValue: value })}
            onMaxChange={(value) => setFilters({ ...filters, maxValue: value })}
          />
        </FilterBar>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Pedidos</CardTitle>
            <CardDescription>Todos os pedidos registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Data Viagem</TableHead>
                  <TableHead>Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.order_number}</TableCell>
                    <TableCell>{order.customers?.full_name}</TableCell>
                    <TableCell>{order.travel_packages?.name}</TableCell>
                    <TableCell>
                      {new Date(order.travel_date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      R$ {Number(order.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/orders/${order.id}`)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/orders/${order.id}/edit`)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredOrders.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {orders.length === 0
                        ? "Nenhum pedido registrado ainda"
                        : "Nenhum pedido encontrado com os filtros aplicados"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Orders;

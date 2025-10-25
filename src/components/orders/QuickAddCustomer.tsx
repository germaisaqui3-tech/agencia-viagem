import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { customerSchema } from "@/lib/validations";
import { z } from "zod";
import { useOrganization } from "@/hooks/useOrganization";

interface QuickAddCustomerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customerId: string) => void;
}

export const QuickAddCustomer = ({ open, onOpenChange, onCustomerCreated }: QuickAddCustomerProps) => {
  const { organizationId, loading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    cpf: "",
    birth_date: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validatedData = customerSchema.parse(formData);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        setLoading(false);
        return;
      }

      if (!organizationId) {
        toast.error("Organização não encontrada");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("customers")
        .insert([
          {
            full_name: validatedData.full_name,
            email: validatedData.email,
            phone: validatedData.phone,
            cpf: validatedData.cpf,
            birth_date: validatedData.birth_date,
            organization_id: organizationId,
            created_by: session.user.id,
          },
        ])
        .select()
        .single();

      if (error || !data) {
        toast.error("Erro ao criar cliente");
        setLoading(false);
        return;
      }

      toast.success("Cliente adicionado com sucesso!");
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        cpf: "",
        birth_date: "",
      });
      onCustomerCreated(data.id);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
      } else {
        toast.error("Erro ao validar dados");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus className="w-3 h-3 mr-1" />
          Novo Cliente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar Cliente Rápido</DialogTitle>
          <DialogDescription>Preencha os dados essenciais do cliente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick_full_name">Nome Completo *</Label>
            <Input
              id="quick_full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="Digite o nome completo"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick_email">Email *</Label>
              <Input
                id="quick_email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="exemplo@email.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_phone">Telefone *</Label>
              <Input
                id="quick_phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quick_cpf">CPF (opcional)</Label>
              <Input
                id="quick_cpf"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick_birth_date">Data de Nascimento (opcional)</Label>
              <Input
                id="quick_birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || orgLoading} variant="gradient">
              {loading ? "Adicionando..." : "Adicionar Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

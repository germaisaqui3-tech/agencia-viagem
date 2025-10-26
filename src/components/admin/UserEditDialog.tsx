import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Edit, Trash2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { userUpdateSchema, type UserUpdateData } from "@/lib/validations";

type AppRole = 'admin' | 'agent' | 'user';
type OrgRole = 'owner' | 'admin' | 'agent' | 'viewer';

interface UserOrganization {
  membership_id: string;
  organization_id: string;
  name: string;
  role: OrgRole;
  is_active: boolean;
}

interface UserWithRole {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  role: AppRole;
  created_at: string;
  organizations?: UserOrganization[];
}

interface UserEditDialogProps {
  user: UserWithRole;
  onSuccess: () => void;
}

export function UserEditDialog({ user, onSuccess }: UserEditDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailChanged, setEmailChanged] = useState(false);
  const [organizations, setOrganizations] = useState<UserOrganization[]>(user.organizations || []);
  const [availableOrgs, setAvailableOrgs] = useState<{id: string, name: string}[]>([]);
  const [selectedOrgToAdd, setSelectedOrgToAdd] = useState<string>("");
  const [selectedOrgRole, setSelectedOrgRole] = useState<OrgRole>("agent");

  const form = useForm<UserUpdateData>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      full_name: user.full_name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
    },
  });

  const emailValue = form.watch("email");

  useEffect(() => {
    setEmailChanged(emailValue !== user.email);
  }, [emailValue, user.email]);

  useEffect(() => {
    if (open) {
      setOrganizations(user.organizations || []);
      loadAvailableOrganizations();
    }
  }, [open, user.organizations]);

  const loadAvailableOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      
      const userOrgIds = organizations.map(o => o.organization_id);
      const available = data?.filter(org => !userOrgIds.includes(org.id)) || [];
      
      setAvailableOrgs(available);
    } catch (error) {
      console.error("Error loading organizations:", error);
    }
  };

  const handleAddOrganization = async () => {
    if (!selectedOrgToAdd) {
      toast.error("Selecione uma organização");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("organization_members")
        .insert({
          user_id: user.id,
          organization_id: selectedOrgToAdd,
          role: selectedOrgRole,
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .select(`
          id,
          organization_id,
          role,
          is_active,
          organizations(name)
        `)
        .single();

      if (error) throw error;

      const newOrg: UserOrganization = {
        membership_id: data.id,
        organization_id: data.organization_id,
        name: (data.organizations as any).name,
        role: data.role as OrgRole,
        is_active: data.is_active,
      };

      setOrganizations([...organizations, newOrg]);
      setSelectedOrgToAdd("");
      setSelectedOrgRole("agent");
      loadAvailableOrganizations();
      
      toast.success("Organização adicionada!");
    } catch (error: any) {
      console.error("Error adding organization:", error);
      toast.error("Erro ao adicionar organização");
    }
  };

  const handleRemoveOrganization = async (membershipId: string, orgName: string, orgId: string, role: OrgRole) => {
    if (role === 'owner') {
      const { data: owners } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", orgId)
        .eq("role", "owner")
        .eq("is_active", true);

      if (owners && owners.length === 1) {
        toast.error("Não é possível remover o último proprietário da organização");
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ is_active: false })
        .eq("id", membershipId);

      if (error) throw error;

      setOrganizations(organizations.filter(o => o.membership_id !== membershipId));
      loadAvailableOrganizations();
      toast.success(`Usuário removido da organização ${orgName}`);
    } catch (error: any) {
      console.error("Error removing organization:", error);
      toast.error("Erro ao remover organização");
    }
  };

  const handleChangeOrgRole = async (
    membershipId: string, 
    newRole: OrgRole
  ) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", membershipId);

      if (error) throw error;

      setOrganizations(
        organizations.map(org => 
          org.membership_id === membershipId 
            ? { ...org, role: newRole }
            : org
        )
      );

      toast.success("Papel atualizado!");
    } catch (error: any) {
      console.error("Error updating org role:", error);
      toast.error("Erro ao atualizar papel");
    }
  };

  const onSubmit = async (values: UserUpdateData) => {
    setLoading(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name,
          email: values.email,
          phone: values.phone || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update role if changed
      if (values.role !== user.role) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .update({ role: values.role })
          .eq("user_id", user.id);

        if (roleError) throw roleError;
      }

      toast.success("Usuário atualizado com sucesso!");
      setOpen(false);
      onSuccess();
    } catch (error: any) {
      toast.error("Erro ao atualizar usuário");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações do usuário
          </DialogDescription>
        </DialogHeader>

        {emailChanged && (
          <Alert>
            <AlertDescription>
              ⚠️ Alterar o email modificará o login do usuário. Certifique-se de informá-lo.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo *</FormLabel>
                  <FormControl>
                    <Input placeholder="João Silva" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="usuario@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 98765-4321" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                      <SelectItem value="user">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator className="my-6" />

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Organizações</h3>
                <p className="text-sm text-muted-foreground">
                  Gerencie as organizações do usuário e seus papéis
                </p>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {organizations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Usuário não pertence a nenhuma organização
                  </p>
                ) : (
                  organizations.map((org) => (
                    <Card key={org.membership_id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{org.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Label className="text-xs">Papel:</Label>
                            <Select
                              value={org.role}
                              onValueChange={(value) => 
                                handleChangeOrgRole(org.membership_id, value as OrgRole)
                              }
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Proprietário</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="agent">Agente</SelectItem>
                                <SelectItem value="viewer">Visualizador</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOrganization(org.membership_id, org.name, org.organization_id, org.role)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {availableOrgs.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label>Adicionar à Organização</Label>
                  <div className="flex gap-2">
                    <Select value={selectedOrgToAdd} onValueChange={setSelectedOrgToAdd}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma organização" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableOrgs.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={selectedOrgRole} onValueChange={(value) => setSelectedOrgRole(value as OrgRole)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Proprietário</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddOrganization} size="icon">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

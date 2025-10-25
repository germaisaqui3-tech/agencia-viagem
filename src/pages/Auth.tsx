import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plane } from "lucide-react";
import { authLoginSchema, authSignupSchema } from "@/lib/validations";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // Validate login credentials
        const result = authLoginSchema.safeParse({ email, password });
        if (!result.success) {
          toast.error(result.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({
          email: result.data.email,
          password: result.data.password,
        });
        if (error) throw error;
        toast.success("Login realizado com sucesso!");
        navigate("/dashboard");
      } else {
        // Validate signup data
        const result = authSignupSchema.safeParse({ email, password, fullName });
        if (!result.success) {
          toast.error(result.error.errors[0].message);
          setLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: result.data.email,
          password: result.data.password,
          options: {
            data: {
              full_name: result.data.fullName,
            },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você pode fazer login agora.");
        setIsLogin(true);
      }
    } catch (error: any) {
      // Use generic error messages to avoid leaking information
      toast.error(isLogin ? "Credenciais inválidas" : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto w-12 h-12 bg-gradient-to-r from-primary to-accent rounded-full flex items-center justify-center">
            <Plane className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl">
            {isLogin ? "Bem-vindo de volta" : "Criar conta"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Entre para gerenciar sua agência de viagens"
              : "Cadastre-se para começar a gerenciar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Seu nome"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} variant="gradient">
              {loading ? "Processando..." : isLogin ? "Entrar" : "Cadastrar"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Faça login"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;

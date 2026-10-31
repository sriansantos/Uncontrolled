"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/client";
import { Wallet } from "lucide-react";

type Status = {
  authenticated: boolean;
  email: string | null;
  setupRequired: boolean;
};

export default function LoginPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Status>("/api/auth/status").then((s) => {
      if (!s) return;
      if (s.authenticated) window.location.href = "/";
      else setStatus(s);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!status) return;

    if (status.setupRequired) {
      if (password.length < 8) return toast.error("A senha precisa ter pelo menos 8 caracteres.");
      if (password !== password2) return toast.error("As senhas não conferem.");
      setBusy(true);
      const res = await api("/api/auth/register", {
        method: "POST",
        json: { email, password },
      });
      setBusy(false);
      if (res) window.location.href = "/";
    } else {
      setBusy(true);
      const res = await api("/api/auth/login", {
        method: "POST",
        json: { email, password },
      });
      setBusy(false);
      if (res) window.location.href = "/";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm border-border/70 shadow-none">
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-emerald-950">
              <Wallet className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Uncontrollader</h1>
            <p className="text-xs text-muted-foreground">
              {status?.setupRequired
                ? "Primeiro acesso — crie seu usuário de administrador"
                : "Entre para acessar suas finanças"}
            </p>
          </div>

          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="login-password">Senha</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete={status?.setupRequired ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {status?.setupRequired && (
              <div className="grid gap-1.5">
                <Label htmlFor="login-password2">Confirmar senha</Label>
                <Input
                  id="login-password2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                />
              </div>
            )}
            <Button type="submit" disabled={busy || !status}>
              {busy ? "Aguarde…" : status?.setupRequired ? "Criar acesso" : "Entrar"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
            Senhas protegidas com scrypt · tentativas de login limitadas · sessão de 30 dias
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

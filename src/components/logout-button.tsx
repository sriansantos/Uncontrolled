"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut, UserRound } from "lucide-react";

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((s) => setEmail(s.authenticated ? s.email : null))
      .catch(() => null);
  }, []);

  if (!email) return null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  // Mobile: só o ícone, no header.
  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={logout}
        aria-label="Sair da conta"
        title="Sair da conta"
        className="h-8 w-8"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  // Desktop: card do usuário na sidebar — email truncado em linha própria,
  // botão separado (email longo não pode estourar o botão).
  const inicial = email.charAt(0).toUpperCase();
  return (
    <div className="rounded-lg border bg-card/50 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
          <UserRound className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium" title={email}>
          {email}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={logout}
        className="mt-2 h-8 w-full text-xs"
      >
        <LogOut className="mr-1.5 h-3.5 w-3.5" />
        Sair da conta
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

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

  return (
    <Button variant="outline" size="sm" onClick={logout} className="w-full">
      <LogOut className="mr-1 h-3.5 w-3.5" />
      {compact ? "Sair" : `Sair (${email})`}
    </Button>
  );
}

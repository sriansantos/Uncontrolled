"use client";

import { usePathname } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/logout-button";
import { Wallet } from "lucide-react";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-emerald-950 shadow-inner">
        <Wallet className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight">Uncontrollader</p>
        {!compact && <p className="text-[11px] text-muted-foreground">finanças pessoais</p>}
      </div>
    </div>
  );
}

// Chrome do app (sidebar/header/nav). Na tela de login renderiza só o conteúdo.
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 border-r bg-sidebar px-3 py-4 lg:flex">
        <div className="px-2 pt-1">
          <Brand />
        </div>
        <AppNav />
        <div className="mt-auto space-y-1 px-1">
          <div className="flex items-center justify-between rounded-lg border px-2 py-1.5">
            <span className="text-xs text-muted-foreground">Tema</span>
            <ThemeToggle />
          </div>
          <LogoutButton />
          <p className="px-2 text-[10px] leading-relaxed text-muted-foreground">
            Essenciais × não essenciais · sobra do mês · reserva de emergência
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topo (mobile) */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur lg:hidden">
          <Brand compact />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <LogoutButton compact />
          </div>
        </header>
        <div className="border-b bg-sidebar px-3 py-2 lg:hidden">
          <AppNav orientation="horizontal" />
        </div>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

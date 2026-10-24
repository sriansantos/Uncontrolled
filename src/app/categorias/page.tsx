"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/client";
import { Plus, Trash2 } from "lucide-react";

type CategoryItem = {
  id: number;
  name: string;
  kind: string;
  tier: string | null;
  active: boolean;
  _count: { transactions: number };
};

export default function CategoriasPage() {
  const [items, setItems] = useState<CategoryItem[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<CategoryItem | null>(null);

  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("EXPENSE");
  const [tier, setTier] = useState<string>("NAO_ESSENCIAL");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const r = await api<{ items: CategoryItem[] }>("/api/categories?includeInactive=1");
    if (r) setItems(r.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!name.trim()) return toast.error("Informe o nome.");
    setSaving(true);
    const res = await api("/api/categories", {
      method: "POST",
      json: {
        name: name.trim(),
        kind,
        ...(kind === "EXPENSE" ? { tier } : { tier: null }),
      },
    });
    setSaving(false);
    if (res !== null) {
      toast.success("Categoria criada!");
      setDialogOpen(false);
      setName("");
      load();
    }
  }

  async function toggleActive(c: CategoryItem, active: boolean) {
    const res = await api(`/api/categories/${c.id}`, { method: "PATCH", json: { active } });
    if (res !== null) {
      setItems((prev) =>
        prev ? prev.map((i) => (i.id === c.id ? { ...i, active } : i)) : prev
      );
    }
  }

  async function changeTier(c: CategoryItem, newTier: string) {
    const res = await api(`/api/categories/${c.id}`, { method: "PATCH", json: { tier: newTier } });
    if (res !== null) {
      setItems((prev) =>
        prev ? prev.map((i) => (i.id === c.id ? { ...i, tier: newTier } : i)) : prev
      );
      toast.success("Categoria movida.");
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await api(`/api/categories/${deleting.id}`, { method: "DELETE" });
    if (res !== null) {
      toast.success("Categoria excluída.");
      setDeleting(null);
      load();
    }
  }

  const income = (items ?? []).filter((c) => c.kind === "INCOME");
  const essential = (items ?? []).filter((c) => c.kind === "EXPENSE" && c.tier === "ESSENCIAL");
  const nonEssential = (items ?? []).filter((c) => c.kind === "EXPENSE" && c.tier === "NAO_ESSENCIAL");

  function Rows({ list }: { list: CategoryItem[] }) {
    return (
      <div className="divide-y">
        {list.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${!c.active ? "text-muted-foreground line-through" : ""}`}>
                {c.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {c._count.transactions} lançamento{c._count.transactions === 1 ? "" : "s"}
              </p>
            </div>

            {c.kind === "EXPENSE" && (
              <Select value={c.tier ?? "NAO_ESSENCIAL"} onValueChange={(v) => changeTier(c, v)}>
                <SelectTrigger className="h-8 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESSENCIAL">Essencial</SelectItem>
                  <SelectItem value="NAO_ESSENCIAL">Não essencial</SelectItem>
                </SelectContent>
              </Select>
            )}

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{c.active ? "ativa" : "inativa"}</span>
              <Switch checked={c.active} onCheckedChange={(v) => toggleActive(c, v)} />
            </div>

            <Button
              variant="ghost"
              size="icon"
              disabled={c._count.transactions > 0}
              onClick={() => setDeleting(c)}
              aria-label="Excluir"
              title={
                c._count.transactions > 0
                  ? "Possui lançamentos — desative em vez de excluir"
                  : "Excluir"
              }
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Categorias"
        subtitle="Categorias padrão da planilha — crie, mova entre essencial/não essencial ou desative"
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </PageHeader>

      {items === null ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Receitas ({income.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Rows list={income} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Despesas essenciais ({essential.length}){" "}
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  base da reserva de emergência
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Rows list={essential} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Despesas não essenciais ({nonEssential.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Rows list={nonEssential} />
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova categoria</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-name">Nome</Label>
              <Input
                id="cat-name"
                placeholder="Ex.: Combustível"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Natureza</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Despesa (saída)</SelectItem>
                    <SelectItem value="INCOME">Receita (entrada)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "EXPENSE" && (
                <div className="grid gap-1.5">
                  <Label>Tipo</Label>
                  <Select value={tier} onValueChange={setTier}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ESSENCIAL">Essencial</SelectItem>
                      <SelectItem value="NAO_ESSENCIAL">Não essencial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `"${deleting.name}" será removida. Isso só é possível para categorias sem lançamentos.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

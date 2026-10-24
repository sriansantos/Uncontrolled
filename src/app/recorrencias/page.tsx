"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MonthNav } from "@/components/month-nav";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatBRL, parseBRLToCents, centsToInputValue } from "@/lib/money";
import { useCurrentMonth } from "@/lib/use-current-month";
import { CheckCircle2, Circle, Pencil, Plus, Trash2 } from "lucide-react";

type RecurrenceItem = {
  id: number;
  name: string;
  amountCents: number;
  dueDay: number;
  categoryId: number;
  categoryName: string;
  paid: boolean;
  overdue: boolean;
};

type CategoryOption = { id: number; name: string; kind: string };

export default function RecorrenciasPage() {
  const [month, setMonth] = useCurrentMonth();
  const [items, setItems] = useState<RecurrenceItem[] | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurrenceItem | null>(null);
  const [deleting, setDeleting] = useState<RecurrenceItem | null>(null);

  // formulário
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDay, setDueDay] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!month) return;
    setItems(null);
    const r = await api<{ items: RecurrenceItem[] }>(`/api/recurrences?month=${month}`);
    if (r) setItems(r.items);
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<{ items: CategoryOption[] }>("/api/categories?kind=EXPENSE").then((r) => {
      if (r) setCategories(r.items);
    });
  }, []);

  function openNew() {
    setEditing(null);
    setName("");
    setAmount("");
    setDueDay("10");
    setCategoryId("");
    setDialogOpen(true);
  }

  function openEdit(r: RecurrenceItem) {
    setEditing(r);
    setName(r.name);
    setAmount(centsToInputValue(r.amountCents));
    setDueDay(String(r.dueDay));
    setCategoryId(String(r.categoryId));
    setDialogOpen(true);
  }

  async function save() {
    const cents = parseBRLToCents(amount);
    if (!name.trim()) return toast.error("Informe o nome.");
    if (cents === null || cents <= 0) return toast.error("Valor inválido.");
    if (!categoryId) return toast.error("Selecione uma categoria.");

    setSaving(true);
    const payload = {
      name: name.trim(),
      amountCents: cents,
      dueDay: Math.min(Math.max(Number(dueDay) || 1, 1), 31),
      categoryId: Number(categoryId),
    };
    const res = editing
      ? await api(`/api/recurrences/${editing.id}`, { method: "PATCH", json: payload })
      : await api("/api/recurrences", { method: "POST", json: payload });
    setSaving(false);
    if (res !== null) {
      toast.success(editing ? "Recorrência atualizada." : "Recorrência criada!");
      setDialogOpen(false);
      load();
    }
  }

  async function pay(r: RecurrenceItem) {
    const res = await api<{ alreadyPaid: boolean }>(`/api/recurrences/${r.id}/pay`, {
      method: "POST",
      json: { month },
    });
    if (res) {
      toast.success(res.alreadyPaid ? "Essa conta já estava paga." : "Conta marcada como paga!");
      load();
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const res = await api(`/api/recurrences/${deleting.id}`, { method: "DELETE" });
    if (res !== null) {
      toast.success("Recorrência excluída. Lançamentos passados foram mantidos.");
      setDeleting(null);
      load();
    }
  }

  const pendingTotal = (items ?? []).filter((r) => !r.paid).reduce((s, r) => s + r.amountCents, 0);
  const overdueCount = (items ?? []).filter((r) => r.overdue).length;

  return (
    <div className="space-y-4">
      <PageHeader title="Recorrências" subtitle="Assinaturas e contas fixas com dia de vencimento">
        <MonthNav month={month} onChange={setMonth} />
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Nova
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Total mensal das recorrências" value={formatBRL((items ?? []).reduce((s, r) => s + r.amountCents, 0))} hint={`${items?.length ?? 0} contas ativas`} />
        <KpiCard title="Em aberto neste mês" value={formatBRL(pendingTotal)} tone="warning" hint={`${(items ?? []).filter((r) => !r.paid).length} pendentes`} />
        <KpiCard title="Atrasadas" value={String(overdueCount)} tone={overdueCount > 0 ? "negative" : "positive"} hint={overdueCount > 0 ? "Vencidas e não pagas" : "Nenhuma atrasada"} />
      </div>

      <Card>
        <CardContent className="p-0">
          {items === null ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma recorrência ativa. Clique em “Nova” para cadastrar a primeira.
            </p>
          ) : (
            <div className="divide-y">
              {items.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Todo dia {r.dueDay} · {r.categoryName}
                    </p>
                  </div>
                  <span className="font-semibold tabular-nums">{formatBRL(r.amountCents)}</span>
                  {r.paid ? (
                    <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Pago
                    </Badge>
                  ) : (
                    <div className="flex items-center gap-2">
                      {r.overdue && <Badge variant="destructive">Atrasada</Badge>}
                      <Button size="sm" variant="outline" onClick={() => pay(r)}>
                        <Circle className="mr-1 h-3 w-3" /> Marcar pago
                      </Button>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Editar">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleting(r)} aria-label="Excluir">
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar recorrência" : "Nova recorrência"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="rec-name">Nome</Label>
              <Input
                id="rec-name"
                placeholder="Ex.: Netflix, Aluguel, Internet…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rec-amount">Valor (R$)</Label>
                <Input
                  id="rec-amount"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rec-day">Dia do vencimento</Label>
                <Input
                  id="rec-day"
                  inputMode="numeric"
                  min={1}
                  max={31}
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Categoria (saída)</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir recorrência?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting &&
                `"${deleting.name}" deixa de ser cobrada. Os pagamentos já lançados permanecem em Lançamentos.`}
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

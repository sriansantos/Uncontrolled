"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MonthNav } from "@/components/month-nav";
import { PageHeader } from "@/components/page-header";
import {
  TransactionDialog,
  type CategoryOption,
  type TransactionDraft,
} from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/client";
import { formatBRL } from "@/lib/money";
import { useCurrentMonth } from "@/lib/use-current-month";
import { SOURCE_LABEL, type Source } from "@/lib/types";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type TxItem = {
  id: number;
  date: string;
  description: string;
  amountCents: number;
  kind: string;
  source: string;
  notes: string | null;
  category: { id: number; name: string; kind: string; tier: string | null };
};

type ListResponse = {
  items: TxItem[];
  total: number;
  sums: { incomeCents: number; expenseCents: number };
};

export default function LancamentosPage() {
  const [month, setMonth] = useCurrentMonth();
  const [kindFilter, setKindFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionDraft | null>(null);
  const [deleting, setDeleting] = useState<TxItem | null>(null);

  useEffect(() => {
    api<{ items: CategoryOption[] }>("/api/categories").then((r) => {
      if (r) setCategories(r.items);
    });
  }, []);

  const load = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    const params = new URLSearchParams({ month, limit: "300" });
    if (kindFilter !== "ALL") params.set("kind", kindFilter);
    if (categoryFilter !== "ALL") params.set("categoryId", categoryFilter);
    if (q.trim()) params.set("q", q.trim());
    const r = await api<ListResponse>(`/api/transactions?${params}`);
    if (r) setData(r);
    setLoading(false);
  }, [month, kindFilter, categoryFilter, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  async function confirmDelete() {
    if (!deleting) return;
    const res = await api(`/api/transactions/${deleting.id}`, { method: "DELETE" });
    if (res !== null) {
      toast.success("Lançamento excluído.");
      setDeleting(null);
      load();
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Lançamentos" subtitle="Entradas e saídas registradas no mês">
        <MonthNav month={month} onChange={setMonth} />
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" /> Novo
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição…"
            className="w-56 pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tudo</SelectItem>
            <SelectItem value="EXPENSE">Despesas</SelectItem>
            <SelectItem value="INCOME">Receitas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas as categorias</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {data && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400">
              + {formatBRL(data.sums.incomeCents)}
            </span>
            <span className="text-red-600 dark:text-red-400">
              − {formatBRL(data.sums.expenseCents)}
            </span>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="hidden sm:table-cell">Categoria</TableHead>
                  <TableHead className="hidden md:table-cell">Origem</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Nenhum lançamento encontrado com os filtros atuais.
                    </TableCell>
                  </TableRow>
                )}
                {data?.items.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="tabular-nums">
                      {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{t.description}</p>
                      {t.notes && (
                        <p className="text-xs text-muted-foreground">{t.notes}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{t.category.name}</span>
                        {t.category.tier && (
                          <Badge
                            variant={t.category.tier === "ESSENCIAL" ? "secondary" : "outline"}
                            className="text-[10px]"
                          >
                            {t.category.tier === "ESSENCIAL" ? "Essencial" : "Não essenc."}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                      {SOURCE_LABEL[t.source as Source] ?? t.source}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold tabular-nums ${
                        t.kind === "INCOME"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {t.kind === "INCOME" ? "+" : "−"} {formatBRL(t.amountCents)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditing({
                              id: t.id,
                              date: t.date,
                              description: t.description,
                              amountCents: t.amountCents,
                              kind: t.kind,
                              categoryId: t.category.id,
                              notes: t.notes,
                            });
                            setDialogOpen(true);
                          }}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleting(t)}
                          aria-label="Excluir"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TransactionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        initial={editing}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `"${deleting.description}" (${formatBRL(deleting.amountCents)}) será removido permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmDelete}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

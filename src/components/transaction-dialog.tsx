"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/client";
import { parseBRLToCents, centsToInputValue } from "@/lib/money";
import { todayISO } from "@/lib/month";
import type { Kind } from "@/lib/types";

export type CategoryOption = {
  id: number;
  name: string;
  kind: string;
  tier: string | null;
};

export type TransactionDraft = {
  id: number;
  date: string;
  description: string;
  amountCents: number;
  kind: string;
  categoryId: number;
  notes: string | null;
};

export function TransactionDialog({
  open,
  onOpenChange,
  categories,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  initial: TransactionDraft | null; // null = novo lançamento
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<Kind>("EXPENSE");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setKind(initial.kind === "INCOME" ? "INCOME" : "EXPENSE");
      setDate(initial.date);
      setDescription(initial.description);
      setAmount(centsToInputValue(initial.amountCents));
      setCategoryId(String(initial.categoryId));
      setNotes(initial.notes ?? "");
    } else {
      setKind("EXPENSE");
      setDate(todayISO());
      setDescription("");
      setAmount("");
      setCategoryId("");
      setNotes("");
    }
  }, [open, initial]);

  const kindCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind]
  );

  async function save() {
    if (!description.trim()) return toast.error("Informe a descrição.");
    const cents = parseBRLToCents(amount);
    if (cents === null || cents <= 0) return toast.error("Valor inválido. Ex.: 1.234,56");
    if (!categoryId) return toast.error("Selecione uma categoria.");

    setSaving(true);
    const payload = {
      date,
      description: description.trim(),
      amountCents: cents,
      kind,
      categoryId: Number(categoryId),
      notes: notes.trim() || null,
    };
    const res = initial
      ? await api(`/api/transactions/${initial.id}`, { method: "PATCH", json: payload })
      : await api("/api/transactions", { method: "POST", json: payload });
    setSaving(false);

    if (res !== null) {
      toast.success(initial ? "Lançamento atualizado." : "Lançamento registrado!");
      onOpenChange(false);
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={kind === "EXPENSE" ? "destructive" : "outline"}
              onClick={() => {
                setKind("EXPENSE");
                setCategoryId("");
              }}
            >
              Despesa
            </Button>
            <Button
              type="button"
              variant={kind === "INCOME" ? "default" : "outline"}
              className={kind === "INCOME" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={() => {
                setKind("INCOME");
                setCategoryId("");
              }}
            >
              Receita
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Valor (R$)</Label>
              <Input
                id="tx-amount"
                inputMode="decimal"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Data</Label>
              <Input
                id="tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-desc">Descrição</Label>
            <Input
              id="tx-desc"
              placeholder="Ex.: Supermercado, Salário, Uber…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {kindCategories.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-notes">Observação (opcional)</Label>
            <Textarea
              id="tx-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

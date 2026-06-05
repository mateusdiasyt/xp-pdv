"use client";

import { AccountPayableStatus } from "@prisma/client";
import { CalendarClock, CheckCircle2, FileUp, Loader2, Paperclip, Plus, Search, X } from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useMemo, useRef, useState } from "react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/presentation/admin/common/action-state";
import {
  createAccountPayableAction,
  initialActionState,
  updateAccountPayableStatusAction,
  uploadAccountPayableReceiptAction,
} from "@/presentation/admin/accounts/actions";

type AccountRow = {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  isRecurringMonthly: boolean;
  dueDay?: number | null;
  status: AccountPayableStatus;
  installmentNumber: number;
  installmentTotal: number;
  notes?: string | null;
  receiptDataUrl?: string | null;
  receiptFileName?: string | null;
};

type AccountsSpreadsheetProps = {
  accounts: AccountRow[];
};

const statusLabels: Record<AccountPayableStatus, string> = {
  PENDING: "Pendente",
  PAID: "Paga",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  timeZone: "UTC",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

function formatDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00.000Z`));
}

function getDaysToDue(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(`${value}T12:00:00.000Z`);
  dueDate.setHours(0, 0, 0, 0);

  return Math.ceil((dueDate.getTime() - today.getTime()) / 86_400_000);
}

function getDueLabel(account: AccountRow) {
  if (account.status === AccountPayableStatus.PAID) {
    return "Quitada";
  }

  const days = getDaysToDue(account.dueDate);

  if (days < 0) {
    return `${Math.abs(days)} dia(s) atrasada`;
  }

  if (days === 0) {
    return "Vence hoje";
  }

  return `Vence em ${days} dia(s)`;
}

function getStatusClass(account: AccountRow) {
  if (account.status === AccountPayableStatus.PAID) {
    return "border-emerald-400/25 bg-emerald-400/10 text-emerald-100";
  }

  const days = getDaysToDue(account.dueDate);

  if (days < 0) {
    return "border-rose-400/30 bg-rose-400/12 text-rose-100";
  }

  if (days <= 5) {
    return "border-amber-400/30 bg-amber-400/12 text-amber-100";
  }

  return "border-border/70 bg-background/70 text-muted-foreground";
}

async function readReceiptFile(file: File) {
  if (file.size > 900_000) {
    throw new Error("Comprovante muito grande. Use imagem/PDF menor que 900KB.");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Nao foi possivel ler o comprovante."));
    reader.readAsDataURL(file);
  });
}

export function AccountsSpreadsheet({ accounts }: AccountsSpreadsheetProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<"RECURRING" | "INSTALLMENT">("RECURRING");
  const [state, setState] = useState<ActionState>(initialActionState);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const totals = useMemo(() => {
    return accounts.reduce(
      (summary, account) => {
        if (account.status === AccountPayableStatus.PAID) {
          summary.paid += account.amount;
          return summary;
        }

        summary.pending += account.amount;

        if (getDaysToDue(account.dueDate) < 0) {
          summary.overdue += account.amount;
        }

        return summary;
      },
      {
        pending: 0,
        paid: 0,
        overdue: 0,
      },
    );
  }, [accounts]);

  async function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("create");
    setState(initialActionState);

    try {
      const result = await createAccountPayableAction(new FormData(event.currentTarget));
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel adicionar a conta.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStatusChange(account: AccountRow) {
    setPendingAction(`status-${account.id}`);
    setState(initialActionState);

    const formData = new FormData();
    formData.set("accountId", account.id);
    formData.set(
      "status",
      account.status === AccountPayableStatus.PAID ? AccountPayableStatus.PENDING : AccountPayableStatus.PAID,
    );

    try {
      const result = await updateAccountPayableStatusAction(formData);
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel atualizar a conta.",
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReceiptChange(account: AccountRow, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPendingAction(`receipt-${account.id}`);
    setState(initialActionState);

    try {
      const receiptDataUrl = await readReceiptFile(file);
      const formData = new FormData();
      formData.set("accountId", account.id);
      formData.set("receiptDataUrl", receiptDataUrl);
      formData.set("receiptFileName", file.name);
      formData.set("receiptMimeType", file.type);

      const result = await uploadAccountPayableReceiptAction(formData);
      setState(result);

      if (result.status === "success") {
        window.location.reload();
      }
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel anexar o comprovante.",
      });
    } finally {
      setPendingAction(null);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-[1.15rem] border border-border/70 bg-card/60 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pendente</p>
          <p className="mt-3 text-2xl font-semibold text-foreground">{formatCurrency(totals.pending)}</p>
        </div>
        <div className="rounded-[1.15rem] border border-rose-400/25 bg-rose-400/8 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-rose-100/70">Atrasado</p>
          <p className="mt-3 text-2xl font-semibold text-rose-50">{formatCurrency(totals.overdue)}</p>
        </div>
        <div className="rounded-[1.15rem] border border-emerald-400/25 bg-emerald-400/8 p-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-emerald-100/70">Pago</p>
          <p className="mt-3 text-2xl font-semibold text-emerald-50">{formatCurrency(totals.paid)}</p>
        </div>
      </div>

      <div className="rounded-[1.4rem] border border-border/70 bg-card/70 shadow-[0_24px_70px_-48px_rgba(0,0,0,0.9)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/65 px-4 py-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Planilha de contas</h2>
            <p className="text-xs text-muted-foreground">{accounts.length} linha(s)</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <form method="get" className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" placeholder="Buscar" className="h-9 w-48 pl-8" />
              </div>
              <Button type="submit" variant="outline" size="sm">
                Filtrar
              </Button>
            </form>

            <Button type="button" size="sm" className="gap-2" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar Conta
            </Button>
          </div>
        </div>

        {formOpen ? (
          <form
            ref={formRef}
            onSubmit={handleCreateSubmit}
            className="border-b border-border/65 bg-background/28 px-4 py-4"
          >
            <input type="hidden" name="accountMode" value={accountMode} />

            <div className="mb-4 grid gap-2 md:grid-cols-2">
              <button
                type="button"
                onClick={() => setAccountMode("RECURRING")}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  accountMode === "RECURRING"
                    ? "border-primary/70 bg-primary/12 text-foreground"
                    : "border-border/70 bg-background/45 text-muted-foreground hover:bg-muted/35",
                )}
              >
                <span className="text-sm font-semibold">Mensal fixa</span>
                <span className="mt-1 block text-xs">Todo mes no mesmo dia.</span>
              </button>
              <button
                type="button"
                onClick={() => setAccountMode("INSTALLMENT")}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-colors",
                  accountMode === "INSTALLMENT"
                    ? "border-primary/70 bg-primary/12 text-foreground"
                    : "border-border/70 bg-background/45 text-muted-foreground hover:bg-muted/35",
                )}
              >
                <span className="text-sm font-semibold">Avulsa ou parcelada</span>
                <span className="mt-1 block text-xs">Data inicial e quantidade de parcelas.</span>
              </button>
            </div>

            <div
              className={cn(
                "grid gap-3",
                accountMode === "RECURRING"
                  ? "xl:grid-cols-[minmax(220px,2fr)_140px_150px_minmax(180px,1fr)_auto_auto]"
                  : "xl:grid-cols-[minmax(220px,2fr)_140px_150px_130px_minmax(180px,1fr)_auto_auto]",
              )}
            >
              <div className="space-y-1">
                <Label htmlFor="accountName">Nome</Label>
                <Input id="accountName" name="name" placeholder="Aluguel, internet, fornecedor..." required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="accountAmount">Valor</Label>
                <Input id="accountAmount" name="amount" inputMode="decimal" placeholder="0,00" required />
              </div>
              {accountMode === "RECURRING" ? (
                <div className="space-y-1">
                  <Label htmlFor="accountDueDay">Dia do mes</Label>
                  <Input id="accountDueDay" name="dueDay" type="number" min={1} max={31} placeholder="10" required />
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="accountDueDate">Vencimento</Label>
                    <Input id="accountDueDate" name="dueDate" type="date" required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="accountInstallments">Parcelas</Label>
                    <Input
                      id="accountInstallments"
                      name="installmentTotal"
                      type="number"
                      min={1}
                      max={120}
                      defaultValue={1}
                    />
                  </div>
                </>
              )}
              <div className="space-y-1">
                <Label htmlFor="accountNotes">Obs.</Label>
                <Input id="accountNotes" name="notes" placeholder="Opcional" />
              </div>
              <Button type="submit" className="self-end gap-2" disabled={pendingAction === "create"}>
                {pendingAction === "create" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Salvar
              </Button>
              <Button type="button" variant="outline" className="self-end gap-2" onClick={() => setFormOpen(false)}>
                <X className="h-4 w-4" />
                Fechar
              </Button>
            </div>
          </form>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border/65 text-left text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <th className="w-[28%] px-4 py-3">Conta</th>
                <th className="w-[12%] px-4 py-3">Valor</th>
                <th className="w-[13%] px-4 py-3">Vencimento</th>
                <th className="w-[10%] px-4 py-3">Parcela</th>
                <th className="w-[16%] px-4 py-3">Status</th>
                <th className="w-[11%] px-4 py-3">Comprovante</th>
                <th className="w-[10%] px-4 py-3 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    Nenhuma conta registrada.
                  </td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id} className="border-b border-border/45 transition-colors hover:bg-muted/18">
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{account.name}</p>
                        {account.notes ? <p className="line-clamp-1 text-xs text-muted-foreground">{account.notes}</p> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(account.amount)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(account.dueDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {account.isRecurringMonthly
                        ? `Todo dia ${account.dueDay ?? new Date(`${account.dueDate}T12:00:00.000Z`).getUTCDate()}`
                        : `${account.installmentNumber}/${account.installmentTotal}`}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("gap-1.5 border px-2.5 py-1 text-[0.76rem]", getStatusClass(account))}>
                        <CalendarClock className="h-3.5 w-3.5" />
                        {statusLabels[account.status]} - {getDueLabel(account)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {account.receiptDataUrl ? (
                        <a
                          href={account.receiptDataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/45"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Ver
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sem anexo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 text-xs font-medium text-foreground transition-colors hover:border-primary/45">
                          {pendingAction === `receipt-${account.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileUp className="h-3.5 w-3.5" />
                          )}
                          Anexar
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/jpg,application/pdf"
                            className="sr-only"
                            onChange={(event) => handleReceiptChange(account, event)}
                            disabled={pendingAction !== null}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(account)}
                          disabled={pendingAction !== null}
                        >
                          {pendingAction === `status-${account.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : account.status === AccountPayableStatus.PAID ? (
                            "Reabrir"
                          ) : (
                            "Pagar"
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ActionFeedback state={state} />
    </div>
  );
}

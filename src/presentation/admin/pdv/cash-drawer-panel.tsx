"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, LockKeyhole, MinusCircle, PlusCircle, Printer, WalletCards } from "lucide-react";

import { ActionFeedback } from "@/components/admin/action-feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { initialActionState, type ActionState } from "@/presentation/admin/common/action-state";
import {
  closeCashSessionAction,
  openCashSessionAction,
  registerCashMovementAction,
} from "@/presentation/admin/cash/actions";

type CashMovementTypeValue = "WITHDRAWAL" | "SUPPLY";
type PaymentMethodValue = "CASH" | "PIX" | "CREDIT_CARD" | "DEBIT_CARD";

export type PdvCashSession = {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  cashSalesAmount: number;
  supplyAmount: number;
  withdrawalAmount: number;
  expectedAmount: number;
  closingAmount: number | null;
  differenceAmount: number | null;
  note: string;
  salesCount: number;
  salesTotalAmount: number;
  paymentTotals: Array<{
    method: PaymentMethodValue;
    amount: number;
  }>;
  cashRegister: {
    id: string;
    name: string;
    code: string;
  };
  operator: {
    id: string;
    name: string;
    email: string;
  };
  movements: Array<{
    id: string;
    type: CashMovementTypeValue;
    amount: number;
    reason: string;
    createdAt: string;
  }>;
};

type CashRegisterOption = {
  id: string;
  name: string;
  code: string;
};

type OperatorOption = {
  id: string;
  name: string;
  email: string;
  roleName: string;
};

type CashDrawerPanelProps = {
  canManage: boolean;
  cashRegisters: CashRegisterOption[];
  operators: OperatorOption[];
  openSessions: PdvCashSession[];
  onSessionOpened: (session: PdvCashSession) => void;
  onSessionUpdated: (session: PdvCashSession) => void;
  onSessionClosed: (session: PdvCashSession) => void;
};

const paymentLabels: Record<PaymentMethodValue, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Credito",
  DEBIT_CARD: "Debito",
};

const movementLabels: Record<CashMovementTypeValue, string> = {
  WITHDRAWAL: "Sangria",
  SUPPLY: "Suprimento",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const closedCashReportStorageKey = "xp-pdv:last-closed-cash-report";

function isPdvCashSession(value: unknown): value is PdvCashSession {
  return Boolean(value && typeof value === "object" && "id" in value && "cashRegister" in value && "operator" in value);
}

function localActionError(error: unknown): ActionState {
  return {
    status: "error",
    message: error instanceof Error ? error.message : "Nao foi possivel concluir a acao.",
  };
}

function reloadPage() {
  window.setTimeout(() => {
    window.location.reload();
  }, 100);
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }

  return dateFormatter.format(new Date(value));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printCashReport(session: PdvCashSession) {
  const payments = session.paymentTotals
    .filter((payment) => payment.amount > 0)
    .map(
      (payment) =>
        `<div><span>${paymentLabels[payment.method]}</span><strong>${formatCurrency(payment.amount)}</strong></div>`,
    )
    .join("");
  const movements = session.movements
    .map(
      (movement) =>
        `<div><span>${movementLabels[movement.type]}</span><strong>${formatCurrency(movement.amount)}</strong></div>`,
    )
    .join("");
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatorio do caixa</title>
  <style>
    @page { size: 57mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { width: 57mm; margin: 0; padding: 4mm 3mm; color: #000; font-family: Arial, sans-serif; font-size: 11px; }
    h1 { margin: 0 0 2mm; text-align: center; font-size: 13px; }
    p { margin: 0.8mm 0; }
    .line { border-top: 1px dashed #000; margin: 2.5mm 0; }
    div.row, main div { display: flex; justify-content: space-between; gap: 3mm; margin: 1.1mm 0; }
    strong { font-weight: 700; text-align: right; }
  </style>
</head>
<body>
  <h1>FECHAMENTO DE CAIXA</h1>
  <p>Caixa: ${escapeHtml(session.cashRegister.name)}</p>
  <p>Operador: ${escapeHtml(session.operator.name)}</p>
  <p>Abertura: ${formatDateTime(session.openedAt)}</p>
  <p>Fechamento: ${formatDateTime(session.closedAt)}</p>
  <div class="line"></div>
  <main>
    <div><span>Saldo inicial</span><strong>${formatCurrency(session.openingAmount)}</strong></div>
    <div><span>Vendas em dinheiro</span><strong>${formatCurrency(session.cashSalesAmount)}</strong></div>
    <div><span>Suprimentos</span><strong>${formatCurrency(session.supplyAmount)}</strong></div>
    <div><span>Sangrias</span><strong>${formatCurrency(session.withdrawalAmount)}</strong></div>
    <div><span>Previsto</span><strong>${formatCurrency(session.expectedAmount)}</strong></div>
    <div><span>Contado</span><strong>${formatCurrency(session.closingAmount ?? 0)}</strong></div>
    <div><span>Diferenca</span><strong>${formatCurrency(session.differenceAmount ?? 0)}</strong></div>
  </main>
  <div class="line"></div>
  <p>Vendas: ${session.salesCount} | Total: ${formatCurrency(session.salesTotalAmount)}</p>
  ${payments ? `<div class="line"></div>${payments}` : ""}
  ${movements ? `<div class="line"></div>${movements}` : ""}
  <div class="line"></div>
  <p>Assinatura: __________________</p>
</body>
</html>`;

  const printWindow = window.open("", "_blank", "width=320,height=640");
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function CashReportCard({ session }: { session: PdvCashSession }) {
  return (
    <div className="rounded-[1.15rem] border border-primary/25 bg-primary/8 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Resumo do caixa fechado</p>
          <p className="text-xs text-muted-foreground">
            {session.cashRegister.name} - {session.operator.name}
          </p>
        </div>
        <Button type="button" size="sm" className="gap-2" onClick={() => printCashReport(session)}>
          <Printer className="h-4 w-4" />
          Imprimir
        </Button>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border/70 bg-background/40 p-2">
          <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Previsto</p>
          <p className="mt-1 text-sm font-semibold">{formatCurrency(session.expectedAmount)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/40 p-2">
          <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Contado</p>
          <p className="mt-1 text-sm font-semibold">{formatCurrency(session.closingAmount ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/40 p-2">
          <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Diferenca</p>
          <p
            className={cn(
              "mt-1 text-sm font-semibold",
              (session.differenceAmount ?? 0) === 0
                ? "text-emerald-300"
                : (session.differenceAmount ?? 0) > 0
                  ? "text-amber-300"
                  : "text-rose-300",
            )}
          >
            {formatCurrency(session.differenceAmount ?? 0)}
          </p>
        </div>
      </div>
    </div>
  );
}

function OpenCashForm({
  cashRegisters,
  operators,
}: {
  cashRegisters: CashRegisterOption[];
  operators: OperatorOption[];
  onOpened: (session: PdvCashSession) => void;
}) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsPending(true);
    setState(initialActionState);

    try {
      const result = await openCashSessionAction(initialActionState, formData);
      setState(result);

      if (result.status === "success") {
        reloadPage();
      }
    } catch (error) {
      setState(localActionError(error));
    } finally {
      setIsPending(false);
    }
  }

  if (cashRegisters.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum caixa ativo encontrado.</p>;
  }

  if (operators.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Cadastre um administrador antes de abrir o caixa.</p>
        <Link
          href="/admin/users"
          className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-3.5 text-sm font-medium text-primary-foreground"
        >
          Cadastrar administrador
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 lg:grid-cols-[minmax(170px,0.9fr)_minmax(170px,0.8fr)_130px_auto] lg:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="pdv-cash-operator">Operador</Label>
        <select id="pdv-cash-operator" name="operatorId" className="admin-native-select" defaultValue={operators[0]?.id} required>
          {operators.map((operator) => (
            <option key={operator.id} value={operator.id}>
              {operator.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pdv-cash-register">Caixa</Label>
        <select
          id="pdv-cash-register"
          name="cashRegisterId"
          className="admin-native-select"
          defaultValue={cashRegisters[0]?.id}
          required
        >
          {cashRegisters.map((cashRegister) => (
            <option key={cashRegister.id} value={cashRegister.id}>
              {cashRegister.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pdv-opening-amount">Inicial</Label>
        <Input id="pdv-opening-amount" name="openingAmount" defaultValue="0.00" inputMode="decimal" required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pdv-opening-note">Obs.</Label>
        <Input id="pdv-opening-note" name="note" placeholder="Opcional" />
      </div>

      <div className="lg:col-span-4">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Abrindo..." : "Abrir caixa"}
        </Button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function CashMovementForm({
  sessionId,
  type,
}: {
  sessionId: string;
  type: CashMovementTypeValue;
  onUpdated: (session: PdvCashSession) => void;
}) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsPending(true);
    setState(initialActionState);

    try {
      const result = await registerCashMovementAction(initialActionState, formData);
      setState(result);

      if (result.status === "success") {
        reloadPage();
      }
    } catch (error) {
      setState(localActionError(error));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[130px_minmax(180px,1fr)_auto] md:items-end">
      <input type="hidden" name="cashSessionId" value={sessionId} />
      <input type="hidden" name="type" value={type} />
      <div className="space-y-1.5">
        <Label htmlFor={`cash-movement-${type}`}>Valor</Label>
        <Input id={`cash-movement-${type}`} name="amount" placeholder="0.00" inputMode="decimal" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`cash-movement-reason-${type}`}>Motivo</Label>
        <Input
          id={`cash-movement-reason-${type}`}
          name="reason"
          placeholder={type === "SUPPLY" ? "Ex: reforco de troco" : "Ex: retirada"}
          required
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando..." : type === "SUPPLY" ? "Confirmar suprimento" : "Confirmar sangria"}
      </Button>
      <div className="md:col-span-3">
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

function CloseCashForm({
  session,
  onClosed,
}: {
  session: PdvCashSession;
  onClosed: (session: PdvCashSession) => void;
}) {
  const [state, setState] = useState<ActionState>(initialActionState);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    setIsPending(true);
    setState(initialActionState);

    try {
      const result = await closeCashSessionAction(initialActionState, formData);
      setState(result);

      if (result.status === "success" && isPdvCashSession(result.data)) {
        onClosed(result.data);
        try {
          window.sessionStorage.setItem(closedCashReportStorageKey, JSON.stringify(result.data));
        } catch {
          // A impressao ainda fica disponivel antes do reload se o navegador bloquear o armazenamento.
        }
        reloadPage();
      }
    } catch (error) {
      setState(localActionError(error));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-[150px_minmax(190px,1fr)_auto] md:items-end">
      <input type="hidden" name="cashSessionId" value={session.id} />
      <div className="space-y-1.5">
        <Label htmlFor="pdv-closing-amount">Valor contado</Label>
        <Input
          id="pdv-closing-amount"
          name="closingAmount"
          defaultValue={session.expectedAmount.toFixed(2)}
          inputMode="decimal"
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pdv-closing-note">Obs.</Label>
        <Textarea id="pdv-closing-note" name="note" rows={1} placeholder="Opcional" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Fechando..." : "Fechar caixa"}
      </Button>
      <div className="md:col-span-3">
        <ActionFeedback state={state} />
      </div>
    </form>
  );
}

export function CashDrawerPanel({
  canManage,
  cashRegisters,
  operators,
  openSessions,
  onSessionOpened,
  onSessionUpdated,
  onSessionClosed,
}: CashDrawerPanelProps) {
  const [selectedSessionId, setSelectedSessionId] = useState(openSessions[0]?.id ?? "");
  const [activePanel, setActivePanel] = useState<"idle" | "withdrawal" | "supply" | "close">("idle");
  const [lastClosedSession, setLastClosedSession] = useState<PdvCashSession | null>(null);

  useEffect(() => {
    let timeoutId: number | undefined;

    try {
      const storedReport = window.sessionStorage.getItem(closedCashReportStorageKey);
      if (!storedReport) {
        return;
      }

      window.sessionStorage.removeItem(closedCashReportStorageKey);
      const parsedReport: unknown = JSON.parse(storedReport);
      if (isPdvCashSession(parsedReport)) {
        timeoutId = window.setTimeout(() => setLastClosedSession(parsedReport), 0);
      }
    } catch {
      window.sessionStorage.removeItem(closedCashReportStorageKey);
    }

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const effectiveSelectedSessionId = openSessions.some((session) => session.id === selectedSessionId)
    ? selectedSessionId
    : (openSessions[0]?.id ?? "");

  const selectedSession = useMemo(
    () => openSessions.find((session) => session.id === effectiveSelectedSessionId) ?? openSessions[0] ?? null,
    [effectiveSelectedSessionId, openSessions],
  );

  const handleClosed = useCallback((session: PdvCashSession) => {
    setLastClosedSession(session);
    setActivePanel("idle");
    onSessionClosed(session);
  }, [onSessionClosed]);

  return (
    <section className="rounded-[1.4rem] border border-border/75 bg-card/86 p-4 shadow-[0_22px_70px_-54px_rgba(0,0,0,0.9)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/35 bg-primary/12 text-primary">
            {selectedSession ? <WalletCards className="h-4 w-4" /> : <LockKeyhole className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {selectedSession ? "Caixa aberto" : "Abra o caixa para vender"}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedSession
                ? `${selectedSession.operator.name} - ${formatDateTime(selectedSession.openedAt)}`
                : "O PDV fica bloqueado ate a abertura."}
            </p>
          </div>
        </div>

        {selectedSession && openSessions.length > 1 ? (
          <select
            className="admin-native-select max-w-xs"
            value={effectiveSelectedSessionId}
            onChange={(event) => setSelectedSessionId(event.target.value)}
          >
            {openSessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.cashRegister.name} - {session.operator.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mt-4">
        {!canManage ? (
          <p className="rounded-2xl border border-dashed border-border/75 bg-background/32 px-4 py-4 text-sm text-muted-foreground">
            Modo leitura.
          </p>
        ) : selectedSession ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Inicial</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(selectedSession.openingAmount)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Dinheiro</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(selectedSession.cashSalesAmount)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Suprimento</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(selectedSession.supplyAmount)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/35 p-3">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Sangria</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(selectedSession.withdrawalAmount)}</p>
              </div>
              <div className="rounded-xl border border-primary/25 bg-primary/8 p-3">
                <p className="text-[0.68rem] uppercase tracking-[0.12em] text-muted-foreground">Previsto</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{formatCurrency(selectedSession.expectedAmount)}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={activePanel === "supply" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setActivePanel((current) => (current === "supply" ? "idle" : "supply"))}
              >
                <PlusCircle className="h-4 w-4" />
                Suprimento
              </Button>
              <Button
                type="button"
                variant={activePanel === "withdrawal" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setActivePanel((current) => (current === "withdrawal" ? "idle" : "withdrawal"))}
              >
                <MinusCircle className="h-4 w-4" />
                Sangria
              </Button>
              <Button
                type="button"
                variant={activePanel === "close" ? "default" : "outline"}
                size="sm"
                className="gap-2"
                onClick={() => setActivePanel((current) => (current === "close" ? "idle" : "close"))}
              >
                <Banknote className="h-4 w-4" />
                Fechar caixa
              </Button>
            </div>

            {activePanel === "supply" ? (
              <CashMovementForm sessionId={selectedSession.id} type="SUPPLY" onUpdated={onSessionUpdated} />
            ) : null}
            {activePanel === "withdrawal" ? (
              <CashMovementForm sessionId={selectedSession.id} type="WITHDRAWAL" onUpdated={onSessionUpdated} />
            ) : null}
            {activePanel === "close" ? <CloseCashForm session={selectedSession} onClosed={handleClosed} /> : null}
          </div>
        ) : (
          <OpenCashForm cashRegisters={cashRegisters} operators={operators} onOpened={onSessionOpened} />
        )}

        {lastClosedSession ? (
          <div className="mt-3">
            <CashReportCard session={lastClosedSession} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

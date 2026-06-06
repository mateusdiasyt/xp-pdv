import { Fragment } from "react";

import { PaymentMethod, PaymentStatus, RefundStatus, SaleStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { CancelSaleForm } from "@/presentation/admin/pdv/cancel-sale-form";
import { RetrySaleNfceButton } from "@/presentation/admin/pdv/retry-sale-nfce-button";

type DecimalLike = {
  toString(): string;
};

export type SalesHistoryTableSale = {
  id: string;
  saleNumber: string;
  customerName?: string | null;
  createdAt: Date;
  status: SaleStatus;
  totalAmount: DecimalLike;
  fiscalStatus?: string | null;
  fiscalAccessKey?: string | null;
  fiscalDanfeUrl?: string | null;
  fiscalReference?: string | null;
  fiscalXmlUrl?: string | null;
  operator: {
    name: string;
  };
  cashSession: {
    cashRegister: {
      name: string;
    };
  };
  items: Array<{
    id: string;
  }>;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amount: DecimalLike;
    status: PaymentStatus;
    nsu?: string | null;
    authorizationCode?: string | null;
    externalTransactionId?: string | null;
  }>;
  gameplayRelease?: {
    status?: string | null;
    stationId: string;
  } | null;
  cancellation?: {
    refundStatus?: RefundStatus | null;
    stockRestored: boolean;
  } | null;
};

type SalesHistoryTableProps = {
  sales: SalesHistoryTableSale[];
  canManage: boolean;
  canCancel: boolean;
  emptyMessage?: string;
};

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Credito",
  DEBIT_CARD: "Debito",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  APPROVED: "Aprovado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  DIVERGENT: "Divergente",
};

function formatPaymentAudit(payment: SalesHistoryTableSale["payments"][number]) {
  const identifiers = [
    payment.nsu ? `NSU ${payment.nsu}` : null,
    payment.authorizationCode ? `Aut. ${payment.authorizationCode}` : null,
    payment.externalTransactionId ? `ID ${payment.externalTransactionId}` : null,
  ].filter(Boolean);

  const statusLabel = payment.status === PaymentStatus.APPROVED ? null : paymentStatusLabels[payment.status];

  return [paymentLabels[payment.method], statusLabel, ...identifiers].filter(Boolean).join(" - ");
}

function getFiscalStatusPresentation(status?: string | null) {
  const normalized = (status ?? "").trim().toUpperCase();

  if (normalized === "AUTHORIZED") {
    return {
      label: "Autorizada",
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    };
  }

  if (normalized === "CANCELLED") {
    return {
      label: "Cancelada",
      className: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200",
    };
  }

  if (normalized === "REJECTED") {
    return {
      label: "Rejeitada",
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  if (normalized === "PROCESSING") {
    return {
      label: "Processando",
      className: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    };
  }

  if (normalized === "DISABLED") {
    return {
      label: "Nao configurada",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }

  if (normalized === "SERVICE_ONLY") {
    return {
      label: "NFS-e semanal",
      className: "bg-cyan-100 text-cyan-800 hover:bg-cyan-100",
    };
  }

  if (normalized === "ERROR") {
    return {
      label: "Erro",
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  return {
    label: "Nao emitida",
    className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };
}

function getGameplayStatusPresentation(status?: string | null) {
  const normalized = (status ?? "").trim().toUpperCase();

  if (normalized === "LIBERADA") {
    return {
      label: "Liberada",
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    };
  }

  if (normalized === "PENDENTE_ENVIO") {
    return {
      label: "Pendente",
      className: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    };
  }

  if (normalized === "FALHA_ENVIO") {
    return {
      label: "Falha",
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  return {
    label: "-",
    className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };
}

function getRefundStatusPresentation(status?: RefundStatus | null) {
  if (status === RefundStatus.CONFIRMED) {
    return {
      label: "Estornado",
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    };
  }

  if (status === RefundStatus.PENDING) {
    return {
      label: "Estorno pendente",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }

  if (status === RefundStatus.NOT_REQUIRED) {
    return {
      label: "Sem devolucao",
      className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    };
  }

  if (status === RefundStatus.FAILED) {
    return {
      label: "Falha no estorno",
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  return {
    label: "-",
    className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };
}

function getDefaultRefundMethod(payments: SalesHistoryTableSale["payments"]) {
  const totals = new Map<PaymentMethod, number>();

  for (const payment of payments) {
    totals.set(payment.method, (totals.get(payment.method) ?? 0) + Number(payment.amount));
  }

  return Array.from(totals.entries()).sort((first, second) => second[1] - first[1])[0]?.[0] ?? null;
}

export function SalesHistoryTable({
  sales,
  canManage,
  canCancel,
  emptyMessage = "Nenhuma venda registrada.",
}: SalesHistoryTableProps) {
  const groupedSales = sales.reduce<Array<{ dateKey: string; dateLabel: string; sales: typeof sales }>>(
    (accumulator, sale) => {
      const dateKey = dateKeyFormatter.format(sale.createdAt);
      const group = accumulator.find((entry) => entry.dateKey === dateKey);
      if (group) {
        group.sales.push(sale);
        return accumulator;
      }

      accumulator.push({
        dateKey,
        dateLabel: dayFormatter.format(sale.createdAt),
        sales: [sale],
      });
      return accumulator;
    },
    [],
  );

  return (
    <div className="admin-scrollbar overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Venda</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-right">Total (R$)</TableHead>
            <TableHead className="w-[17rem] text-right">Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : null}
          {groupedSales.map((group) => (
            <Fragment key={`group-fragment-${group.dateKey}`}>
              <TableRow key={`group-${group.dateKey}`} className="bg-muted/20">
                <TableCell colSpan={5} className="py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {group.dateLabel}
                </TableCell>
              </TableRow>
              {group.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium text-foreground">
                    {sale.saleNumber}
                    {sale.customerName ? <p className="text-xs text-muted-foreground">{sale.customerName}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {timeFormatter.format(sale.createdAt)} - {sale.cashSession.cashRegister.name} - {sale.operator.name}
                    </p>
                    {sale.fiscalAccessKey ? (
                      <p className="mt-1 max-w-[21rem] truncate text-[11px] text-muted-foreground">
                        {sale.fiscalAccessKey}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[16rem] flex-wrap gap-1.5">
                      <Badge
                        className={
                          sale.status === SaleStatus.COMPLETED
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                            : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                        }
                      >
                        {sale.status === SaleStatus.COMPLETED ? "Concluida" : "Cancelada"}
                      </Badge>
                      <Badge className={getFiscalStatusPresentation(sale.fiscalStatus).className}>
                        {getFiscalStatusPresentation(sale.fiscalStatus).label}
                      </Badge>
                      {sale.gameplayRelease ? (
                        <Badge className={getGameplayStatusPresentation(sale.gameplayRelease.status).className}>
                          {sale.gameplayRelease.stationId.toUpperCase()}
                        </Badge>
                      ) : null}
                    </div>
                    {sale.cancellation ? (
                      <div className="mt-2 space-y-1">
                        <Badge className={getRefundStatusPresentation(sale.cancellation.refundStatus).className}>
                          {getRefundStatusPresentation(sale.cancellation.refundStatus).label}
                        </Badge>
                        <p className="text-[11px] text-muted-foreground">
                          {sale.cancellation.stockRestored ? "Estoque retornado" : "Sem retorno de estoque"}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted-foreground">{sale.items.length} item(ns)</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {sale.payments.map((payment) => (
                        <p
                          key={payment.id}
                          className={
                            payment.status === PaymentStatus.DIVERGENT
                              ? "text-xs font-semibold text-rose-300"
                              : "text-xs text-muted-foreground"
                          }
                        >
                          {formatPaymentAudit(payment)}
                        </p>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(sale.totalAmount))}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <a
                        href={`/admin/pdv?receipt=${sale.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
                      >
                        Comprovante
                      </a>
                      {sale.fiscalDanfeUrl ? (
                        <a
                          href={sale.fiscalDanfeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
                        >
                          DANFE
                        </a>
                      ) : null}
                      {sale.fiscalReference || sale.fiscalXmlUrl ? (
                        <a
                          href={`/api/fiscal/sales/${sale.id}/xml`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
                        >
                          XML
                        </a>
                      ) : null}
                      {canManage &&
                      sale.status === SaleStatus.COMPLETED &&
                      sale.fiscalStatus !== "AUTHORIZED" &&
                      sale.fiscalStatus !== "SERVICE_ONLY" ? (
                        <RetrySaleNfceButton saleId={sale.id} />
                      ) : null}
                      {canCancel && sale.status === SaleStatus.COMPLETED ? (
                        <CancelSaleForm
                          saleId={sale.id}
                          totalAmount={Number(sale.totalAmount)}
                          defaultRefundMethod={getDefaultRefundMethod(sale.payments)}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

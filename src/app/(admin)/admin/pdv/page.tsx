import Link from "next/link";
import { Fragment } from "react";

import { PaymentMethod, PaymentStatus, RefundStatus, SaleStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getPdvData, getSaleReceiptData } from "@/application/pdv/pdv-service";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { CancelSaleForm } from "@/presentation/admin/pdv/cancel-sale-form";
import { retrySaleNfceRequest } from "@/presentation/admin/pdv/actions";
import { AutoPrintReceipt } from "@/presentation/admin/pdv/auto-print-receipt";
import { PdvWorkspace } from "@/presentation/admin/pdv/pdv-workspace";
import { ReceiptPrintMode } from "@/presentation/admin/pdv/receipt-print-mode";
import { ReceiptPreviewCard } from "@/presentation/admin/pdv/receipt-preview-card";

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Credito",
  DEBIT_CARD: "Debito",
};

function formatPaymentAudit(payment: {
  method: PaymentMethod;
  amount: { toString(): string };
  status: PaymentStatus;
  nsu?: string | null;
  authorizationCode?: string | null;
  externalTransactionId?: string | null;
}) {
  const identifiers = [
    payment.nsu ? `NSU ${payment.nsu}` : null,
    payment.authorizationCode ? `Aut. ${payment.authorizationCode}` : null,
    payment.externalTransactionId ? `ID ${payment.externalTransactionId}` : null,
  ].filter(Boolean);

  const statusLabel = payment.status === PaymentStatus.DIVERGENT ? "Divergente" : null;

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

type PdvPageProps = {
  searchParams: Promise<{
    receipt?: string;
    cashReceived?: string;
    ticket?: string;
    print?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

function parseCashReceived(value?: string) {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default async function PdvPage({ searchParams }: PdvPageProps) {
  const session = await requirePermission(PERMISSIONS.PDV_VIEW);
  const { receipt, cashReceived, ticket, print } = await searchParams;
  const receiptData = receipt ? await getSaleReceiptData(receipt) : null;

  if (receipt && receiptData) {
    return (
      <div className="space-y-6">
        <ReceiptPrintMode />
        <AutoPrintReceipt enabled={print === "ticket"} />
        <ReceiptPreviewCard
          sale={receiptData}
          cashReceived={parseCashReceived(cashReceived)}
          ticketMode={ticket === "quick"}
        />
      </div>
    );
  }

  const { openSessions, products, sales, customers, openComandas, issues } = await getPdvData();
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.PDV_MANAGE);
  const canCancel = hasPermission(session.user.permissions, PERMISSIONS.PDV_CANCEL);

  const customerOptions = customers.map((customer) => ({
    id: customer.id,
    fullName: customer.fullName,
    documentType: customer.documentType,
    documentNumber: customer.documentNumber,
  }));

  const openSessionOptions = openSessions.map((openSession) => ({
    id: openSession.id,
    cashRegister: {
      name: openSession.cashRegister.name,
      code: openSession.cashRegister.code,
    },
  }));

  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    imageUrl: product.imageUrl,
    kind: product.kind,
    gameplayPlanCode: product.gameplayPlanCode,
    gameplayDurationMinutes: product.gameplayDurationMinutes,
    tracksStock: product.tracksStock,
    salePrice: Number(product.salePrice),
    currentStock: product.currentStock,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
  }));

  const openComandasView = openComandas.map((comanda) => ({
    id: comanda.id,
    number: comanda.number,
    isWalkIn: comanda.isWalkIn,
    customerId: comanda.customerId,
    customerName: comanda.customer?.fullName ?? comanda.customerNameSnapshot ?? "Comanda avulsa",
    subtotalAmount: Number(comanda.subtotalAmount),
    itemCount: comanda.items.length,
    openedAt: comanda.openedAt.toISOString(),
    items: comanda.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: Number(item.lineTotal),
      product: {
        name: item.product.name,
        sku: item.product.sku,
        imageUrl: item.product.imageUrl,
        tracksStock: item.product.tracksStock,
        currentStock: item.product.currentStock,
        category: {
          id: item.product.category.id,
          name: item.product.category.name,
          slug: item.product.category.slug,
        },
      },
    })),
  }));

  const groupedSales = sales.reduce<Array<{ dateKey: string; dateLabel: string; sales: typeof sales }>>(
    (accumulator, sale) => {
      const dateKey = sale.createdAt.toISOString().slice(0, 10);
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
    <div className="space-y-6">
      {issues.length > 0 ? (
        <Card className="border-amber-400/30 bg-amber-400/8">
          <CardContent className="space-y-2 pt-5">
            <p className="text-sm font-semibold text-amber-100">O PDV carregou com dados parciais.</p>
            <p className="text-sm text-amber-50/90">
              Houve falha ao consultar: {issues.join(", ")}. A tela continua acessivel para evitar travamento total.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div>
        <PdvWorkspace
          canManage={canManage}
          customers={customerOptions}
          openSessions={openSessionOptions}
          openComandas={openComandasView}
          products={productOptions}
        />
      </div>

      <div>
        <details className="group overflow-hidden rounded-[1.4rem] border border-border/75 bg-card/82 shadow-[0_22px_70px_-48px_rgba(0,0,0,0.85)]">
          <summary className="flex cursor-pointer list-none flex-col gap-3 px-4 py-4 transition-colors hover:bg-background/28 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-sm font-bold text-primary">
                {sales.length}
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Vendas recentes</p>
                <p className="text-xs text-muted-foreground">
                  Clique para abrir as ultimas vendas agrupadas por data.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="group-open:hidden">Abrir historico</span>
              <span className="hidden group-open:inline">Ocultar historico</span>
              <span className="grid h-8 w-8 place-items-center rounded-full border border-border/75 bg-background/60 text-base leading-none text-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </div>
          </summary>

          <div className="border-t border-border/70 p-3">
            <div className="admin-scrollbar overflow-x-auto">
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Venda</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Caixa</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Estorno</TableHead>
                  <TableHead>Fiscal</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Gameplay</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Total (R$)</TableHead>
                  <TableHead>Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-sm text-muted-foreground">
                      Nenhuma venda registrada.
                    </TableCell>
                  </TableRow>
                ) : null}
                {groupedSales.map((group) => (
                  <Fragment key={`group-fragment-${group.dateKey}`}>
                    <TableRow key={`group-${group.dateKey}`} className="bg-muted/20">
                      <TableCell colSpan={12} className="py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {group.dateLabel}
                      </TableCell>
                    </TableRow>
                    {group.sales.map((sale) => (
                      <TableRow key={sale.id}>
                        <TableCell className="font-medium text-foreground">
                          {sale.saleNumber}
                          {sale.customerName ? <p className="text-xs text-muted-foreground">{sale.customerName}</p> : null}
                        </TableCell>
                        <TableCell>{timeFormatter.format(sale.createdAt)}</TableCell>
                        <TableCell>{sale.cashSession.cashRegister.name}</TableCell>
                        <TableCell>{sale.operator.name}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              sale.status === SaleStatus.COMPLETED
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "bg-rose-100 text-rose-700 hover:bg-rose-100"
                            }
                          >
                            {sale.status === SaleStatus.COMPLETED ? "Concluida" : "Cancelada"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {sale.cancellation ? (
                            <div className="space-y-1">
                              <Badge className={getRefundStatusPresentation(sale.cancellation.refundStatus).className}>
                                {getRefundStatusPresentation(sale.cancellation.refundStatus).label}
                              </Badge>
                              <p className="text-[11px] text-muted-foreground">
                                {sale.cancellation.stockRestored ? "Estoque retornado" : "Sem retorno de estoque"}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className={getFiscalStatusPresentation(sale.fiscalStatus).className}>
                              {getFiscalStatusPresentation(sale.fiscalStatus).label}
                            </Badge>
                            {sale.fiscalAccessKey ? (
                              <p className="max-w-[19rem] truncate text-[11px] text-muted-foreground">
                                {sale.fiscalAccessKey}
                              </p>
                            ) : null}
                          </div>
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
                        <TableCell>
                          {sale.gameplayRelease ? (
                            <div className="space-y-1">
                              <Badge className={getGameplayStatusPresentation(sale.gameplayRelease.status).className}>
                                {getGameplayStatusPresentation(sale.gameplayRelease.status).label}
                              </Badge>
                              <p className="text-[11px] text-muted-foreground">
                                {sale.gameplayRelease.stationId.toUpperCase()}
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{sale.items.length}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(sale.totalAmount))}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/pdv?receipt=${sale.id}`}
                              className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
                            >
                              Comprovante
                            </Link>
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
                            {canManage &&
                            sale.status === SaleStatus.COMPLETED &&
                            sale.fiscalStatus !== "AUTHORIZED" &&
                            sale.fiscalStatus !== "SERVICE_ONLY" ? (
                              <form action={retrySaleNfceRequest}>
                                <input type="hidden" name="saleId" value={sale.id} />
                                <button
                                  type="submit"
                                  className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70"
                                >
                                  Reemitir NFC-e
                                </button>
                              </form>
                            ) : null}
                            {canCancel && sale.status === SaleStatus.COMPLETED ? (
                              <CancelSaleForm saleId={sale.id} totalAmount={Number(sale.totalAmount)} />
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
          </div>
        </details>
      </div>
    </div>
  );
}

import Link from "next/link";

import { PaymentMethod, PaymentStatus, SaleStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getPaymentAuditData } from "@/application/payments/payment-audit-service";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";

type PaymentsPageProps = {
  searchParams: Promise<{
    query?: string;
    startDate?: string;
    endDate?: string;
    method?: string;
    status?: string;
    amount?: string;
  }>;
};

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Cartao de credito",
  DEBIT_CARD: "Cartao de debito",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  APPROVED: "Aprovado",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  DIVERGENT: "Divergente",
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function getPaymentStatusBadge(status: PaymentStatus) {
  if (status === PaymentStatus.DIVERGENT) {
    return {
      label: paymentStatusLabels[status],
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  if (status === PaymentStatus.REFUNDED || status === PaymentStatus.CANCELLED) {
    return {
      label: paymentStatusLabels[status],
      className: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200",
    };
  }

  return {
    label: paymentStatusLabels[status],
    className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  };
}

function hasTraceIdentifier(payment: {
  nsu?: string | null;
  authorizationCode?: string | null;
  externalTransactionId?: string | null;
}) {
  return Boolean(payment.nsu || payment.authorizationCode || payment.externalTransactionId);
}

function isTraceableMethod(method: PaymentMethod) {
  return method === PaymentMethod.PIX || method === PaymentMethod.CREDIT_CARD || method === PaymentMethod.DEBIT_CARD;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requirePermission(PERMISSIONS.PDV_VIEW);
  const filters = await searchParams;
  const audit = await getPaymentAuditData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Conferencia de caixa"
        title="Pagamentos"
        description="Busque transacoes por NSU, autorizacao, ID Pix, valor, venda, cliente e maquininha para fechar o caixa com rastreabilidade."
      />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          title="Pagamentos listados"
          value={String(audit.summary.totalPayments)}
          helper="Limite de 250 registros por consulta"
        />
        <MetricCard
          title="Valor filtrado"
          value={formatCurrency(Number(audit.summary.totalAmount))}
          helper="Soma dos pagamentos encontrados"
        />
        <MetricCard
          title="Cartao/Pix"
          value={String(audit.summary.traceableCount)}
          helper="Transacoes que podem ter NSU, autorizacao ou ID"
        />
        <MetricCard
          title="Sem rastreio"
          value={String(audit.summary.withoutTraceCount)}
          helper={`${audit.summary.divergentCount} divergencia(s) no periodo`}
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Filtro de pagamentos</CardTitle>
          <CardDescription>
            Para achar um comprovante, comece por NSU/autorizacao. Se nao tiver, filtre por data + valor + metodo.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            method="get"
            action="/admin/payments"
            className="grid gap-3 xl:grid-cols-[minmax(240px,2fr)_150px_150px_160px_160px_140px_auto_auto]"
          >
            <div className="space-y-1">
              <label htmlFor="query" className="text-xs text-muted-foreground">
                Busca
              </label>
              <Input
                id="query"
                name="query"
                placeholder="NSU, autorizacao, ID, venda ou cliente"
                defaultValue={audit.filters.query}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="startDate" className="text-xs text-muted-foreground">
                Data inicial
              </label>
              <Input id="startDate" name="startDate" type="date" defaultValue={audit.filters.startDate} />
            </div>
            <div className="space-y-1">
              <label htmlFor="endDate" className="text-xs text-muted-foreground">
                Data final
              </label>
              <Input id="endDate" name="endDate" type="date" defaultValue={audit.filters.endDate} />
            </div>
            <div className="space-y-1">
              <label htmlFor="method" className="text-xs text-muted-foreground">
                Metodo
              </label>
              <select
                id="method"
                name="method"
                defaultValue={audit.filters.method}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/90 px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <option value="ALL">Todos</option>
                {Object.values(PaymentMethod).map((method) => (
                  <option key={method} value={method}>
                    {paymentLabels[method]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="status" className="text-xs text-muted-foreground">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={audit.filters.status}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/90 px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <option value="ALL">Todos</option>
                {Object.values(PaymentStatus).map((status) => (
                  <option key={status} value={status}>
                    {paymentStatusLabels[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="amount" className="text-xs text-muted-foreground">
                Valor
              </label>
              <Input id="amount" name="amount" placeholder="50,00" defaultValue={audit.filters.amount} />
            </div>
            <button
              type="submit"
              className="h-10 self-end rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Filtrar
            </button>
            <Link
              href="/admin/payments"
              className="inline-flex h-10 self-end items-center justify-center rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Limpar
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transacoes encontradas</CardTitle>
          <CardDescription>
            Use os dados abaixo para comparar com relatorio da maquininha, Pix ou extrato do banco.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Metodo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rastreio</TableHead>
                <TableHead>Maquininha</TableHead>
                <TableHead>Cartao</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                    Nenhum pagamento encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : null}
              {audit.payments.map((payment) => {
                const traceableWithoutId = isTraceableMethod(payment.method) && !hasTraceIdentifier(payment);

                return (
                  <TableRow key={payment.id} className={traceableWithoutId ? "bg-amber-500/5" : undefined}>
                    <TableCell>{dateTimeFormatter.format(payment.sale.createdAt)}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {payment.sale.saleNumber}
                      <p className="text-xs text-muted-foreground">{payment.sale.customerName ?? "Comanda avulsa"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {payment.sale.operator.name} - {payment.sale.cashSession.cashRegister.name}
                      </p>
                    </TableCell>
                    <TableCell>{paymentLabels[payment.method]}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={getPaymentStatusBadge(payment.status).className}>
                          {getPaymentStatusBadge(payment.status).label}
                        </Badge>
                        {payment.sale.status === SaleStatus.CANCELLED ? (
                          <p className="text-[11px] text-rose-300">Venda cancelada</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{payment.nsu ? `NSU ${payment.nsu}` : "NSU nao informado"}</p>
                        <p>{payment.authorizationCode ? `Aut. ${payment.authorizationCode}` : "Autorizacao nao informada"}</p>
                        {payment.externalTransactionId ? (
                          <p className="max-w-[18rem] truncate">ID {payment.externalTransactionId}</p>
                        ) : null}
                        {traceableWithoutId ? (
                          <p className="font-medium text-amber-200">Sem dado de rastreio</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground">{payment.terminalId ?? "-"}</p>
                      {payment.receiptText ? (
                        <p className="max-w-[15rem] truncate text-[11px] text-muted-foreground">{payment.receiptText}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-foreground">{payment.cardBrand ?? "-"}</p>
                      {payment.cardLast4 ? <p className="text-[11px] text-muted-foreground">Final {payment.cardLast4}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-medium text-foreground">{formatCurrency(Number(payment.amount))}</p>
                      {payment.approvedAmount ? (
                        <p className="text-[11px] text-muted-foreground">
                          Aprovado {formatCurrency(Number(payment.approvedAmount))}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/pdv?receipt=${payment.sale.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
                      >
                        Comprovante
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

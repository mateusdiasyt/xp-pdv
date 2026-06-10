import { Banknote, CreditCard, ReceiptText, TrendingUp, WalletCards } from "lucide-react";
import { PaymentMethod } from "@prisma/client";
import type { ComponentType } from "react";

import { requirePermission } from "@/application/auth/guards";
import { getReportsData, type ReportPaymentRow } from "@/application/reports/report-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { AutoPrintReceipt } from "@/presentation/admin/pdv/auto-print-receipt";
import { ReceiptPrintMode } from "@/presentation/admin/pdv/receipt-print-mode";
import { ReportFilterForm } from "@/presentation/admin/reports/report-filter-form";
import { ReportPrintAction } from "@/presentation/admin/reports/report-print-action";
import { ReportThermalPrintCard } from "@/presentation/admin/reports/report-thermal-print-card";

type ReportsPageProps = {
  searchParams: Promise<{
    period?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    print?: string;
  }>;
};

type SummaryCardProps = {
  title: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  highlight?: boolean;
};

function formatPercent(value: number) {
  return `${value.toFixed(2).replace(".", ",")}%`;
}

function SummaryCard({ title, value, helper, icon: Icon, highlight = false }: SummaryCardProps) {
  return (
    <Card className={highlight ? "border-primary/35 bg-primary/10" : "border-border/75 bg-card/78"}>
      <CardContent className="flex min-h-32 flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-background/45 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div>
          <p className="text-2xl font-black tracking-[-0.02em] text-foreground">{value}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function paymentCardClass(row: ReportPaymentRow) {
  if (row.amount <= 0) {
    return "border-border/65 bg-background/25";
  }

  if (row.method === PaymentMethod.CASH) {
    return "border-emerald-400/35 bg-emerald-400/10";
  }

  if (row.method === PaymentMethod.PIX) {
    return "border-cyan-400/35 bg-cyan-400/10";
  }

  if (row.method === PaymentMethod.CREDIT_CARD) {
    return "border-violet-400/35 bg-violet-400/10";
  }

  return "border-amber-400/35 bg-amber-400/10";
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requirePermission(PERMISSIONS.REPORTS_VIEW);
  const { period, date, startDate, endDate, print } = await searchParams;
  const reports = await getReportsData({ period, date, startDate, endDate });
  const active = reports.active;
  const hasReconciliationDifference = Math.abs(active.summary.reconciliationDifference) >= 0.01;

  if (print === "thermal") {
    return (
      <div className="space-y-6">
        <ReceiptPrintMode />
        <AutoPrintReceipt enabled />
        <ReportThermalPrintCard report={active} generatedAt={reports.generatedAt} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <PageHeader
          eyebrow="Modulo ERP"
          title="Relatorios"
          description="Vendas, pagamentos, caixa e itens vendidos considerando o turno operacional configurado."
        />
        <div className="flex items-center justify-end">
          <ReportPrintAction
            customStartDate={reports.customStartDate}
            customEndDate={reports.customEndDate}
          />
        </div>
      </div>

      <Card className="z-20 overflow-visible border-border/75 bg-card/78">
        <CardContent className="overflow-visible p-4">
          <ReportFilterForm
            selectedPeriod={reports.selectedPeriod}
            customStartDate={reports.customStartDate}
            customEndDate={reports.customEndDate}
          />
        </CardContent>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Vendido"
          value={formatCurrency(active.summary.netRevenue)}
          helper={`${active.summary.salesCount} venda(s) | ${active.summary.itemsCount} item(ns)`}
          icon={ReceiptText}
          highlight
        />
        <SummaryCard
          title="Ticket medio"
          value={formatCurrency(active.summary.averageTicket)}
          helper={active.range.label}
          icon={TrendingUp}
        />
        <SummaryCard
          title="Lucro bruto"
          value={formatCurrency(active.summary.grossProfit)}
          helper={`Margem ${formatPercent(active.summary.grossMarginPercent)}`}
          icon={WalletCards}
        />
        <SummaryCard
          title="Conferencia"
          value={formatCurrency(active.summary.paymentTotal)}
          helper={
            hasReconciliationDifference
              ? `Diferenca ${formatCurrency(active.summary.reconciliationDifference)}`
              : "Pagamentos batem com vendas"
          }
          icon={CreditCard}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {active.paymentRows.map((row) => (
          <Card key={row.method} className={paymentCardClass(row)}>
            <CardContent className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-sm font-black text-foreground">{row.label}</p>
                <Badge variant="outline" className="h-6 px-2.5 text-[11px]">
                  {formatPercent(row.sharePercent)}
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-[-0.02em] text-foreground">{formatCurrency(row.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.salesCount} venda(s) | ticket {formatCurrency(row.averageTicket)}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <Card className="border-border/75 bg-card/78">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Relatorio por pagamento</CardTitle>
            <CardDescription>{active.range.label}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Forma</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Vendas</TableHead>
                  <TableHead className="text-right">Transacoes</TableHead>
                  <TableHead className="text-right">Ticket</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.paymentRows.map((row) => (
                  <TableRow key={row.method}>
                    <TableCell className="font-medium text-foreground">{row.label}</TableCell>
                    <TableCell className="text-right font-semibold text-foreground">{formatCurrency(row.amount)}</TableCell>
                    <TableCell className="text-right">{row.salesCount}</TableCell>
                    <TableCell className="text-right">{row.transactionCount}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.averageTicket)}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.sharePercent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/75 bg-card/78">
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Movimento de caixa</CardTitle>
            <CardDescription>Dinheiro, suprimento e sangria no periodo.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Dinheiro em vendas</p>
                <Banknote className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-black text-foreground">
                {formatCurrency(active.cashMovementSummary.cashSalesAmount)}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Abertura</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {formatCurrency(active.cashMovementSummary.openingAmount)}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Suprimento</p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatCurrency(active.cashMovementSummary.supplyAmount)}
                </p>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Sangria</p>
                <p className="mt-2 text-lg font-black text-foreground">
                  {formatCurrency(active.cashMovementSummary.withdrawalAmount)}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">Saldo final do caixa</p>
              <p className="mt-2 text-xl font-black text-foreground">
                {formatCurrency(active.cashMovementSummary.finalCashBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Liquido dinheiro {formatCurrency(active.cashMovementSummary.netCashFlow)}
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 xl:grid-cols-2">
        <Card className="border-border/75 bg-card/78">
          <CardHeader>
            <CardTitle>Vendas por categoria</CardTitle>
            <CardDescription>Receita bruta, custo e margem por grupo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.categoryRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      Nenhuma venda concluida no periodo.
                    </TableCell>
                  </TableRow>
                ) : null}
                {active.categoryRows.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium text-foreground">{row.category}</TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.grossRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.grossProfit)}</TableCell>
                    <TableCell className="text-right">{formatPercent(row.grossMarginPercent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/75 bg-card/78">
          <CardHeader>
            <CardTitle>Itens vendidos</CardTitle>
            <CardDescription>Produtos e servicos vendidos no periodo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Vendido</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.itemRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                      Nenhum item vendido no periodo.
                    </TableCell>
                  </TableRow>
                ) : null}
                {active.itemRows.map((row) => (
                  <TableRow key={`${row.category}-${row.item}`}>
                    <TableCell>
                      <p className="font-medium text-foreground">{row.item}</p>
                      <p className="text-xs text-muted-foreground">{row.category}</p>
                    </TableCell>
                    <TableCell className="text-right">{row.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.grossRevenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.grossProfit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

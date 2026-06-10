import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Goal, Wallet } from "lucide-react";

import { requireSession } from "@/application/auth/guards";
import { getDashboardSummary } from "@/application/dashboard/dashboard-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, PERMISSIONS, type PermissionKey } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { RevenueTrendChart } from "@/presentation/admin/dashboard/revenue-trend-chart";

const quickActionClass =
  "inline-flex h-8 w-full items-center justify-between rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted";

function formatGrowth(value: number) {
  if (value > 0) {
    return `+${value.toFixed(1)}%`;
  }

  return `${value.toFixed(1)}%`;
}

function growthTone(value: number) {
  if (value >= 0) {
    return "text-emerald-400";
  }

  return "text-rose-400";
}

function percentOfTarget(actual: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.min(Math.round((actual / target) * 100), 100);
}

const fallbackRoutes: Array<{ permission: PermissionKey; path: string }> = [
  { permission: PERMISSIONS.PDV_VIEW, path: "/admin/pdv" },
  { permission: PERMISSIONS.PAYMENTS_VIEW, path: "/admin/payments" },
  { permission: PERMISSIONS.ACCOUNTS_VIEW, path: "/admin/accounts" },
  { permission: PERMISSIONS.REPORTS_VIEW, path: "/admin/reports" },
  { permission: PERMISSIONS.FISCAL_VIEW, path: "/admin/fiscal" },
  { permission: PERMISSIONS.SALES_VIEW, path: "/admin/sales" },
  { permission: PERMISSIONS.SERVICES_VIEW, path: "/admin/services" },
  { permission: PERMISSIONS.PRODUCTS_VIEW, path: "/admin/products" },
  { permission: PERMISSIONS.STOCK_VIEW, path: "/admin/stock" },
  { permission: PERMISSIONS.USERS_VIEW, path: "/admin/users" },
];

export default async function AdminDashboardPage() {
  const session = await requireSession();

  if (session.user.roleSlug !== "administrador" && !hasPermission(session.user.permissions, PERMISSIONS.DASHBOARD_VIEW)) {
    const fallback = fallbackRoutes.find((item) => hasPermission(session.user.permissions, item.permission));
    if (fallback) {
      redirect(buildTenantAdminPath(session.user.tenantSlug, fallback.path));
    }

    redirect("/forbidden");
  }

  const summary = await getDashboardSummary();
  const averageTicket = summary.todaySalesCount > 0 ? summary.todayRevenue / summary.todaySalesCount : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controle operacional"
        title="Painel"
        description="Visao operacional das vendas. A abertura e o fechamento real do caixa agora ficam dentro do PDV."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Faturamento operacional"
          value={formatCurrency(summary.todayRevenue)}
          helper={`${formatGrowth(summary.revenueGrowthPercent)} vs periodo anterior`}
        />
        <MetricCard
          title="Vendas operacionais"
          value={summary.todaySalesCount}
          helper={`${formatGrowth(summary.salesGrowthPercent)} vs periodo anterior`}
        />
        <MetricCard title="Ticket medio" value={formatCurrency(averageTicket)} helper="Media por venda operacional" />
        <MetricCard
          title="Faturamento do mes"
          value={formatCurrency(summary.monthRevenue)}
          helper={`${formatGrowth(summary.monthGrowthPercent)} vs mes anterior`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Analise de vendas (ultimos 14 dias)</CardTitle>
            <CardDescription>Curva de faturamento e volume de vendas para leitura rapida da operacao.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.chart.length === 0 ? (
              <p className="rounded-xl border border-border/75 bg-muted/35 px-3 py-4 text-sm text-muted-foreground">
                Ainda nao ha dados suficientes para exibir o grafico.
              </p>
            ) : (
              <RevenueTrendChart data={summary.chart} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Produtos mais vendidos</CardTitle>
            <CardDescription>Ranking mensal por quantidade vendida.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.topProducts.length === 0 ? (
              <p className="rounded-xl border border-border/75 bg-muted/35 px-3 py-4 text-sm text-muted-foreground">
                Nenhuma venda registrada neste mes.
              </p>
            ) : (
              summary.topProducts.map((item, index) => (
                <div key={item.productId} className="rounded-xl border border-border/80 bg-background/55 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {index + 1}. {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <Badge variant="outline" className="border-border/80 bg-muted/30 text-foreground">
                      {item.quantity} un.
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">Faturamento: {formatCurrency(item.revenue)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr,1fr]">
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Metas de hoje</CardTitle>
            <CardDescription>Comparativo da meta diaria automatica e saldo acumulado do mes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!summary.goal ? (
              <div className="space-y-3 rounded-xl border border-dashed border-border/80 bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Configure o planejamento mensal para ativar esse painel.</p>
                <Link href="/admin/metas" className={quickActionClass}>
                  Configurar metas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border/80 bg-background/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Meta geral</p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    Meta geral de faturamento
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Faturamento</p>
                    <p className="font-semibold text-foreground">
                      {formatCurrency(summary.goal.revenueActual)} / {formatCurrency(summary.goal.revenueTarget)}
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-muted/70">
                    <div
                      className="h-2 rounded-full bg-chart-2 transition-all"
                      style={{
                        width: `${percentOfTarget(summary.goal.revenueActual, summary.goal.revenueTarget)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summary.goal.revenuePercent.toFixed(1)}% da meta geral
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-background/55 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Meta acumulada</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(summary.goal.monthExpectedToDate)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/55 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Realizado acumulado</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(summary.goal.monthRevenueActual)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-background/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Saldo acumulado do mes</p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      summary.goal.monthBalanceToDate >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {summary.goal.monthBalanceToDate >= 0 ? "Saldo positivo " : "Saldo a recuperar "}
                    {formatCurrency(Math.abs(summary.goal.monthBalanceToDate))}
                  </p>
                  {summary.goal.remainingDaysInCurrentMonth > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Ritmo sugerido: {formatCurrency(summary.goal.recommendedDailyTarget)} por dia nos proximos{" "}
                      {summary.goal.remainingDaysInCurrentMonth} dia(s).
                    </p>
                  ) : null}
                </div>

                <Link href="/admin/metas" className={quickActionClass}>
                  Gerenciar metas
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle>Alertas e atalhos</CardTitle>
            <CardDescription>Produtos criticos e acessos rapidos do dia a dia.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {summary.lowStockProducts.length === 0 ? (
                <p className="rounded-xl border border-border/75 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
                  Nenhum produto com estoque critico no momento.
                </p>
              ) : (
                summary.lowStockProducts.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-border/80 bg-background/55 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-amber-400">
                      {item.currentStock} / min {item.minStock}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 border-t border-border/75 pt-3">
              <Link href="/admin/pdv" className={quickActionClass}>
                Abrir PDV
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin/pdv" className={quickActionClass}>
                Caixa no PDV
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/admin/metas" className={quickActionClass}>
                Ajustar metas
                <Goal className="h-4 w-4" />
              </Link>
            </div>

            <div className={`text-xs ${growthTone(summary.revenueGrowthPercent)}`}>
              Receita diaria: {formatGrowth(summary.revenueGrowthPercent)} em relacao a ontem.
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

import { CalendarDays, Flag } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getGoalsPageData } from "@/application/goals/goal-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { UpsertMonthlyGoalPlanForm } from "@/presentation/admin/goals/upsert-monthly-goal-plan-form";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function toPercent(actual: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.round((actual / target) * 100);
}

function progressColor(percent: number) {
  if (percent >= 100) {
    return "bg-emerald-500";
  }
  if (percent >= 70) {
    return "bg-amber-500";
  }
  return "bg-primary";
}

function ProgressRow({
  label,
  actual,
  target,
  valueFormatter,
}: {
  label: string;
  actual: number;
  target: number;
  valueFormatter: (value: number) => string;
}) {
  const percent = toPercent(actual, target);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">{label}</p>
        <p className="font-semibold text-foreground">
          {valueFormatter(actual)} / {valueFormatter(target)}
        </p>
      </div>
      <div className="h-2 rounded-full bg-muted/70">
        <div
          className={`h-2 rounded-full transition-all ${progressColor(percent)}`}
          style={{
            width: `${Math.min(percent, 100)}%`,
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{percent}% da meta</p>
    </div>
  );
}

export default async function MetasPage() {
  await requirePermission(PERMISSIONS.GOALS_VIEW);
  const data = await getGoalsPageData();
  const todaySummary = data.todaySummary;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Planejamento comercial"
        title="Metas diarias e mensais"
        description="Defina custo mensal e lucro desejado para calcular automaticamente a meta diaria geral de faturamento."
      />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Planejamento mensal</CardTitle>
            <CardDescription>
              Informe custo da empresa e lucro desejado para gerar automaticamente a meta diaria geral de faturamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <UpsertMonthlyGoalPlanForm
              defaultMonthReference={data.currentMonthReference}
              defaultCompanyCost={data.monthlyPlan ? data.monthlyPlan.companyCost.toFixed(2) : undefined}
              defaultDesiredProfitPercent={data.monthlyPlan ? data.monthlyPlan.desiredProfitPercent.toFixed(2) : undefined}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Resumo mensal</CardTitle>
            <CardDescription>
              {data.monthlyPlan
                ? `Plano ativo para ${dateFormatter.format(data.monthlyPlan.monthStart)}.`
                : "Nenhum plano mensal cadastrado para o mes atual."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {!data.monthlyPlan ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
                Cadastre o planejamento mensal para gerar as metas diarias automaticamente.
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Custo da empresa</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(data.monthlyPlan.companyCost)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Lucro desejado</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {data.monthlyPlan.desiredProfitPercent.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Meta mensal</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(data.monthlyPlan.monthlyRevenueTarget)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Meta diaria (auto)</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(data.monthlyPlan.dailyRevenueTarget)}
                    </p>
                  </div>
                </div>
                <ProgressRow
                  label="Faturamento mensal"
                  actual={data.monthlyPlan.monthRevenueActual}
                  target={data.monthlyPlan.monthlyRevenueTarget}
                  valueFormatter={(value) => formatCurrency(value)}
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Meta acumulada</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(data.monthlyPlan.expectedRevenueToDate)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Realizado acumulado</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {formatCurrency(data.monthlyPlan.monthRevenueActual)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Saldo acumulado</p>
                    <p
                      className={`mt-1 text-sm font-semibold ${
                        data.monthlyPlan.balanceToDate >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {data.monthlyPlan.balanceToDate >= 0 ? "Saldo positivo " : "Saldo a recuperar "}
                      {formatCurrency(Math.abs(data.monthlyPlan.balanceToDate))}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border/80 bg-background/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ritmo sugerido</p>
                  {data.monthlyPlan.remainingDaysInCurrentMonth > 0 ? (
                    <p className="mt-1 text-sm text-foreground">
                      Para fechar o mes na meta:{" "}
                      <span className="font-semibold text-primary">
                        {formatCurrency(data.monthlyPlan.recommendedDailyTarget)}
                      </span>{" "}
                      por dia nos proximos {data.monthlyPlan.remainingDaysInCurrentMonth} dia(s).
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-muted-foreground">Mes encerrado para calculo de ritmo diario.</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="border-b border-border/70 pb-4">
            <CardTitle>Meta de hoje</CardTitle>
            <CardDescription>Resumo atual da data {dateFormatter.format(new Date())}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!todaySummary ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 p-4 text-sm text-muted-foreground">
                Configure o planejamento mensal para ativar o acompanhamento automatico da meta diaria.
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Data</p>
                    <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {dateFormatter.format(new Date(todaySummary.goalDate))}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Escopo</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Meta geral do dia</p>
                  </div>
                </div>

                <ProgressRow
                  label="Faturamento"
                  actual={todaySummary.revenueActual}
                  target={todaySummary.revenueTarget}
                  valueFormatter={(value) => formatCurrency(value)}
                />

                <div className="rounded-xl border border-border/80 bg-background/55 p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Saldo do dia</p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      todaySummary.dailyBalance >= 0 ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {todaySummary.dailyBalance >= 0 ? "Saldo positivo " : "Faltante "}
                    {formatCurrency(Math.abs(todaySummary.dailyBalance))}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Historico de metas</CardTitle>
          <CardDescription>{data.goals.length} registro(s) recente(s).</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Meta geral</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.goals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                    Nenhuma meta cadastrada ainda.
                  </TableCell>
                </TableRow>
              ) : null}
              {data.goals.map((goal) => {
                const revenuePercent = toPercent(goal.revenueActual, goal.revenueTarget);

                return (
                  <TableRow key={goal.id}>
                    <TableCell>{dateFormatter.format(goal.goalDate)}</TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">
                        {formatCurrency(goal.revenueActual)} / {formatCurrency(goal.revenueTarget)}
                      </p>
                      <p className="text-xs text-muted-foreground">{revenuePercent}%</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          revenuePercent >= 100
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10"
                            : "border border-primary/30 bg-primary/15 text-primary hover:bg-primary/15"
                        }
                      >
                        <Flag className="mr-1 h-3.5 w-3.5" />
                        {revenuePercent >= 100 ? "Meta batida" : "Em andamento"}
                      </Badge>
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

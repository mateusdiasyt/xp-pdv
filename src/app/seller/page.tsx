import { ExternalLink } from "lucide-react";

import { getPlatformSellerDashboard, requirePlatformSeller } from "@/application/platform/seller-service";
import { SellerCheckoutForm } from "@/components/platform/seller-checkout-form";
import { SellerSignOutButton } from "@/components/platform/seller-sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function statusLabel(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "authorized" || normalized === "active") {
    return "Confirmada";
  }

  if (normalized === "pending") {
    return "Aguardando";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "Cancelada";
  }

  return status;
}

function statusClassName(status: string) {
  const normalized = status.toLowerCase();

  if (normalized === "authorized" || normalized === "active") {
    return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  }

  if (normalized === "pending") {
    return "border-amber-400/35 bg-amber-400/12 text-amber-100";
  }

  return "border-white/10 bg-white/5 text-white/58";
}

export default async function SellerPage() {
  const seller = await requirePlatformSeller();
  const dashboard = await getPlatformSellerDashboard(seller.id);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-border/80 bg-card/78 p-5 shadow-[0_28px_90px_-62px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mendoza PDV</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Painel do vendedor</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {dashboard.seller.name} - comissao padrao de {dashboard.seller.commissionLabel}.
              </p>
            </div>
            <SellerSignOutButton />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Links gerados</CardDescription>
              <CardTitle className="text-3xl">{dashboard.stats.generatedLinks}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vendas confirmadas</CardDescription>
              <CardTitle className="text-3xl">{dashboard.stats.confirmedSales}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total vendido</CardDescription>
              <CardTitle className="text-3xl">{dashboard.stats.grossLabel}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Comissao prevista</CardDescription>
              <CardTitle className="text-3xl">{dashboard.stats.pendingCommissionLabel}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <SellerCheckoutForm tenants={dashboard.tenants} />

        <Card>
          <CardHeader className="border-b border-border/70">
            <CardTitle>Ultimos links</CardTitle>
            <CardDescription>Pagamentos gerados por este vendedor.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {dashboard.recentSubscriptions.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">Nenhum link gerado ainda.</div>
            ) : (
              <div className="divide-y divide-border/70">
                {dashboard.recentSubscriptions.map((subscription) => (
                  <article
                    key={subscription.id}
                    className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.3fr)_0.7fr_0.7fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-foreground">{subscription.tenantName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateFormatter.format(subscription.createdAt)} - Plano {subscription.planName} /{" "}
                        {subscription.billingCycleMonths} mes(es)
                      </p>
                    </div>
                    <p className="text-sm font-black text-foreground">{subscription.amountLabel}</p>
                    <p className="text-sm text-muted-foreground">Comissao {subscription.commissionLabel}</p>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <Badge className={statusClassName(subscription.status)}>{statusLabel(subscription.status)}</Badge>
                      {subscription.initPoint ? (
                        <Button
                          render={<a href={subscription.initPoint} target="_blank" rel="noreferrer" />}
                          size="sm"
                          variant="outline"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Link
                        </Button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

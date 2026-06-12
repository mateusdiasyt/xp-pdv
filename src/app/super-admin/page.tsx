import Link from "next/link";
import { PlatformTenantStatus, type PlatformTenant } from "@prisma/client";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  PowerOff,
  RotateCcw,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  approveTenantAction,
  reactivateTenantAction,
  suspendTenantAction,
} from "@/app/super-admin/actions";
import {
  getPlatformGatewayConfigurationSnapshot,
  type PlatformGatewayConfigurationSnapshot,
} from "@/application/platform/gateway-service";
import {
  formatCentsToBRL,
} from "@/domain/platform/billing-plans";
import { listPlatformBillingSummaries } from "@/application/platform/mercado-pago-billing-service";
import { requirePlatformAdmin } from "@/application/platform/platform-guards";
import { buildTenantAdminPath, listPlatformTenants } from "@/application/platform/platform-service";
import { listPlatformSellersWithStats } from "@/application/platform/seller-service";
import { SuperAdminGatewayForm } from "@/components/platform/super-admin-gateway-form";
import { SuperAdminManualAccessForm } from "@/components/platform/super-admin-manual-access-form";
import { SuperAdminSellerForm } from "@/components/platform/super-admin-seller-form";
import { SuperAdminSellerStatusButton } from "@/components/platform/super-admin-seller-status-button";
import { SuperAdminSignOutButton } from "@/components/platform/super-admin-sign-out-button";
import { TenantSubscriptionCheckoutButton } from "@/components/platform/tenant-subscription-checkout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlatformTenantRow = PlatformTenant & {
  users: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    isOwner: boolean;
    isPlatformAdmin: boolean;
    createdAt: Date;
    updatedAt: Date;
    tenantId: string;
  }>;
};

type SuperAdminPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

type SuperAdminTab = "users" | "gateway" | "sellers";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const planStatusLabels: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  suspended: "Suspenso",
  expired: "Vencido",
};

function statusLabel(status: PlatformTenantStatus) {
  const labels: Record<PlatformTenantStatus, string> = {
    PENDING: "Pendente",
    ACTIVE: "Ativo",
    SUSPENDED: "Suspenso",
    FAILED: "Falha",
  };

  return labels[status];
}

function statusClassName(status: PlatformTenantStatus) {
  if (status === PlatformTenantStatus.ACTIVE) {
    return "border-emerald-400/35 bg-emerald-400/12 text-emerald-200";
  }

  if (status === PlatformTenantStatus.PENDING) {
    return "border-amber-400/35 bg-amber-400/12 text-amber-100";
  }

  if (status === PlatformTenantStatus.FAILED) {
    return "border-rose-400/35 bg-rose-400/12 text-rose-100";
  }

  return "border-white/10 bg-white/5 text-white/48";
}

function formatDate(date?: Date | string | null) {
  if (!date) {
    return "Sem vencimento";
  }

  return dateFormatter.format(new Date(date));
}

function formatDateInput(date?: Date | string | null) {
  if (!date) {
    return "";
  }

  return new Date(date).toISOString().slice(0, 10);
}

function formatDateTime(date?: Date | string | null) {
  if (!date) {
    return "Nunca testado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function maskPublicKey(value: string) {
  if (!value) {
    return "Nao configurada";
  }

  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function getPublicSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://xp-pdv.vercel.app").replace(/\/$/, "");
}

function getGatewayStatus(gateway: PlatformGatewayConfigurationSnapshot) {
  if (gateway.status === "active") {
    return {
      label: "Ativo",
      className: "border-emerald-400/35 bg-emerald-400/12 text-emerald-200",
    };
  }

  if (gateway.status === "attention") {
    return {
      label: "Revisar",
      className: "border-amber-400/35 bg-amber-400/12 text-amber-100",
    };
  }

  return {
    label: "Incompleto",
    className: "border-white/10 bg-white/5 text-white/55",
  };
}

function getPlanState(tenant: PlatformTenantRow) {
  if (!tenant.planName) {
    return {
      label: "Plano não definido",
      className: "border-white/10 bg-white/5 text-white/50",
    };
  }

  if (tenant.planExpiresAt && new Date(tenant.planExpiresAt) < new Date()) {
    return {
      label: "Vencido",
      className: "border-rose-400/35 bg-rose-400/12 text-rose-100",
    };
  }

  return {
    label: planStatusLabels[tenant.planStatus] ?? tenant.planStatus,
    className: "border-primary/30 bg-primary/10 text-primary",
  };
}

function getEnvironmentLabel(tenant: PlatformTenantRow) {
  if (tenant.isDefault) {
    return "Ambiente principal";
  }

  if (tenant.databaseName) {
    return "Banco dedicado ativo";
  }

  if (tenant.status === PlatformTenantStatus.PENDING) {
    return "Aguardando aprovação";
  }

  return "Ambiente não provisionado";
}

function billingStatusLabel(status?: string | null) {
  const normalized = status?.toLowerCase();

  if (normalized === "authorized" || normalized === "active") {
    return "Assinatura ativa";
  }

  if (normalized === "pending") {
    return "Aguardando pagamento";
  }

  if (normalized === "paused") {
    return "Pausada";
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return "Cancelada";
  }

  return status ? status : "Sem assinatura";
}

function superAdminTabLinkClassName(isActive: boolean) {
  return cn(
    "inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 text-[0.8rem] font-medium whitespace-nowrap transition-colors",
    isActive
      ? "border-transparent bg-primary text-primary-foreground shadow-lg shadow-primary/25"
      : "border-border/80 bg-background/85 text-muted-foreground shadow-sm hover:border-border hover:bg-muted/70 hover:text-foreground",
  );
}

function GatewayPanel({ gateway }: { gateway: PlatformGatewayConfigurationSnapshot }) {
  const gatewayStatus = getGatewayStatus(gateway);
  const webhookUrl = `${getPublicSiteUrl()}/api/platform/mercado-pago/webhook`;

  return (
    <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <Card>
        <CardHeader className="border-b border-border/70">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Gateway Mercado Pago</CardTitle>
              <CardDescription>Credenciais globais para cobrar assinaturas dos planos.</CardDescription>
            </div>
            <Badge className={gatewayStatus.className}>{gatewayStatus.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Ambiente</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {gateway.environment === "production" ? "Producao" : "Teste"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Access Token</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {gateway.hasAccessToken ? "Configurado" : "Pendente"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Webhook Secret</p>
              <p className="mt-2 text-lg font-black text-foreground">
                {gateway.hasWebhookSecret ? "Configurado" : "Opcional"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Comprador teste</p>
              <p className="mt-2 break-all text-sm font-semibold text-foreground">
                {gateway.environment === "test" ? gateway.testPayerEmail ?? "Nao configurado" : "Inativo"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Public Key</p>
            <p className="mt-2 break-all font-mono text-sm text-foreground">{maskPublicKey(gateway.publicKey)}</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">URL do webhook</p>
            <p className="mt-2 break-all font-mono text-sm text-foreground">{webhookUrl}</p>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-muted-foreground">Ultimo teste</p>
            <p className="mt-2 text-sm font-semibold text-foreground">
              {gateway.lastTestMessage ?? "Nenhum teste executado."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(gateway.lastTestedAt)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Credenciais</CardTitle>
          <CardDescription>
            Use credenciais de teste enquanto configuramos assinaturas. Depois trocamos para producao.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <SuperAdminGatewayForm gateway={gateway} />
        </CardContent>
      </Card>
    </section>
  );
}

function SellersPanel({ sellers }: { sellers: Awaited<ReturnType<typeof listPlatformSellersWithStats>> }) {
  const activeSellers = sellers.filter((seller) => seller.status === "active").length;
  const generatedLinks = sellers.reduce((sum, seller) => sum + seller.generatedLinks, 0);
  const confirmedSales = sellers.reduce((sum, seller) => sum + seller.confirmedSales, 0);

  return (
    <section className="space-y-4">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Vendedores</CardDescription>
            <CardTitle className="text-3xl">{sellers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-3xl">{activeSellers}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Links / vendas</CardDescription>
            <CardTitle className="text-3xl">
              {generatedLinks} / {confirmedSales}
            </CardTitle>
          </CardHeader>
        </Card>
      </section>

      <SuperAdminSellerForm />

      <Card>
        <CardHeader className="border-b border-border/70">
          <CardTitle>Vendedores</CardTitle>
          <CardDescription>Contas com acesso ao painel de vendas e comissao.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 p-3 sm:p-4">
          {sellers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
              Nenhum vendedor cadastrado.
            </div>
          ) : (
            sellers.map((seller) => (
              <article key={seller.id} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(460px,1.35fr)_auto] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black text-foreground">{seller.name}</h2>
                      <Badge
                        className={
                          seller.status === "active"
                            ? "border-emerald-400/35 bg-emerald-400/12 text-emerald-200"
                            : "border-white/10 bg-white/5 text-white/58"
                        }
                      >
                        {seller.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <p className="mt-2 truncate text-sm text-muted-foreground">{seller.email}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Comissao: <strong className="text-foreground">{seller.commissionLabel}</strong>
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-border/70 bg-card/55 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Links
                      </p>
                      <p className="mt-1 text-lg font-black text-foreground">{seller.generatedLinks}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/55 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Vendas
                      </p>
                      <p className="mt-1 text-lg font-black text-foreground">{seller.confirmedSales}</p>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card/55 p-3">
                      <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                        Comissao
                      </p>
                      <p className="mt-1 text-lg font-black text-foreground">{seller.pendingCommissionLabel}</p>
                    </div>
                  </div>

                  <div className="flex justify-start xl:justify-end">
                    <SuperAdminSellerStatusButton sellerId={seller.id} currentStatus={seller.status} />
                  </div>
                </div>

                {seller.recentSubscriptions.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-border/60">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/60 px-3 py-2 text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      <span>Cliente</span>
                      <span>Valor</span>
                      <span>Status</span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {seller.recentSubscriptions.map((subscription) => (
                        <div
                          key={subscription.id}
                          className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-2 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{subscription.tenantName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {subscription.planName} / {subscription.billingCycleMonths} mes(es) -{" "}
                              {formatDateTime(subscription.createdAt)}
                            </p>
                          </div>
                          <p className="font-black text-foreground">{subscription.amountLabel}</p>
                          <Badge variant="outline">{billingStatusLabel(subscription.status)}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export default async function SuperAdminPage({ searchParams }: SuperAdminPageProps) {
  const [session, tenants, gateway, sellers, params] = await Promise.all([
    requirePlatformAdmin(),
    listPlatformTenants(),
    getPlatformGatewayConfigurationSnapshot(),
    listPlatformSellersWithStats(),
    searchParams,
  ]);
  const billingSummaries = await listPlatformBillingSummaries(tenants.map((tenant) => tenant.id));
  const billingByTenant = new Map(billingSummaries.map((summary) => [summary.tenantId, summary]));
  const activeTab: SuperAdminTab =
    params.tab === "gateway" ? "gateway" : params.tab === "sellers" ? "sellers" : "users";
  const activeCount = tenants.filter((tenant) => tenant.status === PlatformTenantStatus.ACTIVE).length;
  const pendingCount = tenants.filter((tenant) => tenant.status === PlatformTenantStatus.PENDING).length;
  const expiringCount = tenants.filter((tenant) => {
    if (!tenant.planExpiresAt) {
      return false;
    }

    const today = new Date();
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    const expiration = new Date(tenant.planExpiresAt);

    return expiration >= today && expiration <= limit;
  }).length;

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-3xl border border-border/80 bg-card/78 p-5 shadow-[0_28px_90px_-62px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Mendoza PDV</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Super admin</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Gerencie clientes, plano, validade e acesso aos ambientes da plataforma.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button render={<Link href="/" />} variant="outline">
                Voltar
              </Button>
              <SuperAdminSignOutButton />
            </div>
          </div>
        </section>

        <nav className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card/60 p-2">
          <a href="/super-admin" className={superAdminTabLinkClassName(activeTab === "users")}>
            <Users className="h-4 w-4" />
            Usuarios
          </a>
          <a href="/super-admin?tab=gateway" className={superAdminTabLinkClassName(activeTab === "gateway")}>
            <CreditCard className="h-4 w-4" />
            Gateway
          </a>
          <a href="/super-admin?tab=sellers" className={superAdminTabLinkClassName(activeTab === "sellers")}>
            <Users className="h-4 w-4" />
            Vendedores
          </a>
        </nav>

        {activeTab === "users" ? (
          <>
        <section className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Usuários</CardDescription>
              <CardTitle className="text-3xl">{tenants.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ativos</CardDescription>
              <CardTitle className="text-3xl">{activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-3xl">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Vencem em 7 dias</CardDescription>
              <CardTitle className="text-3xl">{expiringCount}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-3 border-b border-border/70 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Usuários da plataforma</CardTitle>
              <CardDescription>Controle plano, validade e acesso sem mexer nos dados do cliente.</CardDescription>
            </div>
            <Button render={<Link href="/register" />}>
              Novo cadastro
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 p-3 sm:p-4">
            {tenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum usuário cadastrado.
              </div>
            ) : (
              tenants.map((tenant) => {
                const planState = getPlanState(tenant);
                const canOpenTenant = tenant.status === PlatformTenantStatus.ACTIVE && tenant.slug === session.user.tenantSlug;
                const billing = billingByTenant.get(tenant.id);

                return (
                  <article
                    key={tenant.id}
                    className="rounded-2xl border border-border/70 bg-background/45 p-4 transition-colors hover:border-border"
                  >
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(480px,1.25fr)_auto] xl:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-lg font-black text-foreground">{tenant.name}</h2>
                          {tenant.isDefault ? <Badge variant="outline">Principal</Badge> : null}
                          <Badge className={statusClassName(tenant.status)}>{statusLabel(tenant.status)}</Badge>
                          <Badge className={planState.className}>{planState.label}</Badge>
                        </div>
                        <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                          <p className="truncate font-mono text-xs text-muted-foreground/85">/app/{tenant.slug}</p>
                          <p className="truncate">
                            {tenant.ownerName} - {tenant.ownerEmail}
                          </p>
                          <p className="inline-flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            {getEnvironmentLabel(tenant)}
                          </p>
                        </div>
                        {tenant.lastProvisioningError ? (
                          <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">
                            {tenant.lastProvisioningError}
                          </p>
                        ) : null}
                      </div>

                      <div className="grid gap-4">
                        <SuperAdminManualAccessForm
                          tenantId={tenant.id}
                          currentPlanName={tenant.planName}
                          planExpiresAtLabel={formatDate(tenant.planExpiresAt)}
                          planExpiresAtInput={formatDateInput(tenant.planExpiresAt)}
                        />

                        <div className="hidden">
                          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200">
                                <CreditCard className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-black text-foreground">Cobrança Mercado Pago</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                  Gera um novo link de assinatura para o cliente pagar.
                                </p>
                              </div>
                            </div>
                            {billing ? (
                              <div className="text-right text-xs">
                                <p className="font-semibold text-foreground">{billingStatusLabel(billing.status)}</p>
                                <p className="mt-1 text-muted-foreground">
                                  Ultima: {billing.planName} / {billing.billingCycleMonths} mes(es) -{" "}
                                  {formatCentsToBRL(billing.amountCents)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs font-semibold text-muted-foreground">Nenhuma cobrança criada</p>
                            )}
                          </div>
                          <TenantSubscriptionCheckoutButton
                            tenantId={tenant.id}
                            defaultPlanName={tenant.planName === "Platina" ? "Platina" : "Ouro"}
                            defaultBillingCycleMonths={billing?.billingCycleMonths ?? 1}
                          />
                        </div>

                        <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/35 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-muted-foreground">
                              Pagamento
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-foreground">
                              {billing
                                ? `${billingStatusLabel(billing.status)} - ${billing.planName} / ${billing.billingCycleMonths} mes(es) - ${formatCentsToBRL(billing.amountCents)}`
                                : "Nenhuma cobranca criada"}
                            </p>
                          </div>
                          <TenantSubscriptionCheckoutButton
                            tenantId={tenant.id}
                            defaultPlanName={tenant.planName === "Platina" ? "Platina" : "Ouro"}
                            defaultBillingCycleMonths={billing?.billingCycleMonths ?? 1}
                            sellers={sellers}
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
                        {canOpenTenant ? (
                          <Button render={<Link href={buildTenantAdminPath(tenant.slug)} />} variant="outline" size="sm">
                            Abrir
                            <ArrowUpRight className="h-4 w-4" />
                          </Button>
                        ) : null}

                        {tenant.status === PlatformTenantStatus.ACTIVE && tenant.slug !== session.user.tenantSlug ? (
                          <span className="rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                            Acesso pelo cliente
                          </span>
                        ) : null}

                        {tenant.status === PlatformTenantStatus.PENDING || tenant.status === PlatformTenantStatus.FAILED ? (
                          <form action={approveTenantAction}>
                            <input type="hidden" name="tenantId" value={tenant.id} />
                            <Button type="submit" size="sm" className="gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              Aprovar
                            </Button>
                          </form>
                        ) : null}

                        {tenant.status === PlatformTenantStatus.ACTIVE && tenant.isDefault ? (
                          <Button type="button" size="sm" variant="outline" className="gap-2 opacity-60" disabled>
                            <PowerOff className="h-4 w-4" />
                            Protegido
                          </Button>
                        ) : null}

                        {tenant.status === PlatformTenantStatus.ACTIVE && !tenant.isDefault ? (
                          <form action={suspendTenantAction}>
                            <input type="hidden" name="tenantId" value={tenant.id} />
                            <Button type="submit" size="sm" variant="outline" className="gap-2">
                              <PowerOff className="h-4 w-4" />
                              Desligar
                            </Button>
                          </form>
                        ) : null}

                        {tenant.status === PlatformTenantStatus.SUSPENDED && !tenant.isDefault ? (
                          <form action={reactivateTenantAction}>
                            <input type="hidden" name="tenantId" value={tenant.id} />
                            <Button type="submit" size="sm" className="gap-2">
                              <RotateCcw className="h-4 w-4" />
                              Reativar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </CardContent>
            </Card>
          </>
        ) : activeTab === "gateway" ? (
          <GatewayPanel gateway={gateway} />
        ) : (
          <SellersPanel sellers={sellers} />
        )}

        <p className={cn("text-center text-xs text-muted-foreground")}>
          Use o menu acima para alternar as areas do super admin.
        </p>
      </div>
    </main>
  );
}

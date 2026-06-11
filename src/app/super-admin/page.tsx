import Link from "next/link";
import { PlatformTenantStatus } from "@prisma/client";
import { ArrowUpRight, CheckCircle2, Database, PowerOff, RotateCcw } from "lucide-react";

import { requirePlatformAdmin } from "@/application/platform/platform-guards";
import { buildTenantAdminPath, listPlatformTenants } from "@/application/platform/platform-service";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SuperAdminSignOutButton } from "@/components/platform/super-admin-sign-out-button";
import { approveTenantAction, reactivateTenantAction, suspendTenantAction } from "@/app/super-admin/actions";

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

  return "border-border/70 bg-muted/40 text-muted-foreground";
}

export default async function SuperAdminPage() {
  const session = await requirePlatformAdmin();
  const tenants = await listPlatformTenants();

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-foreground md:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-2xl border border-border/80 bg-card/78 p-5 shadow-[0_28px_90px_-62px_rgba(0,0,0,0.9)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Plataforma</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Super admin</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Aprove clientes, controle status do plano e acesse o PDV isolado de cada ambiente.
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

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Clientes</CardDescription>
              <CardTitle className="text-3xl">{tenants.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-3xl">
                {tenants.filter((tenant) => tenant.status === PlatformTenantStatus.PENDING).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ativos</CardDescription>
              <CardTitle className="text-3xl">
                {tenants.filter((tenant) => tenant.status === PlatformTenantStatus.ACTIVE).length}
              </CardTitle>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Clientes da plataforma</CardTitle>
              <CardDescription>Seu bar atual aparece como cliente padrao e nao tem banco duplicado.</CardDescription>
            </div>
            <Button render={<Link href="/register" />}>
              Novo cadastro
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {tenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum cliente cadastrado.
              </div>
            ) : (
              tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="grid gap-3 rounded-xl border border-border/70 bg-background/45 p-4 lg:grid-cols-[1.2fr,0.8fr,1fr,auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-base font-semibold text-foreground">{tenant.name}</p>
                      {tenant.isDefault ? <Badge variant="outline">Atual</Badge> : null}
                      <Badge className={statusClassName(tenant.status)}>{statusLabel(tenant.status)}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">/{tenant.slug}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Dono: {tenant.ownerName} · {tenant.ownerEmail}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-card/45 p-3">
                    <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Plano</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{tenant.planName ?? "Padrao"}</p>
                    <p className="text-xs text-muted-foreground">{tenant.planStatus}</p>
                  </div>

                  <div className="rounded-lg border border-border/60 bg-card/45 p-3">
                    <p className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      <Database className="h-3.5 w-3.5" />
                      Banco
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {tenant.isDefault ? "Banco atual" : tenant.databaseName ?? "Aguardando aprovacao"}
                    </p>
                    {tenant.lastProvisioningError ? (
                      <p className="mt-1 line-clamp-2 text-xs text-rose-300">{tenant.lastProvisioningError}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                    {tenant.status === PlatformTenantStatus.ACTIVE && tenant.slug === session.user.tenantSlug ? (
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
                          Desligar painel
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
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

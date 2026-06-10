import { GameplayReleaseStatus, ProductKind } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import {
  calculateManualPaidOpenCharge,
  getGameplayReleaseData,
  getManualPaidOpenBillingConfig,
} from "@/application/gameplay/gameplay-release-service";
import { getPdvData } from "@/application/pdv/pdv-service";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { ManualServiceControlForm } from "@/presentation/admin/gameplay/manual-service-control-form";
import { RetryGameplayReleaseForm } from "@/presentation/admin/gameplay/retry-gameplay-release-form";
import { ServiceCountdown } from "@/presentation/admin/gameplay/services-live-sync";

type ServicesPageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
  }>;
};

const stationCatalog = [
  { id: "tv-01", label: "TV 01 - PS5" },
  { id: "tv-02", label: "TV 02 - Simulador" },
];

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

function normalizeStatus(value?: string) {
  return Object.values(GameplayReleaseStatus).includes(value as GameplayReleaseStatus)
    ? (value as GameplayReleaseStatus)
    : undefined;
}

function getStatusBadge(status: GameplayReleaseStatus) {
  if (status === GameplayReleaseStatus.LIBERADA) {
    return {
      label: "LIBERADA",
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    };
  }

  if (status === GameplayReleaseStatus.PENDENTE_ENVIO) {
    return {
      label: "PENDENTE_ENVIO",
      className: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    };
  }

  if (status === GameplayReleaseStatus.PAUSADA) {
    return {
      label: "PAUSADA",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }

  if (status === GameplayReleaseStatus.CANCELADA) {
    return {
      label: "CANCELADA",
      className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
    };
  }

  return {
    label: "FALHA_ENVIO",
    className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
  };
}

function formatJsonPreview(value: unknown) {
  if (!value) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

function getServiceState(release: Awaited<ReturnType<typeof getGameplayReleaseData>>["releases"][number] | undefined, now: Date) {
  if (!release?.releasedUntil) {
    if (release?.status === GameplayReleaseStatus.PAUSADA) {
      return {
        label: "PAUSADO",
        helper: "Tempo pausado",
        className: "border-amber-300/45 bg-amber-400/10",
        badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
      };
    }

    return {
      label: "LIVRE",
      helper: "Disponivel para venda",
      className: "border-border/75 bg-background/32",
      badgeClassName: "bg-muted text-foreground hover:bg-muted",
    };
  }

  const serviceStartsAt = release.serviceStartsAt ?? release.paidAt;
  if (release.status === GameplayReleaseStatus.PAUSADA) {
    return {
      label: "PAUSADO",
      helper: "Tempo pausado",
      className: "border-amber-300/45 bg-amber-400/10",
      badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }

  const isPreparing = serviceStartsAt.getTime() > now.getTime();
  const isPaidOpenMode = Boolean(getManualPaidOpenBillingConfig(release));
  const isFreeMode = !isPaidOpenMode && (release.durationMinutes === 0 || release.planCode === "MANUAL-LIVRE");

  if (isPreparing) {
    return {
      label: "PREPARANDO",
      helper: `Começa às ${timeFormatter.format(serviceStartsAt)}`,
      className: "border-amber-300/45 bg-amber-400/10",
      badgeClassName: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }

  return {
    label: "EM USO",
    helper: isPaidOpenMode
      ? "Livre pago, cobrando por minuto"
      : isFreeMode
        ? "Modo livre ate encerramento manual"
        : `Ocupada ate ${timeFormatter.format(release.releasedUntil)}`,
    className: "border-emerald-300/45 bg-emerald-400/10",
    badgeClassName: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  };
}

function getReleaseOriginLabel(release: Awaited<ReturnType<typeof getGameplayReleaseData>>["releases"][number]) {
  return release.sale?.saleNumber ?? "Liberação manual";
}

function getReleaseDurationLabel(release: Awaited<ReturnType<typeof getGameplayReleaseData>>["releases"][number]) {
  if (getManualPaidOpenBillingConfig(release)) {
    return "Livre pago";
  }

  if (release.durationMinutes === 0 || release.planCode === "MANUAL-LIVRE") {
    return "Livre";
  }

  return `${release.durationMinutes} min`;
}

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  await requirePermission(PERMISSIONS.SERVICES_VIEW);
  const params = await searchParams;
  const status = normalizeStatus(params.status);
  const query = params.query?.trim() || undefined;
  const [{ summary, releases }, serviceSnapshot, pdvData] = await Promise.all([
    getGameplayReleaseData({ status, query }),
    getGameplayReleaseData(),
    getPdvData(),
  ]);
  const openSessionOptions = pdvData.openSessions.map((openSession) => ({
    id: openSession.id,
    cashRegister: {
      name: openSession.cashRegister.name,
      code: openSession.cashRegister.code,
    },
  }));
  const gameplayProducts = pdvData.products
    .filter((product) => product.kind === ProductKind.GAMEPLAY)
    .map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      kind: product.kind,
      gameplayPlanCode: product.gameplayPlanCode,
      gameplayDurationMinutes: product.gameplayDurationMinutes,
      salePrice: Number(product.salePrice),
      category: {
        id: product.category.id,
        name: product.category.name,
        slug: product.category.slug,
      },
    }));
  const couponOptions = pdvData.coupons.map((coupon) => ({
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    discountType: coupon.discountType,
    discountValue: Number(coupon.discountValue),
    maxDiscountAmount: coupon.maxDiscountAmount ? Number(coupon.maxDiscountAmount) : null,
    minSubtotalAmount: coupon.minSubtotalAmount ? Number(coupon.minSubtotalAmount) : null,
    usageLimit: coupon.usageLimit,
    usedCount: coupon.usedCount,
    productIds: coupon.products.map((product) => product.productId),
    categoryIds: coupon.categories.map((category) => category.categoryId),
  }));
  const now = new Date();
  const activeReleases = serviceSnapshot.releases.filter(
    (release) =>
      (release.status === GameplayReleaseStatus.LIBERADA &&
        release.releasedUntil &&
        release.releasedUntil.getTime() > now.getTime()) ||
      release.status === GameplayReleaseStatus.PAUSADA,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Controle de serviços"
        title="Serviços ativos"
        description="Acompanhe PS5 e simulador, evite venda duplicada e reenvie liberações quando precisar."
      />

      <section className="grid gap-3 lg:grid-cols-2">
        {stationCatalog.map((station) => {
          const release = activeReleases.find((item) => item.stationId === station.id);
          const state = getServiceState(release, now);
          const paidOpenCharge =
            release && release.status === GameplayReleaseStatus.LIBERADA
              ? calculateManualPaidOpenCharge(release, now)
              : null;

          return (
            <Card key={station.id} className={state.className}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{station.label}</CardTitle>
                    <CardDescription>{state.helper}</CardDescription>
                  </div>
                  <Badge className={state.badgeClassName}>{state.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {release ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <span>Origem: {getReleaseOriginLabel(release)}</span>
                      <span>Plano: {release.planCode}</span>
                      <span>{getReleaseDurationLabel(release)}</span>
                    </div>
                    {release.status === GameplayReleaseStatus.PAUSADA ? (
                      <div className="mt-4 rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4">
                        <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-amber-200">
                          Tempo pausado
                        </p>
                        <p className="mt-2 text-2xl font-black text-foreground">Pausado</p>
                      </div>
                    ) : (
                      <ServiceCountdown
                        durationMinutes={release.durationMinutes}
                        planCode={release.planCode}
                        releasedUntil={release.releasedUntil?.toISOString()}
                        serviceStartsAt={(release.serviceStartsAt ?? release.paidAt).toISOString()}
                        manualPaidOpenBilling={
                          paidOpenCharge
                            ? {
                                productName: paidOpenCharge.productName,
                                baseDurationMinutes: paidOpenCharge.baseDurationMinutes,
                                basePriceInCents: paidOpenCharge.basePriceInCents,
                                startedAt: paidOpenCharge.startedAt.toISOString(),
                              }
                            : null
                        }
                      />
                    )}
                  </>
                ) : (
                  <p>Nenhuma venda ativa nesta estação.</p>
                )}
                <ManualServiceControlForm
                  key={`${station.id}-${release?.id ?? "free"}`}
                  stationId={station.id}
                  isBusy={Boolean(release)}
                  openSessions={openSessionOptions}
                  gameplayProducts={gameplayProducts}
                  coupons={couponOptions}
                  activePaidOpenBilling={
                    paidOpenCharge
                      ? {
                          productId: paidOpenCharge.productId,
                          productName: paidOpenCharge.productName,
                          productPlanCode: paidOpenCharge.productPlanCode,
                          categoryId: paidOpenCharge.categoryId,
                          baseDurationMinutes: paidOpenCharge.baseDurationMinutes,
                          basePriceInCents: paidOpenCharge.basePriceInCents,
                          startedAt: paidOpenCharge.startedAt.toISOString(),
                        }
                      : null
                  }
                  activeRelease={
                    release
                      ? {
                          status: release.status,
                          saleId: release.saleId,
                          saleNumber: release.sale?.saleNumber ?? null,
                          saleTotal: release.sale ? Number(release.sale.totalAmount) : null,
                        }
                      : null
                  }
                />
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Liberadas" value={String(summary.released)} helper="Serviço confirmado pelo PDV" />
        <MetricCard title="Pendentes" value={String(summary.pending)} helper="Aguardando tentativa de envio" />
        <MetricCard title="Falhas" value={String(summary.failed)} helper="Precisam de reenvio manual" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Filtro de liberações</CardTitle>
          <CardDescription>Busque por venda, TV, plano ou operador.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form method="get" action="/admin/services" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
            <Input name="query" defaultValue={query ?? ""} placeholder="Venda, TV, plano ou operador" />
            <select name="status" className="admin-native-select" defaultValue={status ?? "ALL"}>
              <option value="ALL">Todos os status</option>
              {Object.values(GameplayReleaseStatus).map((statusOption) => (
                <option key={statusOption} value={statusOption}>
                  {statusOption}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-10 rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Filtrar
            </button>
            <a
              href="/admin/services"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Limpar
            </a>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status por venda</CardTitle>
          <CardDescription>
            Cada venda de serviço mantém payload, resposta, tentativas e último erro para auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>TV / Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Retorno</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhuma liberação encontrada com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : null}
              {releases.map((release) => {
                const badge = getStatusBadge(release.status);

                return (
                  <TableRow key={release.id}>
                    <TableCell className="font-medium text-foreground">
                      {getReleaseOriginLabel(release)}
                      <p className="text-xs text-muted-foreground">
                        {dateTimeFormatter.format(release.sale?.createdAt ?? release.createdAt)} - {release.operator}
                      </p>
                      {release.sale?.customerName ? (
                        <p className="text-xs text-muted-foreground">{release.sale.customerName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{release.stationId.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {release.planCode} - {getReleaseDurationLabel(release)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {release.serviceStartsAt ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          início {timeFormatter.format(release.serviceStartsAt)}
                        </p>
                      ) : null}
                      {release.releasedUntil ? (
                        <p className="text-xs text-muted-foreground">
                          até {timeFormatter.format(release.releasedUntil)}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>{release.attempts}</TableCell>
                    <TableCell>{formatCurrency(Number(release.amount))}</TableCell>
                    <TableCell>
                      {release.lastError ? (
                        <p className="max-w-[20rem] text-xs text-rose-200">{release.lastError}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Sem erro registrado.</p>
                      )}
                      <details className="mt-2 max-w-[24rem] text-xs text-muted-foreground">
                        <summary className="cursor-pointer text-foreground/85">Payload e resposta</summary>
                        <pre className="admin-scrollbar mt-2 max-h-56 overflow-auto rounded-xl border border-border/70 bg-background/60 p-3 text-[11px] leading-relaxed">
                          {formatJsonPreview({
                            request: release.requestPayload,
                            response: release.responsePayload,
                          })}
                        </pre>
                      </details>
                    </TableCell>
                    <TableCell>
                      <RetryGameplayReleaseForm
                        saleId={release.saleId}
                        disabled={!release.saleId || release.status === GameplayReleaseStatus.LIBERADA}
                      />
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

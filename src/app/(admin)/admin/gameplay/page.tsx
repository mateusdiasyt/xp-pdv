import { GameplayReleaseStatus } from "@prisma/client";

import { requirePermission } from "@/application/auth/guards";
import { getGameplayReleaseData } from "@/application/gameplay/gameplay-release-service";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";
import { RetryGameplayReleaseForm } from "@/presentation/admin/gameplay/retry-gameplay-release-form";

type GameplayPageProps = {
  searchParams: Promise<{
    query?: string;
    status?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
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

export default async function GameplayPage({ searchParams }: GameplayPageProps) {
  await requirePermission(PERMISSIONS.PDV_VIEW);
  const params = await searchParams;
  const status = normalizeStatus(params.status);
  const query = params.query?.trim() || undefined;
  const { summary, releases } = await getGameplayReleaseData({ status, query });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="XP Gateway"
        title="Liberação de gameplay"
        description="Acompanhe as TVs liberadas automaticamente pelo PDV e reenvie liberações pendentes sem mexer na NFC-e."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Liberadas" value={String(summary.released)} helper="Gameplay confirmado pelo gateway" />
        <MetricCard title="Pendentes" value={String(summary.pending)} helper="Aguardando tentativa de envio" />
        <MetricCard title="Falhas" value={String(summary.failed)} helper="Precisam de reenvio manual" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Filtro de liberações</CardTitle>
          <CardDescription>Busque por venda, estação, plano ou operador.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form method="get" action="/admin/gameplay" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
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
              href="/admin/gameplay"
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
            Cada venda de gameplay mantém payload, resposta, tentativas e último erro para auditoria.
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
                <TableHead>Ações</TableHead>
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
                      {release.sale.saleNumber}
                      <p className="text-xs text-muted-foreground">
                        {dateTimeFormatter.format(release.sale.createdAt)} - {release.operator}
                      </p>
                      {release.sale.customerName ? (
                        <p className="text-xs text-muted-foreground">{release.sale.customerName}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{release.stationId.toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">
                        {release.planCode} - {release.durationMinutes} min
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={badge.className}>{badge.label}</Badge>
                      {release.releasedUntil ? (
                        <p className="mt-1 text-xs text-muted-foreground">
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
                        disabled={release.status === GameplayReleaseStatus.LIBERADA}
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

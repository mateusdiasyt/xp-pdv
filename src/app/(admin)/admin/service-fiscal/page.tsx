import Link from "next/link";

import { CalendarDays, CheckCircle2, ExternalLink, FileCheck2 } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getTenantModuleEntitlements } from "@/application/platform/platform-service";
import {
  getServiceFiscalApurationData,
  serviceCnaeLabels,
} from "@/application/service-fiscal/service-fiscal-service";
import { MetricCard } from "@/components/admin/metric-card";
import { ModuleLockCard } from "@/components/admin/module-lock-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { canUsePlatformModule } from "@/domain/platform/plan-entitlements";
import { formatCurrency } from "@/lib/format";
import { declareServiceNfseAction } from "@/presentation/admin/service-fiscal/actions";

type ServiceFiscalPageProps = {
  searchParams: Promise<{
    startDate?: string;
    endDate?: string;
    serviceCnae?: string;
    status?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function toDecimalNumber(value: { toString(): string }) {
  return Number(value.toString());
}

function getStatusBadge(isDeclared: boolean) {
  if (isDeclared) {
    return {
      label: "Apurada",
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    };
  }

  return {
    label: "Pendente",
    className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  };
}

export default async function ServiceFiscalPage({ searchParams }: ServiceFiscalPageProps) {
  const session = await requirePermission(PERMISSIONS.SERVICE_FISCAL_VIEW);
  const entitlements = await getTenantModuleEntitlements(session.user.tenantSlug);

  if (!canUsePlatformModule(entitlements, "fiscal-focus")) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Modulo Platina"
          title="Apuracao de servicos"
          description="A apuracao fiscal de servicos fica disponivel quando o Plano Platina estiver ativo."
        />
        <ModuleLockCard
          title="Fiscal de servicos bloqueado"
          description="Ative o Plano Platina no painel super admin para liberar apuracao de servicos, NFS-e e registros fiscais avancados."
        />
      </div>
    );
  }

  const filters = await searchParams;
  const data = await getServiceFiscalApurationData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fiscal municipal"
        title="Apuracao de servicos"
        description="Separe gameplay, simulador e sinuca por CNAE para emitir a NFS-e semanal no portal da Prefeitura e registrar o numero no sistema."
      />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          title="Servicos no periodo"
          value={String(data.summary.totalItems)}
          helper={`${data.filters.startDate} ate ${data.filters.endDate}`}
        />
        <MetricCard
          title="Total de servicos"
          value={formatCurrency(toDecimalNumber(data.summary.totalAmount))}
          helper="Valor separado da NFC-e de produtos"
        />
        <MetricCard
          title="Pendente de NFS-e"
          value={formatCurrency(toDecimalNumber(data.summary.pendingAmount))}
          helper={`${data.summary.pendingItems} lancamento(s)`}
        />
        <MetricCard
          title="Ja apurado"
          value={formatCurrency(toDecimalNumber(data.summary.declaredAmount))}
          helper={`${data.summary.declaredItems} lancamento(s) com NFS-e`}
        />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Filtro da apuracao</CardTitle>
          <CardDescription>
            Use o periodo semanal combinado com a contabilidade ou consulte um intervalo especifico.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            action="/admin/service-fiscal"
            className="grid gap-3 lg:grid-cols-[minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(240px,1fr)_minmax(160px,0.8fr)_auto_auto]"
            method="get"
          >
            <div className="space-y-1">
              <label htmlFor="startDate" className="text-xs text-muted-foreground">
                Inicio
              </label>
              <Input id="startDate" name="startDate" type="date" defaultValue={data.filters.startDate} />
            </div>
            <div className="space-y-1">
              <label htmlFor="endDate" className="text-xs text-muted-foreground">
                Fim
              </label>
              <Input id="endDate" name="endDate" type="date" defaultValue={data.filters.endDate} />
            </div>
            <div className="space-y-1">
              <label htmlFor="serviceCnae" className="text-xs text-muted-foreground">
                CNAE
              </label>
              <select
                id="serviceCnae"
                name="serviceCnae"
                defaultValue={data.filters.serviceCnae}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/90 px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <option value="ALL">Todos os CNAEs</option>
                {Object.entries(serviceCnaeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
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
                defaultValue={data.filters.status}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/90 px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="DECLARED">Apurados</option>
              </select>
            </div>
            <Button type="submit" className="self-end">
              Filtrar
            </Button>
            <Link
              href="/admin/service-fiscal"
              className="inline-flex h-10 items-center justify-center self-end rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Limpar
            </Link>
          </form>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        {data.groups.length === 0 ? (
          <Card className="xl:col-span-2">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum servico encontrado para o periodo selecionado.
            </CardContent>
          </Card>
        ) : null}

        {data.groups.map((group) => (
          <Card key={group.serviceCnae} className="overflow-hidden">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle>{group.serviceDescription}</CardTitle>
                  <CardDescription>CNAE {group.serviceCnae}</CardDescription>
                </div>
                <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                  {formatCurrency(toDecimalNumber(group.totalAmount))}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/50 p-3">
                  <p className="text-xs text-muted-foreground">Quantidade</p>
                  <p className="mt-1 text-xl font-semibold text-foreground">{group.itemCount}</p>
                </div>
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-3">
                  <p className="text-xs text-amber-100/80">Pendente</p>
                  <p className="mt-1 text-xl font-semibold text-amber-50">{group.pendingItemCount}</p>
                </div>
                <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/8 p-3">
                  <p className="text-xs text-emerald-100/80">Apurado</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-50">{group.declaredItemCount}</p>
                </div>
              </div>

              {group.pendingItemCount > 0 ? (
                <form action={declareServiceNfseAction} className="space-y-3 rounded-2xl border border-border/70 bg-background/55 p-4">
                  <input type="hidden" name="serviceCnae" value={group.serviceCnae} />
                  <input type="hidden" name="startDate" value={data.filters.startDate} />
                  <input type="hidden" name="endDate" value={data.filters.endDate} />
                  <div className="flex items-start gap-3">
                    <FileCheck2 className="mt-0.5 size-5 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Depois de emitir no GestãoISS</p>
                      <p className="text-xs text-muted-foreground">
                        Informe o numero da NFS-e para baixar estes servicos da lista pendente.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor={`nfseNumber-${group.serviceCnae}`} className="text-xs text-muted-foreground">
                        Numero da NFS-e
                      </label>
                      <Input id={`nfseNumber-${group.serviceCnae}`} name="nfseNumber" placeholder="Ex.: 2026/000123" required />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`nfseIssuedAt-${group.serviceCnae}`} className="text-xs text-muted-foreground">
                        Data de emissao
                      </label>
                      <Input
                        id={`nfseIssuedAt-${group.serviceCnae}`}
                        name="nfseIssuedAt"
                        type="date"
                        defaultValue={data.filters.endDate}
                        required
                      />
                    </div>
                  </div>
                  <Textarea name="notes" placeholder="Observacao opcional para contador ou caixa." />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit">
                      <CheckCircle2 />
                      Marcar NFS-e emitida
                    </Button>
                    <a
                      href="https://fozdoiguacupr.gestaoiss.com.br/"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/85 px-3.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
                    >
                      Abrir GestãoISS
                      <ExternalLink className="size-4" />
                    </a>
                  </div>
                </form>
              ) : (
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/8 p-4 text-sm text-emerald-50">
                  Todos os servicos deste CNAE ja foram vinculados a uma NFS-e.
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Vendas de servico no periodo</CardTitle>
          <CardDescription>
            Conferencia detalhada para contador: venda, horario, operador, CNAE, valor e vinculo de NFS-e.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>Servico</TableHead>
                <TableHead>CNAE</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhum lancamento de servico encontrado.
                  </TableCell>
                </TableRow>
              ) : null}
              {data.items.map((item) => {
                const status = getStatusBadge(Boolean(item.serviceDeclarationId));

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-foreground">
                      <Link href={`/admin/pdv?receipt=${item.sale.id}`} className="transition-colors hover:text-primary">
                        {item.sale.saleNumber}
                      </Link>
                      <p className="text-xs text-muted-foreground">{item.sale.customerName ?? "Consumidor nao identificado"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-foreground">{item.productNameSnapshot}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity}x de {formatCurrency(toDecimalNumber(item.unitPrice))}
                      </p>
                    </TableCell>
                    <TableCell>{item.serviceCnaeSnapshot ?? "Sem CNAE"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-muted-foreground" />
                        <span>{dateTimeFormatter.format(item.sale.createdAt)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.sale.operator.name}
                      <p className="text-xs text-muted-foreground">{item.sale.cashSession.cashRegister.name}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                      {item.serviceDeclaration?.nfseNumber ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">NFS-e {item.serviceDeclaration.nfseNumber}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(toDecimalNumber(item.lineTotal))}</TableCell>
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

import { requirePermission } from "@/application/auth/guards";
import { getFiscalExportsData } from "@/application/fiscal/fiscal-export-service";
import { MetricCard } from "@/components/admin/metric-card";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { formatCurrency } from "@/lib/format";

type FiscalPageProps = {
  searchParams: Promise<{
    query?: string;
    startDate?: string;
    endDate?: string;
    fiscalStatus?: string;
  }>;
};

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function getFiscalStatusBadge(status?: string | null) {
  const normalized = (status ?? "").trim().toUpperCase();

  if (normalized === "AUTHORIZED") {
    return {
      label: "Autorizada",
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
    };
  }

  if (normalized === "PROCESSING") {
    return {
      label: "Processando",
      className: "bg-sky-100 text-sky-700 hover:bg-sky-100",
    };
  }

  if (normalized === "REJECTED") {
    return {
      label: "Rejeitada",
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  if (normalized === "CANCELLED") {
    return {
      label: "Cancelada",
      className: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200",
    };
  }

  if (normalized === "DISABLED") {
    return {
      label: "Nao configurada",
      className: "bg-amber-100 text-amber-800 hover:bg-amber-100",
    };
  }

  if (normalized === "ERROR") {
    return {
      label: "Erro",
      className: "bg-rose-100 text-rose-700 hover:bg-rose-100",
    };
  }

  return {
    label: "Sem emissao",
    className: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
  };
}

export default async function FiscalPage({ searchParams }: FiscalPageProps) {
  await requirePermission(PERMISSIONS.DASHBOARD_VIEW);
  const filters = await searchParams;
  const fiscal = await getFiscalExportsData(filters);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Fiscal XML"
        description="Painel para contador baixar XML das vendas NFC-e, conferir chaves e acompanhar status fiscal."
      />

      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard title="Vendas listadas" value={String(fiscal.summary.totalSales)} helper="Limite de 300 registros por consulta" />
        <MetricCard title="NFC-e autorizadas" value={String(fiscal.summary.authorizedCount)} helper="Status fiscal autorizado no periodo" />
        <MetricCard title="Com XML disponivel" value={String(fiscal.summary.withXmlCount)} helper="Prontas para download no sistema" />
      </section>

      <Card>
        <CardHeader className="border-b border-border/70 pb-4">
          <CardTitle>Filtro fiscal</CardTitle>
          <CardDescription>Busque por venda, cliente, chave, periodo e status.</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form
            className="grid gap-3 lg:grid-cols-[minmax(220px,2fr)_1fr_1fr_1fr_auto_auto_auto]"
            method="get"
            action="/admin/fiscal"
          >
            <div className="space-y-1">
              <label htmlFor="query" className="text-xs text-muted-foreground">
                Busca
              </label>
              <Input
                id="query"
                name="query"
                placeholder="Venda, cliente ou chave"
                defaultValue={fiscal.filters.query}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="startDate" className="text-xs text-muted-foreground">
                Data inicial
              </label>
              <Input id="startDate" name="startDate" type="date" defaultValue={fiscal.filters.startDate} />
            </div>
            <div className="space-y-1">
              <label htmlFor="endDate" className="text-xs text-muted-foreground">
                Data final
              </label>
              <Input id="endDate" name="endDate" type="date" defaultValue={fiscal.filters.endDate} />
            </div>
            <div className="space-y-1">
              <label htmlFor="fiscalStatus" className="text-xs text-muted-foreground">
                Status
              </label>
              <select
                id="fiscalStatus"
                name="fiscalStatus"
                defaultValue={fiscal.filters.fiscalStatus}
                className="h-10 w-full rounded-xl border border-input/80 bg-card/90 px-3 text-sm shadow-sm outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20"
              >
                <option value="ALL">Todos</option>
                <option value="AUTHORIZED">Autorizada</option>
                <option value="PROCESSING">Processando</option>
                <option value="REJECTED">Rejeitada</option>
                <option value="ERROR">Erro</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-10 rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Filtrar
            </button>
            <button
              type="submit"
              formAction="/api/fiscal/sales/xml-batch"
              formTarget="_blank"
              className="h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 text-sm font-medium text-emerald-100 shadow-sm transition-colors hover:bg-emerald-500/20"
            >
              Baixar XMLs (ZIP)
            </button>
            <a
              href="/admin/fiscal"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
            >
              Limpar
            </a>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>XML das vendas</CardTitle>
          <CardDescription>
            Use o botao de download para pegar o XML de cada NFC-e e encaminhar para contabilidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venda</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Status fiscal</TableHead>
                <TableHead>Chave</TableHead>
                <TableHead className="text-right">Total (R$)</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fiscal.sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhuma venda fiscal encontrada com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : null}
              {fiscal.sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium text-foreground">
                    {sale.saleNumber}
                    <p className="text-xs text-muted-foreground">
                      {sale.operator.name} - {sale.cashSession.cashRegister.name}
                    </p>
                  </TableCell>
                  <TableCell>{dateTimeFormatter.format(sale.createdAt)}</TableCell>
                  <TableCell>{sale.customerName ?? "Comanda avulsa"}</TableCell>
                  <TableCell>
                    <Badge className={getFiscalStatusBadge(sale.fiscalStatus).className}>
                      {getFiscalStatusBadge(sale.fiscalStatus).label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <p className="max-w-[22rem] truncate text-xs text-muted-foreground">
                      {sale.fiscalAccessKey ?? "Nao informada"}
                    </p>
                    {sale.fiscalNumber ? (
                      <p className="text-[11px] text-muted-foreground">
                        Numero {sale.fiscalNumber} / Serie {sale.fiscalSeries ?? "-"}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(sale.totalAmount))}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/fiscal/sales/${sale.id}/xml`}
                        className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
                      >
                        Baixar XML
                      </a>
                      {sale.fiscalDanfeUrl ? (
                        <a
                          href={sale.fiscalDanfeUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex h-8 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-[0.8rem] font-medium text-foreground shadow-sm transition-colors hover:bg-muted/70"
                        >
                          DANFE
                        </a>
                      ) : null}
                    </div>
                    {sale.fiscalMessage ? (
                      <p className="mt-1 max-w-[22rem] text-[11px] text-muted-foreground">{sale.fiscalMessage}</p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { StockMovementType, StockUnit } from "@prisma/client";
import Link from "next/link";
import { Fragment } from "react";
import { FileText, HelpCircle, History, PackagePlus, Search, SlidersHorizontal } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import {
  getStockFormOptions,
  getStockInvoiceXmlHistory,
  getStockMovementFilterOptions,
  getStockMovements,
} from "@/application/stock/stock-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { CreateStockMovementForm } from "@/presentation/admin/stock/create-stock-movement-form";
import { FetchStockInvoiceXmlByKeyForm } from "@/presentation/admin/stock/fetch-stock-invoice-xml-by-key-form";
import { UploadStockInvoiceXmlForm } from "@/presentation/admin/stock/upload-stock-invoice-xml-form";

type StockPageProps = {
  searchParams: Promise<{
    panel?: string;
    q?: string;
    categoryId?: string;
    movementType?: string;
  }>;
};

function movementTypeLabel(type: StockMovementType) {
  if (type === StockMovementType.IN) {
    return "Entrada";
  }

  if (type === StockMovementType.OUT) {
    return "Saida";
  }

  return "Ajuste";
}

function movementTypeClass(type: StockMovementType) {
  if (type === StockMovementType.IN) {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }

  if (type === StockMovementType.OUT) {
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  }

  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
}

function stockUnitLabel(stockUnit: StockUnit) {
  return stockUnit === StockUnit.MILLILITER ? "ml" : "un";
}

function normalizeMovementType(value?: string) {
  if (
    value === StockMovementType.IN ||
    value === StockMovementType.OUT ||
    value === StockMovementType.ADJUSTMENT
  ) {
    return value;
  }

  return undefined;
}

const movementFilterOptions: Array<{ label: string; value: string }> = [
  { label: "Todos os tipos", value: "all" },
  { label: "Entradas", value: StockMovementType.IN },
  { label: "Saidas", value: StockMovementType.OUT },
  { label: "Ajustes", value: StockMovementType.ADJUSTMENT },
];

const outlineLinkClass =
  "inline-flex h-10 items-center justify-center rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70";

const stockActionLinkClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70";

function InfoHint({ label }: { label: string }) {
  return (
    <span title={label} aria-label="Ajuda" className="inline-flex">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const dateOnlyFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function StockPage({ searchParams }: StockPageProps) {
  const session = await requirePermission(PERMISSIONS.STOCK_VIEW);
  const { panel, q, categoryId, movementType } = await searchParams;
  const query = q?.trim() || undefined;
  const categoryFilter = categoryId && categoryId !== "all" ? categoryId.trim() || undefined : undefined;
  const typeFilter = normalizeMovementType(movementType);
  const activePanel = panel === "log" || panel === "xml" ? panel : undefined;
  const isLogPanelOpen = activePanel === "log";
  const isXmlPanelOpen = activePanel === "xml";
  const [products, movements, xmlHistory, categories] = await Promise.all([
    getStockFormOptions(),
    isLogPanelOpen
      ? getStockMovements({
          query,
          categoryId: categoryFilter,
          type: typeFilter,
        })
      : Promise.resolve([]),
    isXmlPanelOpen ? getStockInvoiceXmlHistory() : Promise.resolve(null),
    isLogPanelOpen ? getStockMovementFilterOptions() : Promise.resolve([]),
  ]);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.STOCK_MANAGE);
  const hasMovementFilters = Boolean(query || categoryFilter || typeFilter);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="ERP" title="Estoque" />

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/stock?panel=log" className={stockActionLinkClass}>
          <History className="h-4 w-4" />
          Ver log
        </Link>
        <Link href="/admin/stock?panel=xml" className={stockActionLinkClass}>
          <FileText className="h-4 w-4" />
          XMLs
        </Link>
      </div>

      {canManage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-4 w-4" />
              Entrada por NF-e
              <InfoHint label="Busque pela chave do DANFE ou envie o XML. Nada entra no estoque antes da conferencia." />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <p className="mb-4 text-sm font-semibold text-foreground">Chave da nota</p>
              <FetchStockInvoiceXmlByKeyForm />
            </div>

            <div className="rounded-xl border border-border/75 bg-card/45 p-4">
              <p className="mb-4 text-sm font-semibold text-foreground">Arquivo XML</p>
              <UploadStockInvoiceXmlForm />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Movimentacao manual
              <InfoHint label="Use para perdas, ajustes pontuais e saidas que nao vieram do PDV." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <details className="group rounded-xl border border-border/75 bg-card/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>Abrir registro manual</span>
                <span className="text-xs text-muted-foreground group-open:hidden">Fechado</span>
                <span className="hidden text-xs text-muted-foreground group-open:inline">Aberto</span>
              </summary>
              <div className="border-t border-border/70 p-4">
                <CreateStockMovementForm products={products} />
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}

      {isLogPanelOpen ? (
        <Sheet defaultOpen>
          <SheetContent side="right" showCloseButton={false} className="w-[min(100vw,980px)] overflow-y-auto p-0 sm:max-w-[980px]">
            <SheetHeader className="border-b border-border/70 p-4">
              <div className="flex items-center justify-between gap-3 pr-1">
                <div>
                  <SheetTitle>Log de estoque</SheetTitle>
                  <SheetDescription className="sr-only">Movimentacoes de estoque carregadas sob demanda.</SheetDescription>
                </div>
                <Link href="/admin/stock" className={outlineLinkClass}>
                  Fechar
                </Link>
              </div>
            </SheetHeader>

            <div className="space-y-4 p-4">
          <form method="GET" className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto_auto]">
            <input type="hidden" name="panel" value="log" />
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input name="q" defaultValue={query ?? ""} placeholder="Buscar produto ou SKU" className="pl-9" />
            </div>

            <select name="categoryId" className="admin-native-select" defaultValue={categoryFilter ?? "all"}>
              <option value="all">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select name="movementType" className="admin-native-select" defaultValue={typeFilter ?? "all"}>
              {movementFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <Button type="submit" variant="secondary" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Filtrar
            </Button>

            <Link href="/admin/stock?panel=log" className={outlineLinkClass}>
              Limpar
            </Link>
          </form>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>{movements.length} registro(s) exibido(s)</p>
            <p>Filtros ativos: {hasMovementFilters ? "sim" : "nao"}</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Estoque antes</TableHead>
                <TableHead className="text-right">Estoque depois</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Observacao</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-zinc-500">
                    Nenhuma movimentacao registrada.
                  </TableCell>
                </TableRow>
              ) : null}
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{dateFormatter.format(movement.createdAt)}</TableCell>
                  <TableCell>{movement.product.category.name}</TableCell>
                  <TableCell className="font-medium text-zinc-900">
                    {movement.product.name}
                    <p className="text-xs text-zinc-500">{movement.product.sku}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={movementTypeClass(movement.type)}>{movementTypeLabel(movement.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {movement.quantity} {stockUnitLabel(movement.product.stockUnit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {movement.previousStock} {stockUnitLabel(movement.product.stockUnit)}
                  </TableCell>
                  <TableCell className="text-right">
                    {movement.resultingStock} {stockUnitLabel(movement.product.stockUnit)}
                  </TableCell>
                  <TableCell>{movement.operator?.name ?? "-"}</TableCell>
                  <TableCell className="max-w-[18rem] text-sm text-muted-foreground">
                    {movement.note || "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            </div>
          </SheetContent>
        </Sheet>
      ) : null}

      {isXmlPanelOpen ? (
        <Sheet defaultOpen>
          <SheetContent side="right" showCloseButton={false} className="w-[min(100vw,1100px)] overflow-y-auto p-0 sm:max-w-[1100px]">
            <SheetHeader className="border-b border-border/70 p-4">
              <div className="flex items-center justify-between gap-3 pr-1">
                <div>
                  <SheetTitle>XMLs</SheetTitle>
                  <SheetDescription className="sr-only">XMLs carregados sob demanda.</SheetDescription>
                </div>
                <Link href="/admin/stock" className={outlineLinkClass}>
                  Fechar
                </Link>
              </div>
            </SheetHeader>

            <div className="p-4">
              {xmlHistory?.setupPending ? (
                <p className="text-sm text-amber-600">Tabela de XML pendente no banco.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Chave</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Emissao</TableHead>
                      <TableHead className="text-right">Itens</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Arquivo</TableHead>
                      {canManage ? <TableHead className="text-right">Acao</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {xmlHistory?.entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManage ? 9 : 8} className="text-center text-sm text-zinc-500">
                          Nenhum XML carregado.
                        </TableCell>
                      </TableRow>
                    ) : null}

                    {xmlHistory?.entries.map((xmlEntry) => (
                      <Fragment key={xmlEntry.id}>
                        <TableRow>
                          <TableCell className="max-w-[9rem] truncate font-mono text-xs text-muted-foreground">
                            {xmlEntry.accessKey}
                          </TableCell>
                          <TableCell>{xmlEntry.supplierName ?? "-"}</TableCell>
                          <TableCell>
                            {xmlEntry.invoiceNumber ? `N${xmlEntry.invoiceNumber}` : "-"}
                            {xmlEntry.invoiceSeries ? (
                              <p className="text-xs text-muted-foreground">Serie {xmlEntry.invoiceSeries}</p>
                            ) : null}
                          </TableCell>
                          <TableCell>{xmlEntry.issuedAt ? dateOnlyFormatter.format(xmlEntry.issuedAt) : "-"}</TableCell>
                          <TableCell className="text-right">{xmlEntry.itemCount}</TableCell>
                          <TableCell className="text-right">
                            {xmlEntry.totalAmount ? currencyFormatter.format(Number(xmlEntry.totalAmount)) : "-"}
                          </TableCell>
                          <TableCell>
                            {xmlEntry.importedAt ? (
                              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Importado</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="max-w-[12rem] truncate text-sm">{xmlEntry.sourceFileName}</p>
                          </TableCell>
                          {canManage ? (
                            <TableCell className="text-right">
                              {xmlEntry.importedAt ? (
                                <span className="text-xs text-muted-foreground">Concluido</span>
                              ) : (
                                <Link
                                  href={`/admin/stock/xml/${xmlEntry.id}`}
                                  className="inline-flex h-8 items-center justify-center rounded-xl bg-primary px-3 text-[0.8rem] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                                >
                                  Conferir
                                </Link>
                              )}
                            </TableCell>
                          ) : null}
                        </TableRow>
                        <TableRow className="bg-card/25">
                          <TableCell colSpan={canManage ? 9 : 8}>
                            <details className="group rounded-xl border border-border/70 bg-background/45 p-3">
                              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                                <span>Previa</span>
                                <span className="text-xs font-medium text-muted-foreground group-open:hidden">Abrir</span>
                                <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Fechar</span>
                              </summary>

                              {xmlEntry.previewError ? (
                                <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                                  {xmlEntry.previewError}
                                </p>
                              ) : xmlEntry.preview ? (
                                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                  {xmlEntry.preview.shownItems.map((item) => (
                                    <div key={`${xmlEntry.id}-${item.lineNumber}`} className="rounded-xl border border-border/70 bg-card/50 p-3">
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="line-clamp-2 text-sm font-semibold text-foreground">{item.description}</p>
                                        <span className="rounded-full border border-primary/35 px-2 py-0.5 text-xs font-semibold text-primary">
                                          {item.quantity} un
                                        </span>
                                      </div>
                                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                                        <span>NCM {item.ncm ?? "-"}</span>
                                        <span>CFOP {item.cfop ?? "-"}</span>
                                        <span>Custo {currencyFormatter.format(item.unitCost)}</span>
                                        <span>Total {currencyFormatter.format(item.totalCost)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </details>
                          </TableCell>
                        </TableRow>
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  );
}

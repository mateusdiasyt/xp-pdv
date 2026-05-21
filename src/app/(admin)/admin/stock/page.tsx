import { StockMovementType, StockUnit } from "@prisma/client";
import Link from "next/link";
import { Fragment } from "react";

import { requirePermission } from "@/application/auth/guards";
import { getStockFormOptions, getStockInvoiceXmlHistory, getStockMovements } from "@/application/stock/stock-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { CreateStockMovementForm } from "@/presentation/admin/stock/create-stock-movement-form";
import { FetchStockInvoiceXmlByKeyForm } from "@/presentation/admin/stock/fetch-stock-invoice-xml-by-key-form";
import { UploadStockInvoiceXmlForm } from "@/presentation/admin/stock/upload-stock-invoice-xml-form";

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

export default async function StockPage() {
  const session = await requirePermission(PERMISSIONS.STOCK_VIEW);
  const [movements, products, xmlHistory] = await Promise.all([
    getStockMovements(),
    getStockFormOptions(),
    getStockInvoiceXmlHistory(),
  ]);
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.STOCK_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Modulo ERP"
        title="Estoque e Movimentacoes"
        description="Historico auditavel de entradas, saidas e ajustes com operador responsavel."
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Entrada por NF-e de compra</CardTitle>
            <CardDescription>
              Escaneie a chave do DANFE ou envie o XML recebido. O estoque so muda depois da conferencia dos itens.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Buscar pela chave da nota</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ideal para leitor de barras: leia a chave do DANFE, baixe o XML recebido e confira antes de importar.
                </p>
              </div>
              <FetchStockInvoiceXmlByKeyForm />
            </div>

            <div className="rounded-2xl border border-border/75 bg-card/45 p-4">
              <div className="mb-4">
                <p className="text-sm font-semibold text-foreground">Enviar arquivo XML</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use quando o fornecedor enviar o XML por e-mail, WhatsApp ou download.
                </p>
              </div>
              <UploadStockInvoiceXmlForm />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>XMLs guardados</CardTitle>
          <CardDescription>
            Ultimos XMLs enviados para conferencia. A importacao so acontece pelo botao de confirmacao.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {xmlHistory.setupPending ? (
            <p className="text-sm text-amber-600">
              A tabela de XML ainda nao foi criada neste banco. Execute o db:push para habilitar o armazenamento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Chave NF-e</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Data emissao</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Arquivo</TableHead>
                  {canManage ? <TableHead className="text-right">Acao</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {xmlHistory.entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 9 : 8} className="text-center text-sm text-zinc-500">
                      Nenhum XML de estoque foi carregado.
                    </TableCell>
                  </TableRow>
                ) : null}

                {xmlHistory.entries.map((xmlEntry) => (
                  <Fragment key={xmlEntry.id}>
                    <TableRow>
                      <TableCell className="font-mono text-xs text-muted-foreground">{xmlEntry.accessKey}</TableCell>
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
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            Importado em {dateFormatter.format(xmlEntry.importedAt)}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando conferencia</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="max-w-[14rem] truncate text-sm">{xmlEntry.sourceFileName}</p>
                        <p className="text-xs text-muted-foreground">Upload em {dateFormatter.format(xmlEntry.createdAt)}</p>
                      </TableCell>
                      {canManage ? (
                        <TableCell className="text-right">
                          {xmlEntry.importedAt ? (
                            <span className="text-xs text-muted-foreground">Importacao concluida</span>
                          ) : (
                            <Link
                              href={`/admin/stock/xml/${xmlEntry.id}`}
                              className="inline-flex h-8 items-center justify-center rounded-xl bg-primary px-3 text-[0.8rem] font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:bg-primary/92 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                            >
                              Conferir entrada
                            </Link>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                    <TableRow className="bg-card/25">
                      <TableCell colSpan={canManage ? 9 : 8}>
                        <details className="group rounded-xl border border-border/70 bg-background/45 p-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                            <span>Previa dos itens antes de importar</span>
                            <span className="text-xs font-medium text-muted-foreground group-open:hidden">Abrir</span>
                            <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Fechar</span>
                          </summary>

                          {xmlEntry.previewError ? (
                            <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                              {xmlEntry.previewError} Contate o Mateus.
                            </p>
                          ) : xmlEntry.preview ? (
                            <div className="mt-3 space-y-3">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {xmlEntry.preview.recipientName ? <span>Destinatario: {xmlEntry.preview.recipientName}</span> : null}
                                {xmlEntry.preview.recipientDocument ? <span>CNPJ/CPF: {xmlEntry.preview.recipientDocument}</span> : null}
                                <span>
                                  Mostrando {xmlEntry.preview.shownItems.length} de {xmlEntry.preview.itemLines} linha(s) da NF-e.
                                </span>
                              </div>

                              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
                                    {item.commercialUnit || item.taxableUnit ? (
                                      <p className="mt-2 text-[11px] text-muted-foreground">
                                        XML: {item.commercialQuantity ?? "-"} {item.commercialUnit ?? "uCom"} /{" "}
                                        {item.taxableQuantity ?? "-"} {item.taxableUnit ?? "uTrib"}
                                      </p>
                                    ) : null}
                                  </div>
                                ))}
                              </div>

                              {!xmlEntry.importedAt ? (
                                <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-muted-foreground">
                                  Abra Conferir entrada para revisar produto, preco, imagem e quantidade antes de movimentar o estoque.
                                </p>
                              ) : null}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historico recente</CardTitle>
          <CardDescription>Ultimas 100 movimentacoes registradas.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Estoque antes</TableHead>
                <TableHead className="text-right">Estoque depois</TableHead>
                <TableHead>Operador</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-zinc-500">
                    Nenhuma movimentacao registrada.
                  </TableCell>
                </TableRow>
              ) : null}
              {movements.map((movement) => (
                <TableRow key={movement.id}>
                  <TableCell>{dateFormatter.format(movement.createdAt)}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Movimentacao manual</CardTitle>
            <CardDescription>
              Acao opcional para ajustes pontuais. Fica fechada por padrao e abre somente quando necessario.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <details className="group rounded-xl border border-border/75 bg-card/50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
                <span>Abrir registro manual de estoque</span>
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
    </div>
  );
}

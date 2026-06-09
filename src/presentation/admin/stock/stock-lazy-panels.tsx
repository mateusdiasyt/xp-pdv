"use client";

import { FormEvent, useMemo, useState } from "react";
import { Archive, Download, FileText, History, Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getWorkspaceSlugFromPathname, toTenantAdminHref } from "@/lib/tenant-routes";

type Panel = "log" | "xml";

type StockCategory = {
  id: string;
  name: string;
};

type StockMovement = {
  id: string;
  createdAt: string | null;
  type: "IN" | "OUT" | "ADJUSTMENT";
  typeLabel: string;
  quantity: number;
  previousStock: number;
  resultingStock: number;
  unitLabel: string;
  note: string;
  operatorName: string | null;
  product: {
    name: string;
    sku: string;
    categoryName: string;
  };
};

type StockLogPayload = {
  categories: StockCategory[];
  movements: StockMovement[];
};

type StockXmlEntry = {
  id: string;
  accessKey: string;
  invoiceNumber: string | null;
  invoiceSeries: string | null;
  supplierName: string | null;
  issuedAt: string | null;
  totalAmount: number | null;
  itemCount: number;
  sourceFileName: string;
  importedAt: string | null;
  previewError?: string;
  preview: {
    itemLines: number;
    shownItems: Array<{
      lineNumber: number;
      description: string;
      ncm?: string;
      cfop?: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
    }>;
  } | null;
};

type StockXmlPayload = {
  setupPending: boolean;
  entries: StockXmlEntry[];
};

type LoadState = {
  status: "idle" | "loading" | "success" | "error";
  message?: string;
};

type XmlExportState = {
  status: "idle" | "loading" | "error";
  message?: string;
};

const movementFilterOptions = [
  { label: "Todos os tipos", value: "all" },
  { label: "Entradas", value: "IN" },
  { label: "Saidas", value: "OUT" },
  { label: "Ajustes", value: "ADJUSTMENT" },
];

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

const stockActionButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:border-border hover:bg-muted/70";

function movementTypeClass(type: StockMovement["type"]) {
  if (type === "IN") {
    return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100";
  }

  if (type === "OUT") {
    return "bg-rose-100 text-rose-700 hover:bg-rose-100";
  }

  return "bg-amber-100 text-amber-700 hover:bg-amber-100";
}

function formatDate(value: string | null, mode: "date" | "dateTime" = "dateTime") {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return mode === "date" ? dateOnlyFormatter.format(date) : dateFormatter.format(date);
}

function extractDownloadFileName(headers: Headers, fallback: string) {
  const disposition = headers.get("content-disposition");
  const match = disposition?.match(/filename="([^"]+)"/i);

  return match?.[1] || fallback;
}

async function fetchPanel<TPayload>(panel: Panel, params?: URLSearchParams) {
  const query = new URLSearchParams(params);
  query.set("panel", panel);

  const response = await fetch(`/api/admin/stock/panels?${query.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Nao foi possivel carregar este painel.");
  }

  return (await response.json()) as TPayload;
}

export function StockLazyPanels({ canManage }: { canManage: boolean }) {
  const pathname = usePathname();
  const workspaceSlug = getWorkspaceSlugFromPathname(pathname);
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "idle" });
  const [logData, setLogData] = useState<StockLogPayload | null>(null);
  const [xmlData, setXmlData] = useState<StockXmlPayload | null>(null);
  const [xmlExportState, setXmlExportState] = useState<XmlExportState>({ status: "idle" });
  const [xmlExportFilters, setXmlExportFilters] = useState({
    startDate: "",
    endDate: "",
  });
  const [logFilters, setLogFilters] = useState({
    q: "",
    categoryId: "all",
    movementType: "all",
  });

  const hasMovementFilters = useMemo(
    () => Boolean(logFilters.q.trim() || logFilters.categoryId !== "all" || logFilters.movementType !== "all"),
    [logFilters],
  );

  async function open(panel: Panel) {
    setOpenPanel(panel);
    setLoadState({ status: "loading" });

    try {
      if (panel === "log") {
        const params = new URLSearchParams();
        if (logFilters.q.trim()) {
          params.set("q", logFilters.q.trim());
        }
        params.set("categoryId", logFilters.categoryId);
        params.set("movementType", logFilters.movementType);
        setLogData(await fetchPanel<StockLogPayload>("log", params));
      } else {
        setXmlExportState({ status: "idle" });
        setXmlData(await fetchPanel<StockXmlPayload>("xml"));
      }

      setLoadState({ status: "success" });
    } catch (error) {
      setLoadState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel carregar este painel.",
      });
    }
  }

  async function handleLogFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await open("log");
  }

  async function loadCleanLog() {
    setLogFilters({ q: "", categoryId: "all", movementType: "all" });
    setOpenPanel("log");
    setLoadState({ status: "loading" });

    try {
      setLogData(
        await fetchPanel<StockLogPayload>(
          "log",
          new URLSearchParams({
            categoryId: "all",
            movementType: "all",
          }),
        ),
      );
      setLoadState({ status: "success" });
    } catch (error) {
      setLoadState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel carregar este painel.",
      });
    }
  }

  function goToReview(xmlId: string) {
    window.location.assign(toTenantAdminHref(`/admin/stock/xml/${xmlId}`, workspaceSlug));
  }

  async function handleXmlExportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setXmlExportState({ status: "loading" });

    try {
      const params = new URLSearchParams({
        startDate: xmlExportFilters.startDate,
        endDate: xmlExportFilters.endDate,
      });
      const response = await fetch(`/api/admin/stock/xml/export?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Nao foi possivel exportar os XMLs.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = extractDownloadFileName(response.headers, "xml-estoque.zip");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setXmlExportState({ status: "idle" });
    } catch (error) {
      setXmlExportState({
        status: "error",
        message: error instanceof Error ? error.message : "Nao foi possivel exportar os XMLs.",
      });
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={stockActionButtonClass} onClick={() => open("log")}>
          <History className="h-4 w-4" />
          Ver log
        </button>
        <button type="button" className={stockActionButtonClass} onClick={() => open("xml")}>
          <FileText className="h-4 w-4" />
          XMLs
        </button>
      </div>

      {openPanel ? (
        <div className="fixed inset-0 z-[120] bg-black/35 backdrop-blur-sm">
          <div className="ml-auto flex h-full w-[min(100vw,1080px)] flex-col border-l border-border/80 bg-background shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 p-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {openPanel === "log" ? "Log de estoque" : "XMLs"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {openPanel === "log" ? "Movimentacoes carregadas agora." : "XMLs guardados para conferencia."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenPanel(null)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/85 px-3 text-sm font-medium text-foreground"
              >
                <X className="h-4 w-4" />
                Fechar
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loadState.status === "loading" ? (
                <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : null}

              {loadState.status === "error" ? (
                <p className="rounded-xl border border-destructive/35 bg-destructive/10 p-4 text-sm text-destructive">
                  {loadState.message}
                </p>
              ) : null}

              {loadState.status === "success" && openPanel === "log" && logData ? (
                <div className="space-y-4">
                  <form
                    onSubmit={handleLogFilterSubmit}
                    className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px_auto_auto]"
                  >
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={logFilters.q}
                        onChange={(event) => setLogFilters((current) => ({ ...current, q: event.target.value }))}
                        placeholder="Buscar produto ou SKU"
                        className="pl-9"
                      />
                    </div>

                    <select
                      className="admin-native-select"
                      value={logFilters.categoryId}
                      onChange={(event) => setLogFilters((current) => ({ ...current, categoryId: event.target.value }))}
                    >
                      <option value="all">Todas as categorias</option>
                      {logData.categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>

                    <select
                      className="admin-native-select"
                      value={logFilters.movementType}
                      onChange={(event) =>
                        setLogFilters((current) => ({ ...current, movementType: event.target.value }))
                      }
                    >
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

                    <Button
                      type="button"
                      variant="outline"
                      onClick={loadCleanLog}
                    >
                      Limpar
                    </Button>
                  </form>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <p>{logData.movements.length} registro(s)</p>
                    <p>Filtros: {hasMovementFilters ? "ativos" : "nenhum"}</p>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Produto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Qtd.</TableHead>
                        <TableHead className="text-right">Antes</TableHead>
                        <TableHead className="text-right">Depois</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead>Obs.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logData.movements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                            Nenhuma movimentacao registrada.
                          </TableCell>
                        </TableRow>
                      ) : null}
                      {logData.movements.map((movement) => (
                        <TableRow key={movement.id}>
                          <TableCell>{formatDate(movement.createdAt)}</TableCell>
                          <TableCell>{movement.product.categoryName}</TableCell>
                          <TableCell className="font-medium text-foreground">
                            {movement.product.name}
                            <p className="text-xs text-muted-foreground">{movement.product.sku}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={movementTypeClass(movement.type)}>{movement.typeLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {movement.quantity} {movement.unitLabel}
                          </TableCell>
                          <TableCell className="text-right">
                            {movement.previousStock} {movement.unitLabel}
                          </TableCell>
                          <TableCell className="text-right">
                            {movement.resultingStock} {movement.unitLabel}
                          </TableCell>
                          <TableCell>{movement.operatorName ?? "-"}</TableCell>
                          <TableCell className="max-w-[18rem] text-sm text-muted-foreground">
                            {movement.note || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {loadState.status === "success" && openPanel === "xml" && xmlData ? (
                <div className="space-y-3">
                  {!xmlData.setupPending && xmlData.entries.length > 0 ? (
                    <form
                      onSubmit={handleXmlExportSubmit}
                      className="grid gap-3 rounded-2xl border border-border/75 bg-card/55 p-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]"
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">Exportar XMLs em ZIP</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Filtra pela data em que o XML foi salvo no sistema.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Data inicial</span>
                        <Input
                          type="date"
                          value={xmlExportFilters.startDate}
                          onChange={(event) =>
                            setXmlExportFilters((current) => ({ ...current, startDate: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground">Data final</span>
                        <Input
                          type="date"
                          value={xmlExportFilters.endDate}
                          onChange={(event) =>
                            setXmlExportFilters((current) => ({ ...current, endDate: event.target.value }))
                          }
                          required
                        />
                      </div>
                      <div className="flex flex-col justify-end gap-2">
                        <Button type="submit" className="gap-2" disabled={xmlExportState.status === "loading"}>
                          {xmlExportState.status === "loading" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                          {xmlExportState.status === "loading" ? "Exportando..." : "Exportar ZIP"}
                        </Button>
                        {xmlExportState.status === "error" ? (
                          <p className="text-xs text-destructive">{xmlExportState.message}</p>
                        ) : null}
                      </div>
                    </form>
                  ) : null}

                  {xmlData.setupPending ? (
                    <p className="rounded-xl border border-amber-400/35 bg-amber-400/10 p-4 text-sm text-amber-200">
                      Tabela de XML pendente no banco.
                    </p>
                  ) : null}

                  {!xmlData.setupPending && xmlData.entries.length === 0 ? (
                    <p className="rounded-xl border border-border/70 bg-card/50 p-4 text-center text-sm text-muted-foreground">
                      Nenhum XML carregado.
                    </p>
                  ) : null}

                  {xmlData.entries.map((xmlEntry) => (
                    <div key={xmlEntry.id} className="rounded-2xl border border-border/75 bg-card/55 p-3">
                      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.7fr_120px_120px_auto] lg:items-center">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {xmlEntry.supplierName ?? "Fornecedor nao identificado"}
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{xmlEntry.accessKey}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>{xmlEntry.invoiceNumber ? `Nota ${xmlEntry.invoiceNumber}` : "Nota -"}</p>
                          <p>{formatDate(xmlEntry.issuedAt, "date")}</p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <p>{xmlEntry.itemCount} item(ns)</p>
                          <p>{xmlEntry.totalAmount ? currencyFormatter.format(xmlEntry.totalAmount) : "-"}</p>
                        </div>
                        <div>
                          {xmlEntry.importedAt ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Importado</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pendente</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <a
                            className={stockActionButtonClass}
                            href={`/api/admin/stock/xml/${xmlEntry.id}/download`}
                          >
                            <Download className="h-4 w-4" />
                            Baixar XML
                          </a>
                          {canManage && !xmlEntry.importedAt ? (
                            <Button type="button" onClick={() => goToReview(xmlEntry.id)}>
                              Conferir entrada
                            </Button>
                          ) : null}
                        </div>
                      </div>

                      {xmlEntry.previewError ? (
                        <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                          {xmlEntry.previewError}
                        </p>
                      ) : xmlEntry.preview ? (
                        <details className="group mt-3 rounded-xl border border-border/70 bg-background/45 p-3">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
                            <span>Previa dos itens</span>
                            <span className="text-xs font-medium text-muted-foreground group-open:hidden">Abrir</span>
                            <span className="hidden text-xs font-medium text-muted-foreground group-open:inline">Fechar</span>
                          </summary>
                          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
                          {xmlEntry.preview.itemLines > xmlEntry.preview.shownItems.length ? (
                            <p className="mt-3 text-xs text-muted-foreground">
                              Mostrando {xmlEntry.preview.shownItems.length} de {xmlEntry.preview.itemLines} linha(s).
                            </p>
                          ) : null}
                        </details>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

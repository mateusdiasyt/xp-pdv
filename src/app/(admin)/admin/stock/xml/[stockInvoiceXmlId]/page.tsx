import Link from "next/link";
import { ArrowLeft, BadgeCheck, FileSearch } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getStockInvoiceXmlReview } from "@/application/stock/stock-service";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { StockInvoiceXmlReviewForm } from "@/presentation/admin/stock/stock-invoice-xml-review-form";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default async function StockInvoiceXmlReviewPage({
  params,
}: {
  params: Promise<{ stockInvoiceXmlId: string }>;
}) {
  await requirePermission(PERMISSIONS.STOCK_MANAGE);
  const { stockInvoiceXmlId } = await params;
  const review = await getStockInvoiceXmlReview(stockInvoiceXmlId);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/stock"
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border/80 bg-background/85 px-3.5 text-sm font-medium text-foreground shadow-sm transition-all hover:border-border hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao estoque
      </Link>

      <PageHeader
        eyebrow="Entrada por XML"
        title="Conferir NF-e antes do estoque"
        description="Cada linha precisa ter destino definido antes de criar produto ou movimentar saldo."
      />

      <Card>
        <CardHeader className="gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              {review.xml.invoiceNumber ? `NF-e ${review.xml.invoiceNumber}` : "NF-e guardada"}
            </CardTitle>
            <CardDescription className="mt-2">
              XML {review.xml.sourceFileName} guardado em {dateFormatter.format(review.xml.storedAt)}.
            </CardDescription>
          </div>
          {review.xml.importedAt ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Importado em {dateFormatter.format(review.xml.importedAt)}
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Aguardando conferencia</Badge>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Fornecedor</p>
            <p className="mt-2 font-semibold text-foreground">{review.xml.supplierName ?? "Nao identificado"}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{review.xml.supplierDocument ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Destinatario</p>
            <p className="mt-2 font-semibold text-foreground">{review.xml.recipientName ?? "Nao identificado"}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{review.xml.recipientDocument ?? "-"}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Chave</p>
            <p className="mt-2 break-all font-mono text-xs text-foreground">{review.xml.accessKey}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {review.xml.invoiceSeries ? `Serie ${review.xml.invoiceSeries}` : "Serie nao informada"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/45 p-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Resumo</p>
            <p className="mt-2 font-semibold text-foreground">{review.items.length} linha(s) para revisar</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Total XML {review.xml.totalAmount ? currencyFormatter.format(Number(review.xml.totalAmount)) : "-"}
            </p>
          </div>
        </CardContent>
      </Card>

      {review.xml.importedAt ? (
        <Card className="border-emerald-400/30 bg-emerald-400/10">
          <CardContent className="flex items-start gap-3 p-5">
            <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-500" />
            <div>
              <p className="font-semibold text-foreground">Esta entrada ja foi confirmada.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                O XML continua disponivel para auditoria, mas nao pode movimentar estoque novamente.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <StockInvoiceXmlReviewForm
          stockInvoiceXmlId={review.xml.id}
          categories={review.categories}
          products={review.products}
          items={review.items}
        />
      )}
    </div>
  );
}

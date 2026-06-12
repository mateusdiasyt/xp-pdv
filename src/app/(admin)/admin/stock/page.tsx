import { HelpCircle, PackagePlus } from "lucide-react";

import { requirePermission } from "@/application/auth/guards";
import { getStockFormOptions } from "@/application/stock/stock-service";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, PERMISSIONS } from "@/domain/auth/permissions";
import { CreateStockMovementForm } from "@/presentation/admin/stock/create-stock-movement-form";
import { FetchStockInvoiceXmlByKeyForm } from "@/presentation/admin/stock/fetch-stock-invoice-xml-by-key-form";
import { StockLazyPanels } from "@/presentation/admin/stock/stock-lazy-panels";
import { UploadStockInvoiceXmlForm } from "@/presentation/admin/stock/upload-stock-invoice-xml-form";

type StockPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function InfoHint({ label }: { label: string }) {
  return (
    <span title={label} aria-label="Ajuda" className="inline-flex">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
    </span>
  );
}

export default async function StockPage({ searchParams }: StockPageProps) {
  const session = await requirePermission(PERMISSIONS.STOCK_VIEW);
  void searchParams;
  const products = await getStockFormOptions();
  const canManage = hasPermission(session.user.permissions, PERMISSIONS.STOCK_MANAGE);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="ERP" title="Estoque" />

      <StockLazyPanels canManage={canManage} />

      {canManage ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <PackagePlus className="h-4 w-4" />
              Entrada por NF-e/NFC-e
              <InfoHint label="Modelo 55 pode ser buscado pela chave. Para modelo 65, envie o XML. Nada entra no estoque antes da conferencia." />
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

    </div>
  );
}

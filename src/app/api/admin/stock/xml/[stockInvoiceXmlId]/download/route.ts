import { requirePermission } from "@/application/auth/guards";
import { getStockInvoiceXmlFile } from "@/application/stock/stock-service";
import { PERMISSIONS } from "@/domain/auth/permissions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

function sanitizeXmlFileName(value: string | null | undefined, fallback: string) {
  const baseName = (value?.trim() || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ");
  const fileName = baseName.toLowerCase().endsWith(".xml") ? baseName : `${baseName}.xml`;

  return fileName || `${fallback}.xml`;
}

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      stockInvoiceXmlId: string;
    }>;
  },
) {
  await requirePermission(PERMISSIONS.STOCK_VIEW);

  const { stockInvoiceXmlId } = await context.params;

  try {
    const xmlRecord = await getStockInvoiceXmlFile(stockInvoiceXmlId);
    const fileName = sanitizeXmlFileName(xmlRecord.sourceFileName, `xml-${xmlRecord.accessKey}`);

    return new Response(xmlRecord.rawXml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Nao foi possivel baixar o XML.", { status: 404 });
  }
}

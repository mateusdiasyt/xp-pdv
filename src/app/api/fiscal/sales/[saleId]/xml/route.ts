import { PERMISSIONS, hasPermission } from "@/domain/auth/permissions";
import {
  downloadFocusXmlContent,
  resolveFocusConnection,
  resolveSaleXmlUrlForDownload,
  sanitizeSaleNumberForFileName,
} from "@/application/fiscal/focus-xml-download-service";
import {
  getSaleFiscalDocumentById,
  updateSaleFiscalData,
} from "@/infrastructure/db/repositories/sale-fiscal-repository";
import { getServerAuthSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      saleId: string;
    }>;
  },
) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new Response("Nao autorizado.", { status: 401 });
  }

  if (!hasPermission(session.user.permissions, PERMISSIONS.DASHBOARD_VIEW)) {
    return new Response("Sem permissao para baixar XML fiscal.", { status: 403 });
  }

  const { saleId } = await context.params;
  const sale = await getSaleFiscalDocumentById(saleId);
  if (!sale) {
    return new Response("Venda nao encontrada.", { status: 404 });
  }

  const reference = sale.fiscalReference ?? sale.saleNumber;
  if (!reference) {
    return new Response("Venda sem referencia fiscal para XML.", { status: 400 });
  }

  const connection = await resolveFocusConnection(sale.fiscalEnvironment);
  if (!connection) {
    return new Response("Token fiscal nao configurado para este ambiente. Contate o Mateus.", { status: 500 });
  }

  const resolvedXml = await resolveSaleXmlUrlForDownload({
    existingXmlUrl: sale.fiscalXmlUrl,
    reference,
    connection,
    preferCancellationXml: sale.fiscalStatus === "CANCELLED",
  });

  if (resolvedXml.persistableXmlUrl && resolvedXml.persistableXmlUrl !== sale.fiscalXmlUrl) {
    await updateSaleFiscalData(sale.id, {
      fiscalXmlUrl: resolvedXml.persistableXmlUrl,
      fiscalUpdatedAt: new Date(),
    });
  }

  if (!resolvedXml.xmlUrl) {
    return new Response("XML ainda nao disponivel para esta venda.", { status: 404 });
  }

  const xmlContent = await downloadFocusXmlContent({
    connection,
    xmlUrl: resolvedXml.xmlUrl,
  });

  if (!xmlContent) {
    return new Response("Nao foi possivel baixar o XML na Focus. Tente novamente em instantes ou contate o Mateus.", {
      status: 502,
    });
  }

  const encodedSaleNumber = sanitizeSaleNumberForFileName(sale.saleNumber);
  const fileName = `${encodedSaleNumber}.xml`;

  return new Response(xmlContent, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

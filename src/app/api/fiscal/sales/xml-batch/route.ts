import JSZip from "jszip";

import {
  downloadFocusXmlContent,
  resolveFocusConnection,
  resolveSaleXmlUrlForDownload,
  sanitizeSaleNumberForFileName,
} from "@/application/fiscal/focus-xml-download-service";
import { PERMISSIONS, hasAnyPermission } from "@/domain/auth/permissions";
import {
  listFiscalSales,
  updateSaleFiscalData,
} from "@/infrastructure/db/repositories/sale-fiscal-repository";
import { getServerAuthSession } from "@/lib/auth";

const BATCH_LIMIT = 300;

function parseDateStart(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function parseDateEnd(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(`${value}T23:59:59.999`);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed;
}

function normalizeFiscalStatus(value: string | null) {
  const normalized = (value ?? "ALL").trim().toUpperCase();
  return normalized || "ALL";
}

function getUniqueFileName(baseName: string, usedNames: Set<string>) {
  const root = baseName || "venda";
  const firstCandidate = `${root}.xml`;
  if (!usedNames.has(firstCandidate)) {
    usedNames.add(firstCandidate);
    return firstCandidate;
  }

  let sequence = 2;
  while (true) {
    const candidate = `${root}-${sequence}.xml`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }

    sequence += 1;
  }
}

function buildStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return new Response("Nao autorizado.", { status: 401 });
  }

  const canDownloadXml =
    session.user.roleSlug === "administrador" ||
    hasAnyPermission(session.user.permissions, [PERMISSIONS.FISCAL_VIEW, PERMISSIONS.SALES_VIEW]);

  if (!canDownloadXml) {
    return new Response("Sem permissao para baixar XML fiscal.", { status: 403 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim() || undefined;
  const startDate = parseDateStart(url.searchParams.get("startDate"));
  const endDate = parseDateEnd(url.searchParams.get("endDate"));
  const fiscalStatus = normalizeFiscalStatus(url.searchParams.get("fiscalStatus"));

  const sales = await listFiscalSales({
    query,
    startDate,
    endDate,
    fiscalStatus,
  });

  if (sales.length === 0) {
    return new Response("Nenhuma venda encontrada para os filtros selecionados.", { status: 404 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const errors: string[] = [];
  const connectionCache = new Map<string, Awaited<ReturnType<typeof resolveFocusConnection>>>();
  let downloadedCount = 0;

  const getConnection = async (environment: string | null) => {
    const key = (environment ?? "__DEFAULT__").toLowerCase();
    if (!connectionCache.has(key)) {
      connectionCache.set(key, await resolveFocusConnection(environment));
    }

    return connectionCache.get(key) ?? null;
  };

  for (const sale of sales) {
    const reference = sale.fiscalReference ?? sale.saleNumber;
    if (!reference) {
      errors.push(`${sale.saleNumber}: sem referencia fiscal.`);
      continue;
    }

    try {
      const connection = await getConnection(sale.fiscalEnvironment);
      if (!connection) {
        errors.push(`${sale.saleNumber}: token fiscal nao configurado.`);
        continue;
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
        errors.push(`${sale.saleNumber}: XML indisponivel no momento.`);
        continue;
      }

      const xmlContent = await downloadFocusXmlContent({
        connection,
        xmlUrl: resolvedXml.xmlUrl,
      });

      if (!xmlContent) {
        errors.push(`${sale.saleNumber}: falha ao baixar XML na Focus.`);
        continue;
      }

      const safeName = sanitizeSaleNumberForFileName(sale.saleNumber || sale.id);
      const fileName = getUniqueFileName(safeName, usedNames);
      zip.file(fileName, xmlContent);
      downloadedCount += 1;
    } catch {
      errors.push(`${sale.saleNumber}: erro inesperado ao processar XML.`);
    }
  }

  if (downloadedCount === 0) {
    return new Response(
      `Nenhum XML foi baixado para este filtro. Revise status/token e tente novamente. Contate o Mateus.\n\nDetalhes:\n${errors.join("\n")}`,
      { status: 424 },
    );
  }

  const summaryLines = [
    "Resumo do lote XML",
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Filtro -> query="${query ?? ""}" | status=${fiscalStatus} | inicio=${url.searchParams.get("startDate") ?? "-"} | fim=${url.searchParams.get("endDate") ?? "-"}`,
    `Vendas avaliadas: ${Math.min(sales.length, BATCH_LIMIT)} (limite ${BATCH_LIMIT})`,
    `XMLs baixados: ${downloadedCount}`,
    `Falhas: ${errors.length}`,
    "",
    ...errors.map((line, index) => `${index + 1}. ${line}`),
  ];
  zip.file("resumo-download.txt", summaryLines.join("\n"));

  const zipBuffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const zipArrayBuffer = new ArrayBuffer(zipBuffer.byteLength);
  new Uint8Array(zipArrayBuffer).set(zipBuffer);
  const fileName = `xml-vendas-${buildStamp()}.zip`;

  return new Response(zipArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

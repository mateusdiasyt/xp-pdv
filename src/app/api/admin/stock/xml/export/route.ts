import JSZip from "jszip";

import { requirePermission } from "@/application/auth/guards";
import { getStockInvoiceXmlFilesForExport } from "@/application/stock/stock-service";
import { PERMISSIONS } from "@/domain/auth/permissions";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

function parseSaoPauloDateStart(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00.000-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseSaoPauloDateEnd(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T23:59:59.999-03:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function sanitizeXmlFileName(value: string | null | undefined, fallback: string) {
  const baseName = (value?.trim() || fallback).replace(/[<>:"/\\|?*\x00-\x1F]/g, "-").replace(/\s+/g, " ");
  const fileName = baseName.toLowerCase().endsWith(".xml") ? baseName : `${baseName}.xml`;

  return fileName || `${fallback}.xml`;
}

function getUniqueFileName(fileName: string, usedNames: Set<string>) {
  if (!usedNames.has(fileName)) {
    usedNames.add(fileName);
    return fileName;
  }

  const root = fileName.toLowerCase().endsWith(".xml") ? fileName.slice(0, -4) : fileName;
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

export async function GET(request: Request) {
  await requirePermission(PERMISSIONS.STOCK_VIEW);

  const url = new URL(request.url);
  const rawStartDate = url.searchParams.get("startDate");
  const rawEndDate = url.searchParams.get("endDate");
  const startDate = parseSaoPauloDateStart(rawStartDate);
  const endDate = parseSaoPauloDateEnd(rawEndDate);

  if (!startDate || !endDate) {
    return new Response("Informe data inicial e data final validas.", { status: 400 });
  }

  if (startDate.getTime() > endDate.getTime()) {
    return new Response("A data inicial precisa ser menor ou igual a data final.", { status: 400 });
  }

  const xmlRecords = await getStockInvoiceXmlFilesForExport({
    startDate,
    endDate,
  });

  if (xmlRecords.length === 0) {
    return new Response("Nenhum XML encontrado para o periodo selecionado.", { status: 404 });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const xmlRecord of xmlRecords) {
    const fallback = `xml-${xmlRecord.accessKey}`;
    const safeName = sanitizeXmlFileName(xmlRecord.sourceFileName, fallback);
    zip.file(getUniqueFileName(safeName, usedNames), xmlRecord.rawXml);
  }

  const summaryLines = [
    "Resumo da exportacao de XML de estoque",
    `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
    `Periodo de upload: ${rawStartDate} ate ${rawEndDate}`,
    `XMLs exportados: ${xmlRecords.length}`,
    "",
    ...xmlRecords.map((xmlRecord, index) => {
      const invoice = xmlRecord.invoiceNumber ? `Nota ${xmlRecord.invoiceNumber}` : "Nota -";
      const supplier = xmlRecord.supplierName ?? "Fornecedor nao identificado";
      return `${index + 1}. ${invoice} | ${supplier} | ${xmlRecord.accessKey}`;
    }),
  ];
  zip.file("resumo-exportacao.txt", summaryLines.join("\n"));

  const zipBuffer = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  const zipArrayBuffer = new ArrayBuffer(zipBuffer.byteLength);
  new Uint8Array(zipArrayBuffer).set(zipBuffer);

  return new Response(zipArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="xml-estoque-${buildStamp()}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}

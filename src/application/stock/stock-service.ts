import { Prisma } from "@prisma/client";

import { createStockMovementSchema } from "@/domain/stock/schemas";
import {
  createAuditLog,
  findAuditLogByActionEntity,
  listStockXmlImportAuditEntries,
} from "@/infrastructure/db/repositories/audit-log-repository";
import { listProductOptions } from "@/infrastructure/db/repositories/product-repository";
import {
  createStockInvoiceXmlRecord,
  findStockInvoiceXmlById,
  importStockInvoiceItems,
  isMissingStockInvoiceXmlTableError,
  listStockInvoiceXmls,
  listStockMovements,
  registerStockMovement,
} from "@/infrastructure/db/repositories/stock-repository";

const MAX_XML_FILE_SIZE_BYTES = 2_000_000;
const FOCUS_NFE_RECEIVED_BASE_URL = "https://api.focusnfe.com.br";

type ParsedStockInvoiceItem = {
  lineNumber: number;
  supplierProductCode?: string;
  supplierEan?: string;
  supplierCommercialEan?: string;
  description: string;
  ncm?: string;
  cfop?: string;
  quantity: number;
  unitCost: Prisma.Decimal;
  commercialUnit?: string;
  commercialQuantity?: number;
  taxableUnit?: string;
  taxableQuantity?: number;
};

type ParsedStockInvoiceXml = {
  accessKey: string;
  invoiceNumber?: string;
  invoiceSeries?: string;
  supplierName?: string;
  supplierDocument?: string;
  recipientName?: string;
  recipientDocument?: string;
  issuedAt?: Date;
  totalAmount?: Prisma.Decimal;
  itemCount: number;
  items: ParsedStockInvoiceItem[];
};

type StockXmlImportSummary = {
  imported: boolean;
  createdProducts: number;
  updatedProducts: number;
  stockMovements: number;
  skippedItems: number;
};

const STOCK_XML_PREVIEW_ITEM_LIMIT = 8;

function normalizeXmlText(rawValue?: string) {
  return rawValue?.replace(/\s+/g, " ").trim() || undefined;
}

function extractTagBlock(xml: string, tagName: string) {
  const blockRegex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i");
  return xml.match(blockRegex)?.[1];
}

function extractTagValue(xml: string, tagName: string) {
  const valueRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  return normalizeXmlText(xml.match(valueRegex)?.[1]);
}

function parseXmlDecimal(rawValue?: string, maxPrecision = 2) {
  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.replace(",", ".").trim();
  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return new Prisma.Decimal(parsedValue.toFixed(maxPrecision));
}

function normalizeXmlDocument(rawValue?: string) {
  const digits = rawValue?.replace(/\D/g, "");
  return digits || undefined;
}

function normalizeXmlCode(rawValue?: string) {
  const normalized = normalizeXmlText(rawValue);
  if (!normalized || /^sem gtin$/i.test(normalized) || normalized === "0") {
    return undefined;
  }

  return normalized;
}

function parseXmlNumber(rawValue?: string) {
  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.replace(",", ".").trim();
  const parsedValue = Number(normalizedValue);
  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return parsedValue;
}

function inferSellableUnitMultiplier(description: string) {
  const normalizedDescription = description.toUpperCase();
  const packageMatch = normalizedDescription.match(/\b(\d{1,3})\s*X\s*(\d{1,3})\s*UN\b/);

  if (!packageMatch) {
    return 1;
  }

  const firstPackQuantity = Number(packageMatch[1]);
  const secondPackQuantity = Number(packageMatch[2]);
  const multiplier = firstPackQuantity * secondPackQuantity;

  return Number.isInteger(multiplier) && multiplier > 1 ? multiplier : 1;
}

function parseXmlDate(rawValue?: string) {
  if (!rawValue) {
    return undefined;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate;
}

function parseStockInvoiceItems(rawXml: string) {
  const detBlocks = Array.from(rawXml.matchAll(/<det\b[^>]*>([\s\S]*?)<\/det>/gi));
  const items: ParsedStockInvoiceItem[] = [];

  for (const [index, detMatch] of detBlocks.entries()) {
    const detBlock = detMatch[1] ?? "";
    const productBlock = extractTagBlock(detBlock, "prod") ?? detBlock;

    const description = extractTagValue(productBlock, "xProd");
    if (!description) {
      continue;
    }

    const commercialQuantity = parseXmlNumber(extractTagValue(productBlock, "qCom"));
    const taxableQuantity = parseXmlNumber(extractTagValue(productBlock, "qTrib"));
    const commercialUnit = normalizeXmlText(extractTagValue(productBlock, "uCom"));
    const taxableUnit = normalizeXmlText(extractTagValue(productBlock, "uTrib"));
    const preferredRawQuantity = taxableQuantity && taxableQuantity > 0 ? taxableQuantity : commercialQuantity;
    if (!preferredRawQuantity || preferredRawQuantity <= 0) {
      continue;
    }

    const quantityUsesTaxableUnit = Boolean(taxableQuantity && taxableQuantity > 0);
    const sellableUnitMultiplier = quantityUsesTaxableUnit ? 1 : inferSellableUnitMultiplier(description);
    const quantity = preferredRawQuantity * sellableUnitMultiplier;

    if (!Number.isInteger(quantity)) {
      throw new Error(
        `O item "${description}" possui quantidade vendavel fracionada (${quantity}). Ajuste manualmente antes de importar.`,
      );
    }

    const lineTotal = parseXmlDecimal(extractTagValue(productBlock, "vProd"), 2);
    const commercialUnitCost = parseXmlDecimal(extractTagValue(productBlock, "vUnCom"), 6);
    const taxableUnitCost = parseXmlDecimal(extractTagValue(productBlock, "vUnTrib"), 6);
    const unitCost =
      (quantityUsesTaxableUnit && taxableUnitCost ? taxableUnitCost.toDecimalPlaces(2) : undefined) ??
      (commercialUnitCost
        ? commercialUnitCost.dividedBy(sellableUnitMultiplier).toDecimalPlaces(2)
        : undefined) ?? (lineTotal ? lineTotal.dividedBy(quantity).toDecimalPlaces(2) : undefined);

    if (!unitCost) {
      continue;
    }

    const normalizedNcm = (extractTagValue(productBlock, "NCM") ?? "").replace(/\D/g, "");
    const taxableEan = normalizeXmlCode(extractTagValue(productBlock, "cEANTrib"));
    const commercialEan = normalizeXmlCode(extractTagValue(productBlock, "cEAN"));
    const supplierEan = taxableEan ?? commercialEan;

    items.push({
      lineNumber: index + 1,
      supplierProductCode: normalizeXmlText(extractTagValue(productBlock, "cProd")),
      supplierEan,
      supplierCommercialEan: commercialEan && commercialEan !== supplierEan ? commercialEan : undefined,
      description,
      ncm: normalizedNcm.length === 8 ? normalizedNcm : undefined,
      cfop: normalizeXmlText(extractTagValue(productBlock, "CFOP")),
      quantity,
      unitCost,
      commercialUnit,
      commercialQuantity,
      taxableUnit,
      taxableQuantity,
    });
  }

  return items;
}

function parseStockInvoiceXml(rawXml: string): ParsedStockInvoiceXml {
  const accessKeyFromId = rawXml.match(/\bId="NFe(\d{44})"/i)?.[1];
  const accessKeyFromTag = extractTagValue(rawXml, "chNFe");
  const accessKey = accessKeyFromId ?? accessKeyFromTag;

  if (!accessKey || !/^\d{44}$/.test(accessKey)) {
    throw new Error("Nao foi possivel identificar a chave de acesso no XML informado.");
  }

  const ideBlock = extractTagBlock(rawXml, "ide") ?? rawXml;
  const issuerBlock = extractTagBlock(rawXml, "emit") ?? rawXml;
  const recipientBlock = extractTagBlock(rawXml, "dest") ?? rawXml;
  const totalBlock = extractTagBlock(rawXml, "ICMSTot") ?? rawXml;

  const invoiceNumber = extractTagValue(ideBlock, "nNF");
  const invoiceSeries = extractTagValue(ideBlock, "serie");
  const supplierName = extractTagValue(issuerBlock, "xNome");
  const supplierDocument = normalizeXmlDocument(extractTagValue(issuerBlock, "CNPJ") ?? extractTagValue(issuerBlock, "CPF"));
  const recipientName = extractTagValue(recipientBlock, "xNome");
  const recipientDocument = normalizeXmlDocument(
    extractTagValue(recipientBlock, "CNPJ") ?? extractTagValue(recipientBlock, "CPF"),
  );
  const issuedAt = parseXmlDate(extractTagValue(ideBlock, "dhEmi") ?? extractTagValue(ideBlock, "dEmi"));
  const totalAmount = parseXmlDecimal(extractTagValue(totalBlock, "vNF"));
  const items = parseStockInvoiceItems(rawXml);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    accessKey,
    invoiceNumber,
    invoiceSeries,
    supplierName,
    supplierDocument,
    recipientName,
    recipientDocument,
    issuedAt,
    totalAmount,
    itemCount,
    items,
  };
}

function getConfiguredCompanyDocument() {
  return normalizeXmlDocument(process.env.FOCUS_NFCE_CNPJ_EMITENTE ?? process.env.FOCUS_NFE_CNPJ_EMITENTE);
}

function getFocusReceivedNfeToken() {
  return process.env.FOCUS_NFE_TOKEN_PROD?.trim() || process.env.FOCUS_NFE_TOKEN?.trim();
}

function normalizeAccessKey(rawValue?: string | null) {
  const digits = rawValue?.replace(/\D/g, "");
  return digits && digits.length === 44 ? digits : undefined;
}

async function extractFocusErrorMessage(response: Response) {
  const fallback = `Focus NFe respondeu ${response.status}.`;

  try {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as Record<string, unknown>;
      for (const candidate of [payload.mensagem, payload.message, payload.erro, payload.codigo]) {
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
    }

    const text = await response.text();
    return normalizeXmlText(text)?.slice(0, 240) ?? fallback;
  } catch {
    return fallback;
  }
}

async function fetchReceivedNfeXmlByAccessKey(accessKey: string) {
  const token = getFocusReceivedNfeToken();
  const companyDocument = getConfiguredCompanyDocument();

  if (!token || !companyDocument) {
    throw new Error(
      "Recebimento de NF-e nao configurado. Configure FOCUS_NFE_TOKEN_PROD e FOCUS_NFCE_CNPJ_EMITENTE/FOCUS_NFE_CNPJ_EMITENTE.",
    );
  }

  const url = new URL(`/v2/nfes_recebidas/${accessKey}.xml`, FOCUS_NFE_RECEIVED_BASE_URL);
  url.searchParams.set("cnpj", companyDocument);

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${token}:`).toString("base64")}`,
      Accept: "application/xml, text/xml, */*",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await extractFocusErrorMessage(response);
    if (response.status === 404) {
      throw new Error(
        `NF-e nao encontrada na Focus para esta chave. Confirme se o recebimento de NF-e esta ativo, se a nota foi emitida contra este CNPJ e tente novamente. Detalhe: ${detail}`,
      );
    }

    throw new Error(`Nao foi possivel baixar o XML da NF-e recebida na Focus. Detalhe: ${detail}`);
  }

  const rawXml = await response.text();
  if (!rawXml.includes("<") || !rawXml.toLowerCase().includes("infnfe")) {
    throw new Error("A Focus respondeu, mas o conteudo baixado nao parece ser um XML valido de NF-e.");
  }

  return rawXml;
}

function assertInvoiceRecipientMatchesCompany(parsedInvoice: ParsedStockInvoiceXml) {
  const configuredDocument = getConfiguredCompanyDocument();
  if (!configuredDocument || !parsedInvoice.recipientDocument) {
    return;
  }

  if (configuredDocument !== parsedInvoice.recipientDocument) {
    throw new Error(
      `XML pertence ao destinatario ${parsedInvoice.recipientDocument}, mas a empresa configurada e ${configuredDocument}. Confira o CNPJ antes de importar. Contate o Mateus.`,
    );
  }
}

function ensureXmlStorageAvailable(error: unknown): never {
  if (isMissingStockInvoiceXmlTableError(error)) {
    throw new Error("Modulo de XML de estoque aguardando sincronizacao do banco. Rode o db:push no ambiente atual.");
  }

  throw error instanceof Error ? error : new Error("Nao foi possivel salvar o XML de estoque.");
}

async function runStockXmlImport(params: {
  xmlRecordId: string;
  parsedInvoice: ParsedStockInvoiceXml;
  actorId?: string;
  allowCreateProducts: boolean;
}) {
  if (params.parsedInvoice.items.length === 0) {
    throw new Error("Nao foi encontrado nenhum item valido no XML para importar.");
  }

  const alreadyImported = await findAuditLogByActionEntity({
    action: "stock.xml.import",
    entity: "StockInvoiceXml",
    entityId: params.xmlRecordId,
  });

  if (alreadyImported) {
    throw new Error("Este XML ja foi importado anteriormente para o estoque.");
  }

  const summary = await importStockInvoiceItems({
    accessKey: params.parsedInvoice.accessKey,
    invoiceNumber: params.parsedInvoice.invoiceNumber,
    invoiceSeries: params.parsedInvoice.invoiceSeries,
    supplierName: params.parsedInvoice.supplierName,
    supplierDocument: params.parsedInvoice.supplierDocument,
    actorId: params.actorId,
    allowCreateProducts: params.allowCreateProducts,
    items: params.parsedInvoice.items,
  });

  await createAuditLog({
    userId: params.actorId,
    action: "stock.xml.import",
    entity: "StockInvoiceXml",
    entityId: params.xmlRecordId,
    metadata: {
      accessKey: params.parsedInvoice.accessKey,
      invoiceNumber: params.parsedInvoice.invoiceNumber,
      invoiceSeries: params.parsedInvoice.invoiceSeries,
      createdProducts: summary.createdProducts,
      updatedProducts: summary.updatedProducts,
      stockMovements: summary.stockMovements,
      skippedItems: summary.skippedItems,
      allowCreateProducts: params.allowCreateProducts,
    },
  });

  return summary;
}

function buildStockInvoiceXmlPreview(rawXml: string) {
  const parsedInvoice = parseStockInvoiceXml(rawXml);

  return {
    recipientName: parsedInvoice.recipientName,
    recipientDocument: parsedInvoice.recipientDocument,
    itemLines: parsedInvoice.items.length,
    shownItems: parsedInvoice.items.slice(0, STOCK_XML_PREVIEW_ITEM_LIMIT).map((item) => ({
      lineNumber: item.lineNumber,
      description: item.description,
      ncm: item.ncm,
      cfop: item.cfop,
      quantity: item.quantity,
      unitCost: Number(item.unitCost),
      totalCost: Number(item.unitCost) * item.quantity,
      commercialUnit: item.commercialUnit,
      commercialQuantity: item.commercialQuantity,
      taxableUnit: item.taxableUnit,
      taxableQuantity: item.taxableQuantity,
    })),
  };
}

export async function getStockMovements() {
  return listStockMovements();
}

export async function getStockFormOptions() {
  return listProductOptions();
}

export async function getStockInvoiceXmlHistory() {
  try {
    const entries = await listStockInvoiceXmls();
    const importAudits = await listStockXmlImportAuditEntries(entries.map((entry) => entry.id));
    const importedAtByXmlId = new Map<string, Date>();

    for (const entry of importAudits) {
      if (!entry.entityId || importedAtByXmlId.has(entry.entityId)) {
        continue;
      }

      importedAtByXmlId.set(entry.entityId, entry.createdAt);
    }

    return {
      entries: entries.map((entry) => {
        const { rawXml, ...safeEntry } = entry;

        try {
          return {
            ...safeEntry,
            importedAt: importedAtByXmlId.get(entry.id),
            preview: buildStockInvoiceXmlPreview(rawXml),
            previewError: undefined,
          };
        } catch {
          return {
            ...safeEntry,
            importedAt: importedAtByXmlId.get(entry.id),
            preview: undefined,
            previewError: "Nao foi possivel montar a previa dos itens deste XML.",
          };
        }
      }),
      setupPending: false,
    };
  } catch (error) {
    if (isMissingStockInvoiceXmlTableError(error)) {
      console.warn("[STOCK_XML] Tabela StockInvoiceXml ainda nao existe neste banco.");
      return {
        entries: [],
        setupPending: true,
      };
    }

    throw error;
  }
}

export async function registerStockMovementRecord(input: FormData, actorId?: string) {
  const parsed = createStockMovementSchema.parse({
    productId: input.get("productId"),
    type: input.get("type"),
    quantity: input.get("quantity"),
    unitCost: input.get("unitCost"),
    note: input.get("note"),
  });

  const movement = await registerStockMovement({
    productId: parsed.productId,
    type: parsed.type,
    quantity: parsed.quantity,
    unitCost: parsed.unitCost ? new Prisma.Decimal(parsed.unitCost) : undefined,
    note: parsed.note || undefined,
    operatorId: actorId,
  });

  await createAuditLog({
    userId: actorId,
    action: "stock.movement.create",
    entity: "StockMovement",
    entityId: movement.id,
    metadata: {
      productId: movement.productId,
      type: movement.type,
      quantity: movement.quantity,
      resultingStock: movement.resultingStock,
    },
  });
}

export async function storeStockInvoiceXmlRecord(input: FormData, actorId?: string): Promise<StockXmlImportSummary> {
  const maybeXmlFile = input.get("xmlFile");
  if (!(maybeXmlFile instanceof File) || maybeXmlFile.size <= 0) {
    throw new Error("Selecione um arquivo XML valido para continuar.");
  }

  if (!maybeXmlFile.name.toLowerCase().endsWith(".xml")) {
    throw new Error("Arquivo invalido. Envie um XML da NF-e.");
  }

  if (maybeXmlFile.size > MAX_XML_FILE_SIZE_BYTES) {
    throw new Error("Arquivo muito grande. Limite de 2 MB por XML.");
  }

  const rawXml = await maybeXmlFile.text();
  if (!rawXml.includes("<") || !rawXml.toLowerCase().includes("infnfe")) {
    throw new Error("O arquivo enviado nao parece ser um XML valido de NF-e.");
  }

  return storeRawStockInvoiceXmlRecord({
    input,
    actorId,
    rawXml,
    sourceFileName: maybeXmlFile.name,
    sourceFileSize: maybeXmlFile.size,
  });
}

async function storeRawStockInvoiceXmlRecord(params: {
  input: FormData;
  actorId?: string;
  rawXml: string;
  sourceFileName: string;
  sourceFileSize: number;
}): Promise<StockXmlImportSummary> {
  if (params.sourceFileSize > MAX_XML_FILE_SIZE_BYTES) {
    throw new Error("XML muito grande. Limite de 2 MB por nota.");
  }

  const { input, actorId, rawXml } = params;
  const parsedInvoice = parseStockInvoiceXml(rawXml);
  assertInvoiceRecipientMatchesCompany(parsedInvoice);

  let created: Awaited<ReturnType<typeof createStockInvoiceXmlRecord>>;
  try {
    created = await createStockInvoiceXmlRecord({
      accessKey: parsedInvoice.accessKey,
      invoiceNumber: parsedInvoice.invoiceNumber,
      invoiceSeries: parsedInvoice.invoiceSeries,
      supplierName: parsedInvoice.supplierName,
      supplierDocument: parsedInvoice.supplierDocument,
      issuedAt: parsedInvoice.issuedAt,
      totalAmount: parsedInvoice.totalAmount,
      itemCount: parsedInvoice.itemCount,
      rawXml,
      sourceFileName: params.sourceFileName,
      sourceFileSize: params.sourceFileSize,
      uploadedById: params.actorId,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("Este XML ja foi carregado anteriormente para o estoque.");
    }

    ensureXmlStorageAvailable(error);
  }

  const importSummary: StockXmlImportSummary = {
    imported: false,
    createdProducts: 0,
    updatedProducts: 0,
    stockMovements: 0,
    skippedItems: 0,
  };

  await createAuditLog({
    userId: actorId,
    action: "stock.xml.store",
    entity: "StockInvoiceXml",
    entityId: created.id,
    metadata: {
      accessKey: created.accessKey,
      invoiceNumber: created.invoiceNumber,
      invoiceSeries: created.invoiceSeries,
      supplierName: created.supplierName,
      recipientName: parsedInvoice.recipientName,
      recipientDocument: parsedInvoice.recipientDocument,
      itemCount: created.itemCount,
      sourceFileName: created.sourceFileName,
      sourceFileSize: created.sourceFileSize,
      importedProducts: false,
      importRequiresManualConfirmation: true,
      importSummary,
    },
  });

  return importSummary;
}

export async function fetchAndStoreStockInvoiceXmlByAccessKey(
  input: FormData,
  actorId?: string,
): Promise<StockXmlImportSummary> {
  const accessKey = normalizeAccessKey(String(input.get("accessKey") ?? ""));
  if (!accessKey) {
    throw new Error("Informe ou escaneie uma chave de acesso valida com 44 numeros.");
  }

  const rawXml = await fetchReceivedNfeXmlByAccessKey(accessKey);
  const sourceFileName = `${accessKey}-focus-recebida.xml`;
  const sourceFileSize = Buffer.byteLength(rawXml, "utf8");

  return storeRawStockInvoiceXmlRecord({
    input,
    actorId,
    rawXml,
    sourceFileName,
    sourceFileSize,
  });
}

export async function importStockInvoiceXmlById(stockInvoiceXmlId: string, actorId?: string): Promise<StockXmlImportSummary> {
  const xmlRecord = await findStockInvoiceXmlById(stockInvoiceXmlId);
  if (!xmlRecord) {
    throw new Error("XML nao encontrado para importacao.");
  }

  const parsedInvoice = parseStockInvoiceXml(xmlRecord.rawXml);
  assertInvoiceRecipientMatchesCompany(parsedInvoice);

  const summary = await runStockXmlImport({
    xmlRecordId: xmlRecord.id,
    parsedInvoice,
    actorId,
    allowCreateProducts: true,
  });

  return {
    imported: true,
    createdProducts: summary.createdProducts,
    updatedProducts: summary.updatedProducts,
    stockMovements: summary.stockMovements,
    skippedItems: summary.skippedItems,
  };
}

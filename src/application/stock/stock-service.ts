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

type ParsedStockInvoiceItem = {
  lineNumber: number;
  supplierProductCode?: string;
  supplierEan?: string;
  description: string;
  ncm?: string;
  quantity: number;
  unitCost: Prisma.Decimal;
};

type ParsedStockInvoiceXml = {
  accessKey: string;
  invoiceNumber?: string;
  invoiceSeries?: string;
  supplierName?: string;
  supplierDocument?: string;
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

    const rawQuantity = parseXmlNumber(extractTagValue(productBlock, "qCom"));
    if (!rawQuantity || rawQuantity <= 0) {
      continue;
    }

    if (!Number.isInteger(rawQuantity)) {
      throw new Error(
        `O item "${description}" possui quantidade fracionada (${rawQuantity}). Ajuste manualmente antes de importar.`,
      );
    }

    const sellableUnitMultiplier = inferSellableUnitMultiplier(description);
    const quantity = rawQuantity * sellableUnitMultiplier;

    if (!Number.isInteger(quantity)) {
      throw new Error(
        `O item "${description}" resultou em quantidade fracionada (${quantity}). Ajuste manualmente antes de importar.`,
      );
    }

    const lineTotal = parseXmlDecimal(extractTagValue(productBlock, "vProd"), 2);
    const commercialUnitCost = parseXmlDecimal(extractTagValue(productBlock, "vUnCom"), 2);
    const unitCost =
      (commercialUnitCost
        ? commercialUnitCost.dividedBy(sellableUnitMultiplier).toDecimalPlaces(2)
        : undefined) ?? (lineTotal ? lineTotal.dividedBy(quantity).toDecimalPlaces(2) : undefined);

    if (!unitCost) {
      continue;
    }

    const normalizedNcm = (extractTagValue(productBlock, "NCM") ?? "").replace(/\D/g, "");

    items.push({
      lineNumber: index + 1,
      supplierProductCode: normalizeXmlText(extractTagValue(productBlock, "cProd")),
      supplierEan: normalizeXmlText(extractTagValue(productBlock, "cEAN")),
      description,
      ncm: normalizedNcm.length === 8 ? normalizedNcm : undefined,
      quantity,
      unitCost,
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
  const totalBlock = extractTagBlock(rawXml, "ICMSTot") ?? rawXml;

  const invoiceNumber = extractTagValue(ideBlock, "nNF");
  const invoiceSeries = extractTagValue(ideBlock, "serie");
  const supplierName = extractTagValue(issuerBlock, "xNome");
  const supplierDocument = extractTagValue(issuerBlock, "CNPJ") ?? extractTagValue(issuerBlock, "CPF");
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
    issuedAt,
    totalAmount,
    itemCount,
    items,
  };
}

function readBooleanFormFlag(input: FormData, key: string) {
  const value = input.get(key);
  if (typeof value !== "string") {
    return false;
  }

  return value === "on" || value === "true" || value === "1";
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
      entries: entries.map((entry) => ({
        ...entry,
        importedAt: importedAtByXmlId.get(entry.id),
      })),
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

  const parsedInvoice = parseStockInvoiceXml(rawXml);
  const applyStockImport = readBooleanFormFlag(input, "applyStockImport");
  const allowCreateProducts = readBooleanFormFlag(input, "allowCreateProducts");

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
      sourceFileName: maybeXmlFile.name,
      sourceFileSize: maybeXmlFile.size,
      uploadedById: actorId,
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

  if (applyStockImport) {
    const summary = await runStockXmlImport({
      xmlRecordId: created.id,
      parsedInvoice,
      actorId,
      allowCreateProducts,
    });

    importSummary.imported = true;
    importSummary.createdProducts = summary.createdProducts;
    importSummary.updatedProducts = summary.updatedProducts;
    importSummary.stockMovements = summary.stockMovements;
    importSummary.skippedItems = summary.skippedItems;
  }

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
      itemCount: created.itemCount,
      sourceFileName: created.sourceFileName,
      sourceFileSize: created.sourceFileSize,
      importedProducts: importSummary.imported,
      importSummary,
    },
  });

  return importSummary;
}

export async function importStockInvoiceXmlById(stockInvoiceXmlId: string, actorId?: string): Promise<StockXmlImportSummary> {
  const xmlRecord = await findStockInvoiceXmlById(stockInvoiceXmlId);
  if (!xmlRecord) {
    throw new Error("XML nao encontrado para importacao.");
  }

  const parsedInvoice = parseStockInvoiceXml(xmlRecord.rawXml);

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

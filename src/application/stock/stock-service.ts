import { Prisma, StockMovementType, StockUnit } from "@prisma/client";

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
  importReviewedStockInvoiceItems,
  importStockInvoiceItems,
  isMissingStockInvoiceXmlTableError,
  listStockInvoiceReviewProducts,
  listStockInvoiceXmls,
  listStockMovements,
  registerStockMovement,
  type ListStockMovementsFilters,
  type ReviewedStockInvoiceItemInput,
} from "@/infrastructure/db/repositories/stock-repository";
import { listCategoryOptions } from "@/infrastructure/db/repositories/category-repository";

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
  stockInvoiceXmlId?: string;
  createdProducts: number;
  updatedProducts: number;
  stockMovements: number;
  skippedItems: number;
};

type StockInvoiceXmlReviewDecision = "existing" | "create" | "skip";

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

function inferFractionalStockSuggestion(item: Pick<ParsedStockInvoiceItem, "description" | "commercialUnit" | "taxableUnit">) {
  const source = `${item.description} ${item.commercialUnit ?? ""} ${item.taxableUnit ?? ""}`.toUpperCase();
  const volumeMatch = source.match(/\b(\d+(?:[.,]\d+)?)\s*(ML|L|LT|LITRO|LITROS)\b/);
  const isKegLike = /\b(BAR|BARRIL|KEG)\b/.test(source);

  if (!volumeMatch || !isKegLike) {
    return undefined;
  }

  const volume = Number(volumeMatch[1]?.replace(",", "."));
  if (!Number.isFinite(volume) || volume <= 0) {
    return undefined;
  }

  const unit = volumeMatch[2];
  const millilitersPerPackage = unit === "ML" ? Math.round(volume) : Math.round(volume * 1_000);
  if (millilitersPerPackage <= 0) {
    return undefined;
  }

  return {
    quantityMultiplier: millilitersPerPackage,
    quantityLabel: `${millilitersPerPackage} ml por volume do XML`,
  };
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

function buildFractionalSaleProductName(description: string) {
  const normalizedDescription = description.toUpperCase();

  if (normalizedDescription.includes("VINHO")) {
    return "Chopp de vinho 500ml";
  }

  if (normalizedDescription.includes("PILSEN") || normalizedDescription.includes("CHOPP") || normalizedDescription.includes("CHOPE")) {
    return "Chopp Pilsen 500ml";
  }

  return `${description} 500ml`;
}

function buildFractionalSaleProductSku(
  item: Pick<ParsedStockInvoiceItem, "supplierEan" | "supplierCommercialEan" | "supplierProductCode" | "lineNumber">,
) {
  const sourceCode = item.supplierEan ?? item.supplierCommercialEan ?? item.supplierProductCode ?? `LINHA-${item.lineNumber}`;
  const normalizedCode = sourceCode.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);

  return `COPO-${normalizedCode || `LINHA-${item.lineNumber}`}-500ML`;
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

function getFocusReceivedNfeAuthorization(token: string) {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
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

function hasCompleteReceivedNfeXml(rawXml: string) {
  return rawXml.includes("<") && rawXml.toLowerCase().includes("infnfe");
}

async function downloadFocusReceivedNfeXml(params: {
  accessKey: string;
  companyDocument: string;
  token: string;
}) {
  const { accessKey, companyDocument, token } = params;
  const url = new URL(`/v2/nfes_recebidas/${accessKey}.xml`, FOCUS_NFE_RECEIVED_BASE_URL);
  url.searchParams.set("cnpj", companyDocument);

  const response = await fetch(url, {
    headers: {
      Authorization: getFocusReceivedNfeAuthorization(token),
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

  return response.text();
}

function isDuplicateFocusManifestation(detail: string) {
  const normalizedDetail = detail
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return normalizedDetail.includes("duplicidade") || normalizedDetail.includes("ja existe");
}

async function requestFocusReceivedNfeScience(accessKey: string, token: string) {
  const url = new URL(`/v2/nfes_recebidas/${accessKey}/manifesto`, FOCUS_NFE_RECEIVED_BASE_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: getFocusReceivedNfeAuthorization(token),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tipo: "ciencia" }),
    cache: "no-store",
  });

  if (response.ok) {
    return;
  }

  const detail = await extractFocusErrorMessage(response);
  if (isDuplicateFocusManifestation(detail)) {
    return;
  }

  throw new Error(
    `A Focus ainda so tem o resumo desta NF-e e nao conseguiu registrar a Ciencia da Operacao automaticamente. Detalhe: ${detail}`,
  );
}

async function fetchReceivedNfeXmlByAccessKey(accessKey: string) {
  const token = getFocusReceivedNfeToken();
  const companyDocument = getConfiguredCompanyDocument();

  if (!token || !companyDocument) {
    throw new Error(
      "Recebimento de NF-e nao configurado. Configure FOCUS_NFE_TOKEN_PROD e FOCUS_NFCE_CNPJ_EMITENTE/FOCUS_NFE_CNPJ_EMITENTE.",
    );
  }

  const rawXml = await downloadFocusReceivedNfeXml({ accessKey, companyDocument, token });
  if (hasCompleteReceivedNfeXml(rawXml)) {
    return rawXml;
  }

  await requestFocusReceivedNfeScience(accessKey, token);

  const manifestedXml = await downloadFocusReceivedNfeXml({ accessKey, companyDocument, token });
  if (hasCompleteReceivedNfeXml(manifestedXml)) {
    return manifestedXml;
  }

  throw new Error(
    "A Ciencia da Operacao foi solicitada na Focus, mas o XML completo ainda nao foi liberado por ela. Aguarde alguns instantes e busque pela chave novamente. Se tiver o XML do fornecedor, envie o arquivo diretamente.",
  );
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

async function assertStockInvoiceXmlIsPending(xmlRecordId: string) {
  const alreadyImported = await findAuditLogByActionEntity({
    action: "stock.xml.import",
    entity: "StockInvoiceXml",
    entityId: xmlRecordId,
  });

  if (alreadyImported) {
    throw new Error("Este XML ja foi importado anteriormente para o estoque.");
  }
}

function normalizeReviewMatchValue(rawValue?: string | null) {
  const normalized = rawValue?.trim().toLowerCase();
  return normalized || undefined;
}

function findStockInvoiceReviewProductMatch(
  item: ParsedStockInvoiceItem,
  products: Awaited<ReturnType<typeof listStockInvoiceReviewProducts>>,
) {
  const skuCandidates = [
    normalizeReviewMatchValue(item.supplierEan),
    normalizeReviewMatchValue(item.supplierCommercialEan),
    normalizeReviewMatchValue(item.supplierProductCode),
  ].filter((value): value is string => Boolean(value));

  const skuMatch = products.find((product) => skuCandidates.includes(product.sku.trim().toLowerCase()));
  if (skuMatch) {
    return skuMatch;
  }

  const normalizedName = normalizeReviewMatchValue(item.description);
  return normalizedName ? products.find((product) => product.name.trim().toLowerCase() === normalizedName) : undefined;
}

function toDecimalInputValue(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2).toFixed(2);
}

function toCostInputValue(value: Prisma.Decimal) {
  return value.toDecimalPlaces(4).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function buildStockInvoiceReviewItem(
  item: ParsedStockInvoiceItem,
  matchedProduct: Awaited<ReturnType<typeof listStockInvoiceReviewProducts>>[number] | undefined,
  fallbackCategoryId: string,
) {
  const suggestedSku = item.supplierEan ?? item.supplierCommercialEan ?? item.supplierProductCode ?? "";
  const fractionalSuggestion = inferFractionalStockSuggestion(item);
  const suggestedStockUnit = matchedProduct?.stockUnit ?? (fractionalSuggestion ? StockUnit.MILLILITER : StockUnit.UNIT);
  const suggestedQuantity =
    suggestedStockUnit === StockUnit.MILLILITER && fractionalSuggestion
      ? item.quantity * fractionalSuggestion.quantityMultiplier
      : item.quantity;
  const suggestedUnitCost =
    suggestedStockUnit === StockUnit.MILLILITER && fractionalSuggestion
      ? item.unitCost.dividedBy(fractionalSuggestion.quantityMultiplier)
      : item.unitCost;

  return {
    lineNumber: item.lineNumber,
    description: item.description,
    supplierProductCode: item.supplierProductCode,
    supplierEan: item.supplierEan,
    supplierCommercialEan: item.supplierCommercialEan,
    ncm: item.ncm ?? "",
    cfop: item.cfop,
    quantity: suggestedQuantity,
    sourceQuantity: item.quantity,
    fractionalSuggestion,
    suggestedStockUnit,
    unitCost: toCostInputValue(suggestedUnitCost),
    totalCost: toDecimalInputValue(item.unitCost.times(item.quantity)),
    commercialUnit: item.commercialUnit,
    commercialQuantity: item.commercialQuantity,
    taxableUnit: item.taxableUnit,
    taxableQuantity: item.taxableQuantity,
    suggestedDecision: matchedProduct ? ("existing" as const) : ("create" as const),
    suggestedSku,
    matchedProductId: matchedProduct?.id,
    initialProduct: {
      name: matchedProduct?.name ?? item.description,
      ncm: matchedProduct?.ncm ?? item.ncm ?? "",
      imageUrl: matchedProduct?.imageUrl ?? "",
      categoryId: matchedProduct?.categoryId ?? fallbackCategoryId,
      salePrice: matchedProduct ? toDecimalInputValue(matchedProduct.salePrice) : toDecimalInputValue(suggestedUnitCost),
      happyHourPrice: matchedProduct?.happyHourPrice ? toDecimalInputValue(matchedProduct.happyHourPrice) : "",
      minStock: matchedProduct?.minStock ?? 0,
      stockUnit: suggestedStockUnit,
      pdvVisible: matchedProduct?.pdvVisible ?? !fractionalSuggestion,
    },
    fractionalSaleProduct:
      fractionalSuggestion && suggestedStockUnit === StockUnit.MILLILITER
        ? {
            name: buildFractionalSaleProductName(item.description),
            sku: buildFractionalSaleProductSku(item),
            ncm: item.ncm ?? "",
            categoryId: fallbackCategoryId,
            imageUrl: "",
            salePrice: toDecimalInputValue(suggestedUnitCost.times(500)),
            happyHourPrice: "",
            consumptionQuantity: 500,
          }
        : undefined,
  };
}

function getReviewField(input: FormData, lineNumber: number, fieldName: string) {
  return String(input.get(`item.${lineNumber}.${fieldName}`) ?? "").trim();
}

function parseReviewedDecision(rawValue: string, lineNumber: number): StockInvoiceXmlReviewDecision {
  if (rawValue === "existing" || rawValue === "create" || rawValue === "skip") {
    return rawValue;
  }

  throw new Error(`Escolha o destino do item ${lineNumber} antes de importar.`);
}

function parseReviewedPositiveInteger(rawValue: string, lineNumber: number, fieldLabel: string) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldLabel} invalida no item ${lineNumber}.`);
  }

  return parsed;
}

function parseReviewedNonNegativeInteger(rawValue: string, lineNumber: number, fieldLabel: string) {
  const parsed = Number(rawValue);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido no item ${lineNumber}.`);
  }

  return parsed;
}

function parseReviewedDecimal(
  rawValue: string,
  lineNumber: number,
  fieldLabel: string,
  allowZero = false,
  precision = 2,
) {
  const normalized = rawValue.replace(",", ".");
  const decimalPattern = new RegExp(`^\\d+(\\.\\d{1,${precision}})?$`);
  if (!decimalPattern.test(normalized)) {
    throw new Error(`${fieldLabel} invalido no item ${lineNumber}.`);
  }

  const parsed = new Prisma.Decimal(normalized);
  if ((!allowZero && parsed.lessThanOrEqualTo(0)) || parsed.lessThan(0)) {
    throw new Error(`${fieldLabel} invalido no item ${lineNumber}.`);
  }

  return parsed;
}

function parseReviewedOptionalDecimal(rawValue: string, lineNumber: number, fieldLabel: string) {
  return rawValue ? parseReviewedDecimal(rawValue, lineNumber, fieldLabel, true) : null;
}

function parseReviewedNcm(rawValue: string, lineNumber: number) {
  const normalized = rawValue.replace(/\D/g, "");
  if (!/^\d{8}$/.test(normalized)) {
    throw new Error(`NCM invalido no item ${lineNumber}. Use 8 digitos.`);
  }

  return normalized;
}

function parseReviewedImageUrl(rawValue: string, lineNumber: number) {
  if (!rawValue) {
    return undefined;
  }

  if (rawValue.length > 4_000_000 || !/^(https?:\/\/.+|\/.+|data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+)$/i.test(rawValue)) {
    throw new Error(`Imagem invalida no item ${lineNumber}.`);
  }

  return rawValue;
}

function parseReviewedStockInvoiceItems(input: FormData, items: ParsedStockInvoiceItem[]) {
  return items.map<ReviewedStockInvoiceItemInput>((item) => {
    const decision = parseReviewedDecision(getReviewField(input, item.lineNumber, "decision"), item.lineNumber);

    if (decision === "skip") {
      return {
        ...item,
        decision,
        stockUnit: StockUnit.UNIT,
        pdvVisible: false,
      };
    }

    const name = getReviewField(input, item.lineNumber, "name");
    const categoryId = getReviewField(input, item.lineNumber, "categoryId");
    if (name.length < 2 || !categoryId) {
      throw new Error(`Nome e categoria sao obrigatorios no item ${item.lineNumber}.`);
    }

    const stockUnit = parseReviewedStockUnit(getReviewField(input, item.lineNumber, "stockUnit"), item.lineNumber);
    const fractionalSaleProductEnabled = getReviewField(input, item.lineNumber, "fractionalSaleProduct.enabled") === "on";
    let fractionalSaleProduct: ReviewedStockInvoiceItemInput["fractionalSaleProduct"];

    if (fractionalSaleProductEnabled) {
      if (stockUnit !== StockUnit.MILLILITER) {
        throw new Error(`O item vendavel fracionado da linha ${item.lineNumber} exige entrada do insumo em mililitros.`);
      }

      const fractionalSaleName = getReviewField(input, item.lineNumber, "fractionalSaleProduct.name");
      const fractionalSaleCategoryId = getReviewField(input, item.lineNumber, "fractionalSaleProduct.categoryId");
      if (fractionalSaleName.length < 2 || !fractionalSaleCategoryId) {
        throw new Error(`Nome e categoria do item vendavel da linha ${item.lineNumber} sao obrigatorios.`);
      }

      fractionalSaleProduct = {
        name: fractionalSaleName,
        sku: getReviewField(input, item.lineNumber, "fractionalSaleProduct.sku") || undefined,
        ncm: parseReviewedNcm(getReviewField(input, item.lineNumber, "fractionalSaleProduct.ncm"), item.lineNumber),
        categoryId: fractionalSaleCategoryId,
        imageUrl: parseReviewedImageUrl(
          getReviewField(input, item.lineNumber, "fractionalSaleProduct.imageUrl"),
          item.lineNumber,
        ),
        salePrice: parseReviewedDecimal(
          getReviewField(input, item.lineNumber, "fractionalSaleProduct.salePrice"),
          item.lineNumber,
          "Preco do item vendavel",
          true,
        ),
        happyHourPrice: parseReviewedOptionalDecimal(
          getReviewField(input, item.lineNumber, "fractionalSaleProduct.happyHourPrice"),
          item.lineNumber,
          "Preco Happy Hour do item vendavel",
        ),
        consumptionQuantity: parseReviewedPositiveInteger(
          getReviewField(input, item.lineNumber, "fractionalSaleProduct.consumptionQuantity"),
          item.lineNumber,
          "Consumo do item vendavel",
        ),
      };
    }

    return {
      ...item,
      decision,
      productId: decision === "existing" ? getReviewField(input, item.lineNumber, "productId") : undefined,
      name,
      sku: decision === "create" ? getReviewField(input, item.lineNumber, "sku") : undefined,
      ncm: parseReviewedNcm(getReviewField(input, item.lineNumber, "ncm"), item.lineNumber),
      categoryId,
      imageUrl: parseReviewedImageUrl(getReviewField(input, item.lineNumber, "imageUrl"), item.lineNumber),
      quantity: parseReviewedPositiveInteger(getReviewField(input, item.lineNumber, "quantity"), item.lineNumber, "Quantidade"),
      unitCost: parseReviewedDecimal(
        getReviewField(input, item.lineNumber, "unitCost"),
        item.lineNumber,
        "Custo unitario",
        false,
        4,
      ),
      salePrice: parseReviewedDecimal(getReviewField(input, item.lineNumber, "salePrice"), item.lineNumber, "Preco de venda", true),
      happyHourPrice: parseReviewedOptionalDecimal(
        getReviewField(input, item.lineNumber, "happyHourPrice"),
        item.lineNumber,
        "Preco Happy Hour",
      ),
      minStock: parseReviewedNonNegativeInteger(
        getReviewField(input, item.lineNumber, "minStock"),
        item.lineNumber,
        "Estoque minimo",
      ),
      stockUnit,
      pdvVisible: getReviewField(input, item.lineNumber, "pdvVisible") === "on",
      fractionalSaleProduct,
    };
  });
}

function parseReviewedStockUnit(rawValue: string, lineNumber: number) {
  if (rawValue === StockUnit.UNIT || rawValue === StockUnit.MILLILITER) {
    return rawValue;
  }

  throw new Error(`Unidade de estoque invalida no item ${lineNumber}.`);
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

export async function getStockMovements(filters?: {
  categoryId?: string;
  type?: string;
  query?: string;
}) {
  const movementType =
    filters?.type === StockMovementType.IN ||
    filters?.type === StockMovementType.OUT ||
    filters?.type === StockMovementType.ADJUSTMENT
      ? filters.type
      : undefined;
  const query = filters?.query?.trim() || undefined;
  const categoryId =
    filters?.categoryId && filters.categoryId !== "all" ? filters.categoryId.trim() || undefined : undefined;

  const normalizedFilters: ListStockMovementsFilters = {
    categoryId,
    type: movementType,
    query,
    take: 150,
  };

  return listStockMovements(normalizedFilters);
}

export async function getStockMovementFilterOptions() {
  return listCategoryOptions();
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

export async function getStockInvoiceXmlReview(stockInvoiceXmlId: string) {
  const xmlRecord = await findStockInvoiceXmlById(stockInvoiceXmlId);
  if (!xmlRecord) {
    throw new Error("XML nao encontrado para conferencia.");
  }

  const parsedInvoice = parseStockInvoiceXml(xmlRecord.rawXml);
  assertInvoiceRecipientMatchesCompany(parsedInvoice);

  const [categories, products, importedAudit] = await Promise.all([
    listCategoryOptions(),
    listStockInvoiceReviewProducts(),
    findAuditLogByActionEntity({
      action: "stock.xml.import",
      entity: "StockInvoiceXml",
      entityId: xmlRecord.id,
    }),
  ]);

  const fallbackCategoryId = categories[0]?.id;
  if (!fallbackCategoryId) {
    throw new Error("Cadastre ao menos uma categoria antes de importar produtos pelo XML.");
  }

  return {
    xml: {
      id: xmlRecord.id,
      accessKey: xmlRecord.accessKey,
      invoiceNumber: xmlRecord.invoiceNumber,
      invoiceSeries: xmlRecord.invoiceSeries,
      supplierName: parsedInvoice.supplierName,
      supplierDocument: parsedInvoice.supplierDocument,
      recipientName: parsedInvoice.recipientName,
      recipientDocument: parsedInvoice.recipientDocument,
      issuedAt: parsedInvoice.issuedAt,
      totalAmount: parsedInvoice.totalAmount ? toDecimalInputValue(parsedInvoice.totalAmount) : undefined,
      sourceFileName: xmlRecord.sourceFileName,
      storedAt: xmlRecord.createdAt,
      importedAt: importedAudit?.createdAt,
    },
    categories,
    products: products.map((product) => ({
      ...product,
      salePrice: toDecimalInputValue(product.salePrice),
      happyHourPrice: product.happyHourPrice ? toDecimalInputValue(product.happyHourPrice) : "",
    })),
    items: parsedInvoice.items.map((item) =>
      buildStockInvoiceReviewItem(
        item,
        findStockInvoiceReviewProductMatch(item, products),
        fallbackCategoryId,
      ),
    ),
  };
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

  const { actorId, rawXml } = params;
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
    stockInvoiceXmlId: created.id,
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
    stockInvoiceXmlId: xmlRecord.id,
    createdProducts: summary.createdProducts,
    updatedProducts: summary.updatedProducts,
    stockMovements: summary.stockMovements,
    skippedItems: summary.skippedItems,
  };
}

export async function importReviewedStockInvoiceXmlRecord(input: FormData, actorId?: string): Promise<StockXmlImportSummary> {
  const stockInvoiceXmlId = String(input.get("stockInvoiceXmlId") ?? "").trim();
  if (!stockInvoiceXmlId) {
    throw new Error("XML nao identificado para importacao.");
  }

  const xmlRecord = await findStockInvoiceXmlById(stockInvoiceXmlId);
  if (!xmlRecord) {
    throw new Error("XML nao encontrado para importacao.");
  }

  const parsedInvoice = parseStockInvoiceXml(xmlRecord.rawXml);
  assertInvoiceRecipientMatchesCompany(parsedInvoice);
  await assertStockInvoiceXmlIsPending(xmlRecord.id);

  const reviewedItems = parseReviewedStockInvoiceItems(input, parsedInvoice.items);
  if (!reviewedItems.some((item) => item.decision !== "skip")) {
    throw new Error("Escolha ao menos um item para dar entrada no estoque.");
  }

  const summary = await importReviewedStockInvoiceItems({
    accessKey: parsedInvoice.accessKey,
    invoiceNumber: parsedInvoice.invoiceNumber,
    invoiceSeries: parsedInvoice.invoiceSeries,
    supplierName: parsedInvoice.supplierName,
    supplierDocument: parsedInvoice.supplierDocument,
    actorId,
    items: reviewedItems,
  });

  await createAuditLog({
    userId: actorId,
    action: "stock.xml.import",
    entity: "StockInvoiceXml",
    entityId: xmlRecord.id,
    metadata: {
      accessKey: parsedInvoice.accessKey,
      invoiceNumber: parsedInvoice.invoiceNumber,
      invoiceSeries: parsedInvoice.invoiceSeries,
      createdProducts: summary.createdProducts,
      updatedProducts: summary.updatedProducts,
      stockMovements: summary.stockMovements,
      skippedItems: summary.skippedItems,
      reviewedItems: reviewedItems.map((item) => ({
        lineNumber: item.lineNumber,
        decision: item.decision,
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost.toString(),
      })),
    },
  });

  return {
    imported: true,
    stockInvoiceXmlId: xmlRecord.id,
    ...summary,
  };
}

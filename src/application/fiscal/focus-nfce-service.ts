import { PaymentMethod, Prisma, ProductKind, SaleStatus } from "@prisma/client";

import { resolveFocusFiscalSettings } from "@/application/fiscal/fiscal-configuration-service";
import { getTenantModuleEntitlements } from "@/application/platform/platform-service";
import { canUsePlatformModule } from "@/domain/platform/plan-entitlements";
import {
  getSaleFiscalSnapshot,
  getSaleFiscalStatus,
  updateSaleFiscalData,
} from "@/infrastructure/db/repositories/sale-fiscal-repository";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import { getCurrentTenantSlug } from "@/lib/prisma";

type FocusEnvironment = "homologacao" | "producao";
type FiscalSaleStatus =
  | "AUTHORIZED"
  | "REJECTED"
  | "PROCESSING"
  | "CANCELLED"
  | "SERVICE_ONLY"
  | "ERROR"
  | "DISABLED";

type FocusNfceConfig = {
  enabled: boolean;
  environment: FocusEnvironment;
  token?: string;
  cnpjEmitente?: string;
  baseUrl: string;
  defaultNcm?: string;
  defaultCfop: string;
  defaultIcmsOrigem: string;
  defaultIcmsSituacaoTributaria: string;
  defaultUnidade: string;
  naturezaOperacao: string;
  localDestino: string;
  presencaComprador: string;
  indicadorIeDestinatario: string;
  infoAdicional?: string;
};

const paymentMethodToFocusCode: Record<PaymentMethod, string> = {
  CASH: "01",
  PIX: "17",
  CREDIT_CARD: "03",
  DEBIT_CARD: "04",
};

function toISOStringWithTimezone(date: Date) {
  return date.toISOString();
}

function toDecimal(value: number, fractionDigits = 2) {
  return value.toFixed(fractionDigits);
}

function parseMoney(value: { toString(): string } | string | number) {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeReference(value: string) {
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "");
  return normalized || `VENDA${Date.now()}`;
}

function normalizeCnpjDigits(value: string | undefined) {
  if (!value) {
    return "";
  }

  return value.replace(/\D/g, "");
}

async function canUseFiscalFocusModule() {
  const entitlements = await getTenantModuleEntitlements(await getCurrentTenantSlug());
  return canUsePlatformModule(entitlements, "fiscal-focus");
}

async function getFocusNfceConfig(): Promise<FocusNfceConfig> {
  const settings = await resolveFocusFiscalSettings();
  const token = settings.token;
  const cnpjEmitente = normalizeCnpjDigits(settings.cnpjEmitente);
  const defaultNcm = (settings.defaultNcm ?? "").trim();

  return {
    enabled: Boolean(token && cnpjEmitente),
    environment: settings.environment,
    token,
    cnpjEmitente,
    baseUrl: settings.baseUrl,
    defaultNcm,
    defaultCfop: (process.env.FOCUS_NFCE_CFOP_PADRAO ?? "5102").trim(),
    defaultIcmsOrigem: (process.env.FOCUS_NFCE_ICMS_ORIGEM_PADRAO ?? "0").trim(),
    defaultIcmsSituacaoTributaria: (process.env.FOCUS_NFCE_ICMS_CST_PADRAO ?? "102").trim(),
    defaultUnidade: (process.env.FOCUS_NFCE_UNIDADE_PADRAO ?? "UN").trim(),
    naturezaOperacao: (process.env.FOCUS_NFCE_NATUREZA_OPERACAO ?? "VENDA AO CONSUMIDOR").trim(),
    localDestino: (process.env.FOCUS_NFCE_LOCAL_DESTINO ?? "1").trim(),
    presencaComprador: (process.env.FOCUS_NFCE_PRESENCA_COMPRADOR ?? "1").trim(),
    indicadorIeDestinatario: (process.env.FOCUS_NFCE_INDICADOR_IE_DESTINATARIO ?? "9").trim(),
    infoAdicional: (process.env.FOCUS_NFCE_INFO_ADICIONAL ?? "").trim() || undefined,
  };
}

function buildAbsoluteFocusUrl(baseUrl: string, maybePath: unknown) {
  if (typeof maybePath !== "string" || !maybePath.trim()) {
    return undefined;
  }

  if (maybePath.startsWith("http://") || maybePath.startsWith("https://")) {
    return maybePath;
  }

  const path = maybePath.startsWith("/") ? maybePath : `/${maybePath}`;
  return `${baseUrl}${path}`;
}

function extractFocusMessage(payload: unknown, fallbackMessage: string) {
  if (!payload || typeof payload !== "object") {
    return fallbackMessage;
  }

  const record = payload as Record<string, unknown>;
  const messageCandidates = [
    record.mensagem_sefaz,
    record.mensagem,
    record.message,
    record.erro,
    record.codigo,
  ];

  for (const candidate of messageCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return fallbackMessage;
}

function deriveFocusStatus(payload: unknown, httpStatus: number): FiscalSaleStatus {
  if (payload && typeof payload === "object") {
    const statusValue = String((payload as Record<string, unknown>).status ?? "")
      .trim()
      .toLowerCase();

    if (statusValue === "autorizado") {
      return "AUTHORIZED";
    }

    if (statusValue === "cancelado") {
      return "CANCELLED";
    }

    if (statusValue === "erro_autorizacao") {
      return "REJECTED";
    }

    if (statusValue === "processando_autorizacao") {
      return "PROCESSING";
    }
  }

  if (httpStatus >= 200 && httpStatus < 300) {
    return "PROCESSING";
  }

  return "ERROR";
}

function buildPaymentPayload(
  payments: Array<{ method: PaymentMethod; amount: { toString(): string } }>,
  fiscalTotal?: number,
) {
  let remainingAmount = fiscalTotal === undefined ? undefined : Math.max(fiscalTotal, 0);

  return payments.flatMap((payment) => {
    const paymentAmount = parseMoney(payment.amount);
    const payloadAmount =
      remainingAmount === undefined ? paymentAmount : Math.min(paymentAmount, remainingAmount);

    if (payloadAmount <= 0) {
      return [];
    }

    if (remainingAmount !== undefined) {
      remainingAmount -= payloadAmount;
    }

    const paymentCode = paymentMethodToFocusCode[payment.method];
    const payload: Record<string, string> = {
      forma_pagamento: paymentCode,
      valor_pagamento: toDecimal(payloadAmount, 2),
    };

    if (paymentCode === "03" || paymentCode === "04") {
      payload.tipo_integracao = "2";
    }

    return [payload];
  });
}

async function requestFocusNfce(
  config: FocusNfceConfig,
  saleRef: string,
  payload: unknown,
) {
  const response = await fetch(`${config.baseUrl}/v2/nfce?ref=${encodeURIComponent(saleRef)}&completa=1`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.token}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  let responseJson: unknown = null;
  let responseText: string | null = null;
  try {
    responseJson = await response.json();
  } catch {
    try {
      responseText = await response.text();
    } catch {
      responseText = null;
    }
  }

  return {
    httpStatus: response.status,
    payload: responseJson ?? responseText,
  };
}

async function requestFocusNfceCancellation(
  config: FocusNfceConfig,
  saleRef: string,
  justificativa: string,
) {
  const response = await fetch(`${config.baseUrl}/v2/nfce/${encodeURIComponent(saleRef)}`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.token}:`).toString("base64")}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      justificativa,
    }),
    cache: "no-store",
  });

  let responseJson: unknown = null;
  let responseText: string | null = null;
  try {
    responseJson = await response.json();
  } catch {
    try {
      responseText = await response.text();
    } catch {
      responseText = null;
    }
  }

  return {
    httpStatus: response.status,
    payload: responseJson ?? responseText,
  };
}

export async function issueSaleNfce(data: { saleId: string; actorId: string }) {
  const snapshot = await getSaleFiscalSnapshot(data.saleId);

  if (!snapshot) {
    return {
      status: "ERROR" as const,
      message: "Venda nao encontrada para emissao fiscal.",
    };
  }

  const fiscalReference = normalizeReference(snapshot.fiscalReference ?? snapshot.saleNumber);

  if (!(await canUseFiscalFocusModule())) {
    const message = "NFC-e nao emitida: modulo Fiscal / Focus NFe disponivel apenas no Plano Platina ativo.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFCE",
      fiscalStatus: "DISABLED",
      fiscalMessage: message,
      fiscalErrorAt: null,
      fiscalUpdatedAt: new Date(),
    });

    return {
      status: "DISABLED" as const,
      message,
    };
  }

  const config = await getFocusNfceConfig();

  if (!config.enabled) {
    const message =
      "NFC-e nao emitida: configure token Focus, CNPJ emitente e NCM padrao em Configuracoes > Fiscal / Focus NFe.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFCE",
      fiscalEnvironment: config.environment,
      fiscalStatus: "DISABLED",
      fiscalMessage: message,
      fiscalErrorAt: new Date(),
      fiscalUpdatedAt: new Date(),
    });

    return {
      status: "DISABLED" as const,
      message,
    };
  }

  if (snapshot.status !== SaleStatus.COMPLETED) {
    const message = "NFC-e nao emitida: somente vendas concluidas podem ser emitidas.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFCE",
      fiscalEnvironment: config.environment,
      fiscalStatus: "ERROR",
      fiscalMessage: message,
      fiscalErrorAt: new Date(),
      fiscalUpdatedAt: new Date(),
    });

    return {
      status: "ERROR" as const,
      message,
    };
  }

  if (snapshot.items.length === 0 || snapshot.payments.length === 0) {
    const message = "NFC-e nao emitida: venda sem itens ou sem pagamentos.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFCE",
      fiscalEnvironment: config.environment,
      fiscalStatus: "ERROR",
      fiscalMessage: message,
      fiscalErrorAt: new Date(),
      fiscalUpdatedAt: new Date(),
    });

    return {
      status: "ERROR" as const,
      message,
    };
  }

  const fiscalItems = snapshot.items.filter((item) => item.productKindSnapshot === ProductKind.STANDARD);

  if (fiscalItems.length === 0) {
    const message =
      "NFC-e nao emitida: venda composta somente por servicos. Lance esta venda na apuracao semanal de NFS-e municipal.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFSE",
      fiscalEnvironment: config.environment,
      fiscalStatus: "SERVICE_ONLY",
      fiscalMessage: message,
      fiscalUpdatedAt: new Date(),
      fiscalErrorAt: null,
    });

    return {
      status: "DISABLED" as const,
      message,
    };
  }

  const hasMissingNcm = fiscalItems.some(
    (item) => !String(item.ncmSnapshot ?? "").trim() && !String(config.defaultNcm ?? "").trim(),
  );

  if (hasMissingNcm) {
    const message =
      "NFC-e nao emitida: cadastre o NCM no produto ou configure o NCM padrao em Configuracoes > Fiscal / Focus NFe.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFCE",
      fiscalEnvironment: config.environment,
      fiscalStatus: "ERROR",
      fiscalMessage: message,
      fiscalErrorAt: new Date(),
      fiscalUpdatedAt: new Date(),
    });

    return {
      status: "ERROR" as const,
      message,
    };
  }

  const saleSubtotal = parseMoney(snapshot.subtotalAmount);
  const productSubtotal = fiscalItems.reduce((sum, item) => sum + parseMoney(item.lineTotal), 0);
  const saleDiscount = parseMoney(snapshot.discountAmount);
  const productDiscount =
    saleSubtotal > 0 ? Math.min(productSubtotal, saleDiscount * (productSubtotal / saleSubtotal)) : 0;
  const productTotal = Math.max(productSubtotal - productDiscount, 0);

  const payload = {
    cnpj_emitente: config.cnpjEmitente,
    data_emissao: toISOStringWithTimezone(new Date()),
    indicador_inscricao_estadual_destinatario: config.indicadorIeDestinatario,
    modalidade_frete: "9",
    local_destino: config.localDestino,
    presenca_comprador: config.presencaComprador,
    natureza_operacao: config.naturezaOperacao,
    informacoes_adicionais_contribuinte: config.infoAdicional,
    valor_produtos: toDecimal(productSubtotal, 2),
    valor_desconto: toDecimal(productDiscount, 2),
    valor_total: toDecimal(productTotal, 2),
    items: fiscalItems.map((item, index) => {
      const lineTotal = parseMoney(item.lineTotal);
      const itemDiscount = productSubtotal > 0 ? Math.min(lineTotal, productDiscount * (lineTotal / productSubtotal)) : 0;

      return {
        numero_item: String(index + 1),
        codigo_ncm: String(item.ncmSnapshot ?? "").trim() || config.defaultNcm,
        codigo_produto: item.skuSnapshot || `ITEM-${index + 1}`,
        descricao: item.productNameSnapshot || `ITEM ${index + 1}`,
        quantidade_comercial: toDecimal(item.quantity, 4),
        quantidade_tributavel: toDecimal(item.quantity, 4),
        cfop: config.defaultCfop,
        valor_unitario_comercial: toDecimal(parseMoney(item.unitPrice), 4),
        valor_unitario_tributavel: toDecimal(parseMoney(item.unitPrice), 4),
        valor_bruto: toDecimal(lineTotal, 2),
        valor_desconto: toDecimal(itemDiscount, 2),
        unidade_comercial: config.defaultUnidade,
        unidade_tributavel: config.defaultUnidade,
        icms_origem: config.defaultIcmsOrigem,
        icms_situacao_tributaria: config.defaultIcmsSituacaoTributaria,
      };
    }),
    formas_pagamento: buildPaymentPayload(snapshot.payments, productTotal),
  };

  const { httpStatus, payload: focusPayload } = await requestFocusNfce(config, fiscalReference, payload);
  const derivedStatus = deriveFocusStatus(focusPayload, httpStatus);
  const baseMessage = extractFocusMessage(focusPayload, "Resposta recebida da Focus NFe.");

  const focusRecord = (focusPayload && typeof focusPayload === "object"
    ? (focusPayload as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const fiscalMessage =
    derivedStatus === "AUTHORIZED"
      ? "NFC-e autorizada com sucesso."
      : derivedStatus === "REJECTED"
        ? `NFC-e rejeitada: ${baseMessage}`
        : derivedStatus === "PROCESSING"
          ? `NFC-e em processamento: ${baseMessage}`
          : derivedStatus === "CANCELLED"
            ? "NFC-e cancelada."
            : `Falha ao emitir NFC-e: ${baseMessage}`;

  await updateSaleFiscalData(snapshot.id, {
    fiscalReference,
    fiscalDocumentType: "NFCE",
    fiscalEnvironment: config.environment,
    fiscalStatus: derivedStatus,
    fiscalMessage,
    fiscalAccessKey:
      (focusRecord.chave_nfe as string | undefined) ?? (focusRecord.chave as string | undefined) ?? null,
    fiscalProtocol:
      (focusRecord.numero_protocolo as string | undefined) ?? (focusRecord.protocolo as string | undefined) ?? null,
    fiscalNumber: focusRecord.numero !== undefined ? String(focusRecord.numero) : null,
    fiscalSeries: focusRecord.serie !== undefined ? String(focusRecord.serie) : null,
    fiscalXmlUrl: buildAbsoluteFocusUrl(config.baseUrl, focusRecord.caminho_xml_nota_fiscal),
    fiscalDanfeUrl:
      buildAbsoluteFocusUrl(config.baseUrl, focusRecord.caminho_danfe) ??
      buildAbsoluteFocusUrl(config.baseUrl, focusRecord.url_danfe),
    fiscalQrCodeUrl:
      (focusRecord.qrcode_url as string | undefined) ??
      (focusRecord.url_qrcode as string | undefined) ??
      null,
    fiscalConsultaUrl: (focusRecord.url_consulta_nf as string | undefined) ?? null,
    fiscalIssuedAt: derivedStatus === "AUTHORIZED" ? new Date() : null,
    fiscalUpdatedAt: new Date(),
    fiscalErrorAt: derivedStatus === "AUTHORIZED" ? null : new Date(),
    fiscalResponse:
      focusPayload === null || focusPayload === undefined
        ? Prisma.JsonNull
        : (focusPayload as Prisma.InputJsonValue),
  });

  await createAuditLog({
    userId: data.actorId,
    action: "pdv.sale.nfce.issue",
    entity: "Sale",
    entityId: snapshot.id,
    metadata: {
      saleNumber: snapshot.saleNumber,
      reference: fiscalReference,
      environment: config.environment,
      httpStatus,
      status: derivedStatus,
      message: fiscalMessage,
    },
  });

  return {
    status: derivedStatus,
    message: fiscalMessage,
  };
}

export async function queueSaleNfceIssue(data: { saleId: string; actorId: string }) {
  const snapshot = await getSaleFiscalSnapshot(data.saleId);

  if (!snapshot) {
    return {
      status: "ERROR" as const,
      message: "Venda nao encontrada para enfileirar emissao fiscal.",
    };
  }

  const fiscalReference = normalizeReference(snapshot.fiscalReference ?? snapshot.saleNumber);

  if (!(await canUseFiscalFocusModule())) {
    const message = "NFC-e nao enfileirada: modulo Fiscal / Focus NFe disponivel apenas no Plano Platina ativo.";
    await updateSaleFiscalData(snapshot.id, {
      fiscalReference,
      fiscalDocumentType: "NFCE",
      fiscalStatus: "DISABLED",
      fiscalMessage: message,
      fiscalErrorAt: null,
      fiscalUpdatedAt: new Date(),
    });

    return {
      status: "DISABLED" as const,
      message,
    };
  }

  const config = await getFocusNfceConfig();
  const message = "NFC-e enfileirada para emissao em segundo plano.";

  await updateSaleFiscalData(snapshot.id, {
    fiscalReference,
    fiscalDocumentType: "NFCE",
    fiscalEnvironment: config.environment,
    fiscalStatus: "PROCESSING",
    fiscalMessage: message,
    fiscalErrorAt: null,
    fiscalUpdatedAt: new Date(),
  });

  await createAuditLog({
    userId: data.actorId,
    action: "pdv.sale.nfce.queue",
    entity: "Sale",
    entityId: snapshot.id,
    metadata: {
      saleNumber: snapshot.saleNumber,
      reference: fiscalReference,
      environment: config.environment,
    },
  });

  return {
    status: "PROCESSING" as const,
    message,
  };
}

export async function cancelSaleNfce(data: { saleId: string; reason: string; actorId: string }) {
  const config = await getFocusNfceConfig();
  const saleFiscal = await getSaleFiscalStatus(data.saleId);

  if (!saleFiscal) {
    return {
      status: "ERROR" as const,
      message: "Venda nao encontrada para cancelamento fiscal.",
    };
  }

  const fiscalReference = normalizeReference(saleFiscal.fiscalReference ?? saleFiscal.saleNumber);

  if (!config.enabled || !config.token) {
    const message = "Cancelamento fiscal nao executado: configuracao da Focus NFe incompleta.";
    await updateSaleFiscalData(saleFiscal.id, {
      fiscalReference,
      fiscalMessage: message,
      fiscalUpdatedAt: new Date(),
      fiscalErrorAt: new Date(),
    });
    return {
      status: "DISABLED" as const,
      message,
    };
  }

  if (saleFiscal.fiscalStatus !== "AUTHORIZED") {
    return {
      status: "SKIPPED" as const,
      message: "Venda sem NFC-e autorizada; nenhum cancelamento fiscal necessario.",
    };
  }

  const reason = data.reason.trim();
  const justification = reason.length >= 15 ? reason : `${reason} - Contate o Mateus para suporte.`;
  const normalizedJustification = justification.slice(0, 255);

  const { httpStatus, payload } = await requestFocusNfceCancellation(config, fiscalReference, normalizedJustification);
  const derivedStatus = deriveFocusStatus(payload, httpStatus);
  const responseRecord =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : ({} as Record<string, unknown>);
  const baseMessage = extractFocusMessage(payload, "Resposta recebida da Focus NFe.");

  const fiscalStatus: FiscalSaleStatus =
    derivedStatus === "CANCELLED"
      ? "CANCELLED"
      : derivedStatus === "AUTHORIZED"
        ? "CANCELLED"
        : derivedStatus === "REJECTED"
          ? "ERROR"
          : derivedStatus;

  const message =
    fiscalStatus === "CANCELLED"
      ? "NFC-e cancelada na Focus com sucesso."
      : `Falha ao cancelar NFC-e na Focus: ${baseMessage}`;

  await updateSaleFiscalData(saleFiscal.id, {
    fiscalReference,
    fiscalStatus,
    fiscalMessage: message,
    fiscalProtocol:
      (responseRecord.numero_protocolo as string | undefined) ??
      (responseRecord.protocolo as string | undefined) ??
      null,
    fiscalUpdatedAt: new Date(),
    fiscalErrorAt: fiscalStatus === "CANCELLED" ? null : new Date(),
    fiscalResponse:
      payload === null || payload === undefined
        ? Prisma.JsonNull
        : (payload as Prisma.InputJsonValue),
  });

  await createAuditLog({
    userId: data.actorId,
    action: "pdv.sale.nfce.cancel",
    entity: "Sale",
    entityId: saleFiscal.id,
    metadata: {
      saleNumber: saleFiscal.saleNumber,
      reference: fiscalReference,
      httpStatus,
      status: fiscalStatus,
      message,
    },
  });

  return {
    status: fiscalStatus,
    message,
  };
}

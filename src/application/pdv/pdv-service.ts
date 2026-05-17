import { after } from "next/server";
import { GameplayReleaseStatus, PaymentMethod, Prisma, SaleStatus } from "@prisma/client";

import {
  addComandaItemSchema,
  cancelComandaSchema,
  cancelSaleSchema,
  closeComandaSchema,
  createComandaSchema,
  createSaleSchema,
  removeComandaItemSchema,
  saleItemSchema,
  salePaymentSchema,
  updateComandaCustomerSchema,
  updateComandaItemSchema,
} from "@/domain/pdv/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { parseDecimalInput } from "@/lib/decimal";
import { cancelSaleNfce, issueSaleNfce, queueSaleNfceIssue } from "@/application/fiscal/focus-nfce-service";
import {
  prepareGameplayReleaseForSale,
  triggerGameplayReleaseForSale,
} from "@/application/gameplay/gameplay-release-service";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import { getBusyGameplayReleasesByStationIds } from "@/infrastructure/db/repositories/gameplay-release-repository";
import {
  addItemToComanda,
  cancelComanda,
  closeComandaWithSale,
  createComanda,
  listOpenComandas,
  removeItemFromComanda,
  updateComandaCustomer,
  updateComandaItemQuantity,
} from "@/infrastructure/db/repositories/comanda-repository";
import { listCustomerOptions } from "@/infrastructure/db/repositories/customer-repository";
import {
  cancelSaleAndRestock,
  createSaleWithStockAdjustment,
  getSaleReceiptById,
  listPdvOpenSessions,
  listPdvProductOptions,
  listRecentSales,
  resolveGameplayStationIdsForSelections,
} from "@/infrastructure/db/repositories/sale-repository";

function createSaleNumber() {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `VEN-${datePart}-${randomPart}`;
}

function parseItems(formData: FormData) {
  const productIds = formData.getAll("itemProductId").map((value) => String(value));
  const quantities = formData.getAll("itemQuantity").map((value) => Number(value));

  const items = productIds
    .map((productId, index) => ({
      productId,
      quantity: quantities[index],
    }))
    .filter((item) => item.productId);

  if (items.length === 0) {
    throw new Error("Informe ao menos um item para registrar a venda.");
  }

  return items.map((item) => saleItemSchema.parse(item));
}

function formDataList(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value));
}

function valueAt(values: string[], index: number) {
  return values[index] ?? "";
}

function parseOptionalDecimalInput(value?: string) {
  const normalized = emptyToUndefined(value);
  return normalized ? parseDecimalInput(normalized) : undefined;
}

function parsePayments(formData: FormData) {
  const methods = formDataList(formData, "paymentMethod");
  const amounts = formDataList(formData, "paymentAmount");
  const approvedAmounts = formDataList(formData, "paymentApprovedAmount");
  const cardBrands = formDataList(formData, "paymentCardBrand");
  const cardLast4Values = formDataList(formData, "paymentCardLast4");
  const nsuValues = formDataList(formData, "paymentNsu");
  const authorizationCodes = formDataList(formData, "paymentAuthorizationCode");
  const terminalIds = formDataList(formData, "paymentTerminalId");
  const externalTransactionIds = formDataList(formData, "paymentExternalTransactionId");
  const receiptTexts = formDataList(formData, "paymentReceiptText");

  const payments = methods
    .map((method, index) => ({
      method,
      amount: amounts[index] ?? "0",
      approvedAmount: valueAt(approvedAmounts, index),
      cardBrand: valueAt(cardBrands, index),
      cardLast4: valueAt(cardLast4Values, index),
      nsu: valueAt(nsuValues, index),
      authorizationCode: valueAt(authorizationCodes, index),
      terminalId: valueAt(terminalIds, index),
      externalTransactionId: valueAt(externalTransactionIds, index),
      receiptText: valueAt(receiptTexts, index),
    }))
    .filter((payment) => payment.method && payment.amount);

  if (payments.length === 0) {
    throw new Error("Informe ao menos um pagamento para registrar a venda.");
  }

  return payments.map((payment) => {
    const parsed = salePaymentSchema.parse({
      method: payment.method as PaymentMethod,
      amount: payment.amount,
      approvedAmount: payment.approvedAmount,
      cardBrand: payment.cardBrand,
      cardLast4: payment.cardLast4,
      nsu: payment.nsu,
      authorizationCode: payment.authorizationCode,
      terminalId: payment.terminalId,
      externalTransactionId: payment.externalTransactionId,
      receiptText: payment.receiptText,
    });

    const decimalAmount = parseDecimalInput(parsed.amount);
    if (decimalAmount.lessThanOrEqualTo(0)) {
      throw new Error("Os valores de pagamento devem ser maiores que zero.");
    }

    return {
      method: parsed.method,
      amount: decimalAmount,
      approvedAmount: parseOptionalDecimalInput(parsed.approvedAmount),
      cardBrand: emptyToUndefined(parsed.cardBrand),
      cardLast4: emptyToUndefined(parsed.cardLast4),
      nsu: emptyToUndefined(parsed.nsu),
      authorizationCode: emptyToUndefined(parsed.authorizationCode),
      terminalId: emptyToUndefined(parsed.terminalId),
      externalTransactionId: emptyToUndefined(parsed.externalTransactionId),
      receiptText: emptyToUndefined(parsed.receiptText),
      processedAt: new Date(),
    };
  });
}

function parseGameplaySelections(formData: FormData) {
  const productIds = formData.getAll("gameplayProductId").map((value) => String(value));
  const stationIds = formData.getAll("gameplayStationId").map((value) => String(value));

  return productIds
    .map((productId, index) => ({
      productId,
      stationId: stationIds[index]?.trim().toLowerCase() ?? "",
    }))
    .filter((selection) => selection.productId && selection.stationId);
}

async function assertGameplayStationsAvailable(
  gameplaySelections: Array<{ productId: string; stationId: string }>,
) {
  const stationIds = await resolveGameplayStationIdsForSelections(gameplaySelections);

  if (stationIds.length === 0) {
    return;
  }

  if (stationIds.length > 1) {
    throw new Error("Venda de servico deve liberar apenas uma TV por vez. Contate o Mateus.");
  }

  const busyReleases = await getBusyGameplayReleasesByStationIds(stationIds);
  const busyRelease = busyReleases[0];

  if (busyRelease?.status === GameplayReleaseStatus.PENDENTE_ENVIO) {
    throw new Error(
      `${busyRelease.stationId.toUpperCase()} ja tem uma liberacao pendente. Aguarde alguns segundos ou reenvie pela aba Servicos. Contate o Mateus.`,
    );
  }

  if (!busyRelease?.releasedUntil) {
    return;
  }

  const serviceStartsAt = busyRelease.serviceStartsAt ?? busyRelease.paidAt;
  const isPreparing = serviceStartsAt.getTime() > Date.now();
  const statusLabel = isPreparing ? "em preparacao" : "em uso";
  const releasedUntil = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(busyRelease.releasedUntil);

  throw new Error(
    `${busyRelease.stationId.toUpperCase()} ja esta ${statusLabel} ate ${releasedUntil}. Aguarde finalizar antes de vender novamente. Contate o Mateus.`,
  );
}

function resolveCashReceivedForReceipt(data: {
  explicitCashReceived?: Prisma.Decimal;
  cashPaymentTotal: Prisma.Decimal;
  paymentsTotal: Prisma.Decimal;
  saleTotal: Prisma.Decimal;
}) {
  if (data.explicitCashReceived) {
    return data.explicitCashReceived.toString();
  }

  if (data.cashPaymentTotal.lessThanOrEqualTo(0)) {
    return undefined;
  }

  if (data.paymentsTotal.greaterThan(data.saleTotal)) {
    return data.cashPaymentTotal.toString();
  }

  return undefined;
}

function scheduleAfterResponse(label: string, task: () => Promise<void>) {
  const guardedTask = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[PDV] Falha no processamento em segundo plano (${label}):`, error);
    }
  };

  try {
    after(guardedTask);
  } catch (error) {
    console.warn(`[PDV] Nao foi possivel agendar ${label}; executando sem bloquear a interface.`, error);
    void guardedTask();
  }
}

function scheduleSalePostProcessing(data: {
  saleId: string;
  actorId: string;
  issueFiscal?: boolean;
  releaseGameplay?: boolean;
}) {
  const tasks: Array<{ label: string; run: () => Promise<unknown> }> = [];

  if (data.issueFiscal) {
    tasks.push({
      label: "NFC-e",
      run: () => issueSaleNfce({ saleId: data.saleId, actorId: data.actorId }),
    });
  }

  if (data.releaseGameplay) {
    tasks.push({
      label: "gameplay",
      run: () => triggerGameplayReleaseForSale(data.saleId, data.actorId),
    });
  }

  if (tasks.length === 0) {
    return;
  }

  scheduleAfterResponse(`pos-venda ${data.saleId}`, async () => {
    const results = await Promise.allSettled(tasks.map((task) => task.run()));

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`[PDV] ${tasks[index]?.label ?? "tarefa"} falhou apos venda ${data.saleId}:`, result.reason);
      }
    });
  });
}

async function settlePdvSection<T>(label: string, loader: () => Promise<T>, fallback: T) {
  try {
    const data = await loader();
    return { data, issue: null as string | null };
  } catch (error) {
    console.error(`[PDV] Falha ao carregar ${label}:`, error);
    return { data: fallback, issue: label };
  }
}

export async function getPdvData() {
  const [openSessionsResult, productsResult, salesResult, customersResult, openComandasResult] = await Promise.all([
    settlePdvSection("sessoes de caixa", () => listPdvOpenSessions(), []),
    settlePdvSection("produtos", () => listPdvProductOptions(), []),
    settlePdvSection("vendas recentes", () => listRecentSales(), []),
    settlePdvSection("clientes", () => listCustomerOptions(), []),
    settlePdvSection("comandas abertas", () => listOpenComandas(), []),
  ]);

  return {
    openSessions: openSessionsResult.data,
    products: productsResult.data,
    sales: salesResult.data,
    customers: customersResult.data,
    openComandas: openComandasResult.data,
    issues: [
      openSessionsResult.issue,
      productsResult.issue,
      salesResult.issue,
      customersResult.issue,
      openComandasResult.issue,
    ].filter(Boolean) as string[],
  };
}

export async function getSaleReceiptData(saleId: string) {
  try {
    return await getSaleReceiptById(saleId);
  } catch (error) {
    console.error("[PDV] Falha ao carregar comprovante:", error);
    return null;
  }
}

export async function createSaleRecord(input: FormData, actorId: string) {
  const parsed = createSaleSchema.parse({
    cashSessionId: input.get("cashSessionId"),
    customerName: input.get("customerName"),
    discountAmount: input.get("discountAmount") ?? "0",
    cashReceived: input.get("cashReceived") ?? "",
  });

  const items = parseItems(input);
  const payments = parsePayments(input);
  const gameplaySelections = parseGameplaySelections(input);
  const discountAmount = parseDecimalInput(parsed.discountAmount || "0");

  if (discountAmount.lessThan(0)) {
    throw new Error("Desconto invalido.");
  }

  const cashPaymentTotal = payments
    .filter((payment) => payment.method === PaymentMethod.CASH)
    .reduce((acc, payment) => acc.plus(payment.amount), new Prisma.Decimal(0));
  const paymentsTotal = payments.reduce((acc, payment) => acc.plus(payment.amount), new Prisma.Decimal(0));

  const cashReceived = parsed.cashReceived ? parseDecimalInput(parsed.cashReceived) : undefined;

  if (cashReceived && cashPaymentTotal.equals(0)) {
    throw new Error("Valor recebido em dinheiro so pode ser informado quando houver pagamento em dinheiro.");
  }

  if (cashReceived && cashReceived.lessThan(cashPaymentTotal)) {
    throw new Error("Valor recebido em dinheiro nao pode ser menor que a parte paga em dinheiro.");
  }

  await assertGameplayStationsAvailable(gameplaySelections);

  const sale = await createSaleWithStockAdjustment({
    saleNumber: createSaleNumber(),
    cashSessionId: parsed.cashSessionId,
    operatorId: actorId,
    customerName: emptyToUndefined(parsed.customerName),
    discountAmount,
    items,
    payments,
    gameplaySelections,
  });

  await createAuditLog({
    userId: actorId,
    action: "pdv.sale.create",
    entity: "Sale",
    entityId: sale.id,
    metadata: {
      saleNumber: sale.saleNumber,
      itemCount: sale.items.length,
      totalAmount: sale.totalAmount.toString(),
    },
  });

  const [fiscalResult, gameplayResult] = await Promise.all([
    queueSaleNfceIssue({
      saleId: sale.id,
      actorId,
    }),
    prepareGameplayReleaseForSale(sale.id, actorId),
  ]);

  scheduleSalePostProcessing({
    saleId: sale.id,
    actorId,
    issueFiscal: true,
    releaseGameplay: gameplayResult.status === GameplayReleaseStatus.PENDENTE_ENVIO,
  });

  const receiptCashReceived = resolveCashReceivedForReceipt({
    explicitCashReceived: cashReceived,
    cashPaymentTotal,
    paymentsTotal,
    saleTotal: sale.totalAmount,
  });

  return {
    saleId: sale.id,
    cashReceived: receiptCashReceived,
    fiscalStatus: fiscalResult.status,
    fiscalMessage: fiscalResult.message,
    gameplayStatus: gameplayResult.status,
    gameplayMessage: gameplayResult.message,
  };
}

export async function createComandaRecord(input: FormData, actorId: string) {
  const parsed = createComandaSchema.parse({
    number: input.get("number"),
    customerId: input.get("customerId"),
    isWalkIn: input.get("isWalkIn"),
  });

  const customerId = emptyToUndefined(parsed.customerId);

  if (!parsed.isWalkIn && !customerId) {
    throw new Error("Selecione um cliente ou marque a opcao de comanda avulsa.");
  }

  const created = await createComanda({
    number: parsed.number,
    customerId,
    isWalkIn: parsed.isWalkIn || !customerId,
    openedById: actorId,
  });

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.create",
    entity: "Comanda",
    entityId: created.id,
    metadata: {
      number: created.number,
      isWalkIn: created.isWalkIn,
      customerId: created.customerId,
    },
  });
}

export async function addComandaItemRecord(input: FormData, actorId: string) {
  const parsed = addComandaItemSchema.parse({
    comandaId: input.get("comandaId"),
    productId: input.get("productId"),
    quantity: input.get("quantity"),
  });

  await addItemToComanda(parsed);

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.item.add",
    entity: "Comanda",
    entityId: parsed.comandaId,
    metadata: {
      productId: parsed.productId,
      quantity: parsed.quantity,
    },
  });
}

export async function removeComandaItemRecord(input: FormData, actorId: string) {
  const parsed = removeComandaItemSchema.parse({
    comandaId: input.get("comandaId"),
    productId: input.get("productId"),
  });

  await removeItemFromComanda(parsed);

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.item.remove",
    entity: "Comanda",
    entityId: parsed.comandaId,
    metadata: {
      productId: parsed.productId,
    },
  });
}

export async function updateComandaItemRecord(input: FormData, actorId: string) {
  const parsed = updateComandaItemSchema.parse({
    comandaId: input.get("comandaId"),
    productId: input.get("productId"),
    quantity: input.get("quantity"),
  });

  await updateComandaItemQuantity(parsed);

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.item.update",
    entity: "Comanda",
    entityId: parsed.comandaId,
    metadata: {
      productId: parsed.productId,
      quantity: parsed.quantity,
    },
  });
}

export async function updateComandaCustomerRecord(input: FormData, actorId: string) {
  const parsed = updateComandaCustomerSchema.parse({
    comandaId: input.get("comandaId"),
    customerId: input.get("customerId"),
  });

  const updated = await updateComandaCustomer({
    comandaId: parsed.comandaId,
    customerId: emptyToUndefined(parsed.customerId),
  });

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.customer.update",
    entity: "Comanda",
    entityId: parsed.comandaId,
    metadata: {
      customerId: updated.customerId,
      isWalkIn: updated.isWalkIn,
    },
  });
}

export async function closeComandaRecord(input: FormData, actorId: string) {
  const parsed = closeComandaSchema.parse({
    comandaId: input.get("comandaId"),
    cashSessionId: input.get("cashSessionId"),
    discountAmount: input.get("discountAmount") ?? "0",
    cashReceived: input.get("cashReceived") ?? "",
  });

  const payments = parsePayments(input);
  const discountAmount = parseDecimalInput(parsed.discountAmount || "0");
  if (discountAmount.lessThan(0)) {
    throw new Error("Desconto invalido.");
  }

  const cashPaymentTotal = payments
    .filter((payment) => payment.method === PaymentMethod.CASH)
    .reduce((acc, payment) => acc.plus(payment.amount), new Prisma.Decimal(0));
  const paymentsTotal = payments.reduce((acc, payment) => acc.plus(payment.amount), new Prisma.Decimal(0));

  const cashReceived = parsed.cashReceived ? parseDecimalInput(parsed.cashReceived) : undefined;

  if (cashReceived && cashPaymentTotal.equals(0)) {
    throw new Error("Valor recebido em dinheiro so pode ser informado quando houver pagamento em dinheiro.");
  }

  if (cashReceived && cashReceived.lessThan(cashPaymentTotal)) {
    throw new Error("Valor recebido em dinheiro nao pode ser menor que a parte paga em dinheiro.");
  }

  const sale = await closeComandaWithSale({
    comandaId: parsed.comandaId,
    cashSessionId: parsed.cashSessionId,
    payments,
    discountAmount,
    operatorId: actorId,
    saleNumber: createSaleNumber(),
  });

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.close",
    entity: "Comanda",
    entityId: parsed.comandaId,
    metadata: {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      paymentCount: payments.length,
      cashReceived: cashReceived?.toString(),
    },
  });

  const fiscalResult = await queueSaleNfceIssue({
    saleId: sale.id,
    actorId,
  });

  scheduleSalePostProcessing({
    saleId: sale.id,
    actorId,
    issueFiscal: true,
  });

  const receiptCashReceived = resolveCashReceivedForReceipt({
    explicitCashReceived: cashReceived,
    cashPaymentTotal,
    paymentsTotal,
    saleTotal: sale.totalAmount,
  });

  return {
    saleId: sale.id,
    cashReceived: receiptCashReceived,
    fiscalStatus: fiscalResult.status,
    fiscalMessage: fiscalResult.message,
  };
}

export async function cancelSaleRecord(input: FormData, actorId: string) {
  const parsed = cancelSaleSchema.parse({
    saleId: input.get("saleId"),
    cancelReason: input.get("cancelReason"),
  });

  const cancelled = await cancelSaleAndRestock({
    saleId: parsed.saleId,
    cancelReason: parsed.cancelReason.trim(),
    cancelledById: actorId,
  });

  if (cancelled.status !== SaleStatus.CANCELLED) {
    throw new Error("Nao foi possivel cancelar a venda.");
  }

  await createAuditLog({
    userId: actorId,
    action: "pdv.sale.cancel",
    entity: "Sale",
    entityId: cancelled.id,
    metadata: {
      saleNumber: cancelled.saleNumber,
      cancelReason: parsed.cancelReason,
    },
  });

  const fiscalCancellation = await cancelSaleNfce({
    saleId: cancelled.id,
    reason: parsed.cancelReason,
    actorId,
  });

  const baseMessage = "Venda cancelada com sucesso.";
  const fiscalMessage =
    fiscalCancellation.status === "CANCELLED" ||
    fiscalCancellation.status === "SKIPPED" ||
    fiscalCancellation.status === "DISABLED"
      ? fiscalCancellation.message
      : `${fiscalCancellation.message} Contate o Mateus.`;

  return {
    message: `${baseMessage} ${fiscalMessage}`.trim(),
  };
}

export async function cancelComandaRecord(input: FormData, actorId: string) {
  const parsed = cancelComandaSchema.parse({
    comandaId: input.get("comandaId"),
    cancelReason: input.get("cancelReason"),
  });

  const cancelled = await cancelComanda({
    comandaId: parsed.comandaId,
    cancelledById: actorId,
    cancelReason: parsed.cancelReason.trim(),
  });

  await createAuditLog({
    userId: actorId,
    action: "pdv.comanda.cancel",
    entity: "Comanda",
    entityId: cancelled.id,
    metadata: {
      cancelReason: parsed.cancelReason,
    },
  });
}

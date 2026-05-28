import {
  CashMovementType,
  CashSessionStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ProductKind,
  RecordStatus,
  RefundStatus,
  SaleStatus,
  StockMovementType,
  StockUnit,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  resolveCouponRedemptionInTransaction,
  type CouponRedemptionInput,
} from "@/infrastructure/db/repositories/coupon-repository";

type SaleItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: Prisma.Decimal;
};

export type SalePaymentInput = {
  method: PaymentMethod;
  amount: Prisma.Decimal;
  approvedAmount?: Prisma.Decimal;
  cardBrand?: string;
  cardLast4?: string;
  nsu?: string;
  authorizationCode?: string;
  terminalId?: string;
  externalTransactionId?: string;
  receiptText?: string;
  auditNote?: string;
  processedAt?: Date;
};

type GameplaySelectionInput = {
  productId: string;
  stationId: string;
};

type CreateSaleWithStockAdjustmentInput = {
  saleNumber: string;
  cashSessionId: string;
  operatorId: string;
  customerName?: string;
  discountAmount: Prisma.Decimal;
  couponCode?: string;
  items: SaleItemInput[];
  payments: SalePaymentInput[];
  gameplaySelections?: GameplaySelectionInput[];
  happyHourActive?: boolean;
};

type CancelSaleAndRestockInput = {
  saleId: string;
  cancelReason: string;
  cancelledById: string;
  refundStatus: RefundStatus;
  refundMethod?: PaymentMethod;
  refundAmount?: Prisma.Decimal;
  refundNsu?: string;
  refundAuthorizationCode?: string;
  refundTerminalId?: string;
  refundExternalTransactionId?: string;
  refundReceiptText?: string;
};

type PrismaTx = Prisma.TransactionClient;

const PDV_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 40_000,
};

type StockBalanceProduct = {
  id: string;
  name: string;
  currentStock: number;
  costPrice: Prisma.Decimal;
};

type GameplayStationProductData = {
  name: string;
  gameplayPlanCode: string | null;
};

function inferGameplayStationIdFromProduct(product: GameplayStationProductData) {
  const source = `${product.name} ${product.gameplayPlanCode ?? ""}`.toLowerCase();

  if (
    source.includes("tv 02") ||
    source.includes("tv-02") ||
    source.includes("simulador") ||
    source.includes("simulator") ||
    source.includes("corrida") ||
    source.includes("racing")
  ) {
    return "tv-02";
  }

  if (
    source.includes("tv 01") ||
    source.includes("tv-01") ||
    source.includes("ps5") ||
    source.includes("playstation") ||
    source.includes("play station")
  ) {
    return "tv-01";
  }

  return null;
}

function resolveGameplayStationId(product: GameplayStationProductData, selectedStationId?: string | null) {
  return inferGameplayStationIdFromProduct(product) ?? selectedStationId?.trim().toLowerCase() ?? null;
}

function resolveEffectiveSalePrice(
  product: { salePrice: Prisma.Decimal; happyHourPrice?: Prisma.Decimal | null },
  options?: { happyHourActive?: boolean; unitPriceOverride?: Prisma.Decimal },
) {
  if (options?.unitPriceOverride) {
    return options.unitPriceOverride;
  }

  if (options?.happyHourActive && product.happyHourPrice?.greaterThan(0)) {
    return product.happyHourPrice;
  }

  return product.salePrice;
}

function resolveRecipeUnitCost(product: {
  costPrice: Prisma.Decimal;
  recipeIngredients: Array<{
    quantity: number;
    ingredientProduct: {
      costPrice: Prisma.Decimal;
    };
  }>;
}) {
  if (product.recipeIngredients.length === 0) {
    return product.costPrice;
  }

  return product.recipeIngredients.reduce(
    (total, ingredient) => total.plus(ingredient.ingredientProduct.costPrice.times(ingredient.quantity)),
    new Prisma.Decimal(0),
  );
}

async function moveTrackedStock(
  tx: PrismaTx,
  balances: Map<string, number>,
  product: StockBalanceProduct,
  quantity: number,
  type: StockMovementType,
  note: string,
  operatorId?: string,
) {
  if (quantity <= 0) {
    return;
  }

  const previousStock = balances.get(product.id) ?? product.currentStock;
  const resultingStock = type === StockMovementType.IN ? previousStock + quantity : previousStock - quantity;

  if (resultingStock < 0) {
    throw new Error(`Estoque insuficiente para ${product.name}.`);
  }

  const stockUpdate = await tx.product.updateMany({
    where: { id: product.id },
    data: {
      currentStock: resultingStock,
    },
  });

  if (stockUpdate.count === 0) {
    throw new Error("Produto nao encontrado para atualizar o estoque.");
  }

  await tx.stockMovement.create({
    data: {
      productId: product.id,
      type,
      quantity,
      unitCost: product.costPrice,
      previousStock,
      resultingStock,
      note,
      operatorId,
    },
  });

  balances.set(product.id, resultingStock);
}

function normalizeOptionalPaymentText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function paymentAuditKeys(payment: SalePaymentInput) {
  const keys: string[] = [];
  const nsu = normalizeOptionalPaymentText(payment.nsu);
  const externalTransactionId = normalizeOptionalPaymentText(payment.externalTransactionId);
  const authorizationCode = normalizeOptionalPaymentText(payment.authorizationCode);
  const terminalId = normalizeOptionalPaymentText(payment.terminalId);

  if (externalTransactionId) {
    keys.push(`external:${externalTransactionId.toLowerCase()}`);
  }

  if (nsu) {
    keys.push(`nsu:${(terminalId ?? "sem-terminal").toLowerCase()}:${nsu.toLowerCase()}`);
  }

  if (authorizationCode && terminalId) {
    keys.push(`auth:${terminalId.toLowerCase()}:${authorizationCode.toLowerCase()}`);
  }

  return keys;
}

function assertSubmittedPaymentsAreUnique(payments: SalePaymentInput[]) {
  const seenKeys = new Set<string>();

  for (const payment of payments) {
    for (const key of paymentAuditKeys(payment)) {
      if (seenKeys.has(key)) {
        throw new Error("Pagamento duplicado na mesma venda. Confira NSU/autorizacao e contate o Mateus.");
      }

      seenKeys.add(key);
    }
  }
}

function assertApprovedAmountMatchesPayment(payment: SalePaymentInput) {
  if (!payment.approvedAmount) {
    return;
  }

  const tolerance = new Prisma.Decimal("0.01");
  const difference = payment.approvedAmount.minus(payment.amount).abs();

  if (difference.greaterThan(tolerance)) {
    throw new Error(
      "Valor aprovado na maquininha/Pix diferente do valor lancado no sistema. Confira antes de fechar. Contate o Mateus.",
    );
  }
}

function getPaymentStatus(payment: SalePaymentInput) {
  if (!payment.approvedAmount) {
    return PaymentStatus.APPROVED;
  }

  const tolerance = new Prisma.Decimal("0.01");
  return payment.approvedAmount.minus(payment.amount).abs().greaterThan(tolerance)
    ? PaymentStatus.DIVERGENT
    : PaymentStatus.APPROVED;
}

async function assertPaymentNotPreviouslyRecorded(tx: PrismaTx, payment: SalePaymentInput) {
  const duplicateFilters: Prisma.PaymentWhereInput[] = [];
  const nsu = normalizeOptionalPaymentText(payment.nsu);
  const externalTransactionId = normalizeOptionalPaymentText(payment.externalTransactionId);
  const authorizationCode = normalizeOptionalPaymentText(payment.authorizationCode);
  const terminalId = normalizeOptionalPaymentText(payment.terminalId);

  if (externalTransactionId) {
    duplicateFilters.push({ externalTransactionId });
  }

  if (nsu) {
    duplicateFilters.push(terminalId ? { nsu, terminalId } : { nsu });
  }

  if (authorizationCode && terminalId) {
    duplicateFilters.push({ authorizationCode, terminalId });
  }

  if (duplicateFilters.length === 0) {
    return;
  }

  const duplicatePayment = await tx.payment.findFirst({
    where: {
      OR: duplicateFilters,
      sale: {
        status: SaleStatus.COMPLETED,
      },
    },
    select: {
      id: true,
      sale: {
        select: {
          saleNumber: true,
        },
      },
    },
  });

  if (duplicatePayment) {
    throw new Error(
      `Pagamento possivelmente duplicado. Esta transacao ja aparece na venda ${duplicatePayment.sale.saleNumber}. Contate o Mateus.`,
    );
  }
}

async function assertPaymentsAuditConsistency(tx: PrismaTx, payments: SalePaymentInput[]) {
  assertSubmittedPaymentsAreUnique(payments);

  for (const payment of payments) {
    assertApprovedAmountMatchesPayment(payment);
    await assertPaymentNotPreviouslyRecorded(tx, payment);
  }
}

function isRetryableTransactionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2028";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("transaction not found") || message.includes("transaction api error");
  }

  return false;
}

async function runWithTransactionRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableTransactionError(error)) {
      throw error;
    }

    return operation();
  }
}

function isMissingProductImageColumnError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2022" && String(error.meta?.column ?? "").toLowerCase().includes("imageurl");
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("imageurl") && (message.includes("column") || message.includes("does not exist"));
  }

  return false;
}

export async function listPdvProductOptions() {
  try {
    return await prisma.product.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        pdvVisible: true,
        NOT: {
          kind: ProductKind.STANDARD,
          tracksStock: true,
          stockUnit: StockUnit.MILLILITER,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        kind: true,
        tracksStock: true,
        serviceCnae: true,
        serviceDescription: true,
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        salePrice: true,
        happyHourPrice: true,
        currentStock: true,
        status: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  } catch (error) {
    if (!isMissingProductImageColumnError(error)) {
      throw error;
    }

    const products = await prisma.product.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        pdvVisible: true,
        NOT: {
          kind: ProductKind.STANDARD,
          tracksStock: true,
          stockUnit: StockUnit.MILLILITER,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        kind: true,
        tracksStock: true,
        serviceCnae: true,
        serviceDescription: true,
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        salePrice: true,
        happyHourPrice: true,
        currentStock: true,
        status: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return products.map((product) => ({
      ...product,
      imageUrl: null,
    }));
  }
}

export async function listPdvOpenSessions() {
  return prisma.cashSession.findMany({
    where: {
      status: CashSessionStatus.OPEN,
    },
    include: {
      cashRegister: true,
      operator: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });
}

export async function listRecentSales() {
  const recentSalesLimit = 30;

  return prisma.sale.findMany({
    include: {
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      cashSession: {
        include: {
          cashRegister: true,
        },
      },
      items: {
        select: {
          id: true,
          quantity: true,
        },
      },
      payments: true,
      gameplayRelease: true,
      cancellation: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: recentSalesLimit,
  });
}

export async function getSaleReceiptById(saleId: string) {
  return prisma.sale.findUnique({
    where: {
      id: saleId,
    },
    include: {
      operator: {
        select: {
          id: true,
          name: true,
        },
      },
      cashSession: {
        include: {
          cashRegister: true,
        },
      },
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      payments: {
        orderBy: {
          createdAt: "asc",
        },
      },
      gameplayRelease: true,
      cancellation: true,
    },
  });
}

export async function resolveGameplayStationIdsForSelections(selections: GameplaySelectionInput[]) {
  const productIds = [...new Set(selections.map((selection) => selection.productId).filter(Boolean))];

  if (productIds.length === 0) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      kind: ProductKind.GAMEPLAY,
    },
    select: {
      id: true,
      name: true,
      gameplayPlanCode: true,
    },
  });
  const selectionMap = new Map(
    selections.map((selection) => [selection.productId, selection.stationId.trim().toLowerCase()]),
  );
  const stationIds = products
    .map((product) => resolveGameplayStationId(product, selectionMap.get(product.id)))
    .filter(Boolean) as string[];

  return [...new Set(stationIds)];
}

async function runCreateSaleWithStockAdjustment(
  tx: PrismaTx,
  data: CreateSaleWithStockAdjustmentInput,
) {
  const session = await tx.cashSession.findUniqueOrThrow({
    where: { id: data.cashSessionId },
    select: {
      id: true,
      status: true,
    },
  });

  if (session.status !== CashSessionStatus.OPEN) {
    throw new Error("Sessao de caixa fechada. Abra um caixa para registrar venda.");
  }

  const productIds = [...new Set(data.items.map((item) => item.productId))];
  const products = await tx.product.findMany({
    where: {
      id: { in: productIds },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      ncm: true,
      kind: true,
      tracksStock: true,
      serviceCnae: true,
      serviceDescription: true,
      gameplayPlanCode: true,
      gameplayDurationMinutes: true,
      salePrice: true,
      happyHourPrice: true,
      categoryId: true,
      costPrice: true,
      currentStock: true,
      status: true,
      recipeIngredients: {
        select: {
          quantity: true,
          ingredientProduct: {
            select: {
              id: true,
              name: true,
              currentStock: true,
              costPrice: true,
            },
          },
        },
      },
    },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));
  const gameplaySelectionMap = new Map(
    (data.gameplaySelections ?? []).map((selection) => [selection.productId, selection.stationId.trim().toLowerCase()]),
  );

  const productLineTotals: Array<{ productId: string; categoryId: string; lineTotal: Prisma.Decimal }> = [];
  const subtotalAmount = data.items.reduce((acc, item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error("Produto nao encontrado para a venda.");
    }

    if (product.status !== RecordStatus.ACTIVE) {
      throw new Error(`Produto ${product.name} inativo para venda.`);
    }

    if (product.kind === ProductKind.GAMEPLAY) {
      const stationId = resolveGameplayStationId(product, gameplaySelectionMap.get(product.id));
      if (!stationId) {
        throw new Error(`Selecione a TV/estacao para o gameplay ${product.name}.`);
      }

      if (!product.gameplayPlanCode || !product.gameplayDurationMinutes) {
        throw new Error(`Produto de gameplay ${product.name} precisa de plano e duracao configurados.`);
      }
    } else if (product.kind === ProductKind.STANDARD && product.tracksStock && product.currentStock < item.quantity) {
      throw new Error(`Estoque insuficiente para ${product.name}.`);
    }

    if (product.kind === ProductKind.STANDARD) {
      for (const recipeIngredient of product.recipeIngredients) {
        const requiredQuantity = recipeIngredient.quantity * item.quantity;
        if (recipeIngredient.ingredientProduct.currentStock < requiredQuantity) {
          throw new Error(`Estoque insuficiente do insumo ${recipeIngredient.ingredientProduct.name} para ${product.name}.`);
        }
      }
    }

    const unitPrice = resolveEffectiveSalePrice(product, {
      happyHourActive: data.happyHourActive,
      unitPriceOverride: item.unitPrice,
    });

    const lineTotal = unitPrice.times(item.quantity);
      productLineTotals.push({
        productId: item.productId,
        categoryId: product.categoryId,
        lineTotal,
      });

    return acc.plus(lineTotal);
  }, new Prisma.Decimal(0));

  const manualDiscountAmount = data.discountAmount;
  let couponRedemption: CouponRedemptionInput | null = null;
  if (data.couponCode) {
    couponRedemption = await resolveCouponRedemptionInTransaction(
      tx,
      data.couponCode,
      subtotalAmount,
      productLineTotals,
    );
  }

  const totalDiscountAmount = manualDiscountAmount.plus(couponRedemption?.discountAmount ?? 0);

  if (totalDiscountAmount.lessThan(0)) {
    throw new Error("Desconto invalido.");
  }

  if (totalDiscountAmount.greaterThan(subtotalAmount)) {
    throw new Error("Desconto nao pode ser maior que o subtotal da venda.");
  }

  const totalAmount = subtotalAmount.minus(totalDiscountAmount);
  const tolerance = new Prisma.Decimal("0.01");
  const nonCashPayments = data.payments.filter((payment) => payment.method !== PaymentMethod.CASH);
  const cashPayments = data.payments.filter((payment) => payment.method === PaymentMethod.CASH);

  const nonCashTotal = nonCashPayments.reduce(
    (acc, payment) => acc.plus(payment.amount),
    new Prisma.Decimal(0),
  );
  const cashTotal = cashPayments.reduce(
    (acc, payment) => acc.plus(payment.amount),
    new Prisma.Decimal(0),
  );

  const normalizedPayments: SalePaymentInput[] = [...nonCashPayments];

  if (cashPayments.length === 0) {
    const paymentsTotal = nonCashTotal;
    const difference = paymentsTotal.minus(totalAmount).abs();
    if (difference.greaterThan(tolerance)) {
      throw new Error("A soma dos pagamentos deve ser igual ao total liquido da venda.");
    }
  } else {
    const nonCashOverflow = nonCashTotal.minus(totalAmount);
    if (nonCashOverflow.greaterThan(tolerance)) {
      throw new Error("Pagamentos sem dinheiro nao podem ultrapassar o total da venda.");
    }

    const remainingForCashRaw = totalAmount.minus(nonCashTotal);
    const remainingForCash = remainingForCashRaw.lessThan(0)
      ? new Prisma.Decimal(0)
      : remainingForCashRaw;

    if (cashTotal.plus(tolerance).lessThan(remainingForCash)) {
      throw new Error("Valor em dinheiro insuficiente para completar o total da venda.");
    }

    if (remainingForCash.greaterThan(0)) {
      normalizedPayments.push({
        method: PaymentMethod.CASH,
        amount: remainingForCash,
        processedAt: new Date(),
      });
    }
  }

  await assertPaymentsAuditConsistency(tx, normalizedPayments);

  const sale = await tx.sale.create({
    data: {
      saleNumber: data.saleNumber,
      cashSessionId: data.cashSessionId,
      operatorId: data.operatorId,
      customerName: data.customerName,
      subtotalAmount,
      discountAmount: totalDiscountAmount,
      totalAmount,
      items: {
        create: data.items.map((item) => {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new Error("Produto invalido na venda.");
          }

          const unitPrice = resolveEffectiveSalePrice(product, {
            happyHourActive: data.happyHourActive,
            unitPriceOverride: item.unitPrice,
          });

          return {
            productId: product.id,
            productNameSnapshot: product.name,
            skuSnapshot: product.sku,
            ncmSnapshot: product.ncm,
            productKindSnapshot: product.kind,
            serviceCnaeSnapshot: product.kind === ProductKind.STANDARD ? null : product.serviceCnae,
            serviceDescriptionSnapshot:
              product.kind === ProductKind.STANDARD
                ? null
                : product.serviceDescription ?? product.name,
            gameplayStationId:
              product.kind === ProductKind.GAMEPLAY
                ? resolveGameplayStationId(product, gameplaySelectionMap.get(product.id))
                : null,
            gameplayPlanCode: product.kind === ProductKind.GAMEPLAY ? product.gameplayPlanCode : null,
            gameplayDurationMinutes:
              product.kind === ProductKind.GAMEPLAY ? product.gameplayDurationMinutes : null,
            quantity: item.quantity,
            unitPrice,
            unitCost: resolveRecipeUnitCost(product),
            lineTotal: unitPrice.times(item.quantity),
            lineCostTotal: resolveRecipeUnitCost(product).times(item.quantity),
          };
        }),
      },
      payments: {
        create: normalizedPayments.map((payment) => ({
          method: payment.method,
          amount: payment.amount,
          status: getPaymentStatus(payment),
          approvedAmount: payment.approvedAmount,
          cardBrand: normalizeOptionalPaymentText(payment.cardBrand),
          cardLast4: normalizeOptionalPaymentText(payment.cardLast4),
          nsu: normalizeOptionalPaymentText(payment.nsu),
          authorizationCode: normalizeOptionalPaymentText(payment.authorizationCode),
          terminalId: normalizeOptionalPaymentText(payment.terminalId),
          externalTransactionId: normalizeOptionalPaymentText(payment.externalTransactionId),
          receiptText: normalizeOptionalPaymentText(payment.receiptText),
          auditNote: normalizeOptionalPaymentText(payment.auditNote),
          processedAt: payment.processedAt ?? new Date(),
        })),
      },
      coupons: couponRedemption
        ? {
            create: {
              couponId: couponRedemption.couponId,
              codeSnapshot: couponRedemption.codeSnapshot,
              discountTypeSnapshot: couponRedemption.discountTypeSnapshot,
              discountValueSnapshot: couponRedemption.discountValueSnapshot,
              discountAmount: couponRedemption.discountAmount,
            },
          }
        : undefined,
    },
    include: {
      items: true,
    },
  });

  const stockBalances = new Map<string, number>();

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      continue;
    }

    if (product.kind !== ProductKind.STANDARD) {
      continue;
    }

    if (product.tracksStock) {
      await moveTrackedStock(
        tx,
        stockBalances,
        product,
        item.quantity,
        StockMovementType.OUT,
        `Saida por venda ${data.saleNumber}`,
        data.operatorId,
      );
    }

    for (const recipeIngredient of product.recipeIngredients) {
      await moveTrackedStock(
        tx,
        stockBalances,
        recipeIngredient.ingredientProduct,
        recipeIngredient.quantity * item.quantity,
        StockMovementType.OUT,
        `Consumo por venda ${data.saleNumber}: ${product.name}`,
        data.operatorId,
      );
    }
  }

  return sale;
}

export async function createSaleWithStockAdjustment(data: CreateSaleWithStockAdjustmentInput) {
  return runWithTransactionRetry(() =>
    prisma.$transaction((tx) => runCreateSaleWithStockAdjustment(tx, data), PDV_TRANSACTION_OPTIONS),
  );
}

export async function createSaleWithStockAdjustmentInTransaction(
  tx: PrismaTx,
  data: CreateSaleWithStockAdjustmentInput,
) {
  return runCreateSaleWithStockAdjustment(tx, data);
}

export async function cancelSaleAndRestock(data: CancelSaleAndRestockInput) {
  return runWithTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: data.saleId },
        include: {
          items: true,
          payments: true,
        },
      });

      if (sale.status === SaleStatus.CANCELLED) {
        throw new Error("A venda selecionada ja foi cancelada.");
      }

      const refundAmount =
        data.refundStatus === RefundStatus.NOT_REQUIRED
          ? new Prisma.Decimal(0)
          : data.refundAmount ?? sale.totalAmount;
      const refundDifference = refundAmount.minus(sale.totalAmount).abs();

      if (data.refundStatus === RefundStatus.CONFIRMED && !data.refundMethod) {
        throw new Error("Informe a forma usada para o estorno confirmado. Contate o Mateus.");
      }

      if (data.refundStatus === RefundStatus.CONFIRMED && refundDifference.greaterThan(new Prisma.Decimal("0.01"))) {
        throw new Error("O valor do estorno confirmado precisa bater com o total da venda. Contate o Mateus.");
      }

      const productIds = [...new Set(sale.items.map((item) => item.productId))];
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          kind: true,
          tracksStock: true,
          currentStock: true,
          costPrice: true,
          recipeIngredients: {
            select: {
              quantity: true,
              ingredientProduct: {
                select: {
                  id: true,
                  name: true,
                  currentStock: true,
                  costPrice: true,
                },
              },
            },
          },
        },
      });
      const productMap = new Map(products.map((product) => [product.id, product]));

      const cancelledSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: SaleStatus.CANCELLED,
          cancelReason: data.cancelReason,
          cancelledById: data.cancelledById,
          cancelledAt: new Date(),
        },
      });

      if (data.refundStatus === RefundStatus.CONFIRMED) {
        await tx.payment.updateMany({
          where: {
            saleId: sale.id,
          },
          data: {
            status: PaymentStatus.REFUNDED,
          },
        });
      }

      if (data.refundStatus === RefundStatus.CONFIRMED && data.refundMethod === PaymentMethod.CASH) {
        const originalCashAmount = sale.payments
          .filter((payment) => payment.method === PaymentMethod.CASH)
          .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
        const cashOutflowAmount = refundAmount.minus(originalCashAmount);

        if (cashOutflowAmount.greaterThan(0)) {
          await tx.cashMovement.create({
            data: {
              cashSessionId: sale.cashSessionId,
              operatorId: data.cancelledById,
              type: CashMovementType.WITHDRAWAL,
              amount: cashOutflowAmount,
              reason: `Estorno em dinheiro da venda ${sale.saleNumber}: ${data.cancelReason}`,
            },
          });
        }
      }

      const cancellation = await tx.saleCancellation.create({
        data: {
          saleId: sale.id,
          reason: data.cancelReason,
          refundStatus: data.refundStatus,
          refundMethod: data.refundMethod,
          refundAmount,
          refundNsu: normalizeOptionalPaymentText(data.refundNsu),
          refundAuthorizationCode: normalizeOptionalPaymentText(data.refundAuthorizationCode),
          refundTerminalId: normalizeOptionalPaymentText(data.refundTerminalId),
          refundExternalTransactionId: normalizeOptionalPaymentText(data.refundExternalTransactionId),
          refundReceiptText: normalizeOptionalPaymentText(data.refundReceiptText),
          createdById: data.cancelledById,
        },
      });

      let restoredQuantity = 0;

      const stockBalances = new Map<string, number>();

      for (const item of sale.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          continue;
        }

        if (product.kind !== ProductKind.STANDARD) {
          continue;
        }

        if (product.tracksStock) {
          await moveTrackedStock(
            tx,
            stockBalances,
            product,
            item.quantity,
            StockMovementType.IN,
            `Retorno por cancelamento da venda ${sale.saleNumber}: ${data.cancelReason}`,
            data.cancelledById,
          );
          restoredQuantity += item.quantity;
        }

        for (const recipeIngredient of product.recipeIngredients) {
          const restoredIngredientQuantity = recipeIngredient.quantity * item.quantity;
          await moveTrackedStock(
            tx,
            stockBalances,
            recipeIngredient.ingredientProduct,
            restoredIngredientQuantity,
            StockMovementType.IN,
            `Retorno por cancelamento da venda ${sale.saleNumber}: insumo de ${item.productNameSnapshot}`,
            data.cancelledById,
          );
          restoredQuantity += restoredIngredientQuantity;
        }
      }

      const updatedCancellation = await tx.saleCancellation.update({
        where: {
          id: cancellation.id,
        },
        data: {
          stockRestored: restoredQuantity > 0,
        },
      });

      return {
        sale: cancelledSale,
        cancellation: updatedCancellation,
        restoredQuantity,
      };
    }, PDV_TRANSACTION_OPTIONS),
  );
}

export async function updateSaleCancellationFiscalData(
  saleId: string,
  data: Pick<Prisma.SaleCancellationUncheckedUpdateInput, "fiscalStatus" | "fiscalMessage">,
) {
  return prisma.saleCancellation.update({
    where: {
      saleId,
    },
    data,
  });
}

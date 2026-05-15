import { PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PaymentAuditFiltersInput = {
  query?: string;
  startDate?: string;
  endDate?: string;
  method?: string;
  status?: string;
  amount?: string;
};

const traceableMethods: PaymentMethod[] = [PaymentMethod.PIX, PaymentMethod.CREDIT_CARD, PaymentMethod.DEBIT_CARD];

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function resolveDefaultDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
}

function parseBrazilianDateStart(value: string) {
  return new Date(`${value}T00:00:00.000-03:00`);
}

function parseBrazilianDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999-03:00`);
}

function normalizeMoneyFilter(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  let normalized = trimmed.replace(/\s/g, "");
  if (normalized.includes(",") && normalized.includes(".")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return undefined;
  }

  return new Prisma.Decimal(normalized);
}

function normalizeMethod(value?: string) {
  return Object.values(PaymentMethod).includes(value as PaymentMethod) ? (value as PaymentMethod) : "ALL";
}

function normalizeStatus(value?: string) {
  return Object.values(PaymentStatus).includes(value as PaymentStatus) ? (value as PaymentStatus) : "ALL";
}

function hasTraceIdentifier(payment: {
  nsu: string | null;
  authorizationCode: string | null;
  externalTransactionId: string | null;
}) {
  return Boolean(payment.nsu || payment.authorizationCode || payment.externalTransactionId);
}

export async function getPaymentAuditData(input: PaymentAuditFiltersInput) {
  const defaultDateRange = resolveDefaultDateRange();
  const query = input.query?.trim() ?? "";
  const startDate = input.startDate?.trim() || defaultDateRange.startDate;
  const endDate = input.endDate?.trim() || defaultDateRange.endDate;
  const method = normalizeMethod(input.method);
  const status = normalizeStatus(input.status);
  const amount = normalizeMoneyFilter(input.amount);

  const where: Prisma.PaymentWhereInput = {
    sale: {
      createdAt: {
        gte: parseBrazilianDateStart(startDate),
        lte: parseBrazilianDateEnd(endDate),
      },
    },
  };

  if (method !== "ALL") {
    where.method = method;
  }

  if (status !== "ALL") {
    where.status = status;
  }

  if (amount) {
    where.amount = amount;
  }

  if (query) {
    where.OR = [
      { nsu: { contains: query, mode: "insensitive" } },
      { authorizationCode: { contains: query, mode: "insensitive" } },
      { externalTransactionId: { contains: query, mode: "insensitive" } },
      { terminalId: { contains: query, mode: "insensitive" } },
      { cardBrand: { contains: query, mode: "insensitive" } },
      { receiptText: { contains: query, mode: "insensitive" } },
      { sale: { saleNumber: { contains: query, mode: "insensitive" } } },
      { sale: { customerName: { contains: query, mode: "insensitive" } } },
    ];
  }

  const payments = await prisma.payment.findMany({
    where,
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          customerName: true,
          status: true,
          totalAmount: true,
          fiscalStatus: true,
          createdAt: true,
          operator: {
            select: {
              name: true,
            },
          },
          cashSession: {
            select: {
              cashRegister: {
                select: {
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 250,
  });

  const traceablePayments = payments.filter((payment) => traceableMethods.includes(payment.method));
  const paymentsWithoutTrace = traceablePayments.filter((payment) => !hasTraceIdentifier(payment));
  const divergentPayments = payments.filter((payment) => payment.status === PaymentStatus.DIVERGENT);
  const totalAmount = payments.reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));

  return {
    filters: {
      query,
      startDate,
      endDate,
      method,
      status,
      amount: input.amount?.trim() ?? "",
    },
    summary: {
      totalPayments: payments.length,
      totalAmount,
      traceableCount: traceablePayments.length,
      withoutTraceCount: paymentsWithoutTrace.length,
      divergentCount: divergentPayments.length,
    },
    payments,
  };
}

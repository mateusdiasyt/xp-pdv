import { CashMovementType, CashSessionStatus, PaymentMethod, PaymentStatus, Prisma, SaleStatus } from "@prisma/client";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";
import {
  getOperationalDayRange,
  getOperationalDayRangeByBusinessDate,
  type OperationalDayRange,
} from "@/domain/business-hours/operational-day";
import { prisma } from "@/lib/prisma";

export const REPORT_PERIODS = [
  "cash",
  "1d",
  "7d",
  "15d",
  "30d",
  "3m",
  "6m",
  "1y",
  "custom",
] as const;

export type ReportPeriod = (typeof REPORT_PERIODS)[number];

type Ymd = {
  year: number;
  month: number;
  day: number;
};

type ReportRange = {
  start: Date;
  end: Date;
  label: string;
  cashSessionId?: string;
  cashSessionLabel?: string;
  mode: "cash" | "period";
  businessStartDate: string;
  businessEndDate: string;
  timezone: string;
  startsAt: string;
  endsAt: string;
};

type ReportSummary = {
  salesCount: number;
  cancelledSalesCount: number;
  itemsCount: number;
  averageTicket: number;
  grossRevenue: number;
  netRevenue: number;
  discountAmount: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  roiOnCostPercent: number;
  paymentTotal: number;
  reconciliationDifference: number;
};

export type ReportPaymentRow = {
  method: PaymentMethod;
  label: string;
  amount: number;
  salesCount: number;
  transactionCount: number;
  sharePercent: number;
  averageTicket: number;
};

type ReportCashMovementSummary = {
  openingAmount: number;
  cashSalesAmount: number;
  supplyAmount: number;
  withdrawalAmount: number;
  netCashFlow: number;
  finalCashBalance: number;
};

type ReportCategoryRow = {
  category: string;
  quantity: number;
  grossRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  roiOnCostPercent: number;
  profitSharePercent: number;
};

type ReportItemRow = {
  category: string;
  item: string;
  quantity: number;
  grossRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPercent: number;
  roiOnCostPercent: number;
  profitSharePercent: number;
};

export type ReportPeriodData = {
  period: ReportPeriod;
  label: string;
  range: ReportRange;
  summary: ReportSummary;
  paymentRows: ReportPaymentRow[];
  cashMovementSummary: ReportCashMovementSummary;
  categoryRows: ReportCategoryRow[];
  itemRows: ReportItemRow[];
};

type ReportsDataInput = {
  period?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
};

export type ReportsData = {
  generatedAt: string;
  referenceDate: string;
  customStartDate: string;
  customEndDate: string;
  selectedPeriod: ReportPeriod;
  active: ReportPeriodData;
  oneDay: ReportPeriodData;
  sevenDays: ReportPeriodData;
  fifteenDays: ReportPeriodData;
  thirtyDays: ReportPeriodData;
};

const paymentMethodOrder = [
  PaymentMethod.CASH,
  PaymentMethod.PIX,
  PaymentMethod.CREDIT_CARD,
  PaymentMethod.DEBIT_CARD,
] as const;

const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT_CARD: "Credito",
  DEBIT_CARD: "Debito",
};

type ReportSettings = {
  businessTimezone?: string;
  businessDayStartsAt?: string;
  businessDayEndsAt?: string;
};

type SaleForReport = {
  id: string;
  subtotalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  items: Array<{
    productNameSnapshot: string;
    quantity: number;
    lineTotal: Prisma.Decimal;
    lineCostTotal: Prisma.Decimal;
    product: {
      name: string;
      category: {
        name: string;
      };
    } | null;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: Prisma.Decimal;
  }>;
};

async function getCashOpeningAmount(range: ReportRange) {
  if (range.cashSessionId) {
    const session = await prisma.cashSession.findUnique({
      where: {
        id: range.cashSessionId,
      },
      select: {
        openingAmount: true,
      },
    });

    return toNumber(session?.openingAmount);
  }

  const sessions = await prisma.cashSession.findMany({
    where: {
      openedAt: {
        gte: range.start,
        lt: range.end,
      },
    },
    select: {
      openingAmount: true,
    },
  });

  return sessions.reduce((total, session) => total + toNumber(session.openingAmount), 0);
}

function toNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) {
    return 0;
  }

  return Number(value);
}

function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toPercent(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return round2((value / total) * 100);
}

function toMarginPercent(grossProfit: number, grossRevenue: number) {
  if (grossRevenue <= 0) {
    return 0;
  }

  return round2((grossProfit / grossRevenue) * 100);
}

function toRoiPercent(grossProfit: number, totalCost: number) {
  if (totalCost <= 0) {
    return 0;
  }

  return round2((grossProfit / totalCost) * 100);
}

function formatYmd(date: Ymd) {
  return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function parseYmd(value?: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) {
    return null;
  }

  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  const check = new Date(Date.UTC(date.year, date.month - 1, date.day, 12, 0, 0, 0));

  if (
    check.getUTCFullYear() !== date.year ||
    check.getUTCMonth() + 1 !== date.month ||
    check.getUTCDate() !== date.day
  ) {
    return null;
  }

  return date;
}

function addDays(date: Ymd, days: number): Ymd {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + days, 12, 0, 0, 0));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function addMonths(date: Ymd, months: number): Ymd {
  const next = new Date(Date.UTC(date.year, date.month - 1 + months, date.day, 12, 0, 0, 0));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

function compareYmd(first: Ymd, second: Ymd) {
  return formatYmd(first).localeCompare(formatYmd(second));
}

function formatDateLabel(date: Ymd) {
  return `${String(date.day).padStart(2, "0")}/${String(date.month).padStart(2, "0")}/${date.year}`;
}

function resolvePeriod(period?: string): ReportPeriod {
  if ((REPORT_PERIODS as readonly string[]).includes(period ?? "")) {
    return period as ReportPeriod;
  }

  return "1d";
}

function periodLabel(period: ReportPeriod) {
  const labels: Record<ReportPeriod, string> = {
    cash: "Caixa atual",
    "1d": "Relatorio de 1 dia",
    "7d": "Relatorio de 7 dias",
    "15d": "Relatorio de 15 dias",
    "30d": "Relatorio de 30 dias",
    "3m": "Relatorio de 3 meses",
    "6m": "Relatorio de 6 meses",
    "1y": "Relatorio de 1 ano",
    custom: "Relatorio personalizado",
  };

  return labels[period];
}

function rangeLabel(period: ReportPeriod, start: Ymd, end: Ymd, range: OperationalDayRange) {
  const prefix = period === "custom" ? "Personalizado" : periodLabel(period).replace("Relatorio de ", "");
  const dateLabel =
    compareYmd(start, end) === 0
      ? formatDateLabel(start)
      : `${formatDateLabel(start)} ate ${formatDateLabel(end)}`;

  return `${prefix}: ${dateLabel} | Turno ${range.startsAt}-${range.endsAt}`;
}

function formatDateTimeLabel(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildRange(start: Ymd, end: Ymd, period: ReportPeriod, settings: ReportSettings): ReportRange {
  let normalizedStart = start;
  let normalizedEnd = end;

  if (compareYmd(normalizedStart, normalizedEnd) > 0) {
    normalizedStart = end;
    normalizedEnd = start;
  }

  const startRange = getOperationalDayRangeByBusinessDate(normalizedStart, settings);
  const endRange = getOperationalDayRangeByBusinessDate(normalizedEnd, settings);

  return {
    start: startRange.start,
    end: endRange.end,
    label: rangeLabel(period, normalizedStart, normalizedEnd, startRange),
    mode: "period",
    businessStartDate: formatYmd(normalizedStart),
    businessEndDate: formatYmd(normalizedEnd),
    timezone: startRange.timezone,
    startsAt: startRange.startsAt,
    endsAt: startRange.endsAt,
  };
}

async function getOpenCashSessionRange(settings: ReportSettings, fallbackReferenceDate: Ymd): Promise<ReportRange | null> {
  const openSession = await prisma.cashSession.findFirst({
    where: {
      status: CashSessionStatus.OPEN,
    },
    select: {
      id: true,
      openedAt: true,
      cashRegister: {
        select: {
          name: true,
          code: true,
        },
      },
      operator: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      openedAt: "desc",
    },
  });

  if (!openSession) {
    return null;
  }

  const operationalDay = getOperationalDayRange(openSession.openedAt, settings);
  const now = new Date();
  const registerLabel = `${openSession.cashRegister.name} (${openSession.cashRegister.code})`;

  return {
    start: openSession.openedAt,
    end: now,
    label: `Caixa atual: ${registerLabel} | Aberto ${formatDateTimeLabel(openSession.openedAt, operationalDay.timezone)}`,
    cashSessionId: openSession.id,
    cashSessionLabel: `${registerLabel} - ${openSession.operator.name}`,
    mode: "cash",
    businessStartDate: formatYmd(operationalDay.businessDate),
    businessEndDate: formatYmd(fallbackReferenceDate),
    timezone: operationalDay.timezone,
    startsAt: operationalDay.startsAt,
    endsAt: operationalDay.endsAt,
  };
}

function getRangeForPeriod(
  period: ReportPeriod,
  referenceDate: Ymd,
  settings: ReportSettings,
  customStartDate?: string,
  customEndDate?: string,
) {
  if (period === "cash") {
    const range = buildRange(referenceDate, referenceDate, period, settings);

    return {
      range: {
        ...range,
        label: `Caixa atual: nenhum caixa aberto | Turno ${range.startsAt}-${range.endsAt}`,
        mode: "cash" as const,
      },
      customStartDate: range.businessStartDate,
      customEndDate: range.businessEndDate,
    };
  }

  if (period === "custom") {
    const fallbackStart = parseYmd(customStartDate) ?? parseYmd(customEndDate) ?? referenceDate;
    const fallbackEnd = parseYmd(customEndDate) ?? parseYmd(customStartDate) ?? referenceDate;
    const range = buildRange(fallbackStart, fallbackEnd, period, settings);

    return {
      range,
      customStartDate: range.businessStartDate,
      customEndDate: range.businessEndDate,
    };
  }

  const daysByPeriod: Partial<Record<ReportPeriod, number>> = {
    "1d": 1,
    "7d": 7,
    "15d": 15,
    "30d": 30,
  };
  const days = daysByPeriod[period];

  if (days) {
    const start = addDays(referenceDate, -(days - 1));
    const range = buildRange(start, referenceDate, period, settings);

    return {
      range,
      customStartDate: range.businessStartDate,
      customEndDate: range.businessEndDate,
    };
  }

  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const start = addDays(addMonths(referenceDate, -months), 1);
  const range = buildRange(start, referenceDate, period, settings);

  return {
    range,
    customStartDate: range.businessStartDate,
    customEndDate: range.businessEndDate,
  };
}

function buildPaymentRows(sales: SaleForReport[], netRevenue: number): ReportPaymentRow[] {
  const amounts = new Map<PaymentMethod, number>();
  const transactionCounts = new Map<PaymentMethod, number>();
  const saleIds = new Map<PaymentMethod, Set<string>>();

  for (const method of paymentMethodOrder) {
    amounts.set(method, 0);
    transactionCounts.set(method, 0);
    saleIds.set(method, new Set<string>());
  }

  for (const sale of sales) {
    let remaining = toNumber(sale.totalAmount);
    const orderedPayments = [...sale.payments].sort((first, second) => {
      if (first.method === PaymentMethod.CASH && second.method !== PaymentMethod.CASH) {
        return 1;
      }

      if (first.method !== PaymentMethod.CASH && second.method === PaymentMethod.CASH) {
        return -1;
      }

      return paymentMethodOrder.indexOf(first.method) - paymentMethodOrder.indexOf(second.method);
    });

    for (const payment of orderedPayments) {
      if (remaining <= 0) {
        break;
      }

      const appliedAmount = Math.min(toNumber(payment.amount), remaining);
      if (appliedAmount <= 0) {
        continue;
      }

      amounts.set(payment.method, round2((amounts.get(payment.method) ?? 0) + appliedAmount));
      transactionCounts.set(payment.method, (transactionCounts.get(payment.method) ?? 0) + 1);
      saleIds.get(payment.method)?.add(sale.id);
      remaining = round2(remaining - appliedAmount);
    }
  }

  return paymentMethodOrder.map((method) => {
    const amount = round2(amounts.get(method) ?? 0);
    const salesCount = saleIds.get(method)?.size ?? 0;

    return {
      method,
      label: paymentLabels[method],
      amount,
      salesCount,
      transactionCount: transactionCounts.get(method) ?? 0,
      sharePercent: toPercent(amount, netRevenue),
      averageTicket: salesCount > 0 ? round2(amount / salesCount) : 0,
    };
  });
}

async function getReportPeriodData(period: ReportPeriod, range: ReportRange): Promise<ReportPeriodData> {
  const completedSaleWhere = range.cashSessionId
    ? {
        status: SaleStatus.COMPLETED,
        cashSessionId: range.cashSessionId,
      }
    : {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: range.start,
          lt: range.end,
        },
      };
  const cancelledSaleWhere = range.cashSessionId
    ? {
        status: SaleStatus.CANCELLED,
        cashSessionId: range.cashSessionId,
      }
    : {
        status: SaleStatus.CANCELLED,
        createdAt: {
          gte: range.start,
          lt: range.end,
        },
      };
  const cashMovementWhere = range.cashSessionId
    ? {
        cashSessionId: range.cashSessionId,
      }
    : {
        createdAt: {
          gte: range.start,
          lt: range.end,
        },
      };

  const [sales, cancelledSalesCount, cashMovements, openingAmount] = await Promise.all([
    prisma.sale.findMany({
      where: completedSaleWhere,
      select: {
        id: true,
        subtotalAmount: true,
        discountAmount: true,
        totalAmount: true,
        items: {
          select: {
            productNameSnapshot: true,
            quantity: true,
            lineTotal: true,
            lineCostTotal: true,
            product: {
              select: {
                name: true,
                category: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          where: {
            status: PaymentStatus.APPROVED,
          },
          select: {
            method: true,
            amount: true,
          },
        },
      },
    }),
    prisma.sale.count({
      where: cancelledSaleWhere,
    }),
    prisma.cashMovement.findMany({
      where: cashMovementWhere,
      select: {
        type: true,
        amount: true,
      },
    }),
    getCashOpeningAmount(range),
  ]);

  let itemsCount = 0;
  let grossRevenue = 0;
  let discountAmount = 0;
  let netRevenue = 0;
  let totalCost = 0;

  const categoryMap = new Map<string, Omit<ReportCategoryRow, "profitSharePercent">>();
  const itemMap = new Map<string, Omit<ReportItemRow, "profitSharePercent">>();

  for (const sale of sales) {
    grossRevenue += toNumber(sale.subtotalAmount);
    discountAmount += toNumber(sale.discountAmount);
    netRevenue += toNumber(sale.totalAmount);

    for (const saleItem of sale.items) {
      const quantity = saleItem.quantity;
      const lineRevenue = toNumber(saleItem.lineTotal);
      const lineCost = toNumber(saleItem.lineCostTotal);
      const lineProfit = lineRevenue - lineCost;
      const category = saleItem.product?.category?.name ?? "Sem categoria";
      const itemName = saleItem.product?.name ?? saleItem.productNameSnapshot ?? "Item removido";

      itemsCount += quantity;
      totalCost += lineCost;

      const categoryAccumulator = categoryMap.get(category) ?? {
        category,
        quantity: 0,
        grossRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPercent: 0,
        roiOnCostPercent: 0,
      };
      categoryAccumulator.quantity += quantity;
      categoryAccumulator.grossRevenue += lineRevenue;
      categoryAccumulator.totalCost += lineCost;
      categoryAccumulator.grossProfit += lineProfit;
      categoryMap.set(category, categoryAccumulator);

      const itemKey = `${category}::${itemName}`;
      const itemAccumulator = itemMap.get(itemKey) ?? {
        category,
        item: itemName,
        quantity: 0,
        grossRevenue: 0,
        totalCost: 0,
        grossProfit: 0,
        grossMarginPercent: 0,
        roiOnCostPercent: 0,
      };
      itemAccumulator.quantity += quantity;
      itemAccumulator.grossRevenue += lineRevenue;
      itemAccumulator.totalCost += lineCost;
      itemAccumulator.grossProfit += lineProfit;
      itemMap.set(itemKey, itemAccumulator);
    }
  }

  const grossProfit = grossRevenue - discountAmount - totalCost;
  const paymentRows = buildPaymentRows(sales, netRevenue);
  const paymentTotal = round2(paymentRows.reduce((total, row) => total + row.amount, 0));
  const cashSalesAmount = paymentRows.find((row) => row.method === PaymentMethod.CASH)?.amount ?? 0;
  const supplyAmount = cashMovements
    .filter((movement) => movement.type === CashMovementType.SUPPLY)
    .reduce((total, movement) => total + toNumber(movement.amount), 0);
  const withdrawalAmount = cashMovements
    .filter((movement) => movement.type === CashMovementType.WITHDRAWAL)
    .reduce((total, movement) => total + toNumber(movement.amount), 0);

  const categoryRows = Array.from(categoryMap.values())
    .map((row) => ({
      ...row,
      grossRevenue: round2(row.grossRevenue),
      totalCost: round2(row.totalCost),
      grossProfit: round2(row.grossProfit),
      grossMarginPercent: toMarginPercent(row.grossProfit, row.grossRevenue),
      roiOnCostPercent: toRoiPercent(row.grossProfit, row.totalCost),
      profitSharePercent: toPercent(row.grossProfit, grossProfit),
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  const itemRows = Array.from(itemMap.values())
    .map((row) => ({
      ...row,
      grossRevenue: round2(row.grossRevenue),
      totalCost: round2(row.totalCost),
      grossProfit: round2(row.grossProfit),
      grossMarginPercent: toMarginPercent(row.grossProfit, row.grossRevenue),
      roiOnCostPercent: toRoiPercent(row.grossProfit, row.totalCost),
      profitSharePercent: toPercent(row.grossProfit, grossProfit),
    }))
    .sort((a, b) => b.grossRevenue - a.grossRevenue);

  const summary: ReportSummary = {
    salesCount: sales.length,
    cancelledSalesCount,
    itemsCount,
    averageTicket: sales.length > 0 ? round2(netRevenue / sales.length) : 0,
    grossRevenue: round2(grossRevenue),
    netRevenue: round2(netRevenue),
    discountAmount: round2(discountAmount),
    totalCost: round2(totalCost),
    grossProfit: round2(grossProfit),
    grossMarginPercent: toMarginPercent(grossProfit, netRevenue),
    roiOnCostPercent: toRoiPercent(grossProfit, totalCost),
    paymentTotal,
    reconciliationDifference: round2(netRevenue - paymentTotal),
  };

  return {
    period,
    label: periodLabel(period),
    range,
    summary,
    paymentRows,
    cashMovementSummary: {
      openingAmount: round2(openingAmount),
      cashSalesAmount: round2(cashSalesAmount),
      supplyAmount: round2(supplyAmount),
      withdrawalAmount: round2(withdrawalAmount),
      netCashFlow: round2(cashSalesAmount + supplyAmount - withdrawalAmount),
      finalCashBalance: round2(openingAmount + cashSalesAmount + supplyAmount - withdrawalAmount),
    },
    categoryRows,
    itemRows,
  };
}

export async function getReportsData(input: ReportsDataInput): Promise<ReportsData> {
  const now = new Date();
  const { customization } = await getBrandCustomizationSnapshot();
  const currentOperationalDay = input.date
    ? getOperationalDayRangeByBusinessDate(parseYmd(input.date) ?? getOperationalDayRange(now, customization).businessDate, customization)
    : getOperationalDayRange(now, customization);
  const referenceDate = currentOperationalDay.businessDate;
  const cashRange = await getOpenCashSessionRange(customization, referenceDate);
  const selectedPeriod = input.period ? resolvePeriod(input.period) : cashRange ? "cash" : "1d";

  const oneDayRange = getRangeForPeriod("1d", referenceDate, customization, input.startDate, input.endDate).range;
  const sevenDaysRange = getRangeForPeriod("7d", referenceDate, customization, input.startDate, input.endDate).range;
  const fifteenDaysRange = getRangeForPeriod("15d", referenceDate, customization, input.startDate, input.endDate).range;
  const thirtyDaysRange = getRangeForPeriod("30d", referenceDate, customization, input.startDate, input.endDate).range;
  const selectedRangeData =
    selectedPeriod === "cash" && cashRange
      ? {
          range: cashRange,
          customStartDate: cashRange.businessStartDate,
          customEndDate: cashRange.businessEndDate,
        }
      : getRangeForPeriod(
          selectedPeriod === "cash" ? "1d" : selectedPeriod,
          referenceDate,
          customization,
          input.startDate,
          input.endDate,
        );
  const activePeriod = selectedPeriod === "cash" && !cashRange ? "1d" : selectedPeriod;

  const [oneDay, sevenDays, fifteenDays, thirtyDays, active] = await Promise.all([
    getReportPeriodData("1d", oneDayRange),
    getReportPeriodData("7d", sevenDaysRange),
    getReportPeriodData("15d", fifteenDaysRange),
    getReportPeriodData("30d", thirtyDaysRange),
    getReportPeriodData(activePeriod, selectedRangeData.range),
  ]);

  return {
    generatedAt: now.toISOString(),
    referenceDate: formatYmd(referenceDate),
    customStartDate: selectedRangeData.customStartDate,
    customEndDate: selectedRangeData.customEndDate,
    selectedPeriod: activePeriod,
    active,
    oneDay,
    sevenDays,
    fifteenDays,
    thirtyDays,
  };
}

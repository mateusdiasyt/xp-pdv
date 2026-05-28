import { Prisma, SaleStatus } from "@prisma/client";

import { getBrandCustomizationSnapshot } from "@/application/customization/brand-customization-service";
import {
  buildOperationalChartBuckets,
  formatOperationalDateLabel,
  getDaysInOperationalMonth,
  getOperationalDayRange,
  getOperationalMonthRange,
  getPreviousOperationalDayRange,
  toGoalDate,
} from "@/domain/business-hours/operational-day";
import { countCategories } from "@/infrastructure/db/repositories/category-repository";
import { getMonthlyGoalPlanByDate } from "@/infrastructure/db/repositories/goal-repository";
import { countProducts, listLowStockProducts } from "@/infrastructure/db/repositories/product-repository";
import { prisma } from "@/lib/prisma";
import { countStockMovements } from "@/infrastructure/db/repositories/stock-repository";
import { countSuppliers } from "@/infrastructure/db/repositories/supplier-repository";
import { countUsers } from "@/infrastructure/db/repositories/user-repository";

function toNumber(value: Prisma.Decimal | null | undefined) {
  if (!value) {
    return 0;
  }

  return Number(value);
}

function growthPercent(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

function percentOfTarget(actual: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return (actual / target) * 100;
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100;
}

export async function getDashboardSummary() {
  const now = new Date();
  const { customization } = await getBrandCustomizationSnapshot();
  const operationalDay = getOperationalDayRange(now, customization);
  const previousOperationalDay = getPreviousOperationalDayRange(operationalDay, customization);
  const operationalMonth = getOperationalMonthRange(operationalDay, customization);
  const chartBuckets = buildOperationalChartBuckets(operationalDay, 14, customization);
  const firstChartBucket = chartBuckets[0] ?? operationalDay;
  const goalDate = toGoalDate(operationalDay);

  const [
    users,
    categories,
    suppliers,
    products,
    stockMovements,
    lowStockProducts,
    todayRevenueAggregate,
    yesterdayRevenueAggregate,
    todaySalesCount,
    yesterdaySalesCount,
    monthRevenueAggregate,
    previousMonthRevenueAggregate,
    recentSales,
    topProductsRaw,
    monthlyGoalPlan,
  ] = await Promise.all([
    countUsers(),
    countCategories(),
    countSuppliers(),
    countProducts(),
    countStockMovements(),
    listLowStockProducts(),
    prisma.sale.aggregate({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: operationalDay.start,
          lt: operationalDay.end,
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: previousOperationalDay.start,
          lt: previousOperationalDay.end,
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.sale.count({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: operationalDay.start,
          lt: operationalDay.end,
        },
      },
    }),
    prisma.sale.count({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: previousOperationalDay.start,
          lt: previousOperationalDay.end,
        },
      },
    }),
    prisma.sale.aggregate({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: operationalMonth.start,
          lt: operationalMonth.end,
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.sale.aggregate({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: operationalMonth.previousStart,
          lt: operationalMonth.start,
        },
      },
      _sum: {
        totalAmount: true,
      },
    }),
    prisma.sale.findMany({
      where: {
        status: SaleStatus.COMPLETED,
        createdAt: {
          gte: firstChartBucket.start,
          lt: operationalDay.end,
        },
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
    prisma.saleItem.groupBy({
      by: ["productId"],
      where: {
        sale: {
          status: SaleStatus.COMPLETED,
          createdAt: {
            gte: operationalMonth.start,
            lt: operationalMonth.end,
          },
        },
      },
      _sum: {
        quantity: true,
        lineTotal: true,
      },
      orderBy: {
        _sum: {
          quantity: "desc",
        },
      },
      take: 6,
    }),
    getMonthlyGoalPlanByDate(goalDate),
  ]);

  const todayRevenue = toNumber(todayRevenueAggregate._sum.totalAmount);
  const yesterdayRevenue = toNumber(yesterdayRevenueAggregate._sum.totalAmount);
  const monthRevenue = toNumber(monthRevenueAggregate._sum.totalAmount);
  const previousMonthRevenue = toNumber(previousMonthRevenueAggregate._sum.totalAmount);

  const chartMap = new Map<string, { revenue: number; orders: number }>();
  for (const bucket of chartBuckets) {
    chartMap.set(bucket.businessDateKey, { revenue: 0, orders: 0 });
  }

  for (const sale of recentSales) {
    const bucket = chartBuckets.find((item) => sale.createdAt >= item.start && sale.createdAt < item.end);

    if (!bucket) {
      continue;
    }

    const key = bucket.businessDateKey;
    const item = chartMap.get(key);
    if (!item) {
      continue;
    }

    item.revenue += Number(sale.totalAmount);
    item.orders += 1;
  }

  const chart = Array.from(chartMap.entries()).map(([date, values]) => ({
    date,
    label: formatOperationalDateLabel(date),
    revenue: Number(values.revenue.toFixed(2)),
    orders: values.orders,
  }));

  const topProductIds = topProductsRaw.map((item) => item.productId);
  const topProductRecords =
    topProductIds.length > 0
      ? await prisma.product.findMany({
          where: {
            id: {
              in: topProductIds,
            },
          },
          select: {
            id: true,
            name: true,
            sku: true,
          },
        })
      : [];
  const productMap = new Map(topProductRecords.map((product) => [product.id, product]));

  const topProducts = topProductsRaw.map((item) => {
    const product = productMap.get(item.productId);
    return {
      productId: item.productId,
      name: product?.name ?? "Produto removido",
      sku: product?.sku ?? "-",
      quantity: Number(item._sum.quantity ?? 0),
      revenue: Number(item._sum.lineTotal ?? 0),
    };
  });

  const totalDaysInCurrentMonth = getDaysInOperationalMonth(operationalDay);
  const elapsedDaysInCurrentMonth = Math.min(operationalDay.businessDate.day, totalDaysInCurrentMonth);

  const goal = monthlyGoalPlan
    ? {
        monthStart: monthlyGoalPlan.monthStart,
        revenueTarget: Number(monthlyGoalPlan.dailyRevenueTarget),
        revenueActual: todayRevenue,
        revenuePercent: percentOfTarget(
          todayRevenue,
          Number(monthlyGoalPlan.dailyRevenueTarget),
        ),
        dailyBalance: roundCurrency(todayRevenue - Number(monthlyGoalPlan.dailyRevenueTarget)),
        monthRevenueActual: monthRevenue,
        monthExpectedToDate: roundCurrency(Number(monthlyGoalPlan.dailyRevenueTarget) * elapsedDaysInCurrentMonth),
        monthBalanceToDate: roundCurrency(
          monthRevenue - Number(monthlyGoalPlan.dailyRevenueTarget) * elapsedDaysInCurrentMonth,
        ),
        remainingDaysInCurrentMonth: Math.max(totalDaysInCurrentMonth - elapsedDaysInCurrentMonth, 0),
        recommendedDailyTarget: roundCurrency(
          Math.max(totalDaysInCurrentMonth - elapsedDaysInCurrentMonth, 0) > 0
            ? Math.max(Number(monthlyGoalPlan.monthlyRevenueTarget) - monthRevenue, 0) /
                Math.max(totalDaysInCurrentMonth - elapsedDaysInCurrentMonth, 1)
            : 0,
        ),
      }
    : null;

  return {
    users,
    categories,
    suppliers,
    products,
    stockMovements,
    lowStockProducts,
    todayRevenue,
    todaySalesCount,
    revenueGrowthPercent: growthPercent(todayRevenue, yesterdayRevenue),
    salesGrowthPercent: growthPercent(todaySalesCount, yesterdaySalesCount),
    monthRevenue,
    monthGrowthPercent: growthPercent(monthRevenue, previousMonthRevenue),
    operationalDay: {
      businessDate: operationalDay.businessDateKey,
      startsAt: operationalDay.startsAt,
      endsAt: operationalDay.endsAt,
      timezone: operationalDay.timezone,
    },
    chart,
    topProducts,
    goal,
  };
}

import { CouponDiscountType, Prisma, ProductKind, RecordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type CouponRedemptionInput = {
  couponId: string;
  codeSnapshot: string;
  discountTypeSnapshot: CouponDiscountType;
  discountValueSnapshot: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
};

type PrismaTx = Prisma.TransactionClient;

export async function listCoupons() {
  return prisma.coupon.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      categories: {
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      products: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
    },
  });
}

export async function listCouponCategories() {
  return prisma.productCategory.findMany({
    where: {
      status: RecordStatus.ACTIVE,
    },
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function listCouponProducts() {
  return prisma.product.findMany({
    where: {
      status: RecordStatus.ACTIVE,
      pdvVisible: true,
      kind: ProductKind.STANDARD,
    },
    select: {
      id: true,
      name: true,
      sku: true,
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
}

export async function listActiveCouponsForPdv() {
  const now = new Date();

  return prisma.coupon.findMany({
    where: {
      status: RecordStatus.ACTIVE,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    select: {
      id: true,
      code: true,
      name: true,
      discountType: true,
      discountValue: true,
      maxDiscountAmount: true,
      minSubtotalAmount: true,
      usageLimit: true,
      usedCount: true,
      products: {
        select: {
          productId: true,
        },
      },
      categories: {
        select: {
          categoryId: true,
        },
      },
    },
    orderBy: {
      code: "asc",
    },
  });
}

export async function upsertCoupon(data: {
  couponId?: string;
  code: string;
  name: string;
  description?: string | null;
  discountType: CouponDiscountType;
  discountValue: Prisma.Decimal;
  maxDiscountAmount?: Prisma.Decimal | null;
  minSubtotalAmount?: Prisma.Decimal | null;
  usageLimit?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  status: RecordStatus;
  productIds: string[];
  categoryIds: string[];
}) {
  const productLinks = data.productIds.map((productId) => ({ productId }));
  const categoryLinks = data.categoryIds.map((categoryId) => ({ categoryId }));

  if (data.couponId) {
    return prisma.coupon.update({
      where: { id: data.couponId },
      data: {
        code: data.code,
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        maxDiscountAmount: data.maxDiscountAmount,
        minSubtotalAmount: data.minSubtotalAmount,
        usageLimit: data.usageLimit,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        status: data.status,
        products: {
          deleteMany: {},
          create: productLinks,
        },
        categories: {
          deleteMany: {},
          create: categoryLinks,
        },
      },
    });
  }

  return prisma.coupon.create({
    data: {
      code: data.code,
      name: data.name,
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxDiscountAmount: data.maxDiscountAmount,
      minSubtotalAmount: data.minSubtotalAmount,
      usageLimit: data.usageLimit,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: data.status,
      products: {
        create: productLinks,
      },
      categories: {
        create: categoryLinks,
      },
    },
  });
}

export async function updateCouponStatus(data: { couponId: string; status: RecordStatus }) {
  return prisma.coupon.update({
    where: { id: data.couponId },
    data: {
      status: data.status,
    },
  });
}

export async function resolveCouponRedemptionInTransaction(
  tx: PrismaTx,
  code: string,
  subtotalAmount: Prisma.Decimal,
  productLineTotals: Array<{ productId: string; categoryId: string; lineTotal: Prisma.Decimal }>,
): Promise<CouponRedemptionInput | null> {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  const now = new Date();
  const coupon = await tx.coupon.findUnique({
    where: { code: normalizedCode },
    include: {
      products: {
        select: {
          productId: true,
        },
      },
      categories: {
        select: {
          categoryId: true,
        },
      },
    },
  });

  if (!coupon || coupon.status !== RecordStatus.ACTIVE) {
    throw new Error("Cupom invalido ou inativo.");
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    throw new Error("Cupom ainda nao iniciou.");
  }

  if (coupon.endsAt && coupon.endsAt < now) {
    throw new Error("Cupom expirado.");
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new Error("Cupom atingiu o limite de uso.");
  }

  if (coupon.minSubtotalAmount && subtotalAmount.lessThan(coupon.minSubtotalAmount)) {
    throw new Error(`Cupom exige venda minima de R$ ${coupon.minSubtotalAmount.toFixed(2)}.`);
  }

  const allowedProductIds = new Set(coupon.products.map((product) => product.productId));
  const allowedCategoryIds = new Set(coupon.categories.map((category) => category.categoryId));
  const eligibleSubtotal =
    allowedProductIds.size === 0 && allowedCategoryIds.size === 0
      ? subtotalAmount
      : productLineTotals
          .filter((line) => allowedProductIds.has(line.productId) || allowedCategoryIds.has(line.categoryId))
          .reduce((sum, line) => sum.plus(line.lineTotal), new Prisma.Decimal(0));

  if (eligibleSubtotal.lessThanOrEqualTo(0)) {
    throw new Error("Cupom nao vale para os produtos desta venda.");
  }

  let discountAmount =
    coupon.discountType === CouponDiscountType.PERCENTAGE
      ? eligibleSubtotal.times(coupon.discountValue).dividedBy(100)
      : coupon.discountValue;

  if (coupon.maxDiscountAmount && discountAmount.greaterThan(coupon.maxDiscountAmount)) {
    discountAmount = coupon.maxDiscountAmount;
  }

  if (discountAmount.greaterThan(eligibleSubtotal)) {
    discountAmount = eligibleSubtotal;
  }

  discountAmount = discountAmount.toDecimalPlaces(2);

  if (discountAmount.lessThanOrEqualTo(0)) {
    throw new Error("Cupom nao gerou desconto para esta venda.");
  }

  if (coupon.usageLimit !== null) {
    const updated = await tx.coupon.updateMany({
      where: {
        id: coupon.id,
        usedCount: { lt: coupon.usageLimit },
      },
      data: {
        usedCount: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      throw new Error("Cupom atingiu o limite de uso.");
    }
  } else {
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        usedCount: { increment: 1 },
      },
    });
  }

  return {
    couponId: coupon.id,
    codeSnapshot: coupon.code,
    discountTypeSnapshot: coupon.discountType,
    discountValueSnapshot: coupon.discountValue,
    discountAmount,
  };
}

import { CouponDiscountType } from "@prisma/client";

export type PdvCouponOption = {
  id: string;
  code: string;
  name: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minSubtotalAmount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  productIds: string[];
  categoryIds: string[];
};

export type CouponLine = {
  productId: string;
  categoryId: string;
  lineTotalInCents: number;
};

export function normalizeCouponCode(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function calculateCouponDiscountInCents(input: {
  coupon: PdvCouponOption;
  subtotalInCents: number;
  lines: CouponLine[];
}) {
  const { coupon, subtotalInCents, lines } = input;
  const allowedProductIds = new Set(coupon.productIds);
  const allowedCategoryIds = new Set(coupon.categoryIds);
  const eligibleSubtotalInCents =
    allowedProductIds.size === 0 && allowedCategoryIds.size === 0
      ? subtotalInCents
      : lines
          .filter((line) => allowedProductIds.has(line.productId) || allowedCategoryIds.has(line.categoryId))
          .reduce((sum, line) => sum + line.lineTotalInCents, 0);

  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
    return { discountInCents: 0, message: "Limite atingido" };
  }

  if (coupon.minSubtotalAmount && subtotalInCents < Math.round(coupon.minSubtotalAmount * 100)) {
    return { discountInCents: 0, message: "Venda abaixo do minimo" };
  }

  if (eligibleSubtotalInCents <= 0) {
    return { discountInCents: 0, message: "Nao vale para estes produtos" };
  }

  const rawDiscount =
    coupon.discountType === CouponDiscountType.PERCENTAGE
      ? Math.round((eligibleSubtotalInCents * coupon.discountValue) / 100)
      : Math.round(coupon.discountValue * 100);

  const cappedDiscount =
    coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0
      ? Math.min(rawDiscount, Math.round(coupon.maxDiscountAmount * 100))
      : rawDiscount;

  return {
    discountInCents: Math.max(0, Math.min(cappedDiscount, eligibleSubtotalInCents)),
    message: null,
  };
}

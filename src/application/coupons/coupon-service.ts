import { Prisma } from "@prisma/client";

import { couponSchema, couponStatusSchema } from "@/domain/coupons/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { parseDecimalInput } from "@/lib/decimal";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  listActiveCouponsForPdv,
  listCouponCategories,
  listCouponProducts,
  listCoupons,
  updateCouponStatus,
  upsertCoupon,
} from "@/infrastructure/db/repositories/coupon-repository";

function parseOptionalDecimal(value?: string) {
  return value ? parseDecimalInput(value) : null;
}

function parseOptionalDate(value?: string) {
  return value ? new Date(value) : null;
}

function parseOptionalInt(value?: string) {
  return value ? Number(value) : null;
}

export async function getCouponsPageData() {
  const [coupons, products, categories] = await Promise.all([
    listCoupons(),
    listCouponProducts(),
    listCouponCategories(),
  ]);
  return { coupons, products, categories };
}

export async function getPdvCoupons() {
  return listActiveCouponsForPdv();
}

export async function saveCouponRecord(input: FormData, actorId?: string) {
  const parsed = couponSchema.parse({
    couponId: input.get("couponId"),
    code: input.get("code"),
    name: input.get("name"),
    description: input.get("description"),
    discountType: input.get("discountType"),
    discountValue: input.get("discountValue"),
    maxDiscountAmount: input.get("maxDiscountAmount"),
    minSubtotalAmount: input.get("minSubtotalAmount"),
    usageLimit: input.get("usageLimit"),
    startsAt: input.get("startsAt"),
    endsAt: input.get("endsAt"),
    status: input.get("status"),
  });

  const productIds = [...new Set(input.getAll("productId").map((value) => String(value)).filter(Boolean))];
  const categoryIds = [...new Set(input.getAll("categoryId").map((value) => String(value)).filter(Boolean))];
  const coupon = await upsertCoupon({
    couponId: emptyToUndefined(parsed.couponId),
    code: parsed.code,
    name: parsed.name,
    description: emptyToUndefined(parsed.description),
    discountType: parsed.discountType,
    discountValue: parseDecimalInput(parsed.discountValue),
    maxDiscountAmount: parseOptionalDecimal(parsed.maxDiscountAmount),
    minSubtotalAmount: parseOptionalDecimal(parsed.minSubtotalAmount),
    usageLimit: parseOptionalInt(parsed.usageLimit),
    startsAt: parseOptionalDate(parsed.startsAt),
    endsAt: parseOptionalDate(parsed.endsAt),
    status: parsed.status,
    productIds,
    categoryIds,
  });

  await createAuditLog({
    userId: actorId,
    action: parsed.couponId ? "coupons.update" : "coupons.create",
    entity: "Coupon",
    entityId: coupon.id,
    metadata: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue.toString(),
      productCount: productIds.length,
      categoryCount: categoryIds.length,
    } satisfies Prisma.JsonObject,
  });
}

export async function updateCouponStatusRecord(input: FormData, actorId?: string) {
  const parsed = couponStatusSchema.parse({
    couponId: input.get("couponId"),
    status: input.get("status"),
  });

  const coupon = await updateCouponStatus(parsed);

  await createAuditLog({
    userId: actorId,
    action: "coupons.status.update",
    entity: "Coupon",
    entityId: coupon.id,
    metadata: {
      code: coupon.code,
      status: coupon.status,
    },
  });
}

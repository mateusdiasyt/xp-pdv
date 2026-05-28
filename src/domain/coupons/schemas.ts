import { CouponDiscountType, RecordStatus } from "@prisma/client";
import { z } from "zod";

const decimalRegex = /^\d+([.,]\d{1,2})?$/;
const optionalDecimal = z.string().regex(decimalRegex, "Valor invalido").optional().or(z.literal(""));
const optionalInt = z.string().regex(/^\d+$/, "Numero invalido").optional().or(z.literal(""));

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : "";
}

export const couponSchema = z
  .object({
    couponId: z.string().optional().or(z.literal("")),
    code: z.preprocess(
      normalizeCode,
      z.string().min(3, "Cupom muito curto").max(32, "Cupom muito longo").regex(/^[A-Z0-9_-]+$/, "Use letras, numeros, _ ou -"),
    ),
    name: z.string().trim().min(2, "Nome obrigatorio").max(80, "Nome muito longo"),
    description: z.string().trim().max(240, "Descricao muito longa").optional().or(z.literal("")),
    discountType: z.nativeEnum(CouponDiscountType),
    discountValue: z.string().regex(decimalRegex, "Desconto invalido"),
    maxDiscountAmount: optionalDecimal,
    minSubtotalAmount: optionalDecimal,
    usageLimit: optionalInt,
    startsAt: z.string().optional().or(z.literal("")),
    endsAt: z.string().optional().or(z.literal("")),
    status: z.nativeEnum(RecordStatus),
  })
  .superRefine((value, context) => {
    const discountValue = Number(value.discountValue.replace(",", "."));
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      context.addIssue({ code: "custom", path: ["discountValue"], message: "Desconto precisa ser maior que zero" });
    }

    if (value.discountType === CouponDiscountType.PERCENTAGE && discountValue > 100) {
      context.addIssue({ code: "custom", path: ["discountValue"], message: "Percentual maximo: 100%" });
    }

    if (value.startsAt && value.endsAt && new Date(value.startsAt) > new Date(value.endsAt)) {
      context.addIssue({ code: "custom", path: ["endsAt"], message: "Fim precisa ser depois do inicio" });
    }
  });

export const couponStatusSchema = z.object({
  couponId: z.string().min(1, "Cupom obrigatorio"),
  status: z.nativeEnum(RecordStatus),
});

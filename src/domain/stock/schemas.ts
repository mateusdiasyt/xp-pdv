import { StockMovementType } from "@prisma/client";
import { z } from "zod";

const decimalRegex = /^\d+(\.\d{1,4})?$/;

export const createStockMovementSchema = z.object({
  productId: z.string().min(1, "Produto obrigatorio"),
  type: z.nativeEnum(StockMovementType),
  quantity: z.coerce.number().int().positive("Quantidade deve ser positiva"),
  unitCost: z.string().regex(decimalRegex, "Valor unitario invalido").optional().or(z.literal("")),
  note: z.string().max(280, "Observacao muito longa").optional().or(z.literal("")),
});

export type CreateStockMovementInput = z.infer<typeof createStockMovementSchema>;

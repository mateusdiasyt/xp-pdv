import { AccountPayableStatus } from "@prisma/client";
import { z } from "zod";

const moneySchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().replace(/\./g, "").replace(",", ".");
}, z.coerce.number().positive("Informe um valor maior que zero."));

const dueDateSchema = z.coerce.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida.");

export const createAccountPayableSchema = z.object({
  name: z.coerce.string().trim().min(2, "Informe o nome da conta.").max(120, "Nome muito longo."),
  amount: moneySchema,
  dueDate: dueDateSchema,
  installmentTotal: z.coerce.number().int().min(1).max(120).default(1),
  notes: z.coerce.string().trim().max(240).optional(),
});

export const updateAccountPayableStatusSchema = z.object({
  accountId: z.coerce.string().trim().min(1, "Conta invalida."),
  status: z.nativeEnum(AccountPayableStatus),
});

export const uploadAccountPayableReceiptSchema = z.object({
  accountId: z.coerce.string().trim().min(1, "Conta invalida."),
  receiptDataUrl: z.coerce.string().trim().min(1, "Anexe um comprovante.").max(1_200_000, "Comprovante muito grande."),
  receiptFileName: z.coerce.string().trim().max(180).optional(),
  receiptMimeType: z.coerce.string().trim().max(80).optional(),
});

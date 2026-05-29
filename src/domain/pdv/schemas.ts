import { PaymentMethod, RefundStatus } from "@prisma/client";
import { z } from "zod";

const decimalRegex = /^\d+([.,]\d{1,2})?$/;

export const createSaleSchema = z.object({
  cashSessionId: z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, "Sessao de caixa obrigatoria"),
  ),
  customerName: z.string().max(120, "Nome do cliente muito longo").optional().or(z.literal("")),
  couponCode: z.string().trim().max(32, "Cupom muito longo").optional().or(z.literal("")),
  discountAmount: z.string().regex(decimalRegex, "Desconto invalido"),
  cashReceived: z.string().regex(decimalRegex, "Valor recebido invalido").optional().or(z.literal("")),
});

export const createComandaSchema = z.object({
  number: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      if (typeof value === "string") {
        const normalized = value.trim();
        if (!normalized) {
          return undefined;
        }

        const parsed = Number(normalized);
        return Number.isNaN(parsed) ? undefined : parsed;
      }

      if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
      }

      return undefined;
    },
    z
      .number({ message: "Informe o numero da comanda." })
      .int("Numero da comanda deve ser inteiro.")
      .min(1, "Numero da comanda invalido.")
      .max(999, "Numero maximo da comanda: 999."),
  ),
  customerId: z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "string") {
        return value.trim();
      }

      return "";
    },
    z.union([z.literal(""), z.string().cuid("Cliente selecionado invalido.")]),
  ),
  customerName: z.string().trim().max(120, "Nome da comanda muito longo").optional().or(z.literal("")),
  isWalkIn: z.preprocess(
    (value) => value === true || value === "true" || value === "on" || value === "1",
    z.boolean(),
  ),
});

export const addComandaItemSchema = z.object({
  comandaId: z.string().min(1, "Comanda obrigatoria"),
  productId: z.string().min(1, "Produto obrigatorio"),
  quantity: z.coerce.number().int().positive("Quantidade invalida"),
});

export const removeComandaItemSchema = z.object({
  comandaId: z.string().min(1, "Comanda obrigatoria"),
  productId: z.string().min(1, "Produto obrigatorio"),
});

export const updateComandaItemSchema = z.object({
  comandaId: z.string().min(1, "Comanda obrigatoria"),
  productId: z.string().min(1, "Produto obrigatorio"),
  quantity: z.coerce.number().int().positive("Quantidade invalida"),
});

export const updateComandaCustomerSchema = z.object({
  comandaId: z.string().min(1, "Comanda obrigatoria"),
  customerId: z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return "";
      }

      if (typeof value === "string") {
        return value.trim();
      }

      return "";
    },
    z.union([z.literal(""), z.string().cuid("Cliente selecionado invalido.")]),
  ),
  customerName: z.string().trim().max(120, "Nome da comanda muito longo").optional().or(z.literal("")),
});

export const closeComandaSchema = z.object({
  comandaId: z.string().min(1, "Comanda obrigatoria"),
  cashSessionId: z.string().min(1, "Sessao de caixa obrigatoria"),
  couponCode: z.string().trim().max(32, "Cupom muito longo").optional().or(z.literal("")),
  discountAmount: z.string().regex(decimalRegex, "Desconto invalido"),
  cashReceived: z.string().regex(decimalRegex, "Valor recebido invalido").optional().or(z.literal("")),
});

export const saleItemSchema = z.object({
  productId: z.string().min(1, "Produto obrigatorio"),
  quantity: z.number().int().positive("Quantidade invalida"),
});

export const salePaymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod),
  amount: z.string().regex(decimalRegex, "Valor de pagamento invalido"),
  approvedAmount: z.string().regex(decimalRegex, "Valor aprovado invalido").optional().or(z.literal("")),
  cardBrand: z.string().trim().max(40, "Bandeira muito longa").optional().or(z.literal("")),
  cardLast4: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "Ultimos digitos do cartao invalidos")
    .optional()
    .or(z.literal("")),
  nsu: z.string().trim().max(80, "NSU muito longo").optional().or(z.literal("")),
  authorizationCode: z.string().trim().max(80, "Codigo de autorizacao muito longo").optional().or(z.literal("")),
  terminalId: z.string().trim().max(80, "Identificacao da maquininha muito longa").optional().or(z.literal("")),
  externalTransactionId: z.string().trim().max(120, "ID da transacao muito longo").optional().or(z.literal("")),
  receiptText: z.string().trim().max(1000, "Comprovante muito longo").optional().or(z.literal("")),
});

export const cancelSaleSchema = z.object({
  saleId: z.string().min(1, "Venda obrigatoria"),
  cancelReason: z.string().min(3, "Informe o motivo do cancelamento").max(280, "Motivo muito longo"),
  refundStatus: z.nativeEnum(RefundStatus).default(RefundStatus.PENDING),
  refundMethod: z.nativeEnum(PaymentMethod).optional().or(z.literal("")),
  refundAmount: z.string().regex(decimalRegex, "Valor de estorno invalido").optional().or(z.literal("")),
  refundNsu: z.string().trim().max(80, "NSU muito longo").optional().or(z.literal("")),
  refundAuthorizationCode: z.string().trim().max(80, "Codigo de autorizacao muito longo").optional().or(z.literal("")),
  refundTerminalId: z.string().trim().max(80, "Identificacao da maquininha muito longa").optional().or(z.literal("")),
  refundExternalTransactionId: z.string().trim().max(120, "ID da transacao muito longo").optional().or(z.literal("")),
  refundReceiptText: z.string().trim().max(1000, "Comprovante muito longo").optional().or(z.literal("")),
});

export const cancelComandaSchema = z.object({
  comandaId: z.string().min(1, "Comanda obrigatoria"),
  cancelReason: z.string().min(3, "Informe o motivo do cancelamento").max(280, "Motivo muito longo"),
});

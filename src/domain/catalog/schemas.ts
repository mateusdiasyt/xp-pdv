import { ProductKind, RecordStatus } from "@prisma/client";
import { z } from "zod";

const decimalRegex = /^\d+(\.\d{1,2})?$/;
const imagePathRegex = /^(https?:\/\/.+|\/.+)$/i;
const imageDataUrlRegex = /^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=]+$/;
const ncmRegex = /^\d{8}$/;
const cnaeRegex = /^\d{7}$/;

export const createCategorySchema = z.object({
  name: z.string().min(2, "Nome da categoria obrigatorio"),
  slug: z
    .string()
    .min(2, "Slug obrigatoria")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minusculas, numeros e hifen"),
  description: z.string().max(500, "Descricao longa demais").optional().or(z.literal("")),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
});

export const createSupplierSchema = z.object({
  tradeName: z.string().min(2, "Nome fantasia obrigatorio"),
  legalName: z.string().max(120).optional().or(z.literal("")),
  document: z.string().max(24).optional().or(z.literal("")),
  email: z.string().email("Email invalido").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
});

const productFiscalFieldsRefinement = (
  data: {
    kind: ProductKind;
    ncm?: string;
    serviceCnae?: string;
    gameplayPlanCode?: string;
    gameplayDurationMinutes?: number;
  },
  context: z.RefinementCtx,
) => {
  if (data.kind === ProductKind.STANDARD && !data.ncm?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["ncm"],
      message: "Informe o NCM fiscal com 8 digitos.",
    });
  }

  if (data.kind !== ProductKind.STANDARD && !data.serviceCnae?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["serviceCnae"],
      message: "Informe o CNAE do servico.",
    });
  }

  if (data.kind !== ProductKind.GAMEPLAY) {
    return;
  }

  if (!data.gameplayPlanCode?.trim()) {
    context.addIssue({
      code: "custom",
      path: ["gameplayPlanCode"],
      message: "Informe o codigo do plano de gameplay.",
    });
  }

  if (!data.gameplayDurationMinutes) {
    context.addIssue({
      code: "custom",
      path: ["gameplayDurationMinutes"],
      message: "Informe a duracao do gameplay em minutos.",
    });
  }
};

const productSchemaBase = z.object({
  name: z.string().min(2, "Nome obrigatorio"),
  sku: z.string().min(2, "SKU obrigatorio"),
  ncm: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      return value.replace(/\D/g, "");
    },
    z.string().regex(ncmRegex, "NCM invalido. Use 8 digitos.").optional().or(z.literal("")),
  ),
  description: z.string().max(800).optional().or(z.literal("")),
  imageUrl: z
    .string()
    .max(4_000_000, "Imagem muito longa")
    .optional()
    .or(z.literal(""))
    .refine(
      (value) => !value || imagePathRegex.test(value) || imageDataUrlRegex.test(value),
      "Informe uma imagem valida.",
    ),
  categoryId: z.string().min(1, "Categoria obrigatoria"),
  supplierId: z.string().optional().or(z.literal("")),
  kind: z.nativeEnum(ProductKind).default(ProductKind.STANDARD),
  tracksStock: z.preprocess((value) => {
    if (value === true || value === "true" || value === "on") {
      return true;
    }

    if (value === false || value === "false" || value === "off") {
      return false;
    }

    return undefined;
  }, z.boolean().default(true)),
  serviceCnae: z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      return value.replace(/\D/g, "");
    },
    z.string().regex(cnaeRegex, "CNAE invalido. Use 7 digitos.").optional().or(z.literal("")),
  ),
  serviceDescription: z.string().max(160, "Descricao fiscal do servico muito longa").optional().or(z.literal("")),
  gameplayPlanCode: z.string().max(80, "Codigo do plano muito longo").optional().or(z.literal("")),
  gameplayDurationMinutes: z.preprocess(
    (value) => {
      if (value === null || value === undefined || value === "") {
        return undefined;
      }

      return Number(value);
    },
    z.number().int("Duracao deve ser um numero inteiro").positive("Duracao deve ser maior que zero").optional(),
  ),
  costPrice: z.string().regex(decimalRegex, "Custo invalido"),
  salePrice: z.string().regex(decimalRegex, "Preco invalido"),
  minStock: z.coerce.number().int().min(0, "Estoque minimo invalido"),
  currentStock: z.coerce.number().int().min(0, "Estoque atual invalido"),
  status: z.nativeEnum(RecordStatus).default(RecordStatus.ACTIVE),
});

export const createProductSchema = productSchemaBase.superRefine(productFiscalFieldsRefinement);

export const updateProductSchema = productSchemaBase.extend({
  productId: z.string().min(1, "Produto obrigatorio"),
}).superRefine(productFiscalFieldsRefinement);

export const updateProductStatusSchema = z.object({
  productId: z.string().min(1, "Produto obrigatorio"),
  status: z.nativeEnum(RecordStatus),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

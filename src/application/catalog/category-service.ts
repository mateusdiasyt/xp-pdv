import { createCategorySchema } from "@/domain/catalog/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  createCategory,
  listCategories,
  updateCategoryFiscalRules,
  updateCategoryStatus,
} from "@/infrastructure/db/repositories/category-repository";
import { RecordStatus } from "@prisma/client";
import { z } from "zod";

export async function getCategories(search?: string) {
  return listCategories(search);
}

export async function createCategoryRecord(input: FormData, actorId?: string) {
  const parsed = createCategorySchema.parse({
    name: input.get("name"),
    slug: input.get("slug"),
    description: input.get("description"),
    fiscalCfop: input.get("fiscalCfop"),
    fiscalCsosn: input.get("fiscalCsosn"),
    fiscalIcmsOrigin: input.get("fiscalIcmsOrigin"),
    status: input.get("status"),
  });

  const created = await createCategory({
    name: parsed.name.trim(),
    slug: parsed.slug.trim(),
    description: emptyToUndefined(parsed.description),
    fiscalCfop: emptyToUndefined(parsed.fiscalCfop),
    fiscalCsosn: emptyToUndefined(parsed.fiscalCsosn),
    fiscalIcmsOrigin: emptyToUndefined(parsed.fiscalIcmsOrigin),
    status: parsed.status,
  });

  await createAuditLog({
    userId: actorId,
    action: "categories.create",
    entity: "ProductCategory",
    entityId: created.id,
    metadata: {
      name: created.name,
      slug: created.slug,
      fiscalCfop: created.fiscalCfop,
      fiscalCsosn: created.fiscalCsosn,
      fiscalIcmsOrigin: created.fiscalIcmsOrigin,
    },
  });
}

const updateCategoryFiscalRulesSchema = z.object({
  categoryId: z.string().min(1, "Categoria obrigatoria"),
  fiscalCfop: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
    z.string().regex(/^\d{4}$/, "CFOP invalido. Use 4 digitos.").optional().or(z.literal("")),
  ),
  fiscalCsosn: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
    z.string().regex(/^\d{3}$/, "CSOSN invalido. Use 3 digitos.").optional().or(z.literal("")),
  ),
  fiscalIcmsOrigin: z.preprocess(
    (value) => (typeof value === "string" ? value.replace(/\D/g, "") : value),
    z.string().regex(/^[0-8]$/, "Origem ICMS invalida. Use um digito de 0 a 8.").optional().or(z.literal("")),
  ),
});

export async function updateCategoryFiscalRulesRecord(input: FormData, actorId?: string) {
  const parsed = updateCategoryFiscalRulesSchema.parse({
    categoryId: input.get("categoryId"),
    fiscalCfop: input.get("fiscalCfop"),
    fiscalCsosn: input.get("fiscalCsosn"),
    fiscalIcmsOrigin: input.get("fiscalIcmsOrigin"),
  });

  const updated = await updateCategoryFiscalRules({
    categoryId: parsed.categoryId,
    fiscalCfop: emptyToUndefined(parsed.fiscalCfop),
    fiscalCsosn: emptyToUndefined(parsed.fiscalCsosn),
    fiscalIcmsOrigin: emptyToUndefined(parsed.fiscalIcmsOrigin),
  });

  await createAuditLog({
    userId: actorId,
    action: "categories.fiscal.update",
    entity: "ProductCategory",
    entityId: updated.id,
    metadata: {
      fiscalCfop: updated.fiscalCfop,
      fiscalCsosn: updated.fiscalCsosn,
      fiscalIcmsOrigin: updated.fiscalIcmsOrigin,
    },
  });
}

const updateCategoryStatusSchema = z.object({
  categoryId: z.string().min(1, "Categoria obrigatoria"),
  status: z.nativeEnum(RecordStatus),
});

export async function updateCategoryStatusRecord(input: FormData, actorId?: string) {
  const parsed = updateCategoryStatusSchema.parse({
    categoryId: input.get("categoryId"),
    status: input.get("status"),
  });

  const updated = await updateCategoryStatus(parsed);

  await createAuditLog({
    userId: actorId,
    action: "categories.status.update",
    entity: "ProductCategory",
    entityId: updated.id,
    metadata: { status: updated.status },
  });
}

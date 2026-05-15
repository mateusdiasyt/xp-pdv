import { Prisma, ProductKind, RecordStatus } from "@prisma/client";

import { createProductSchema, updateProductSchema, updateProductStatusSchema } from "@/domain/catalog/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import { listCategoryOptions } from "@/infrastructure/db/repositories/category-repository";
import {
  createProduct,
  listProductOptions,
  listProducts,
  updateProduct,
  updateProductStatus,
} from "@/infrastructure/db/repositories/product-repository";
import { listSupplierOptions } from "@/infrastructure/db/repositories/supplier-repository";

function calculateMargin(costPrice: Prisma.Decimal, salePrice: Prisma.Decimal) {
  if (salePrice.equals(0)) {
    return new Prisma.Decimal(0);
  }

  return salePrice.minus(costPrice).dividedBy(salePrice).times(100).toDecimalPlaces(2);
}

export async function getProducts(filters?: {
  search?: string;
  status?: RecordStatus;
  categoryId?: string;
}) {
  return listProducts(filters);
}

export async function getProductOptions() {
  return listProductOptions();
}

export async function getProductFormOptions() {
  const [categories, suppliers] = await Promise.all([listCategoryOptions(), listSupplierOptions()]);
  return { categories, suppliers };
}

export async function createProductRecord(input: FormData, actorId?: string) {
  const parsed = createProductSchema.parse({
    name: input.get("name"),
    sku: input.get("sku"),
    ncm: input.get("ncm"),
    description: input.get("description"),
    imageUrl: input.get("imageUrl"),
    categoryId: input.get("categoryId"),
    supplierId: input.get("supplierId"),
    kind: input.get("kind"),
    serviceCnae: input.get("serviceCnae"),
    serviceDescription: input.get("serviceDescription"),
    gameplayPlanCode: input.get("gameplayPlanCode"),
    gameplayDurationMinutes: input.get("gameplayDurationMinutes"),
    costPrice: input.get("costPrice"),
    salePrice: input.get("salePrice"),
    minStock: input.get("minStock"),
    currentStock: input.get("currentStock"),
    status: input.get("status"),
  });

  const isServiceLike = parsed.kind !== ProductKind.STANDARD;
  const isGameplay = parsed.kind === ProductKind.GAMEPLAY;
  const costPrice = new Prisma.Decimal(isServiceLike ? "0.00" : parsed.costPrice);
  const salePrice = new Prisma.Decimal(parsed.salePrice);
  const marginPercent = calculateMargin(costPrice, salePrice);

  const created = await createProduct({
    name: parsed.name.trim(),
    sku: parsed.sku.trim(),
    ncm: isServiceLike ? "" : (parsed.ncm ?? ""),
    description: emptyToUndefined(parsed.description),
    imageUrl: emptyToUndefined(parsed.imageUrl),
    categoryId: parsed.categoryId,
    supplierId: isServiceLike ? null : emptyToUndefined(parsed.supplierId),
    kind: parsed.kind,
    serviceCnae: isServiceLike ? emptyToUndefined(parsed.serviceCnae) : null,
    serviceDescription: isServiceLike ? emptyToUndefined(parsed.serviceDescription) : null,
    gameplayPlanCode: isGameplay ? emptyToUndefined(parsed.gameplayPlanCode) : null,
    gameplayDurationMinutes: isGameplay ? parsed.gameplayDurationMinutes : null,
    costPrice,
    salePrice,
    marginPercent,
    minStock: isServiceLike ? 0 : parsed.minStock,
    currentStock: isServiceLike ? 0 : parsed.currentStock,
    status: parsed.status,
  });

  await createAuditLog({
    userId: actorId,
    action: "products.create",
    entity: "Product",
    entityId: created.id,
    metadata: {
      sku: created.sku,
      ncm: created.ncm,
      imageUrl: created.imageUrl,
      kind: created.kind,
      serviceCnae: created.serviceCnae,
      serviceDescription: created.serviceDescription,
      gameplayPlanCode: created.gameplayPlanCode,
      gameplayDurationMinutes: created.gameplayDurationMinutes,
      categoryId: created.categoryId,
      supplierId: created.supplierId,
    },
  });
}

export async function updateProductRecord(input: FormData, actorId?: string) {
  const parsed = updateProductSchema.parse({
    productId: input.get("productId"),
    name: input.get("name"),
    sku: input.get("sku"),
    ncm: input.get("ncm"),
    description: input.get("description"),
    imageUrl: input.get("imageUrl"),
    categoryId: input.get("categoryId"),
    supplierId: input.get("supplierId"),
    kind: input.get("kind"),
    serviceCnae: input.get("serviceCnae"),
    serviceDescription: input.get("serviceDescription"),
    gameplayPlanCode: input.get("gameplayPlanCode"),
    gameplayDurationMinutes: input.get("gameplayDurationMinutes"),
    costPrice: input.get("costPrice"),
    salePrice: input.get("salePrice"),
    minStock: input.get("minStock"),
    currentStock: input.get("currentStock"),
    status: input.get("status"),
  });

  const isServiceLike = parsed.kind !== ProductKind.STANDARD;
  const isGameplay = parsed.kind === ProductKind.GAMEPLAY;
  const costPrice = new Prisma.Decimal(isServiceLike ? "0.00" : parsed.costPrice);
  const salePrice = new Prisma.Decimal(parsed.salePrice);
  const marginPercent = calculateMargin(costPrice, salePrice);

  const updated = await updateProduct({
    productId: parsed.productId,
    name: parsed.name.trim(),
    sku: parsed.sku.trim(),
    ncm: isServiceLike ? "" : (parsed.ncm ?? ""),
    description: emptyToUndefined(parsed.description),
    imageUrl: emptyToUndefined(parsed.imageUrl),
    categoryId: parsed.categoryId,
    supplierId: isServiceLike ? null : emptyToUndefined(parsed.supplierId),
    kind: parsed.kind,
    serviceCnae: isServiceLike ? emptyToUndefined(parsed.serviceCnae) : null,
    serviceDescription: isServiceLike ? emptyToUndefined(parsed.serviceDescription) : null,
    gameplayPlanCode: isGameplay ? emptyToUndefined(parsed.gameplayPlanCode) : null,
    gameplayDurationMinutes: isGameplay ? parsed.gameplayDurationMinutes : null,
    costPrice,
    salePrice,
    marginPercent,
    minStock: isServiceLike ? 0 : parsed.minStock,
    currentStock: isServiceLike ? 0 : parsed.currentStock,
    status: parsed.status,
  });

  await createAuditLog({
    userId: actorId,
    action: "products.update",
    entity: "Product",
    entityId: updated.id,
    metadata: {
      sku: updated.sku,
      ncm: updated.ncm,
      imageUrl: updated.imageUrl,
      kind: updated.kind,
      serviceCnae: updated.serviceCnae,
      serviceDescription: updated.serviceDescription,
      gameplayPlanCode: updated.gameplayPlanCode,
      gameplayDurationMinutes: updated.gameplayDurationMinutes,
      categoryId: updated.categoryId,
      supplierId: updated.supplierId,
    },
  });
}

export async function updateProductStatusRecord(input: FormData, actorId?: string) {
  const parsed = updateProductStatusSchema.parse({
    productId: input.get("productId"),
    status: input.get("status"),
  });

  const updated = await updateProductStatus(parsed);

  await createAuditLog({
    userId: actorId,
    action: "products.status.update",
    entity: "Product",
    entityId: updated.id,
    metadata: { status: updated.status },
  });
}

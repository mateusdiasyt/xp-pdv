import { Prisma, ProductKind, RecordStatus, StockUnit } from "@prisma/client";

import { createProductSchema, updateProductSchema, updateProductStatusSchema } from "@/domain/catalog/schemas";
import { emptyToUndefined } from "@/domain/shared/normalizers";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import { listCategoryOptions } from "@/infrastructure/db/repositories/category-repository";
import {
  createProduct,
  countProducts,
  getProductForEdit,
  getProductImageById,
  listStockIngredientOptions,
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

type RecipeIngredientInput = {
  ingredientProductId: string;
  quantity: number;
};

function formValueToString(value: FormDataEntryValue | null | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function readRecipeIngredients(input: FormData): RecipeIngredientInput[] {
  const ingredientIds = input.getAll("recipeIngredientProductId").map(formValueToString);
  const quantities = input.getAll("recipeQuantity").map(formValueToString);
  const rowCount = Math.max(ingredientIds.length, quantities.length);
  const ingredients: RecipeIngredientInput[] = [];
  const usedIngredientIds = new Set<string>();

  for (let index = 0; index < rowCount; index += 1) {
    const ingredientProductId = ingredientIds[index] ?? "";
    const rawQuantity = quantities[index] ?? "";

    if (!ingredientProductId && !rawQuantity) {
      continue;
    }

    if (!ingredientProductId) {
      throw new Error("Selecione o item do estoque usado na receita.");
    }

    const quantity = Number(rawQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Informe um consumo inteiro maior que zero para cada item da receita.");
    }

    if (usedIngredientIds.has(ingredientProductId)) {
      throw new Error("Nao repita o mesmo item do estoque na receita.");
    }

    usedIngredientIds.add(ingredientProductId);
    ingredients.push({ ingredientProductId, quantity });
  }

  return ingredients;
}

export async function getProducts(filters?: {
  search?: string;
  status?: RecordStatus;
  categoryId?: string;
  take?: number;
  skip?: number;
}) {
  return listProducts(filters);
}

export async function getProductsCount(filters?: {
  search?: string;
  status?: RecordStatus;
  categoryId?: string;
}) {
  return countProducts(filters);
}

export async function getProductEditPayload(productId: string) {
  return getProductForEdit(productId);
}

export async function getProductImagePayload(productId: string) {
  return getProductImageById(productId);
}

export async function getProductOptions() {
  return listProductOptions();
}

export async function getProductFormOptions() {
  const [categories, suppliers, stockIngredients] = await Promise.all([
    listCategoryOptions(),
    listSupplierOptions(),
    listStockIngredientOptions(),
  ]);
  return { categories, suppliers, stockIngredients };
}

export async function createProductRecord(input: FormData, actorId?: string) {
  const parsed = createProductSchema.parse({
    name: input.get("name"),
    sku: input.get("sku"),
    ncm: input.get("ncm"),
    fiscalCfop: input.get("fiscalCfop"),
    fiscalCsosn: input.get("fiscalCsosn"),
    fiscalIcmsOrigin: input.get("fiscalIcmsOrigin"),
    description: input.get("description"),
    imageUrl: input.get("imageUrl"),
    categoryId: input.get("categoryId"),
    supplierId: input.get("supplierId"),
    kind: input.get("kind"),
    tracksStock: input.get("tracksStock"),
    serviceCnae: input.get("serviceCnae"),
    serviceDescription: input.get("serviceDescription"),
    gameplayPlanCode: input.get("gameplayPlanCode"),
    gameplayDurationMinutes: input.get("gameplayDurationMinutes"),
    costPrice: input.get("costPrice"),
    salePrice: input.get("salePrice"),
    happyHourPrice: input.get("happyHourPrice"),
    minStock: input.get("minStock"),
    currentStock: input.get("currentStock"),
    stockUnit: input.get("stockUnit"),
    recipeIngredientProductId: input.get("recipeIngredientProductId"),
    recipeQuantity: input.get("recipeQuantity"),
    status: input.get("status"),
  });

  const isServiceLike = parsed.kind !== ProductKind.STANDARD;
  const isGameplay = parsed.kind === ProductKind.GAMEPLAY;
  const tracksStock = !isServiceLike && parsed.tracksStock;
  const costPrice = new Prisma.Decimal(isServiceLike ? "0.00" : parsed.costPrice);
  const salePrice = new Prisma.Decimal(parsed.salePrice);
  const happyHourPrice = parsed.happyHourPrice ? new Prisma.Decimal(parsed.happyHourPrice) : null;
  const marginPercent = calculateMargin(costPrice, salePrice);
  const recipeIngredients = !isServiceLike ? readRecipeIngredients(input) : [];

  const created = await createProduct({
    name: parsed.name.trim(),
    sku: parsed.sku.trim(),
    ncm: isServiceLike ? "" : (parsed.ncm ?? ""),
    fiscalCfop: isServiceLike ? null : emptyToUndefined(parsed.fiscalCfop),
    fiscalCsosn: isServiceLike ? null : emptyToUndefined(parsed.fiscalCsosn),
    fiscalIcmsOrigin: isServiceLike ? null : emptyToUndefined(parsed.fiscalIcmsOrigin),
    description: emptyToUndefined(parsed.description),
    imageUrl: emptyToUndefined(parsed.imageUrl),
    categoryId: parsed.categoryId,
    supplierId: isServiceLike ? null : emptyToUndefined(parsed.supplierId),
    kind: parsed.kind,
    tracksStock,
    serviceCnae: isServiceLike ? emptyToUndefined(parsed.serviceCnae) : null,
    serviceDescription: isServiceLike ? emptyToUndefined(parsed.serviceDescription) : null,
    gameplayPlanCode: isGameplay ? emptyToUndefined(parsed.gameplayPlanCode) : null,
    gameplayDurationMinutes: isGameplay ? parsed.gameplayDurationMinutes : null,
    costPrice,
    salePrice,
    happyHourPrice,
    marginPercent,
    minStock: tracksStock ? parsed.minStock : 0,
    currentStock: tracksStock ? parsed.currentStock : 0,
    stockUnit: tracksStock ? parsed.stockUnit : StockUnit.UNIT,
    recipeIngredients,
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
      fiscalCfop: created.fiscalCfop,
      fiscalCsosn: created.fiscalCsosn,
      fiscalIcmsOrigin: created.fiscalIcmsOrigin,
      imageUrl: created.imageUrl,
      kind: created.kind,
      tracksStock: created.tracksStock,
      serviceCnae: created.serviceCnae,
      serviceDescription: created.serviceDescription,
      gameplayPlanCode: created.gameplayPlanCode,
      gameplayDurationMinutes: created.gameplayDurationMinutes,
      happyHourPrice: created.happyHourPrice?.toString(),
      categoryId: created.categoryId,
      supplierId: created.supplierId,
      stockUnit: created.stockUnit,
    },
  });
}

export async function updateProductRecord(input: FormData, actorId?: string) {
  const parsed = updateProductSchema.parse({
    productId: input.get("productId"),
    name: input.get("name"),
    sku: input.get("sku"),
    ncm: input.get("ncm"),
    fiscalCfop: input.get("fiscalCfop"),
    fiscalCsosn: input.get("fiscalCsosn"),
    fiscalIcmsOrigin: input.get("fiscalIcmsOrigin"),
    description: input.get("description"),
    imageUrl: input.get("imageUrl"),
    categoryId: input.get("categoryId"),
    supplierId: input.get("supplierId"),
    kind: input.get("kind"),
    tracksStock: input.get("tracksStock"),
    serviceCnae: input.get("serviceCnae"),
    serviceDescription: input.get("serviceDescription"),
    gameplayPlanCode: input.get("gameplayPlanCode"),
    gameplayDurationMinutes: input.get("gameplayDurationMinutes"),
    costPrice: input.get("costPrice"),
    salePrice: input.get("salePrice"),
    happyHourPrice: input.get("happyHourPrice"),
    minStock: input.get("minStock"),
    currentStock: input.get("currentStock"),
    stockUnit: input.get("stockUnit"),
    recipeIngredientProductId: input.get("recipeIngredientProductId"),
    recipeQuantity: input.get("recipeQuantity"),
    status: input.get("status"),
  });

  const isServiceLike = parsed.kind !== ProductKind.STANDARD;
  const isGameplay = parsed.kind === ProductKind.GAMEPLAY;
  const tracksStock = !isServiceLike && parsed.tracksStock;
  const costPrice = new Prisma.Decimal(isServiceLike ? "0.00" : parsed.costPrice);
  const salePrice = new Prisma.Decimal(parsed.salePrice);
  const happyHourPrice = parsed.happyHourPrice ? new Prisma.Decimal(parsed.happyHourPrice) : null;
  const marginPercent = calculateMargin(costPrice, salePrice);
  const recipeIngredients = !isServiceLike ? readRecipeIngredients(input) : [];

  const updated = await updateProduct({
    productId: parsed.productId,
    name: parsed.name.trim(),
    sku: parsed.sku.trim(),
    ncm: isServiceLike ? "" : (parsed.ncm ?? ""),
    fiscalCfop: isServiceLike ? null : emptyToUndefined(parsed.fiscalCfop),
    fiscalCsosn: isServiceLike ? null : emptyToUndefined(parsed.fiscalCsosn),
    fiscalIcmsOrigin: isServiceLike ? null : emptyToUndefined(parsed.fiscalIcmsOrigin),
    description: emptyToUndefined(parsed.description),
    imageUrl: emptyToUndefined(parsed.imageUrl),
    categoryId: parsed.categoryId,
    supplierId: isServiceLike ? null : emptyToUndefined(parsed.supplierId),
    kind: parsed.kind,
    tracksStock,
    serviceCnae: isServiceLike ? emptyToUndefined(parsed.serviceCnae) : null,
    serviceDescription: isServiceLike ? emptyToUndefined(parsed.serviceDescription) : null,
    gameplayPlanCode: isGameplay ? emptyToUndefined(parsed.gameplayPlanCode) : null,
    gameplayDurationMinutes: isGameplay ? parsed.gameplayDurationMinutes : null,
    costPrice,
    salePrice,
    happyHourPrice,
    marginPercent,
    minStock: tracksStock ? parsed.minStock : 0,
    currentStock: tracksStock ? parsed.currentStock : 0,
    stockUnit: tracksStock ? parsed.stockUnit : StockUnit.UNIT,
    recipeIngredients,
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
      fiscalCfop: updated.fiscalCfop,
      fiscalCsosn: updated.fiscalCsosn,
      fiscalIcmsOrigin: updated.fiscalIcmsOrigin,
      imageUrl: updated.imageUrl,
      kind: updated.kind,
      tracksStock: updated.tracksStock,
      serviceCnae: updated.serviceCnae,
      serviceDescription: updated.serviceDescription,
      gameplayPlanCode: updated.gameplayPlanCode,
      gameplayDurationMinutes: updated.gameplayDurationMinutes,
      happyHourPrice: updated.happyHourPrice?.toString(),
      categoryId: updated.categoryId,
      supplierId: updated.supplierId,
      stockUnit: updated.stockUnit,
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

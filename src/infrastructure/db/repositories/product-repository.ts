import { Prisma, ProductKind, RecordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ListProductsFilters = {
  search?: string;
  status?: RecordStatus;
  categoryId?: string;
  take?: number;
  skip?: number;
};

function buildProductWhere(filters?: ListProductsFilters) {
  const where: Prisma.ProductWhereInput = {};

  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.categoryId) {
    where.categoryId = filters.categoryId;
  }

  return where;
}

function appendSqlCondition(current: Prisma.Sql, next: Prisma.Sql) {
  if (current === Prisma.empty) {
    return next;
  }

  return Prisma.sql`${current} AND ${next}`;
}

function buildProductWhereSql(filters?: ListProductsFilters) {
  let where = Prisma.empty;

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    where = appendSqlCondition(
      where,
      Prisma.sql`(p."name" ILIKE ${searchTerm} OR p."sku" ILIKE ${searchTerm})`,
    );
  }

  if (filters?.status) {
    where = appendSqlCondition(where, Prisma.sql`p."status" = ${filters.status}::"RecordStatus"`);
  }

  if (filters?.categoryId) {
    where = appendSqlCondition(where, Prisma.sql`p."categoryId" = ${filters.categoryId}`);
  }

  return where === Prisma.empty ? Prisma.empty : Prisma.sql`WHERE ${where}`;
}

function isMissingProductImageColumnError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2022" && String(error.meta?.column ?? "").toLowerCase().includes("imageurl");
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("imageurl") && (message.includes("column") || message.includes("does not exist"));
  }

  return false;
}

export async function listProducts(filters?: ListProductsFilters) {
  const where = buildProductWhere(filters);

  try {
    const products = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        sku: string;
        ncm: string | null;
        description: string | null;
        hasImage: boolean;
        kind: ProductKind;
        serviceCnae: string | null;
        serviceDescription: string | null;
        gameplayPlanCode: string | null;
        gameplayDurationMinutes: number | null;
        tracksStock: boolean;
        costPrice: Prisma.Decimal;
        salePrice: Prisma.Decimal;
        happyHourPrice: Prisma.Decimal | null;
        marginPercent: Prisma.Decimal;
        minStock: number;
        currentStock: number;
        status: RecordStatus;
        categoryId: string;
        supplierId: string | null;
        createdAt: Date;
        updatedAt: Date;
        categoryName: string;
        categorySlug: string;
      }>
    >`
      SELECT
        p."id",
        p."name",
        p."sku",
        p."ncm",
        p."description",
        COALESCE(length(p."imageUrl"), 0) > 0 AS "hasImage",
        p."kind",
        p."serviceCnae",
        p."serviceDescription",
        p."gameplayPlanCode",
        p."gameplayDurationMinutes",
        p."tracksStock",
        p."costPrice",
        p."salePrice",
        p."happyHourPrice",
        p."marginPercent",
        p."minStock",
        p."currentStock",
        p."status",
        p."categoryId",
        p."supplierId",
        p."createdAt",
        p."updatedAt",
        c."name" AS "categoryName",
        c."slug" AS "categorySlug"
      FROM "Product" p
      INNER JOIN "ProductCategory" c ON c."id" = p."categoryId"
      ${buildProductWhereSql(filters)}
      ORDER BY p."createdAt" DESC
      ${filters?.take ? Prisma.sql`LIMIT ${filters.take} OFFSET ${filters.skip ?? 0}` : Prisma.empty}
    `;

    return products.map(({ categoryName, categorySlug, ...product }) => ({
      ...product,
      category: {
        id: product.categoryId,
        name: categoryName,
        slug: categorySlug,
      },
    }));
  } catch (error) {
    if (!isMissingProductImageColumnError(error)) {
      throw error;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        ncm: true,
        description: true,
        kind: true,
        serviceCnae: true,
        serviceDescription: true,
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        tracksStock: true,
        costPrice: true,
        salePrice: true,
        happyHourPrice: true,
        marginPercent: true,
        minStock: true,
        currentStock: true,
        status: true,
        categoryId: true,
        supplierId: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: filters?.take,
      skip: filters?.skip,
    });

    return products.map((product) => ({
      ...product,
      hasImage: false,
    }));
  }
}

export async function createProduct(data: {
  name: string;
  sku: string;
  ncm: string;
  description?: string;
  imageUrl?: string;
  kind: ProductKind;
  serviceCnae?: string | null;
  serviceDescription?: string | null;
  gameplayPlanCode?: string | null;
  gameplayDurationMinutes?: number | null;
  tracksStock: boolean;
  categoryId: string;
  supplierId?: string | null;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  happyHourPrice?: Prisma.Decimal | null;
  marginPercent: Prisma.Decimal;
  minStock: number;
  currentStock: number;
  status: RecordStatus;
}) {
  return prisma.product.create({
    data,
  });
}

export async function updateProduct(data: {
  productId: string;
  name: string;
  sku: string;
  ncm: string;
  description?: string;
  imageUrl?: string;
  kind: ProductKind;
  serviceCnae?: string | null;
  serviceDescription?: string | null;
  gameplayPlanCode?: string | null;
  gameplayDurationMinutes?: number | null;
  tracksStock: boolean;
  categoryId: string;
  supplierId?: string | null;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
  happyHourPrice?: Prisma.Decimal | null;
  marginPercent: Prisma.Decimal;
  minStock: number;
  currentStock: number;
  status: RecordStatus;
}) {
  return prisma.product.update({
    where: { id: data.productId },
    data: {
      name: data.name,
      sku: data.sku,
      ncm: data.ncm,
      description: data.description,
      imageUrl: data.imageUrl,
      kind: data.kind,
      serviceCnae: data.serviceCnae,
      serviceDescription: data.serviceDescription,
      gameplayPlanCode: data.gameplayPlanCode,
      gameplayDurationMinutes: data.gameplayDurationMinutes,
      tracksStock: data.tracksStock,
      categoryId: data.categoryId,
      supplierId: data.supplierId,
      costPrice: data.costPrice,
      salePrice: data.salePrice,
      happyHourPrice: data.happyHourPrice,
      marginPercent: data.marginPercent,
      minStock: data.minStock,
      currentStock: data.currentStock,
      status: data.status,
    },
  });
}

export async function countProducts(filters?: ListProductsFilters) {
  return prisma.product.count({
    where: buildProductWhere(filters),
  });
}

export async function getProductForEdit(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      name: true,
      sku: true,
      ncm: true,
      description: true,
      imageUrl: true,
      kind: true,
      serviceCnae: true,
      serviceDescription: true,
      gameplayPlanCode: true,
      gameplayDurationMinutes: true,
      tracksStock: true,
      costPrice: true,
      salePrice: true,
      happyHourPrice: true,
      minStock: true,
      currentStock: true,
      status: true,
      categoryId: true,
      supplierId: true,
    },
  });
}

export async function getProductImageById(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      imageUrl: true,
      updatedAt: true,
    },
  });
}

export async function listProductOptions() {
  try {
    return await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        imageUrl: true,
        kind: true,
        serviceCnae: true,
        serviceDescription: true,
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        tracksStock: true,
        currentStock: true,
        status: true,
        salePrice: true,
        happyHourPrice: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });
  } catch (error) {
    if (!isMissingProductImageColumnError(error)) {
      throw error;
    }

    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        kind: true,
        serviceCnae: true,
        serviceDescription: true,
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        tracksStock: true,
        currentStock: true,
        status: true,
        salePrice: true,
        happyHourPrice: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return products.map((product) => ({
      ...product,
      imageUrl: null,
    }));
  }
}

export async function listLowStockProducts() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true,
      currentStock: true,
      minStock: true,
      tracksStock: true,
    },
  });

  return products
    .filter((product) => product.tracksStock && product.currentStock <= product.minStock)
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 5);
}

export async function updateProductStatus(data: { productId: string; status: RecordStatus }) {
  return prisma.product.update({
    where: { id: data.productId },
    data: { status: data.status },
  });
}

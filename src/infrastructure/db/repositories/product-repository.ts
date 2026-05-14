import { Prisma, ProductKind, RecordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type ListProductsFilters = {
  search?: string;
  status?: RecordStatus;
  categoryId?: string;
};

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

  try {
    return await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        ncm: true,
        description: true,
        imageUrl: true,
        kind: true,
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        costPrice: true,
        salePrice: true,
        marginPercent: true,
        minStock: true,
        currentStock: true,
        status: true,
        categoryId: true,
        supplierId: true,
        unitId: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        supplier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
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
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        costPrice: true,
        salePrice: true,
        marginPercent: true,
        minStock: true,
        currentStock: true,
        status: true,
        categoryId: true,
        supplierId: true,
        unitId: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        supplier: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return products.map((product) => ({
      ...product,
      imageUrl: null,
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
  gameplayPlanCode?: string;
  gameplayDurationMinutes?: number;
  categoryId: string;
  supplierId?: string;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
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
  gameplayPlanCode?: string;
  gameplayDurationMinutes?: number;
  categoryId: string;
  supplierId?: string;
  costPrice: Prisma.Decimal;
  salePrice: Prisma.Decimal;
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
      gameplayPlanCode: data.gameplayPlanCode,
      gameplayDurationMinutes: data.gameplayDurationMinutes,
      categoryId: data.categoryId,
      supplierId: data.supplierId,
      costPrice: data.costPrice,
      salePrice: data.salePrice,
      marginPercent: data.marginPercent,
      minStock: data.minStock,
      currentStock: data.currentStock,
      status: data.status,
    },
  });
}

export async function countProducts() {
  return prisma.product.count();
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
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        currentStock: true,
        status: true,
        salePrice: true,
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
        gameplayPlanCode: true,
        gameplayDurationMinutes: true,
        currentStock: true,
        status: true,
        salePrice: true,
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
    },
  });

  return products
    .filter((product) => product.currentStock <= product.minStock)
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 5);
}

export async function updateProductStatus(data: { productId: string; status: RecordStatus }) {
  return prisma.product.update({
    where: { id: data.productId },
    data: { status: data.status },
  });
}

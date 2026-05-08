import { Prisma, RecordStatus, StockMovementType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type RegisterStockMovementInput = {
  productId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: Prisma.Decimal;
  note?: string;
  operatorId?: string;
};

export async function listStockMovements() {
  return prisma.stockMovement.findMany({
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });
}

export async function registerStockMovement(data: RegisterStockMovementInput) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUniqueOrThrow({
      where: { id: data.productId },
      select: {
        id: true,
        currentStock: true,
      },
    });

    let resultingStock = product.currentStock;

    if (data.type === StockMovementType.IN) {
      resultingStock += data.quantity;
    } else if (data.type === StockMovementType.OUT) {
      resultingStock -= data.quantity;
      if (resultingStock < 0) {
        throw new Error("Estoque insuficiente para a saida selecionada.");
      }
    } else {
      resultingStock = data.quantity;
    }

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type: data.type,
        quantity: data.quantity,
        unitCost: data.unitCost,
        previousStock: product.currentStock,
        resultingStock,
        note: data.note,
        operatorId: data.operatorId,
      },
    });

    const stockUpdate = await tx.product.updateMany({
      where: { id: product.id },
      data: {
        currentStock: resultingStock,
      },
    });

    if (stockUpdate.count === 0) {
      throw new Error("Produto nao encontrado para atualizar o estoque.");
    }

    return movement;
  });
}

export async function countStockMovements() {
  return prisma.stockMovement.count();
}

export function isMissingStockInvoiceXmlTableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" && String(error.meta?.table ?? "").includes("StockInvoiceXml");
  }

  if (error instanceof Error) {
    const normalizedMessage = error.message.toLowerCase();
    return normalizedMessage.includes("stockinvoicexml") && normalizedMessage.includes("does not exist");
  }

  return false;
}

export async function listStockInvoiceXmls() {
  return prisma.stockInvoiceXml.findMany({
    select: {
      id: true,
      accessKey: true,
      invoiceNumber: true,
      invoiceSeries: true,
      supplierName: true,
      issuedAt: true,
      totalAmount: true,
      itemCount: true,
      sourceFileName: true,
      createdAt: true,
      uploadedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 30,
  });
}

type CreateStockInvoiceXmlInput = {
  accessKey: string;
  invoiceNumber?: string;
  invoiceSeries?: string;
  supplierName?: string;
  supplierDocument?: string;
  issuedAt?: Date;
  totalAmount?: Prisma.Decimal;
  itemCount: number;
  rawXml: string;
  sourceFileName: string;
  sourceFileSize: number;
  uploadedById?: string;
};

export async function createStockInvoiceXmlRecord(data: CreateStockInvoiceXmlInput) {
  return prisma.stockInvoiceXml.create({
    data,
  });
}

export async function findStockInvoiceXmlById(stockInvoiceXmlId: string) {
  return prisma.stockInvoiceXml.findUnique({
    where: {
      id: stockInvoiceXmlId,
    },
    select: {
      id: true,
      accessKey: true,
      invoiceNumber: true,
      invoiceSeries: true,
      supplierName: true,
      supplierDocument: true,
      rawXml: true,
      itemCount: true,
      createdAt: true,
      sourceFileName: true,
    },
  });
}

type ImportStockInvoiceItemInput = {
  lineNumber: number;
  supplierProductCode?: string;
  supplierEan?: string;
  description: string;
  ncm?: string;
  quantity: number;
  unitCost: Prisma.Decimal;
};

type ImportStockInvoiceItemsInput = {
  accessKey: string;
  invoiceNumber?: string;
  invoiceSeries?: string;
  supplierName?: string;
  supplierDocument?: string;
  actorId?: string;
  allowCreateProducts: boolean;
  items: ImportStockInvoiceItemInput[];
};

type ImportStockInvoiceItemsResult = {
  createdProducts: number;
  updatedProducts: number;
  stockMovements: number;
  skippedItems: number;
};

function normalizeSupplierDocument(rawValue?: string) {
  if (!rawValue) {
    return undefined;
  }

  const digits = rawValue.replace(/\D/g, "");
  if (!digits) {
    return undefined;
  }

  if (digits.length !== 11 && digits.length !== 14) {
    return undefined;
  }

  return digits;
}

function calculateMargin(costPrice: Prisma.Decimal, salePrice: Prisma.Decimal) {
  if (salePrice.equals(0)) {
    return new Prisma.Decimal(0);
  }

  return salePrice.minus(costPrice).dividedBy(salePrice).times(100).toDecimalPlaces(2);
}

function toSafeSkuToken(rawValue?: string) {
  if (!rawValue) {
    return undefined;
  }

  const normalized = rawValue.trim();
  if (!normalized || /^sem gtin$/i.test(normalized) || normalized === "0") {
    return undefined;
  }

  return normalized;
}

async function buildUniqueSku(
  tx: Prisma.TransactionClient,
  preferredSku: string | undefined,
  accessKey: string,
  lineNumber: number,
) {
  const fallbackBase = `XML-${accessKey.slice(-8)}-${String(lineNumber).padStart(3, "0")}`;
  const base = preferredSku?.slice(0, 50) || fallbackBase;
  let sequence = 0;

  while (true) {
    const candidate = sequence === 0 ? base : `${base}-${sequence}`;
    const existing = await tx.product.findFirst({
      where: {
        sku: {
          equals: candidate,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      return candidate;
    }

    sequence += 1;
  }
}

export async function importStockInvoiceItems(data: ImportStockInvoiceItemsInput): Promise<ImportStockInvoiceItemsResult> {
  return prisma.$transaction(async (tx) => {
    const normalizedSupplierDocument = normalizeSupplierDocument(data.supplierDocument);
    let supplierId: string | undefined;

    if (data.supplierName || normalizedSupplierDocument) {
      const supplier = await tx.supplier.findFirst({
        where: normalizedSupplierDocument
          ? {
              document: normalizedSupplierDocument,
            }
          : {
              tradeName: {
                equals: (data.supplierName ?? "").trim(),
                mode: "insensitive",
              },
            },
        select: {
          id: true,
        },
      });

      if (supplier) {
        supplierId = supplier.id;
      } else {
        const createdSupplier = await tx.supplier.create({
          data: {
            tradeName: (data.supplierName ?? "Fornecedor XML").trim(),
            document: normalizedSupplierDocument,
            status: RecordStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        });

        supplierId = createdSupplier.id;
      }
    }

    let defaultCategory = await tx.productCategory.findFirst({
      where: {
        slug: "importacao-xml",
      },
      select: {
        id: true,
      },
    });

    if (!defaultCategory) {
      defaultCategory = await tx.productCategory.create({
        data: {
          name: "Importacao XML",
          slug: "importacao-xml",
          description: "Produtos criados automaticamente pela entrada de XML de compra.",
          status: RecordStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });
    }

    const productStockMap = new Map<string, number>();
    const updatedProductIds = new Set<string>();
    let createdProducts = 0;
    let stockMovements = 0;
    let skippedItems = 0;

    for (const item of data.items) {
      const skuCandidates = [toSafeSkuToken(item.supplierProductCode), toSafeSkuToken(item.supplierEan)].filter(
        (value): value is string => Boolean(value),
      );

      let product = await tx.product.findFirst({
        where: skuCandidates.length
          ? {
              OR: skuCandidates.map((sku) => ({
                sku: {
                  equals: sku,
                  mode: "insensitive",
                },
              })),
            }
          : {
              name: {
                equals: item.description,
                mode: "insensitive",
              },
            },
        select: {
          id: true,
          name: true,
          sku: true,
          ncm: true,
          salePrice: true,
          minStock: true,
          currentStock: true,
          supplierId: true,
        },
      });

      if (!product && skuCandidates.length) {
        product = await tx.product.findFirst({
          where: {
            name: {
              equals: item.description,
              mode: "insensitive",
            },
          },
          select: {
            id: true,
            name: true,
            sku: true,
            ncm: true,
            salePrice: true,
            minStock: true,
            currentStock: true,
            supplierId: true,
          },
        });
      }

      if (!product) {
        if (!data.allowCreateProducts) {
          skippedItems += 1;
          continue;
        }

        const sku = await buildUniqueSku(tx, skuCandidates[0], data.accessKey, item.lineNumber);

        product = await tx.product.create({
          data: {
            name: item.description,
            sku,
            ncm: item.ncm,
            description: `Cadastro criado via XML de compra (${data.accessKey}).`,
            costPrice: item.unitCost,
            salePrice: item.unitCost,
            marginPercent: new Prisma.Decimal(0),
            minStock: 0,
            currentStock: 0,
            status: RecordStatus.ACTIVE,
            categoryId: defaultCategory.id,
            supplierId,
          },
          select: {
            id: true,
            name: true,
            sku: true,
            ncm: true,
            salePrice: true,
            minStock: true,
            currentStock: true,
            supplierId: true,
          },
        });

        createdProducts += 1;
      }

      const currentStock = productStockMap.get(product.id) ?? product.currentStock;
      const resultingStock = currentStock + item.quantity;

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          type: StockMovementType.IN,
          quantity: item.quantity,
          unitCost: item.unitCost,
          previousStock: currentStock,
          resultingStock,
          note: `Entrada via XML ${data.invoiceNumber ? `N${data.invoiceNumber}` : ""}${data.invoiceSeries ? ` serie ${data.invoiceSeries}` : ""} (${data.accessKey}).`,
          operatorId: data.actorId,
        },
      });

      const nextNcm = item.ncm ?? product.ncm ?? undefined;
      const nextSalePrice = product.salePrice.lessThan(item.unitCost) ? item.unitCost : product.salePrice;

      await tx.product.update({
        where: {
          id: product.id,
        },
        data: {
          currentStock: resultingStock,
          costPrice: item.unitCost,
          ncm: nextNcm,
          supplierId: supplierId ?? product.supplierId ?? undefined,
          salePrice: nextSalePrice,
          marginPercent: calculateMargin(item.unitCost, nextSalePrice),
        },
      });

      productStockMap.set(product.id, resultingStock);
      updatedProductIds.add(product.id);
      stockMovements += 1;
    }

    return {
      createdProducts,
      updatedProducts: updatedProductIds.size,
      stockMovements,
      skippedItems,
    };
  });
}

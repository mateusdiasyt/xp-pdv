import { ComandaStatus, Prisma, RecordStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  createSaleWithStockAdjustmentInTransaction,
  type SalePaymentInput,
} from "@/infrastructure/db/repositories/sale-repository";

const PDV_TRANSACTION_OPTIONS = {
  maxWait: 20_000,
  timeout: 40_000,
};

const PDV_CONFIGURATION_SCOPE = "GLOBAL";

function isRetryableTransactionError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2028";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes("transaction not found") || message.includes("transaction api error");
  }

  return false;
}

async function runWithTransactionRetry<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableTransactionError(error)) {
      throw error;
    }

    return operation();
  }
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

async function recalculateComandaSubtotal(tx: Prisma.TransactionClient, comandaId: string) {
  const aggregate = await tx.comandaItem.aggregate({
    where: {
      comandaId,
    },
    _sum: {
      lineTotal: true,
    },
  });

  const subtotalAmount = aggregate._sum.lineTotal ?? new Prisma.Decimal(0);

  await tx.comanda.update({
    where: {
      id: comandaId,
    },
    data: {
      subtotalAmount,
    },
  });
}

async function getHappyHourActiveInTransaction(tx: Prisma.TransactionClient) {
  const configuration = await tx.pdvConfiguration.findUnique({
    where: {
      scope: PDV_CONFIGURATION_SCOPE,
    },
    select: {
      happyHourActive: true,
    },
  });

  return configuration?.happyHourActive ?? false;
}

function resolveComandaUnitPrice(product: {
  salePrice: Prisma.Decimal;
  happyHourPrice?: Prisma.Decimal | null;
}, happyHourActive: boolean) {
  if (happyHourActive && product.happyHourPrice?.greaterThan(0)) {
    return product.happyHourPrice;
  }

  return product.salePrice;
}

export async function listOpenComandas() {
  try {
    return await prisma.comanda.findMany({
      where: {
        status: ComandaStatus.OPEN,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            documentType: true,
            documentNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                imageUrl: true,
                tracksStock: true,
                currentStock: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        openedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ number: "asc" }, { openedAt: "asc" }],
    });
  } catch (error) {
    if (!isMissingProductImageColumnError(error)) {
      throw error;
    }

    const comandas = await prisma.comanda.findMany({
      where: {
        status: ComandaStatus.OPEN,
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            documentType: true,
            documentNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                tracksStock: true,
                currentStock: true,
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        openedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ number: "asc" }, { openedAt: "asc" }],
    });

    return comandas.map((comanda) => ({
      ...comanda,
      items: comanda.items.map((item) => ({
        ...item,
        product: {
          ...item.product,
          imageUrl: null,
        },
      })),
    }));
  }
}

export async function createComanda(data: {
  number: number;
  customerId?: string;
  isWalkIn: boolean;
  openedById: string;
}) {
  return prisma.$transaction(async (tx) => {
    const existingOpen = await tx.comanda.findFirst({
      where: {
        number: data.number,
        status: ComandaStatus.OPEN,
      },
      select: {
        id: true,
      },
    });

    if (existingOpen) {
      throw new Error(`Ja existe uma comanda aberta com o numero ${data.number}.`);
    }

    let customerNameSnapshot: string | undefined;
    if (data.customerId) {
      const customer = await tx.customer.findUnique({
        where: {
          id: data.customerId,
        },
        select: {
          id: true,
          fullName: true,
          status: true,
        },
      });

      if (!customer) {
        throw new Error("Cliente selecionado nao encontrado.");
      }

      if (customer.status !== RecordStatus.ACTIVE) {
        throw new Error("Cliente selecionado esta inativo.");
      }

      customerNameSnapshot = customer.fullName;
    }

    return tx.comanda.create({
      data: {
        number: data.number,
        status: ComandaStatus.OPEN,
        isWalkIn: data.isWalkIn,
        customerId: data.customerId,
        customerNameSnapshot,
        openedById: data.openedById,
      },
    });
  });
}

export async function addItemToComanda(data: {
  comandaId: string;
  productId: string;
  quantity: number;
}) {
  return prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findUnique({
      where: {
        id: data.comandaId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!comanda || comanda.status !== ComandaStatus.OPEN) {
      throw new Error("A comanda selecionada nao esta aberta.");
    }

    const product = await tx.product.findUnique({
      where: {
        id: data.productId,
      },
      select: {
        id: true,
        name: true,
        salePrice: true,
        happyHourPrice: true,
        status: true,
      },
    });

    if (!product) {
      throw new Error("Produto nao encontrado.");
    }

    if (product.status !== RecordStatus.ACTIVE) {
      throw new Error(`Produto ${product.name} inativo para venda.`);
    }

    const existingItem = await tx.comandaItem.findUnique({
      where: {
        comandaId_productId: {
          comandaId: data.comandaId,
          productId: data.productId,
        },
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    const happyHourActive = await getHappyHourActiveInTransaction(tx);
    const unitPrice = resolveComandaUnitPrice(product, happyHourActive);

    if (!existingItem) {
      await tx.comandaItem.create({
        data: {
          comandaId: data.comandaId,
          productId: data.productId,
          quantity: data.quantity,
          unitPrice,
          lineTotal: unitPrice.times(data.quantity),
        },
      });
    } else {
      const nextQuantity = existingItem.quantity + data.quantity;
      await tx.comandaItem.update({
        where: {
          id: existingItem.id,
        },
        data: {
          quantity: nextQuantity,
          unitPrice,
          lineTotal: unitPrice.times(nextQuantity),
        },
      });
    }

    await recalculateComandaSubtotal(tx, data.comandaId);
  });
}

export async function updateComandaItemQuantity(data: {
  comandaId: string;
  productId: string;
  quantity: number;
}) {
  return prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findUnique({
      where: {
        id: data.comandaId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!comanda || comanda.status !== ComandaStatus.OPEN) {
      throw new Error("A comanda selecionada nao esta aberta.");
    }

    const item = await tx.comandaItem.findUnique({
      where: {
        comandaId_productId: {
          comandaId: data.comandaId,
          productId: data.productId,
        },
      },
      include: {
        product: {
          select: {
            id: true,
            status: true,
            salePrice: true,
            happyHourPrice: true,
            name: true,
          },
        },
      },
    });

    if (!item) {
      throw new Error("Item da comanda nao encontrado.");
    }

    if (item.product.status !== RecordStatus.ACTIVE) {
      throw new Error(`Produto ${item.product.name} inativo para venda.`);
    }

    const happyHourActive = await getHappyHourActiveInTransaction(tx);
    const unitPrice = resolveComandaUnitPrice(item.product, happyHourActive);

    await tx.comandaItem.update({
      where: {
        id: item.id,
      },
      data: {
        quantity: data.quantity,
        unitPrice,
        lineTotal: unitPrice.times(data.quantity),
      },
    });

    await recalculateComandaSubtotal(tx, data.comandaId);
  });
}

export async function removeItemFromComanda(data: { comandaId: string; productId: string }) {
  return prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findUnique({
      where: {
        id: data.comandaId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!comanda || comanda.status !== ComandaStatus.OPEN) {
      throw new Error("A comanda selecionada nao esta aberta.");
    }

    await tx.comandaItem.delete({
      where: {
        comandaId_productId: {
          comandaId: data.comandaId,
          productId: data.productId,
        },
      },
    });

    await recalculateComandaSubtotal(tx, data.comandaId);
  });
}

export async function updateComandaCustomer(data: { comandaId: string; customerId?: string }) {
  return prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findUnique({
      where: {
        id: data.comandaId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!comanda || comanda.status !== ComandaStatus.OPEN) {
      throw new Error("A comanda selecionada nao esta aberta.");
    }

    let customerNameSnapshot: string | null = null;
    let isWalkIn = true;

    if (data.customerId) {
      const customer = await tx.customer.findUnique({
        where: {
          id: data.customerId,
        },
        select: {
          id: true,
          fullName: true,
          status: true,
        },
      });

      if (!customer) {
        throw new Error("Cliente selecionado nao encontrado.");
      }

      if (customer.status !== RecordStatus.ACTIVE) {
        throw new Error("Cliente selecionado esta inativo.");
      }

      customerNameSnapshot = customer.fullName;
      isWalkIn = false;
    }

    return tx.comanda.update({
      where: {
        id: data.comandaId,
      },
      data: {
        customerId: data.customerId ?? null,
        customerNameSnapshot,
        isWalkIn,
      },
    });
  });
}

export async function cancelComanda(data: {
  comandaId: string;
  cancelledById: string;
  cancelReason: string;
}) {
  return prisma.$transaction(async (tx) => {
    const comanda = await tx.comanda.findUnique({
      where: {
        id: data.comandaId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!comanda || comanda.status !== ComandaStatus.OPEN) {
      throw new Error("A comanda selecionada nao esta aberta.");
    }

    return tx.comanda.update({
      where: {
        id: data.comandaId,
      },
      data: {
        status: ComandaStatus.CANCELLED,
        closedById: data.cancelledById,
        closedAt: new Date(),
        notes: data.cancelReason,
      },
    });
  });
}

export async function closeComandaWithSale(data: {
  comandaId: string;
  cashSessionId: string;
  payments: SalePaymentInput[];
  discountAmount: Prisma.Decimal;
  operatorId: string;
  saleNumber: string;
}) {
  return runWithTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
      const comanda = await tx.comanda.findUnique({
        where: {
          id: data.comandaId,
        },
        include: {
          customer: {
            select: {
              fullName: true,
            },
          },
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
            },
          },
        },
      });

      if (!comanda || comanda.status !== ComandaStatus.OPEN) {
        throw new Error("A comanda selecionada nao esta aberta.");
      }

      if (comanda.items.length === 0) {
        throw new Error("Adicione itens na comanda antes de fechar a venda.");
      }

      const sale = await createSaleWithStockAdjustmentInTransaction(tx, {
        saleNumber: data.saleNumber,
        cashSessionId: data.cashSessionId,
        operatorId: data.operatorId,
        customerName: comanda.customer?.fullName ?? comanda.customerNameSnapshot ?? undefined,
        discountAmount: data.discountAmount,
        items: comanda.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: data.payments,
      });

      await tx.comanda.update({
        where: {
          id: comanda.id,
        },
        data: {
          status: ComandaStatus.CLOSED,
          closedById: data.operatorId,
          closedAt: new Date(),
          closedSaleId: sale.id,
        },
      });

      return sale;
    }, PDV_TRANSACTION_OPTIONS),
  );
}

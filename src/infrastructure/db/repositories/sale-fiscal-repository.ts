import { Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type SaleFiscalSnapshot = {
  id: string;
  saleNumber: string;
  status: SaleStatus;
  customerName: string | null;
  subtotalAmount: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  fiscalReference: string | null;
  payments: Array<{
    method: import("@prisma/client").PaymentMethod;
    amount: Prisma.Decimal;
  }>;
  items: Array<{
    productNameSnapshot: string;
    skuSnapshot: string;
    ncmSnapshot: string | null;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
};

export async function getSaleFiscalSnapshot(saleId: string): Promise<SaleFiscalSnapshot | null> {
  return prisma.sale.findUnique({
    where: {
      id: saleId,
    },
    select: {
      id: true,
      saleNumber: true,
      status: true,
      customerName: true,
      subtotalAmount: true,
      discountAmount: true,
      totalAmount: true,
      fiscalReference: true,
      payments: {
        select: {
          method: true,
          amount: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      items: {
        select: {
          productNameSnapshot: true,
          skuSnapshot: true,
          ncmSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function updateSaleFiscalData(
  saleId: string,
  data: Prisma.SaleUncheckedUpdateInput,
) {
  return prisma.sale.update({
    where: {
      id: saleId,
    },
    data,
    select: {
      id: true,
      fiscalStatus: true,
      fiscalMessage: true,
      fiscalAccessKey: true,
      fiscalDanfeUrl: true,
      fiscalXmlUrl: true,
      fiscalReference: true,
      fiscalUpdatedAt: true,
    },
  });
}

export async function getSaleFiscalStatus(saleId: string) {
  return prisma.sale.findUnique({
    where: {
      id: saleId,
    },
    select: {
      id: true,
      saleNumber: true,
      status: true,
      fiscalReference: true,
      fiscalEnvironment: true,
      fiscalStatus: true,
      fiscalMessage: true,
    },
  });
}

type ListFiscalSalesInput = {
  query?: string;
  startDate?: Date;
  endDate?: Date;
  fiscalStatus?: string;
};

export async function listFiscalSales(input: ListFiscalSalesInput) {
  const normalizedQuery = input.query?.trim();
  const normalizedStatus = input.fiscalStatus?.trim().toUpperCase();

  const where: Prisma.SaleWhereInput = {
    status: SaleStatus.COMPLETED,
    createdAt:
      input.startDate || input.endDate
        ? {
            ...(input.startDate ? { gte: input.startDate } : {}),
            ...(input.endDate ? { lte: input.endDate } : {}),
          }
        : undefined,
    fiscalStatus:
      normalizedStatus && normalizedStatus !== "ALL"
        ? normalizedStatus
        : undefined,
    OR: normalizedQuery
      ? [
          {
            saleNumber: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
          {
            customerName: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
          {
            fiscalAccessKey: {
              contains: normalizedQuery,
              mode: "insensitive",
            },
          },
        ]
      : undefined,
  };

  return prisma.sale.findMany({
    where,
    select: {
      id: true,
      saleNumber: true,
      customerName: true,
      totalAmount: true,
      createdAt: true,
      fiscalStatus: true,
      fiscalMessage: true,
      fiscalEnvironment: true,
      fiscalAccessKey: true,
      fiscalNumber: true,
      fiscalSeries: true,
      fiscalReference: true,
      fiscalXmlUrl: true,
      fiscalDanfeUrl: true,
      cashSession: {
        select: {
          cashRegister: {
            select: {
              name: true,
            },
          },
        },
      },
      operator: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 300,
  });
}

export async function getSaleFiscalDocumentById(saleId: string) {
  return prisma.sale.findUnique({
    where: {
      id: saleId,
    },
    select: {
      id: true,
      saleNumber: true,
      fiscalStatus: true,
      fiscalEnvironment: true,
      fiscalReference: true,
      fiscalXmlUrl: true,
      fiscalAccessKey: true,
      createdAt: true,
    },
  });
}

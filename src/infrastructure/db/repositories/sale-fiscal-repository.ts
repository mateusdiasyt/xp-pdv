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

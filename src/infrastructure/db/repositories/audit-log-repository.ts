import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type CreateAuditLogInput = {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function createAuditLog(input: CreateAuditLogInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function findAuditLogByActionEntity(input: {
  action: string;
  entity: string;
  entityId: string;
}) {
  return prisma.auditLog.findFirst({
    where: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
    },
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
  });
}

export async function listStockXmlImportAuditEntries(stockXmlIds: string[]) {
  if (stockXmlIds.length === 0) {
    return [];
  }

  return prisma.auditLog.findMany({
    where: {
      action: "stock.xml.import",
      entity: "StockInvoiceXml",
      entityId: {
        in: stockXmlIds,
      },
    },
    select: {
      entityId: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function listCashAuditLogs(limit = 250) {
  return prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { startsWith: "cash." } },
        { action: { startsWith: "pdv." } },
      ],
    },
    include: {
      user: {
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
    take: limit,
  });
}

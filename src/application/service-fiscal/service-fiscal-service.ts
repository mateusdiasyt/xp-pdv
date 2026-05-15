import { Prisma, ProductKind, SaleStatus } from "@prisma/client";
import { z } from "zod";

import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import { prisma } from "@/lib/prisma";

export const serviceCnaeLabels: Record<string, string> = {
  "9329804": "93.29-8-04 - Exploracao de jogos eletronicos recreativos",
  "9329803": "93.29-8-03 - Exploracao de jogos de sinuca, bilhar e similares",
};

type ServiceFiscalFiltersInput = {
  startDate?: string;
  endDate?: string;
  serviceCnae?: string;
  status?: string;
};

const serviceDeclarationSchema = z.object({
  serviceCnae: z.string().regex(/^\d{7}$/, "CNAE invalido."),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inicial invalida."),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data final invalida."),
  nfseNumber: z.string().trim().min(1, "Informe o numero da NFS-e emitida.").max(80, "Numero da NFS-e muito longo."),
  nfseIssuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de emissao invalida."),
  notes: z.string().trim().max(500, "Observacao muito longa").optional().or(z.literal("")),
});

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function currentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    startDate: toDateInput(start),
    endDate: toDateInput(end),
  };
}

function parseBrazilianDateStart(value: string) {
  return new Date(`${value}T00:00:00.000-03:00`);
}

function parseBrazilianDateEnd(value: string) {
  return new Date(`${value}T23:59:59.999-03:00`);
}

function normalizeCnae(value?: string) {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized.length === 7 ? normalized : "ALL";
}

function normalizeStatus(value?: string) {
  const normalized = value?.trim().toUpperCase();
  return normalized === "PENDING" || normalized === "DECLARED" ? normalized : "ALL";
}

function serviceDescriptionForCnae(cnae: string, fallback?: string | null) {
  return fallback?.trim() || serviceCnaeLabels[cnae] || `Servico CNAE ${cnae}`;
}

function buildServiceItemWhere(input: {
  startDate: string;
  endDate: string;
  serviceCnae: string;
  status: string;
}): Prisma.SaleItemWhereInput {
  return {
    productKindSnapshot: {
      in: [ProductKind.GAMEPLAY, ProductKind.SERVICE],
    },
    sale: {
      status: SaleStatus.COMPLETED,
      createdAt: {
        gte: parseBrazilianDateStart(input.startDate),
        lte: parseBrazilianDateEnd(input.endDate),
      },
    },
    serviceCnaeSnapshot: input.serviceCnae === "ALL" ? undefined : input.serviceCnae,
    serviceDeclarationId:
      input.status === "PENDING"
        ? null
        : input.status === "DECLARED"
          ? { not: null }
          : undefined,
  };
}

export async function getServiceFiscalApurationData(input: ServiceFiscalFiltersInput) {
  const defaultRange = currentWeekRange();
  const startDate = input.startDate?.trim() || defaultRange.startDate;
  const endDate = input.endDate?.trim() || defaultRange.endDate;
  const serviceCnae = normalizeCnae(input.serviceCnae);
  const status = normalizeStatus(input.status);

  const items = await prisma.saleItem.findMany({
    where: buildServiceItemWhere({ startDate, endDate, serviceCnae, status }),
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          customerName: true,
          createdAt: true,
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
      },
      serviceDeclaration: {
        select: {
          id: true,
          nfseNumber: true,
          nfseIssuedAt: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 500,
  });

  const groupsMap = new Map<
    string,
    {
      serviceCnae: string;
      serviceDescription: string;
      totalAmount: Prisma.Decimal;
      itemCount: number;
      pendingItemCount: number;
      declaredItemCount: number;
    }
  >();

  for (const item of items) {
    const cnae = item.serviceCnaeSnapshot ?? "sem-cnae";
    const currentGroup =
      groupsMap.get(cnae) ??
      {
        serviceCnae: cnae,
        serviceDescription: serviceDescriptionForCnae(cnae, item.serviceDescriptionSnapshot),
        totalAmount: new Prisma.Decimal(0),
        itemCount: 0,
        pendingItemCount: 0,
        declaredItemCount: 0,
      };

    currentGroup.totalAmount = currentGroup.totalAmount.plus(item.lineTotal);
    currentGroup.itemCount += item.quantity;
    if (item.serviceDeclarationId) {
      currentGroup.declaredItemCount += item.quantity;
    } else {
      currentGroup.pendingItemCount += item.quantity;
    }
    groupsMap.set(cnae, currentGroup);
  }

  const totalAmount = items.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
  const pendingAmount = items
    .filter((item) => !item.serviceDeclarationId)
    .reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
  const declaredAmount = totalAmount.minus(pendingAmount);

  return {
    filters: {
      startDate,
      endDate,
      serviceCnae,
      status,
    },
    summary: {
      totalItems: items.length,
      totalAmount,
      pendingAmount,
      declaredAmount,
      pendingItems: items.filter((item) => !item.serviceDeclarationId).length,
      declaredItems: items.filter((item) => item.serviceDeclarationId).length,
    },
    groups: [...groupsMap.values()].sort((first, second) =>
      first.serviceDescription.localeCompare(second.serviceDescription),
    ),
    items,
  };
}

export async function createServiceFiscalDeclarationRecord(input: FormData, actorId: string) {
  const parsed = serviceDeclarationSchema.parse({
    serviceCnae: String(input.get("serviceCnae") ?? "").replace(/\D/g, ""),
    startDate: input.get("startDate"),
    endDate: input.get("endDate"),
    nfseNumber: input.get("nfseNumber"),
    nfseIssuedAt: input.get("nfseIssuedAt"),
    notes: input.get("notes"),
  });

  const pendingItems = await prisma.saleItem.findMany({
    where: buildServiceItemWhere({
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      serviceCnae: parsed.serviceCnae,
      status: "PENDING",
    }),
    select: {
      id: true,
      lineTotal: true,
      quantity: true,
      serviceDescriptionSnapshot: true,
    },
  });

  if (pendingItems.length === 0) {
    throw new Error("Nao ha servicos pendentes para este CNAE e periodo. Contate o Mateus.");
  }

  const totalAmount = pendingItems.reduce((sum, item) => sum.plus(item.lineTotal), new Prisma.Decimal(0));
  const itemCount = pendingItems.reduce((sum, item) => sum + item.quantity, 0);
  const serviceDescription = serviceDescriptionForCnae(parsed.serviceCnae, pendingItems[0]?.serviceDescriptionSnapshot);

  const declaration = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceFiscalDeclaration.create({
      data: {
        serviceCnae: parsed.serviceCnae,
        serviceDescription,
        periodStart: parseBrazilianDateStart(parsed.startDate),
        periodEnd: parseBrazilianDateStart(parsed.endDate),
        totalAmount,
        itemCount,
        nfseNumber: parsed.nfseNumber,
        nfseIssuedAt: parseBrazilianDateStart(parsed.nfseIssuedAt),
        notes: parsed.notes?.trim() || null,
        createdById: actorId,
      },
    });

    await tx.saleItem.updateMany({
      where: {
        id: {
          in: pendingItems.map((item) => item.id),
        },
        serviceDeclarationId: null,
      },
      data: {
        serviceDeclarationId: created.id,
        serviceDeclaredAt: new Date(),
      },
    });

    return created;
  });

  await createAuditLog({
    userId: actorId,
    action: "service-fiscal.declaration.create",
    entity: "ServiceFiscalDeclaration",
    entityId: declaration.id,
    metadata: {
      serviceCnae: declaration.serviceCnae,
      periodStart: parsed.startDate,
      periodEnd: parsed.endDate,
      nfseNumber: declaration.nfseNumber,
      totalAmount: declaration.totalAmount.toString(),
      itemCount: declaration.itemCount,
    },
  });

  return declaration;
}

import { GameplayReleaseStatus, Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function getSaleGameplaySnapshot(saleId: string) {
  return prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      saleNumber: true,
      customerName: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      operator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          gameplayStationId: true,
          gameplayPlanCode: true,
          gameplayDurationMinutes: true,
          quantity: true,
          lineTotal: true,
        },
      },
      gameplayRelease: true,
    },
  });
}

export async function upsertPendingGameplayRelease(data: {
  saleId: string;
  integrationId: string;
  stationId: string;
  planCode: string;
  durationMinutes: number;
  amount: Prisma.Decimal;
  paidAt: Date;
  operator: string;
  customerId?: string;
  requestPayload: Prisma.InputJsonValue;
}) {
  return prisma.gameplayRelease.upsert({
    where: {
      saleId: data.saleId,
    },
    create: {
      saleId: data.saleId,
      integrationId: data.integrationId,
      stationId: data.stationId,
      planCode: data.planCode,
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paidAt: data.paidAt,
      operator: data.operator,
      customerId: data.customerId,
      requestPayload: data.requestPayload,
      status: GameplayReleaseStatus.PENDENTE_ENVIO,
    },
    update: {
      integrationId: data.integrationId,
      stationId: data.stationId,
      planCode: data.planCode,
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paidAt: data.paidAt,
      operator: data.operator,
      customerId: data.customerId,
      requestPayload: data.requestPayload,
      status: GameplayReleaseStatus.PENDENTE_ENVIO,
      lastError: null,
    },
  });
}

export async function markGameplayReleaseResult(data: {
  saleId: string;
  status: GameplayReleaseStatus;
  attemptsToAdd: number;
  responsePayload?: Prisma.InputJsonValue;
  lastError?: string | null;
  releasedUntil?: Date;
}) {
  return prisma.gameplayRelease.update({
    where: {
      saleId: data.saleId,
    },
    data: {
      status: data.status,
      responsePayload: data.responsePayload,
      lastError: data.lastError,
      releasedUntil: data.releasedUntil,
      attempts: {
        increment: data.attemptsToAdd,
      },
      lastAttemptAt: new Date(),
    },
  });
}

export async function markGameplayReleaseFailureWithoutRequest(data: {
  saleId: string;
  requestPayload: Prisma.InputJsonValue;
  stationId: string;
  planCode: string;
  durationMinutes: number;
  amount: Prisma.Decimal;
  paidAt: Date;
  operator: string;
  customerId?: string;
  lastError: string;
}) {
  return prisma.gameplayRelease.upsert({
    where: {
      saleId: data.saleId,
    },
    create: {
      saleId: data.saleId,
      stationId: data.stationId,
      planCode: data.planCode,
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paidAt: data.paidAt,
      operator: data.operator,
      customerId: data.customerId,
      requestPayload: data.requestPayload,
      status: GameplayReleaseStatus.FALHA_ENVIO,
      attempts: 0,
      lastError: data.lastError,
      lastAttemptAt: new Date(),
    },
    update: {
      requestPayload: data.requestPayload,
      stationId: data.stationId,
      planCode: data.planCode,
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paidAt: data.paidAt,
      operator: data.operator,
      customerId: data.customerId,
      status: GameplayReleaseStatus.FALHA_ENVIO,
      lastError: data.lastError,
      lastAttemptAt: new Date(),
    },
  });
}

export async function listGameplayReleases(filters?: {
  status?: GameplayReleaseStatus;
  query?: string;
}) {
  const where: Prisma.GameplayReleaseWhereInput = {};

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.query) {
    where.OR = [
      { sale: { saleNumber: { contains: filters.query, mode: "insensitive" } } },
      { stationId: { contains: filters.query, mode: "insensitive" } },
      { planCode: { contains: filters.query, mode: "insensitive" } },
      { operator: { contains: filters.query, mode: "insensitive" } },
    ];
  }

  return prisma.gameplayRelease.findMany({
    where,
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          status: true,
          fiscalStatus: true,
          createdAt: true,
          totalAmount: true,
          customerName: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 150,
  });
}

export async function countGameplayReleasesByStatus() {
  const [released, pending, failed] = await Promise.all([
    prisma.gameplayRelease.count({ where: { status: GameplayReleaseStatus.LIBERADA } }),
    prisma.gameplayRelease.count({ where: { status: GameplayReleaseStatus.PENDENTE_ENVIO } }),
    prisma.gameplayRelease.count({ where: { status: GameplayReleaseStatus.FALHA_ENVIO } }),
  ]);

  return {
    released,
    pending,
    failed,
  };
}

export async function getPendingGameplayReleases() {
  return prisma.gameplayRelease.findMany({
    where: {
      status: {
        in: [GameplayReleaseStatus.PENDENTE_ENVIO, GameplayReleaseStatus.FALHA_ENVIO],
      },
      sale: {
        status: SaleStatus.COMPLETED,
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: 25,
  });
}

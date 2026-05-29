import { GameplayReleaseStatus, Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const completedSaleOrManualReleaseWhere = {
  OR: [
    {
      saleId: null,
    },
    {
      sale: {
        status: SaleStatus.COMPLETED,
      },
    },
  ],
} satisfies Prisma.GameplayReleaseWhereInput;

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
  serviceStartsAt?: Date;
  preparationSeconds?: number;
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
      serviceStartsAt: data.serviceStartsAt,
      preparationSeconds: data.preparationSeconds,
      releasedUntil: data.releasedUntil,
      attempts: {
        increment: data.attemptsToAdd,
      },
      lastAttemptAt: new Date(),
    },
  });
}

export async function getGameplayReleaseBySaleId(saleId: string) {
  return prisma.gameplayRelease.findUnique({
    where: {
      saleId,
    },
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          status: true,
          createdAt: true,
          totalAmount: true,
        },
      },
    },
  });
}

export async function getActiveGameplayReleaseByStationId(stationId: string, now = new Date()) {
  return prisma.gameplayRelease.findFirst({
    where: {
      stationId,
      status: GameplayReleaseStatus.LIBERADA,
      releasedUntil: {
        gt: now,
      },
      ...completedSaleOrManualReleaseWhere,
    },
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          customerName: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      releasedUntil: "desc",
    },
  });
}

export async function getBusyGameplayReleasesByStationIds(stationIds: string[], now = new Date()) {
  const normalizedStationIds = stationIds
    .map((stationId) => stationId.trim().toLowerCase())
    .filter(Boolean);

  if (normalizedStationIds.length === 0) {
    return [];
  }

  return prisma.gameplayRelease.findMany({
    where: {
      stationId: {
        in: normalizedStationIds,
      },
      AND: [
        completedSaleOrManualReleaseWhere,
        {
          OR: [
            {
              status: GameplayReleaseStatus.LIBERADA,
              releasedUntil: {
                gt: now,
              },
            },
            {
              status: GameplayReleaseStatus.PENDENTE_ENVIO,
            },
          ],
        },
      ],
    },
    include: {
      sale: {
        select: {
          id: true,
          saleNumber: true,
          customerName: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      releasedUntil: "asc",
    },
  });
}

export async function createManualGameplayRelease(data: {
  stationId: string;
  planCode: string;
  durationMinutes: number;
  amount: Prisma.Decimal;
  paidAt: Date;
  operator: string;
  requestPayload: Prisma.InputJsonValue;
  responsePayload: Prisma.InputJsonValue;
  serviceStartsAt: Date;
  preparationSeconds: number;
  releasedUntil: Date;
}) {
  return prisma.gameplayRelease.create({
    data: {
      saleId: null,
      integrationId: "manual-admin",
      stationId: data.stationId,
      planCode: data.planCode,
      durationMinutes: data.durationMinutes,
      amount: data.amount,
      paidAt: data.paidAt,
      operator: data.operator,
      requestPayload: data.requestPayload,
      responsePayload: data.responsePayload,
      status: GameplayReleaseStatus.LIBERADA,
      attempts: 0,
      lastError: null,
      serviceStartsAt: data.serviceStartsAt,
      preparationSeconds: data.preparationSeconds,
      releasedUntil: data.releasedUntil,
      lastAttemptAt: data.paidAt,
    },
  });
}

export async function endActiveGameplayReleaseByStationId(stationId: string, now = new Date()) {
  const activeRelease = await prisma.gameplayRelease.findFirst({
    where: {
      stationId,
      status: GameplayReleaseStatus.LIBERADA,
      releasedUntil: {
        gt: now,
      },
      ...completedSaleOrManualReleaseWhere,
    },
    orderBy: {
      releasedUntil: "desc",
    },
  });

  if (!activeRelease) {
    return null;
  }

  return prisma.gameplayRelease.update({
    where: {
      id: activeRelease.id,
    },
    data: {
      releasedUntil: now,
      responsePayload: {
        status: "ENDED_MANUALLY",
        endedAt: now.toISOString(),
        previousReleasedUntil: activeRelease.releasedUntil?.toISOString() ?? null,
        stationId: activeRelease.stationId,
        planCode: activeRelease.planCode,
      },
      lastError: null,
      lastAttemptAt: now,
    },
  });
}

export async function extendActiveGameplayReleaseByStationId(data: {
  stationId: string;
  minutesToAdd: number;
  operator: string;
  saleId?: string;
  now?: Date;
}) {
  const now = data.now ?? new Date();
  const activeRelease = await prisma.gameplayRelease.findFirst({
    where: {
      stationId: data.stationId,
      status: GameplayReleaseStatus.LIBERADA,
      releasedUntil: {
        gt: now,
      },
      ...completedSaleOrManualReleaseWhere,
    },
    orderBy: {
      releasedUntil: "desc",
    },
  });

  if (!activeRelease?.releasedUntil) {
    return null;
  }

  const releasedUntil = new Date(activeRelease.releasedUntil.getTime() + data.minutesToAdd * 60_000);

  return prisma.gameplayRelease.update({
    where: {
      id: activeRelease.id,
    },
    data: {
      durationMinutes: activeRelease.durationMinutes + data.minutesToAdd,
      releasedUntil,
      responsePayload: {
        status: "EXTENDED",
        extendedAt: now.toISOString(),
        previousReleasedUntil: activeRelease.releasedUntil.toISOString(),
        releasedUntil: releasedUntil.toISOString(),
        stationId: activeRelease.stationId,
        planCode: activeRelease.planCode,
        minutesAdded: data.minutesToAdd,
        operator: data.operator,
        saleId: data.saleId ?? null,
      },
      lastError: null,
      lastAttemptAt: now,
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

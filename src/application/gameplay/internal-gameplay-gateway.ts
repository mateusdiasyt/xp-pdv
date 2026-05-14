import { GameplayReleaseStatus, Prisma } from "@prisma/client";

import { type XpGatewayReleasePayload } from "@/application/gameplay/xp-gateway-client";
import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  getGameplayReleaseBySaleId,
  markGameplayReleaseResult,
  upsertPendingGameplayRelease,
} from "@/infrastructure/db/repositories/gameplay-release-repository";

export type InternalGameplayReleaseResult = {
  status: "LIBERADA";
  saleId: string;
  stationId: string;
  planCode: string;
  durationMinutes: number;
  serviceStartsAt: string;
  preparationSeconds: number;
  preparationEndsAt: string;
  unlockedUntil: string;
  releasedUntil: string;
  message: string;
};

const DEFAULT_PREPARATION_SECONDS = 30;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parsePaidAt(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function calculateServiceWindow(paidAt: Date, durationMinutes: number, preparationSeconds = DEFAULT_PREPARATION_SECONDS) {
  const serviceStartsAt = new Date(paidAt.getTime() + preparationSeconds * 1000);
  const releasedUntil = new Date(serviceStartsAt.getTime() + durationMinutes * 60_000);

  return {
    serviceStartsAt,
    releasedUntil,
  };
}

function buildResponse(
  payload: XpGatewayReleasePayload,
  serviceStartsAt: Date,
  releasedUntil: Date,
  preparationSeconds = DEFAULT_PREPARATION_SECONDS,
): InternalGameplayReleaseResult {
  return {
    status: GameplayReleaseStatus.LIBERADA,
    saleId: payload.saleId,
    stationId: payload.stationId,
    planCode: payload.planCode,
    durationMinutes: payload.durationMinutes,
    serviceStartsAt: serviceStartsAt.toISOString(),
    preparationSeconds,
    preparationEndsAt: serviceStartsAt.toISOString(),
    unlockedUntil: releasedUntil.toISOString(),
    releasedUntil: releasedUntil.toISOString(),
    message: `TV ${payload.stationId.toUpperCase()} em preparacao e liberada automaticamente em ${preparationSeconds}s.`,
  };
}

export async function releaseGameplayInsidePdv(
  payload: XpGatewayReleasePayload,
  actorId?: string,
): Promise<InternalGameplayReleaseResult> {
  const existingRelease = await getGameplayReleaseBySaleId(payload.saleId);

  if (existingRelease?.status === GameplayReleaseStatus.LIBERADA && existingRelease.releasedUntil) {
    return buildResponse(
      payload,
      existingRelease.serviceStartsAt ?? existingRelease.paidAt,
      existingRelease.releasedUntil,
      existingRelease.preparationSeconds,
    );
  }

  const paidAt = parsePaidAt(payload.paidAt);
  const amount = new Prisma.Decimal(payload.amount);
  const { serviceStartsAt, releasedUntil } = calculateServiceWindow(paidAt, payload.durationMinutes);
  const responsePayload = buildResponse(payload, serviceStartsAt, releasedUntil);

  await upsertPendingGameplayRelease({
    saleId: payload.saleId,
    integrationId: payload.integrationId,
    stationId: payload.stationId,
    planCode: payload.planCode,
    durationMinutes: payload.durationMinutes,
    amount,
    paidAt,
    operator: payload.operator,
    customerId: payload.customerId,
    requestPayload: toJsonValue(payload),
  });

  const updatedRelease = await markGameplayReleaseResult({
    saleId: payload.saleId,
    status: GameplayReleaseStatus.LIBERADA,
    attemptsToAdd: 0,
    responsePayload: toJsonValue(responsePayload),
    lastError: null,
    serviceStartsAt,
    preparationSeconds: DEFAULT_PREPARATION_SECONDS,
    releasedUntil,
  });

  await createAuditLog({
    userId: actorId,
    action: "pdv.gameplay.release.internal",
    entity: "GameplayRelease",
    entityId: updatedRelease.id,
    metadata: {
      saleId: payload.saleId,
      stationId: payload.stationId,
      planCode: payload.planCode,
      durationMinutes: payload.durationMinutes,
    },
  });

  return responsePayload;
}

import { GameplayReleaseStatus, Prisma, SaleStatus } from "@prisma/client";

import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  countGameplayReleasesByStatus,
  getSaleGameplaySnapshot,
  listGameplayReleases,
  markGameplayReleaseFailureWithoutRequest,
  markGameplayReleaseResult,
  upsertPendingGameplayRelease,
} from "@/infrastructure/db/repositories/gameplay-release-repository";
import {
  getXpGatewayConfig,
  postGameplayRelease,
  type XpGatewayReleasePayload,
} from "@/application/gameplay/xp-gateway-client";

const XP_GATEWAY_INTEGRATION_ID = "pdv-xp-main";
const FALLBACK_STATION_ID = "sem-estacao";
const FALLBACK_PLAN_CODE = "gameplay";

type GameplayReleaseOutcome = {
  status: "SKIPPED" | GameplayReleaseStatus;
  message: string;
  releasedUntil?: Date | null;
  stationId?: string;
};

function toNumber(value: Prisma.Decimal | number) {
  return Number(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function extractReleasedUntil(responsePayload: unknown, paidAt: Date, durationMinutes: number) {
  if (responsePayload && typeof responsePayload === "object") {
    const payload = responsePayload as Record<string, unknown>;
    const candidates = [
      payload.releasedUntil,
      payload.expiresAt,
      payload.validUntil,
      payload.releaseUntil,
      payload.liberadaAte,
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }

      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return new Date(paidAt.getTime() + durationMinutes * 60_000);
}

function formatReleaseTime(date?: Date | null) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function buildReleaseDraft(
  sale: NonNullable<Awaited<ReturnType<typeof getSaleGameplaySnapshot>>>,
):
  | { type: "none" }
  | {
      type: "valid" | "invalid";
      payload: XpGatewayReleasePayload;
      amount: Prisma.Decimal;
      paidAt: Date;
      error?: string;
    } {
  const gameplayItems = sale.items.filter((item) => item.gameplayPlanCode || item.gameplayDurationMinutes);

  if (gameplayItems.length === 0) {
    return { type: "none" };
  }

  const stationIds = [...new Set(gameplayItems.map((item) => item.gameplayStationId).filter(Boolean) as string[])];
  const planCodes = [...new Set(gameplayItems.map((item) => item.gameplayPlanCode).filter(Boolean) as string[])];
  const durationMinutes = gameplayItems.reduce(
    (total, item) => total + (item.gameplayDurationMinutes ?? 0) * item.quantity,
    0,
  );
  const amount = gameplayItems.reduce((total, item) => total.plus(item.lineTotal), new Prisma.Decimal(0));

  const payload: XpGatewayReleasePayload = {
    integrationId: XP_GATEWAY_INTEGRATION_ID,
    saleId: sale.id,
    stationId: stationIds[0] ?? FALLBACK_STATION_ID,
    planCode: planCodes.length === 1 ? planCodes[0] : planCodes.join("+") || FALLBACK_PLAN_CODE,
    durationMinutes,
    amount: toNumber(amount),
    paidAt: sale.createdAt.toISOString(),
    operator: sale.operator.name,
    customerId: undefined,
  };

  const issues: string[] = [];

  if (sale.status !== SaleStatus.COMPLETED) {
    issues.push("A venda ainda nao esta concluida/paga.");
  }

  if (stationIds.length === 0) {
    issues.push("Selecione a TV/estacao do gameplay.");
  }

  if (stationIds.length > 1) {
    issues.push("Uma venda de gameplay deve liberar apenas uma TV/estacao por vez.");
  }

  if (planCodes.length === 0) {
    issues.push("Produto de gameplay sem codigo de plano.");
  }

  if (durationMinutes <= 0) {
    issues.push("Produto de gameplay sem duracao valida.");
  }

  if (amount.lessThanOrEqualTo(0)) {
    issues.push("Valor de gameplay invalido para liberacao.");
  }

  if (issues.length > 0) {
    return {
      type: "invalid",
      payload,
      amount,
      paidAt: sale.createdAt,
      error: `${issues.join(" ")} Contate o Mateus.`,
    };
  }

  return {
    type: "valid",
    payload,
    amount,
    paidAt: sale.createdAt,
  };
}

export async function triggerGameplayReleaseForSale(
  saleId: string,
  actorId?: string,
): Promise<GameplayReleaseOutcome> {
  try {
    const sale = await getSaleGameplaySnapshot(saleId);

    if (!sale) {
      return {
        status: "SKIPPED",
        message: "Venda nao encontrada para liberacao de gameplay.",
      };
    }

    if (sale.gameplayRelease?.status === GameplayReleaseStatus.LIBERADA) {
      return {
        status: GameplayReleaseStatus.LIBERADA,
        message: `Gameplay ja liberado para ${sale.gameplayRelease.stationId}.`,
        releasedUntil: sale.gameplayRelease.releasedUntil,
        stationId: sale.gameplayRelease.stationId,
      };
    }

    const draft = buildReleaseDraft(sale);

    if (draft.type === "none") {
      return {
        status: "SKIPPED",
        message: "Venda sem item de gameplay.",
      };
    }

    if (draft.type === "invalid") {
      await markGameplayReleaseFailureWithoutRequest({
        saleId: sale.id,
        requestPayload: toJsonValue(draft.payload),
        stationId: draft.payload.stationId,
        planCode: draft.payload.planCode,
        durationMinutes: draft.payload.durationMinutes,
        amount: draft.amount,
        paidAt: draft.paidAt,
        operator: draft.payload.operator,
        customerId: draft.payload.customerId,
        lastError: draft.error ?? "Dados de gameplay invalidos. Contate o Mateus.",
      });

      return {
        status: GameplayReleaseStatus.FALHA_ENVIO,
        message: draft.error ?? "Dados de gameplay invalidos. Contate o Mateus.",
        stationId: draft.payload.stationId,
      };
    }

    await upsertPendingGameplayRelease({
      saleId: sale.id,
      integrationId: draft.payload.integrationId,
      stationId: draft.payload.stationId,
      planCode: draft.payload.planCode,
      durationMinutes: draft.payload.durationMinutes,
      amount: draft.amount,
      paidAt: draft.paidAt,
      operator: draft.payload.operator,
      customerId: draft.payload.customerId,
      requestPayload: toJsonValue(draft.payload),
    });

    const config = getXpGatewayConfig();

    if (!config) {
      const lastError = "XP Gateway nao configurado. Verifique XP_GATEWAY_BASE_URL e XP_GATEWAY_INTEGRATION_KEY. Contate o Mateus.";
      await markGameplayReleaseResult({
        saleId: sale.id,
        status: GameplayReleaseStatus.FALHA_ENVIO,
        attemptsToAdd: 0,
        lastError,
      });

      return {
        status: GameplayReleaseStatus.FALHA_ENVIO,
        message: lastError,
        stationId: draft.payload.stationId,
      };
    }

    const result = await postGameplayRelease(draft.payload, config);
    const releasedUntil = result.ok
      ? extractReleasedUntil(result.responsePayload, draft.paidAt, draft.payload.durationMinutes)
      : undefined;

    const updatedRelease = await markGameplayReleaseResult({
      saleId: sale.id,
      status: result.ok ? GameplayReleaseStatus.LIBERADA : GameplayReleaseStatus.FALHA_ENVIO,
      attemptsToAdd: result.attempts,
      responsePayload: result.responsePayload ? toJsonValue(result.responsePayload) : undefined,
      lastError: result.ok ? null : `${result.errorMessage ?? "Falha ao liberar gameplay."} Contate o Mateus.`,
      releasedUntil,
    });

    await createAuditLog({
      userId: actorId,
      action: result.ok ? "pdv.gameplay.release.success" : "pdv.gameplay.release.failed",
      entity: "GameplayRelease",
      entityId: updatedRelease.id,
      metadata: {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        stationId: draft.payload.stationId,
        status: updatedRelease.status,
        attempts: result.attempts,
      },
    });

    if (!result.ok) {
      return {
        status: GameplayReleaseStatus.FALHA_ENVIO,
        message: `${result.errorMessage ?? "Nao foi possivel liberar gameplay."} Contate o Mateus.`,
        stationId: draft.payload.stationId,
      };
    }

    return {
      status: GameplayReleaseStatus.LIBERADA,
      message: `TV ${draft.payload.stationId.toUpperCase()} liberada ate ${formatReleaseTime(releasedUntil)}.`,
      releasedUntil,
      stationId: draft.payload.stationId,
    };
  } catch (error) {
    console.error("[GAMEPLAY] Falha inesperada na liberacao:", error);
    return {
      status: GameplayReleaseStatus.FALHA_ENVIO,
      message: "A venda foi concluida, mas a liberacao do gameplay falhou. Reenvie pela aba Gameplay. Contate o Mateus.",
    };
  }
}

export async function getGameplayReleaseData(filters?: {
  status?: GameplayReleaseStatus;
  query?: string;
}) {
  const [summary, releases] = await Promise.all([
    countGameplayReleasesByStatus(),
    listGameplayReleases(filters),
  ]);

  return {
    summary,
    releases,
  };
}

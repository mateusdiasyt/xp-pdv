import { GameplayReleaseStatus, Prisma, SaleStatus } from "@prisma/client";

import { createAuditLog } from "@/infrastructure/db/repositories/audit-log-repository";
import {
  countGameplayReleasesByStatus,
  createManualGameplayRelease,
  cancelControllableGameplayReleaseByStationId,
  endActiveGameplayReleaseByStationId,
  getGameplayProductForManualBilling,
  getControllableGameplayReleaseByStationId,
  extendActiveGameplayReleaseByStationId,
  getBusyGameplayReleasesByStationIds,
  getSaleGameplaySnapshot,
  listGameplayReleases,
  markGameplayReleaseFailureWithoutRequest,
  markGameplayReleaseResult,
  pauseActiveGameplayReleaseByStationId,
  resumePausedGameplayReleaseByStationId,
  upsertPendingGameplayRelease,
} from "@/infrastructure/db/repositories/gameplay-release-repository";
import {
  getXpGatewayConfig,
  postGameplayRelease,
  type XpGatewayReleasePayload,
} from "@/application/gameplay/xp-gateway-client";
import { releaseGameplayInsidePdv } from "@/application/gameplay/internal-gameplay-gateway";

const XP_GATEWAY_INTEGRATION_ID = "pdv-xp-main";
const FALLBACK_STATION_ID = "sem-estacao";
const FALLBACK_PLAN_CODE = "gameplay";
const MANUAL_FREE_RELEASE_UNTIL = new Date("2099-12-31T23:59:59.000Z");
export const MANUAL_PAID_OPEN_PLAN_CODE = "MANUAL-LIVRE-PAGO";
const MANUAL_PAID_OPEN_MODE = "OPEN_PAID";

const manualReleaseDurations = {
  "15": { label: "15 min", durationMinutes: 15, planCode: "MANUAL-15" },
  "30": { label: "30 min", durationMinutes: 30, planCode: "MANUAL-30" },
  "45": { label: "45 min", durationMinutes: 45, planCode: "MANUAL-45" },
  "60": { label: "1h", durationMinutes: 60, planCode: "MANUAL-60" },
  FREE: { label: "Livre", durationMinutes: 0, planCode: "MANUAL-LIVRE" },
} as const;

type ManualReleaseDurationKey = keyof typeof manualReleaseDurations;

type GameplayReleaseOutcome = {
  status: "SKIPPED" | GameplayReleaseStatus;
  message: string;
  releasedUntil?: Date | null;
  serviceStartsAt?: Date | null;
  stationId?: string;
};

export type ManualPaidOpenBillingConfig = {
  mode: typeof MANUAL_PAID_OPEN_MODE;
  productId: string;
  productName: string;
  productPlanCode: string;
  categoryId: string;
  baseDurationMinutes: number;
  basePriceInCents: number;
};

export type ManualPaidOpenCharge = ManualPaidOpenBillingConfig & {
  startedAt: Date;
  elapsedMinutes: number;
  billedMinutes: number;
  amountInCents: number;
  amount: Prisma.Decimal;
  pricePerMinuteInCents: number;
};

type ManualPaidOpenReleaseSource = {
  planCode: string;
  paidAt: Date;
  serviceStartsAt?: Date | null;
  requestPayload: unknown;
};

function toNumber(value: Prisma.Decimal | number) {
  return Number(value);
}

function moneyToCents(value: Prisma.Decimal | number) {
  return Math.round(toNumber(value) * 100);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readPositiveInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readNonNegativeInteger(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function roundServiceMinutesUp(minutes: number) {
  return Math.max(5, Math.ceil(Math.max(1, minutes) / 5) * 5);
}

export function getManualPaidOpenBillingConfig(
  release?: Pick<ManualPaidOpenReleaseSource, "planCode" | "requestPayload"> | null,
): ManualPaidOpenBillingConfig | null {
  if (!release || release.planCode !== MANUAL_PAID_OPEN_PLAN_CODE || !isRecord(release.requestPayload)) {
    return null;
  }

  const payload = release.requestPayload;
  const mode = readString(payload.manualBillingMode);
  const productId = readString(payload.billingProductId);
  const productName = readString(payload.billingProductName);
  const productPlanCode = readString(payload.billingPlanCode);
  const categoryId = readString(payload.billingCategoryId);
  const baseDurationMinutes = readPositiveInteger(payload.billingDurationMinutes);
  const basePriceInCents = readPositiveInteger(payload.billingBasePriceInCents);

  if (
    mode !== MANUAL_PAID_OPEN_MODE ||
    !productId ||
    !productName ||
    !productPlanCode ||
    !categoryId ||
    !baseDurationMinutes ||
    !basePriceInCents
  ) {
    return null;
  }

  return {
    mode: MANUAL_PAID_OPEN_MODE,
    productId,
    productName,
    productPlanCode,
    categoryId,
    baseDurationMinutes,
    basePriceInCents,
  };
}

export function calculateManualPaidOpenCharge(
  release: ManualPaidOpenReleaseSource,
  now = new Date(),
): ManualPaidOpenCharge | null {
  const config = getManualPaidOpenBillingConfig(release);
  if (!config) {
    return null;
  }

  const startedAt = release.serviceStartsAt ?? release.paidAt;
  const elapsedMilliseconds = Math.max(0, now.getTime() - startedAt.getTime());
  const elapsedMinutes = Math.max(1, Math.ceil(elapsedMilliseconds / 60_000));
  const billedMinutes = roundServiceMinutesUp(elapsedMinutes);
  const amountInCents = Math.max(
    1,
    Math.round((config.basePriceInCents * billedMinutes) / config.baseDurationMinutes),
  );

  return {
    ...config,
    startedAt,
    elapsedMinutes,
    billedMinutes,
    amountInCents,
    amount: new Prisma.Decimal(amountInCents).dividedBy(100).toDecimalPlaces(2),
    pricePerMinuteInCents: config.basePriceInCents / config.baseDurationMinutes,
  };
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function getPayloadRecord(value: unknown) {
  return isRecord(value) ? value : {};
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
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPreparationMessage(stationId: string, serviceStartsAt?: Date | null, releasedUntil?: Date | null) {
  const stationLabel = stationId.toUpperCase();
  const startTime = formatReleaseTime(serviceStartsAt);
  const endTime = formatReleaseTime(releasedUntil);

  if (startTime && endTime) {
    return `TV ${stationLabel} prepara por 30s, inicia às ${startTime} e termina às ${endTime}.`;
  }

  if (endTime) {
    return `TV ${stationLabel} liberada até ${endTime}.`;
  }

  return `TV ${stationLabel} liberada.`;
}

function isManualReleaseDurationKey(value: string): value is ManualReleaseDurationKey {
  return value in manualReleaseDurations;
}

function formatManualReleaseMessage(stationId: string, label: string, releasedUntil: Date) {
  const stationLabel = stationId.toUpperCase();

  if (label === "Livre") {
    return `${stationLabel} liberada em modo livre até encerramento manual.`;
  }

  return `${stationLabel} liberada por ${label}, até ${formatReleaseTime(releasedUntil)}.`;
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

export async function prepareGameplayReleaseForSale(
  saleId: string,
  actorId?: string,
): Promise<GameplayReleaseOutcome> {
  try {
    const sale = await getSaleGameplaySnapshot(saleId);

    if (!sale) {
      return {
        status: "SKIPPED",
        message: "Venda nao encontrada para preparar liberacao de gameplay.",
      };
    }

    if (sale.gameplayRelease?.status === GameplayReleaseStatus.LIBERADA) {
      return {
        status: GameplayReleaseStatus.LIBERADA,
        message: formatPreparationMessage(
          sale.gameplayRelease.stationId,
          sale.gameplayRelease.serviceStartsAt,
          sale.gameplayRelease.releasedUntil,
        ),
        releasedUntil: sale.gameplayRelease.releasedUntil,
        serviceStartsAt: sale.gameplayRelease.serviceStartsAt,
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

    const release = await upsertPendingGameplayRelease({
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

    await createAuditLog({
      userId: actorId,
      action: "pdv.gameplay.release.queue",
      entity: "GameplayRelease",
      entityId: release.id,
      metadata: {
        saleId: sale.id,
        saleNumber: sale.saleNumber,
        stationId: draft.payload.stationId,
        planCode: draft.payload.planCode,
        durationMinutes: draft.payload.durationMinutes,
      },
    });

    return {
      status: GameplayReleaseStatus.PENDENTE_ENVIO,
      message: `Liberacao da ${draft.payload.stationId.toUpperCase()} enfileirada em segundo plano.`,
      stationId: draft.payload.stationId,
    };
  } catch (error) {
    console.error("[GAMEPLAY] Falha ao preparar liberacao:", error);
    return {
      status: GameplayReleaseStatus.FALHA_ENVIO,
      message:
        "A venda foi concluida, mas a preparacao da liberacao falhou. Reenvie pela aba Servicos. Contate o Mateus.",
    };
  }
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
        message: formatPreparationMessage(
          sale.gameplayRelease.stationId,
          sale.gameplayRelease.serviceStartsAt,
          sale.gameplayRelease.releasedUntil,
        ),
        releasedUntil: sale.gameplayRelease.releasedUntil,
        serviceStartsAt: sale.gameplayRelease.serviceStartsAt,
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
      const internalResult = await releaseGameplayInsidePdv(draft.payload, actorId);
      const releasedUntil = new Date(internalResult.releasedUntil);
      const serviceStartsAt = new Date(internalResult.serviceStartsAt);

      return {
        status: GameplayReleaseStatus.LIBERADA,
        message: formatPreparationMessage(draft.payload.stationId, serviceStartsAt, releasedUntil),
        releasedUntil,
        serviceStartsAt,
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
      message: formatPreparationMessage(draft.payload.stationId, undefined, releasedUntil),
      releasedUntil,
      stationId: draft.payload.stationId,
    };
  } catch (error) {
    console.error("[GAMEPLAY] Falha inesperada na liberacao:", error);
    return {
      status: GameplayReleaseStatus.FALHA_ENVIO,
      message: "A venda foi concluida, mas a liberacao do servico falhou. Reenvie pela aba Servicos. Contate o Mateus.",
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

export async function getManualPaidOpenChargeByStationId(stationId: string, now = new Date()) {
  const normalizedStationId = stationId.trim().toLowerCase();
  if (!normalizedStationId) {
    return null;
  }

  const activeRelease = (await getBusyGameplayReleasesByStationIds([normalizedStationId], now))[0];
  if (!activeRelease || activeRelease.stationId !== normalizedStationId) {
    return null;
  }

  const charge = calculateManualPaidOpenCharge(activeRelease, now);
  if (!charge) {
    return null;
  }

  return {
    release: activeRelease,
    charge,
  };
}

export async function releaseManualGameplayStation(data: {
  stationId: string;
  durationPreset: string;
  operator: string;
  actorId?: string;
  billingMode?: "PAID_OPEN";
  billingProductId?: string;
}) {
  const stationId = data.stationId.trim().toLowerCase();

  if (!stationId) {
    throw new Error("Informe a TV para liberar manualmente.");
  }

  if (!isManualReleaseDurationKey(data.durationPreset)) {
    throw new Error("Selecione um tempo valido para liberar o servico.");
  }

  const busyRelease = (await getBusyGameplayReleasesByStationIds([stationId]))[0];

  if (busyRelease?.status === GameplayReleaseStatus.PENDENTE_ENVIO) {
    throw new Error(
      `${stationId.toUpperCase()} tem uma liberacao pendente. Aguarde alguns segundos ou reenvie pela aba Servicos.`,
    );
  }

  if (busyRelease?.releasedUntil) {
    throw new Error(
      `${stationId.toUpperCase()} ja esta em uso. Encerre o tempo atual antes de liberar novamente.`,
    );
  }

  const option = manualReleaseDurations[data.durationPreset];
  const isPaidOpenRelease = option.durationMinutes === 0 && data.billingMode === "PAID_OPEN";
  const billingProduct = isPaidOpenRelease
    ? await getGameplayProductForManualBilling(String(data.billingProductId ?? ""))
    : null;

  if (isPaidOpenRelease) {
    if (!billingProduct) {
      throw new Error("Selecione o produto/servico que define o valor do tempo livre.");
    }

    if (!billingProduct.gameplayPlanCode || !billingProduct.gameplayDurationMinutes) {
      throw new Error(`Produto ${billingProduct.name} precisa de plano e duracao configurados.`);
    }

    if (billingProduct.salePrice.lessThanOrEqualTo(0)) {
      throw new Error(`Produto ${billingProduct.name} precisa ter valor de venda maior que zero.`);
    }
  }

  const now = new Date();
  const releasedUntil =
    option.durationMinutes === 0 ? MANUAL_FREE_RELEASE_UNTIL : new Date(now.getTime() + option.durationMinutes * 60_000);
  const billingPayload = billingProduct
    ? {
        manualBillingMode: MANUAL_PAID_OPEN_MODE,
        billingProductId: billingProduct.id,
        billingProductName: billingProduct.name,
        billingProductSku: billingProduct.sku,
        billingPlanCode: billingProduct.gameplayPlanCode,
        billingDurationMinutes: billingProduct.gameplayDurationMinutes,
        billingBasePriceInCents: moneyToCents(billingProduct.salePrice),
        billingCategoryId: billingProduct.categoryId,
      }
    : {};
  const planCode = isPaidOpenRelease ? MANUAL_PAID_OPEN_PLAN_CODE : option.planCode;
  const requestPayload = {
    integrationId: "manual-admin",
    saleId: null,
    stationId,
    planCode,
    durationMinutes: option.durationMinutes,
    amount: 0,
    paidAt: now.toISOString(),
    operator: data.operator,
    manualRelease: true,
    ...billingPayload,
  };
  const responsePayload = {
    status: GameplayReleaseStatus.LIBERADA,
    stationId,
    planCode,
    durationMinutes: option.durationMinutes,
    serviceStartsAt: now.toISOString(),
    preparationSeconds: 0,
    releasedUntil: releasedUntil.toISOString(),
    manualRelease: true,
    ...billingPayload,
  };

  const release = await createManualGameplayRelease({
    stationId,
    planCode,
    durationMinutes: option.durationMinutes,
    amount: new Prisma.Decimal(0),
    paidAt: now,
    operator: data.operator,
    requestPayload: toJsonValue(requestPayload),
    responsePayload: toJsonValue(responsePayload),
    serviceStartsAt: now,
    preparationSeconds: 0,
    releasedUntil,
  });

  await createAuditLog({
    userId: data.actorId,
    action: "admin.services.manual_release",
    entity: "GameplayRelease",
    entityId: release.id,
    metadata: {
      stationId,
      planCode,
      durationMinutes: option.durationMinutes,
      manualRelease: true,
      manualBillingMode: billingProduct ? MANUAL_PAID_OPEN_MODE : undefined,
      billingProductId: billingProduct?.id,
    },
  });

  return {
    release,
    message: billingProduct
      ? `${stationId.toUpperCase()} liberada em modo livre pago. Cobranca calculada no encerramento.`
      : formatManualReleaseMessage(stationId, option.label, releasedUntil),
  };
}

export async function extendManualGameplayStation(data: {
  stationId: string;
  durationPreset: string;
  operator: string;
  actorId?: string;
  saleId?: string;
}) {
  const stationId = data.stationId.trim().toLowerCase();

  if (!stationId) {
    throw new Error("Informe a TV para adicionar tempo.");
  }

  if (!isManualReleaseDurationKey(data.durationPreset) || data.durationPreset === "FREE") {
    throw new Error("Selecione um tempo válido para adicionar.");
  }

  const option = manualReleaseDurations[data.durationPreset];
  const release = await extendActiveGameplayReleaseByStationId({
    stationId,
    minutesToAdd: option.durationMinutes,
    operator: data.operator,
    saleId: data.saleId,
  });

  if (!release?.releasedUntil) {
    throw new Error(`${stationId.toUpperCase()} está livre. Use Liberar para iniciar um tempo novo.`);
  }

  await createAuditLog({
    userId: data.actorId,
    action: "admin.services.manual_extend",
    entity: "GameplayRelease",
    entityId: release.id,
    metadata: {
      stationId,
      minutesAdded: option.durationMinutes,
      saleId: data.saleId,
    },
  });

  return {
    release,
    message: `${stationId.toUpperCase()} recebeu +${option.label}. Agora vai até ${formatReleaseTime(release.releasedUntil)}.`,
  };
}

export async function pauseManualGameplayStation(data: {
  stationId: string;
  operator: string;
  actorId?: string;
}) {
  const stationId = data.stationId.trim().toLowerCase();

  if (!stationId) {
    throw new Error("Informe a TV para pausar.");
  }

  const now = new Date();
  const release = await getControllableGameplayReleaseByStationId(stationId, now);

  if (!release || release.status !== GameplayReleaseStatus.LIBERADA || !release.releasedUntil) {
    throw new Error(`${stationId.toUpperCase()} nao possui tempo rodando para pausar.`);
  }

  const previousPayload = getPayloadRecord(release.responsePayload);
  const paidOpenConfig = getManualPaidOpenBillingConfig(release);
  const serviceStartsAt = release.serviceStartsAt ?? release.paidAt;
  const accumulatedActiveSeconds = paidOpenConfig
    ? Math.max(1, Math.ceil(Math.max(0, now.getTime() - serviceStartsAt.getTime()) / 1000))
    : null;
  const remainingSeconds =
    paidOpenConfig || release.planCode === "MANUAL-LIVRE"
      ? null
      : Math.max(1, Math.ceil(Math.max(0, release.releasedUntil.getTime() - now.getTime()) / 1000));

  const pausedRelease = await pauseActiveGameplayReleaseByStationId(stationId, {
    now,
    responsePayload: toJsonValue({
      ...previousPayload,
      status: "PAUSED",
      pausedAt: now.toISOString(),
      stationId,
      planCode: release.planCode,
      previousReleasedUntil: release.releasedUntil.toISOString(),
      remainingSeconds,
      accumulatedActiveSeconds,
      operator: data.operator,
    }),
  });

  if (!pausedRelease) {
    throw new Error(`${stationId.toUpperCase()} nao possui tempo rodando para pausar.`);
  }

  await createAuditLog({
    userId: data.actorId,
    action: "admin.services.manual_pause",
    entity: "GameplayRelease",
    entityId: pausedRelease.id,
    metadata: {
      stationId,
      saleId: pausedRelease.saleId,
      remainingSeconds,
      accumulatedActiveSeconds,
    },
  });

  return {
    release: pausedRelease,
    message: `${stationId.toUpperCase()} pausada.`,
  };
}

export async function resumeManualGameplayStation(data: {
  stationId: string;
  operator: string;
  actorId?: string;
}) {
  const stationId = data.stationId.trim().toLowerCase();

  if (!stationId) {
    throw new Error("Informe a TV para retomar.");
  }

  const now = new Date();
  const release = await getControllableGameplayReleaseByStationId(stationId, now);

  if (!release || release.status !== GameplayReleaseStatus.PAUSADA) {
    throw new Error(`${stationId.toUpperCase()} nao possui tempo pausado para retomar.`);
  }

  const previousPayload = getPayloadRecord(release.responsePayload);
  const paidOpenConfig = getManualPaidOpenBillingConfig(release);
  const accumulatedActiveSeconds = readNonNegativeInteger(previousPayload.accumulatedActiveSeconds) ?? 0;
  const remainingSeconds = readPositiveInteger(previousPayload.remainingSeconds);
  const isManualFree = release.planCode === "MANUAL-LIVRE";
  const serviceStartsAt = paidOpenConfig
    ? new Date(now.getTime() - accumulatedActiveSeconds * 1000)
    : now;
  const releasedUntil =
    paidOpenConfig || isManualFree
      ? MANUAL_FREE_RELEASE_UNTIL
      : new Date(now.getTime() + (remainingSeconds ?? Math.max(1, release.durationMinutes * 60)) * 1000);

  const resumedRelease = await resumePausedGameplayReleaseByStationId(stationId, {
    now,
    serviceStartsAt,
    releasedUntil,
    responsePayload: toJsonValue({
      ...previousPayload,
      status: "RESUMED",
      resumedAt: now.toISOString(),
      stationId,
      planCode: release.planCode,
      releasedUntil: releasedUntil.toISOString(),
      accumulatedActiveSeconds: paidOpenConfig ? accumulatedActiveSeconds : null,
      operator: data.operator,
    }),
  });

  if (!resumedRelease) {
    throw new Error(`${stationId.toUpperCase()} nao possui tempo pausado para retomar.`);
  }

  await createAuditLog({
    userId: data.actorId,
    action: "admin.services.manual_resume",
    entity: "GameplayRelease",
    entityId: resumedRelease.id,
    metadata: {
      stationId,
      saleId: resumedRelease.saleId,
      remainingSeconds,
      accumulatedActiveSeconds,
    },
  });

  return {
    release: resumedRelease,
    message: `${stationId.toUpperCase()} retomada.`,
  };
}

export async function cancelManualGameplayStation(data: {
  stationId: string;
  operator: string;
  reason: string;
  actorId?: string;
}) {
  const stationId = data.stationId.trim().toLowerCase();
  const reason = data.reason.trim();

  if (!stationId) {
    throw new Error("Informe a TV para cancelar.");
  }

  if (reason.length < 3) {
    throw new Error("Informe o motivo do cancelamento.");
  }

  const now = new Date();
  const release = await getControllableGameplayReleaseByStationId(stationId, now);

  if (!release) {
    throw new Error(`${stationId.toUpperCase()} nao possui tempo ativo ou pausado para cancelar.`);
  }

  const previousPayload = getPayloadRecord(release.responsePayload);
  const cancelledRelease = await cancelControllableGameplayReleaseByStationId(stationId, {
    now,
    responsePayload: toJsonValue({
      ...previousPayload,
      status: "CANCELLED_MANUALLY",
      cancelledAt: now.toISOString(),
      stationId,
      planCode: release.planCode,
      reason,
      operator: data.operator,
      saleId: release.saleId,
    }),
  });

  if (!cancelledRelease) {
    throw new Error(`${stationId.toUpperCase()} nao possui tempo ativo ou pausado para cancelar.`);
  }

  await createAuditLog({
    userId: data.actorId,
    action: "admin.services.manual_cancel",
    entity: "GameplayRelease",
    entityId: cancelledRelease.id,
    metadata: {
      stationId,
      saleId: release.saleId,
      reason,
    },
  });

  return {
    release: cancelledRelease,
    saleId: release.saleId,
    saleNumber: release.sale?.saleNumber,
    message: release.saleId
      ? `${stationId.toUpperCase()} cancelada. Venda vinculada enviada para cancelamento.`
      : `${stationId.toUpperCase()} cancelada sem gerar venda.`,
  };
}

export async function endManualGameplayStation(data: {
  stationId: string;
  operator: string;
  actorId?: string;
  saleId?: string;
  amount?: Prisma.Decimal;
  durationMinutes?: number;
  billingPayload?: Prisma.InputJsonValue;
}) {
  const stationId = data.stationId.trim().toLowerCase();

  if (!stationId) {
    throw new Error("Informe a TV para encerrar o tempo.");
  }

  const endedRelease = await endActiveGameplayReleaseByStationId(stationId, {
    saleId: data.saleId,
    amount: data.amount,
    durationMinutes: data.durationMinutes,
    billingPayload: data.billingPayload,
  });

  if (!endedRelease) {
    return {
      release: null,
      message: `${stationId.toUpperCase()} ja esta livre. Nenhum tempo ativo para encerrar.`,
    };
  }

  await createAuditLog({
    userId: data.actorId,
    action: "admin.services.manual_end",
    entity: "GameplayRelease",
    entityId: endedRelease.id,
    metadata: {
      stationId,
      operator: data.operator,
      previousReleasedUntil: endedRelease.responsePayload,
      saleId: data.saleId,
      amount: data.amount?.toString(),
      durationMinutes: data.durationMinutes,
    },
  });

  return {
    release: endedRelease,
    message: data.saleId
      ? `${stationId.toUpperCase()} encerrada e venda registrada. A TV volta ao bloqueio na proxima consulta.`
      : `${stationId.toUpperCase()} encerrada manualmente. A TV volta ao bloqueio na proxima consulta.`,
  };
}

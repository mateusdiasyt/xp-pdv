import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PlatformTenantStatus, Prisma } from "@prisma/client";
import { z } from "zod";

import {
  buildPlanExpirationFromCycle,
  formatCentsToBRL,
  getPlatformPlanPrice,
  normalizePlatformBillingCycle,
  normalizePlatformPlanName,
  type PlatformBillingCycleMonths,
} from "@/domain/platform/billing-plans";
import type { PlatformPlanName } from "@/domain/platform/plan-entitlements";
import { getPlatformPrisma } from "@/lib/prisma";
import { approvePlatformTenant } from "@/application/platform/platform-service";
import { resolveMercadoPagoGatewayCredentials } from "@/application/platform/gateway-service";

const MERCADO_PAGO_API_URL = "https://api.mercadopago.com";
const MERCADO_PAGO_PROVIDER = "mercado-pago";

const checkoutSchema = z.object({
  tenantId: z.string().trim().min(1, "Cliente invalido."),
  planName: z.string().transform((value) => normalizePlatformPlanName(value)),
  billingCycleMonths: z.string().or(z.number()).transform((value) => normalizePlatformBillingCycle(value)),
});

let platformBillingTablesPromise: Promise<void> | null = null;

type MercadoPagoPreapprovalResponse = {
  id?: string;
  init_point?: string;
  status?: string;
  external_reference?: string;
  payer_email?: string;
  reason?: string;
  next_payment_date?: string;
  date_created?: string;
  last_modified?: string;
};

type MercadoPagoPaymentResponse = {
  id?: string | number;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  preapproval_id?: string;
  date_approved?: string;
  date_created?: string;
  transaction_amount?: number;
};

export type PlatformBillingSummary = {
  tenantId: string;
  subscriptionId: string;
  planName: string;
  billingCycleMonths: number;
  amountCents: number;
  status: string;
  mercadoPagoPreapprovalId: string | null;
  mercadoPagoInitPoint: string | null;
  nextPaymentAt: Date | null;
  lastPaymentAt: Date | null;
  updatedAt: Date;
};

export type TenantPaymentPortalState = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantStatus: string;
  ownerEmail: string;
  planName: string | null;
  planStatus: string;
  latestSubscription: PlatformBillingSummary | null;
};

function getSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://xp-pdv.vercel.app").replace(
    /\/$/,
    "",
  );
}

function parseDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeMercadoPagoStatus(status: string | null | undefined) {
  return status?.trim().toLowerCase() || "unknown";
}

function isActiveSubscriptionStatus(status: string) {
  return ["authorized", "active"].includes(normalizeMercadoPagoStatus(status));
}

function isInactiveSubscriptionStatus(status: string) {
  return ["cancelled", "canceled", "paused", "rejected"].includes(normalizeMercadoPagoStatus(status));
}

function toJsonInput(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function buildMercadoPagoSubscriptionEndDate() {
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 10);
  return endDate.toISOString();
}

export async function ensurePlatformBillingTables() {
  if (!platformBillingTablesPromise) {
    const prisma = getPlatformPrisma();

    platformBillingTablesPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PlatformSubscription" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "planName" TEXT NOT NULL,
          "billingCycleMonths" INTEGER NOT NULL,
          "amountCents" INTEGER NOT NULL,
          "currency" TEXT NOT NULL DEFAULT 'BRL',
          "status" TEXT NOT NULL DEFAULT 'pending',
          "mercadoPagoPreapprovalId" TEXT,
          "mercadoPagoInitPoint" TEXT,
          "mercadoPagoExternalReference" TEXT NOT NULL,
          "payerEmail" TEXT NOT NULL,
          "reason" TEXT NOT NULL,
          "nextPaymentAt" TIMESTAMP(3),
          "lastPaymentAt" TIMESTAMP(3),
          "activatedAt" TIMESTAMP(3),
          "cancelledAt" TIMESTAMP(3),
          "lastWebhookAt" TIMESTAMP(3),
          "rawSnapshot" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PlatformSubscription_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSubscription_mercadoPagoPreapprovalId_key"
          ON "PlatformSubscription"("mercadoPagoPreapprovalId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "PlatformSubscription_mercadoPagoExternalReference_key"
          ON "PlatformSubscription"("mercadoPagoExternalReference")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformSubscription_tenantId_idx"
          ON "PlatformSubscription"("tenantId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformSubscription_status_idx"
          ON "PlatformSubscription"("status")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformSubscription_planName_idx"
          ON "PlatformSubscription"("planName")
      `);

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PlatformPaymentEvent" (
          "id" TEXT NOT NULL,
          "provider" TEXT NOT NULL DEFAULT 'mercado-pago',
          "eventType" TEXT NOT NULL,
          "resourceId" TEXT,
          "action" TEXT,
          "subscriptionId" TEXT,
          "tenantId" TEXT,
          "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "processedAt" TIMESTAMP(3),
          "status" TEXT NOT NULL DEFAULT 'received',
          "message" TEXT,
          "payload" JSONB,
          CONSTRAINT "PlatformPaymentEvent_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformPaymentEvent_provider_idx"
          ON "PlatformPaymentEvent"("provider")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformPaymentEvent_eventType_idx"
          ON "PlatformPaymentEvent"("eventType")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformPaymentEvent_resourceId_idx"
          ON "PlatformPaymentEvent"("resourceId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformPaymentEvent_subscriptionId_idx"
          ON "PlatformPaymentEvent"("subscriptionId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformPaymentEvent_tenantId_idx"
          ON "PlatformPaymentEvent"("tenantId")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformPaymentEvent_status_idx"
          ON "PlatformPaymentEvent"("status")
      `);
    })()
      .then(() => undefined)
      .catch((error) => {
        platformBillingTablesPromise = null;
        throw error;
      });
  }

  return platformBillingTablesPromise;
}

async function mercadoPagoRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const credentials = await resolveMercadoPagoGatewayCredentials();

  if (!credentials) {
    throw new Error("Configure o gateway Mercado Pago no super admin antes de cobrar assinaturas.");
  }

  const response = await fetch(`${MERCADO_PAGO_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("[MERCADO_PAGO] request failed", {
      path,
      status: response.status,
      body: body.slice(0, 500),
    });
    throw new Error(`Mercado Pago respondeu ${response.status}${body ? `: ${body.slice(0, 220)}` : "."}`);
  }

  return response.json() as Promise<T>;
}

async function fetchMercadoPagoPreapproval(preapprovalId: string) {
  return mercadoPagoRequest<MercadoPagoPreapprovalResponse>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
}

async function fetchMercadoPagoPayment(paymentId: string) {
  return mercadoPagoRequest<MercadoPagoPaymentResponse>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

async function activateTenantPlan(subscriptionId: string, sourceStatus: string, baseDate = new Date()) {
  await ensurePlatformBillingTables();
  const prisma = getPlatformPrisma();
  const subscription = await prisma.platformSubscription.findUnique({
    where: { id: subscriptionId },
    include: { tenant: true },
  });

  if (!subscription) {
    throw new Error("Assinatura nao encontrada para ativacao.");
  }

  const planName = normalizePlatformPlanName(subscription.planName);
  const cycle = normalizePlatformBillingCycle(subscription.billingCycleMonths);
  const planExpiresAt = subscription.nextPaymentAt ?? buildPlanExpirationFromCycle(cycle, baseDate);

  if (
    subscription.tenant.status === PlatformTenantStatus.PENDING ||
    subscription.tenant.status === PlatformTenantStatus.FAILED ||
    (subscription.tenant.status === PlatformTenantStatus.SUSPENDED && !subscription.tenant.databaseName)
  ) {
    await approvePlatformTenant(subscription.tenantId);
  }

  await prisma.platformTenant.update({
    where: { id: subscription.tenantId },
    data: {
      status: PlatformTenantStatus.ACTIVE,
      planName,
      planStatus: "active",
      planExpiresAt,
      suspendedAt: null,
      lastProvisioningError: null,
    },
  });

  await prisma.platformSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: normalizeMercadoPagoStatus(sourceStatus),
      activatedAt: subscription.activatedAt ?? new Date(),
    },
  });
}

async function suspendTenantPlanFromSubscription(subscriptionId: string, sourceStatus: string) {
  await ensurePlatformBillingTables();
  const prisma = getPlatformPrisma();
  const subscription = await prisma.platformSubscription.findUnique({
    where: { id: subscriptionId },
    include: { tenant: true },
  });

  if (!subscription) {
    return;
  }

  await prisma.platformSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: normalizeMercadoPagoStatus(sourceStatus),
      cancelledAt: ["cancelled", "canceled"].includes(normalizeMercadoPagoStatus(sourceStatus))
        ? new Date()
        : subscription.cancelledAt,
    },
  });

  if (subscription.tenant.planName === subscription.planName) {
    await prisma.platformTenant.update({
      where: { id: subscription.tenantId },
      data: {
        planStatus: "suspended",
        planExpiresAt: new Date(),
      },
    });
  }
}

async function applyPreapprovalSnapshot(preapproval: MercadoPagoPreapprovalResponse) {
  await ensurePlatformBillingTables();
  const prisma = getPlatformPrisma();
  const preapprovalId = preapproval.id;
  const externalReference = preapproval.external_reference;

  if (!preapprovalId && !externalReference) {
    throw new Error("Mercado Pago nao retornou identificador da assinatura.");
  }

  const subscription = await prisma.platformSubscription.findFirst({
    where: {
      OR: [
        preapprovalId ? { mercadoPagoPreapprovalId: preapprovalId } : undefined,
        externalReference ? { mercadoPagoExternalReference: externalReference } : undefined,
      ].filter(Boolean) as Array<Prisma.PlatformSubscriptionWhereInput>,
    },
  });

  if (!subscription) {
    throw new Error("Assinatura nao encontrada para o retorno do Mercado Pago.");
  }

  const status = normalizeMercadoPagoStatus(preapproval.status);
  const nextPaymentAt = parseDate(preapproval.next_payment_date);

  await prisma.platformSubscription.update({
    where: { id: subscription.id },
    data: {
      mercadoPagoPreapprovalId: preapprovalId ?? subscription.mercadoPagoPreapprovalId,
      status,
      nextPaymentAt: nextPaymentAt ?? subscription.nextPaymentAt,
      lastWebhookAt: new Date(),
      rawSnapshot: toJsonInput(preapproval),
    },
  });

  if (isActiveSubscriptionStatus(status)) {
    await activateTenantPlan(subscription.id, status, nextPaymentAt ?? new Date());
  } else if (isInactiveSubscriptionStatus(status)) {
    await suspendTenantPlanFromSubscription(subscription.id, status);
  }

  return subscription.id;
}

async function applyPaymentSnapshot(payment: MercadoPagoPaymentResponse) {
  await ensurePlatformBillingTables();
  const prisma = getPlatformPrisma();
  const paymentStatus = normalizeMercadoPagoStatus(payment.status);
  const preapprovalId = payment.preapproval_id;
  const externalReference = payment.external_reference;

  if (!preapprovalId && !externalReference) {
    return null;
  }

  const subscription = await prisma.platformSubscription.findFirst({
    where: {
      OR: [
        preapprovalId ? { mercadoPagoPreapprovalId: preapprovalId } : undefined,
        externalReference ? { mercadoPagoExternalReference: externalReference } : undefined,
      ].filter(Boolean) as Array<Prisma.PlatformSubscriptionWhereInput>,
    },
  });

  if (!subscription) {
    return null;
  }

  await prisma.platformSubscription.update({
    where: { id: subscription.id },
    data: {
      lastPaymentAt: parseDate(payment.date_approved) ?? subscription.lastPaymentAt,
      lastWebhookAt: new Date(),
      rawSnapshot: toJsonInput(payment),
    },
  });

  if (paymentStatus === "approved") {
    if (preapprovalId) {
      const preapproval = await fetchMercadoPagoPreapproval(preapprovalId);
      await applyPreapprovalSnapshot(preapproval);
    } else {
      await activateTenantPlan(subscription.id, "authorized", parseDate(payment.date_approved) ?? new Date());
    }
  }

  return subscription.id;
}

export async function createPlatformSubscriptionCheckout(input: {
  tenantId: string;
  planName: PlatformPlanName;
  billingCycleMonths: PlatformBillingCycleMonths;
}) {
  await ensurePlatformBillingTables();
  const prisma = getPlatformPrisma();
  const credentials = await resolveMercadoPagoGatewayCredentials();

  if (!credentials) {
    throw new Error("Configure o gateway Mercado Pago no super admin antes de cobrar assinaturas.");
  }

  const tenant = await prisma.platformTenant.findUnique({
    where: { id: input.tenantId },
  });

  if (!tenant) {
    throw new Error("Cliente nao encontrado.");
  }

  if (tenant.status === PlatformTenantStatus.SUSPENDED) {
    throw new Error("Cliente suspenso. Reative antes de gerar nova assinatura.");
  }

  const price = getPlatformPlanPrice(input.planName, input.billingCycleMonths);
  const amount = Number((price.amountCents / 100).toFixed(2));
  const externalReference = `mendoza:${tenant.id}:${randomUUID()}`;
  const reason = `Mendoza PDV - Plano ${input.planName} (${price.label})`;
  const payerEmail = credentials.environment === "test" ? credentials.testPayerEmail : tenant.ownerEmail;

  const subscription = await prisma.platformSubscription.create({
    data: {
      tenantId: tenant.id,
      planName: input.planName,
      billingCycleMonths: input.billingCycleMonths,
      amountCents: price.amountCents,
      currency: "BRL",
      status: "pending",
      mercadoPagoExternalReference: externalReference,
      payerEmail,
      reason,
    },
  });

  const preapproval = await mercadoPagoRequest<MercadoPagoPreapprovalResponse>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason,
      external_reference: externalReference,
      payer_email: payerEmail,
      auto_recurring: {
        frequency: input.billingCycleMonths,
        frequency_type: "months",
        end_date: buildMercadoPagoSubscriptionEndDate(),
        transaction_amount: amount,
        currency_id: "BRL",
      },
      back_url: `${getSiteUrl()}/api/platform/mercado-pago/return?subscriptionId=${subscription.id}`,
      status: "pending",
    }),
  });

  if (!preapproval.id || !preapproval.init_point) {
    throw new Error("Mercado Pago nao retornou link de assinatura.");
  }

  const updated = await prisma.platformSubscription.update({
    where: { id: subscription.id },
    data: {
      mercadoPagoPreapprovalId: preapproval.id,
      mercadoPagoInitPoint: preapproval.init_point,
      status: normalizeMercadoPagoStatus(preapproval.status),
      nextPaymentAt: parseDate(preapproval.next_payment_date),
      rawSnapshot: toJsonInput(preapproval),
    },
  });

  return {
    subscriptionId: updated.id,
    initPoint: preapproval.init_point,
    amountLabel: formatCentsToBRL(price.amountCents),
  };
}

export async function createPlatformSubscriptionCheckoutFromForm(input: FormData) {
  const parsed = checkoutSchema.parse({
    tenantId: input.get("tenantId"),
    planName: input.get("planName"),
    billingCycleMonths: input.get("billingCycleMonths"),
  });

  return createPlatformSubscriptionCheckout(parsed);
}

export async function listPlatformBillingSummaries(tenantIds: string[]): Promise<PlatformBillingSummary[]> {
  await ensurePlatformBillingTables();

  if (tenantIds.length === 0) {
    return [];
  }

  const subscriptions = await getPlatformPrisma().platformSubscription.findMany({
    where: {
      tenantId: { in: tenantIds },
    },
    orderBy: [{ createdAt: "desc" }],
  });
  const seen = new Set<string>();
  const summaries: PlatformBillingSummary[] = [];

  for (const subscription of subscriptions) {
    if (seen.has(subscription.tenantId)) {
      continue;
    }

    seen.add(subscription.tenantId);
    summaries.push({
      tenantId: subscription.tenantId,
      subscriptionId: subscription.id,
      planName: subscription.planName,
      billingCycleMonths: subscription.billingCycleMonths,
      amountCents: subscription.amountCents,
      status: subscription.status,
      mercadoPagoPreapprovalId: subscription.mercadoPagoPreapprovalId,
      mercadoPagoInitPoint: subscription.mercadoPagoInitPoint,
      nextPaymentAt: subscription.nextPaymentAt,
      lastPaymentAt: subscription.lastPaymentAt,
      updatedAt: subscription.updatedAt,
    });
  }

  return summaries;
}

export async function getTenantPaymentPortalState(slug: string): Promise<TenantPaymentPortalState | null> {
  await ensurePlatformBillingTables();
  const tenant = await getPlatformPrisma().platformTenant.findUnique({
    where: { slug },
  });

  if (!tenant) {
    return null;
  }

  const [latestSubscription] = await listPlatformBillingSummaries([tenant.id]);

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    tenantName: tenant.name,
    tenantStatus: tenant.status,
    ownerEmail: tenant.ownerEmail,
    planName: tenant.planName,
    planStatus: tenant.planStatus,
    latestSubscription: latestSubscription ?? null,
  };
}

function parseSignatureHeader(value: string | null) {
  if (!value) {
    return null;
  }

  return value.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, rawValue] = part.split("=");
    if (key && rawValue) {
      acc[key.trim()] = rawValue.trim();
    }
    return acc;
  }, {});
}

function verifyMercadoPagoSignature(input: {
  webhookSecret: string | null;
  requestId: string | null;
  signature: string | null;
  dataId: string | null;
}) {
  if (!input.webhookSecret) {
    return true;
  }

  const signature = parseSignatureHeader(input.signature);
  const ts = signature?.ts;
  const v1 = signature?.v1;

  if (!input.requestId || !input.dataId || !ts || !v1) {
    return false;
  }

  const manifest = `id:${input.dataId};request-id:${input.requestId};ts:${ts};`;
  const expected = createHmac("sha256", input.webhookSecret).update(manifest).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(v1, "hex");

  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function extractResourceId(payload: Record<string, unknown>, searchParams: URLSearchParams) {
  const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
  const bodyId = data?.id ?? payload.id;

  return String(searchParams.get("data.id") ?? searchParams.get("id") ?? bodyId ?? "").trim() || null;
}

function shouldTreatAsPreapproval(eventType: string, action: string | null) {
  const subject = `${eventType} ${action ?? ""}`.toLowerCase();
  return subject.includes("preapproval") || subject.includes("subscription");
}

export async function syncMercadoPagoSubscriptionByPreapprovalId(preapprovalId: string) {
  const preapproval = await fetchMercadoPagoPreapproval(preapprovalId);
  return applyPreapprovalSnapshot(preapproval);
}

export async function processMercadoPagoWebhook(input: {
  payload: Record<string, unknown>;
  headers: Headers;
  searchParams: URLSearchParams;
}) {
  await ensurePlatformBillingTables();
  const credentials = await resolveMercadoPagoGatewayCredentials();
  const resourceId = extractResourceId(input.payload, input.searchParams);
  const eventType = String(input.payload.type ?? input.payload.topic ?? input.searchParams.get("type") ?? "unknown");
  const action = input.payload.action ? String(input.payload.action) : input.searchParams.get("action");

  const isValidSignature = verifyMercadoPagoSignature({
    webhookSecret: credentials?.webhookSecret ?? null,
    requestId: input.headers.get("x-request-id"),
    signature: input.headers.get("x-signature"),
    dataId: resourceId,
  });

  if (!isValidSignature) {
    return {
      status: "unauthorized" as const,
      message: "Assinatura do webhook invalida.",
    };
  }

  const event = await getPlatformPrisma().platformPaymentEvent.create({
    data: {
      provider: MERCADO_PAGO_PROVIDER,
      eventType,
      resourceId,
      action,
      payload: toJsonInput(input.payload),
    },
  });

  if (!resourceId) {
    await getPlatformPrisma().platformPaymentEvent.update({
      where: { id: event.id },
      data: {
        processedAt: new Date(),
        status: "ignored",
        message: "Evento sem identificador de recurso.",
      },
    });

    return {
      status: "ignored" as const,
      message: "Evento sem recurso.",
    };
  }

  try {
    const subscriptionId = shouldTreatAsPreapproval(eventType, action)
      ? await syncMercadoPagoSubscriptionByPreapprovalId(resourceId)
      : await applyPaymentSnapshot(await fetchMercadoPagoPayment(resourceId));

    await getPlatformPrisma().platformPaymentEvent.update({
      where: { id: event.id },
      data: {
        processedAt: new Date(),
        status: subscriptionId ? "processed" : "ignored",
        message: subscriptionId ? "Evento processado." : "Evento sem assinatura vinculada.",
        subscriptionId,
      },
    });

    return {
      status: "processed" as const,
      message: "Evento processado.",
    };
  } catch (error) {
    await getPlatformPrisma().platformPaymentEvent.update({
      where: { id: event.id },
      data: {
        processedAt: new Date(),
        status: "error",
        message: error instanceof Error ? error.message : "Falha ao processar webhook.",
      },
    });

    throw error;
  }
}

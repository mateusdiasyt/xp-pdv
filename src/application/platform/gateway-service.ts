import { z } from "zod";

import { decryptSecretValue, encryptSecretValue } from "@/lib/secret-crypto";
import { getPlatformPrisma } from "@/lib/prisma";

const MERCADO_PAGO_PROVIDER = "mercado-pago";

const gatewayConfigurationSchema = z.object({
  environment: z.enum(["test", "production"]),
  publicKey: z.string().trim().min(16, "Informe a Public Key do Mercado Pago."),
  accessToken: z.string().trim().optional(),
  runConnectionTest: z.boolean().default(true),
});

let platformGatewayConfigurationTablePromise: Promise<void> | null = null;

type GatewayActor = {
  id: string;
  name: string;
};

type MercadoPagoConnectionTest = {
  status: "success" | "error";
  message: string;
};

export type PlatformGatewayConfigurationSnapshot = {
  provider: string;
  environment: "test" | "production";
  publicKey: string;
  hasAccessToken: boolean;
  status: string;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  lastTestedAt: Date | null;
  updatedByName: string | null;
  updatedAt: Date | null;
  setupPending: boolean;
};

function normalizeGatewayEnvironment(value: string | null | undefined): "test" | "production" {
  return value === "production" ? "production" : "test";
}

async function ensurePlatformGatewayConfigurationTable() {
  if (!platformGatewayConfigurationTablePromise) {
    const prisma = getPlatformPrisma();

    platformGatewayConfigurationTablePromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "PlatformGatewayConfiguration" (
          "id" TEXT NOT NULL,
          "provider" TEXT NOT NULL DEFAULT 'mercado-pago',
          "environment" TEXT NOT NULL DEFAULT 'test',
          "publicKey" TEXT,
          "accessTokenEncrypted" TEXT,
          "status" TEXT NOT NULL DEFAULT 'inactive',
          "lastTestStatus" TEXT,
          "lastTestMessage" TEXT,
          "lastTestedAt" TIMESTAMP(3),
          "updatedById" TEXT,
          "updatedByName" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PlatformGatewayConfiguration_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "PlatformGatewayConfiguration_provider_key"
          ON "PlatformGatewayConfiguration"("provider")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformGatewayConfiguration_provider_idx"
          ON "PlatformGatewayConfiguration"("provider")
      `);
      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "PlatformGatewayConfiguration_status_idx"
          ON "PlatformGatewayConfiguration"("status")
      `);
    })()
      .then(() => undefined)
      .catch((error) => {
        platformGatewayConfigurationTablePromise = null;
        throw error;
      });
  }

  return platformGatewayConfigurationTablePromise;
}

async function testMercadoPagoAccessToken(accessToken: string): Promise<MercadoPagoConnectionTest> {
  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        status: "error",
        message: `Mercado Pago respondeu ${response.status}. Revise o Access Token.`,
      };
    }

    const payload = (await response.json()) as {
      id?: number | string;
      nickname?: string;
      site_id?: string;
    };
    const account = payload.nickname || payload.id || "conta Mercado Pago";
    const site = payload.site_id ? ` (${payload.site_id})` : "";

    return {
      status: "success",
      message: `Conectado em ${account}${site}.`,
    };
  } catch {
    return {
      status: "error",
      message: "Nao foi possivel conectar ao Mercado Pago agora.",
    };
  }
}

export async function getPlatformGatewayConfigurationSnapshot(): Promise<PlatformGatewayConfigurationSnapshot> {
  await ensurePlatformGatewayConfigurationTable();
  const configuration = await getPlatformPrisma().platformGatewayConfiguration.findUnique({
    where: { provider: MERCADO_PAGO_PROVIDER },
  });

  if (!configuration) {
    return {
      provider: MERCADO_PAGO_PROVIDER,
      environment: "test",
      publicKey: "",
      hasAccessToken: false,
      status: "inactive",
      lastTestStatus: null,
      lastTestMessage: null,
      lastTestedAt: null,
      updatedByName: null,
      updatedAt: null,
      setupPending: true,
    };
  }

  return {
    provider: configuration.provider,
    environment: normalizeGatewayEnvironment(configuration.environment),
    publicKey: configuration.publicKey ?? "",
    hasAccessToken: Boolean(configuration.accessTokenEncrypted),
    status: configuration.status,
    lastTestStatus: configuration.lastTestStatus,
    lastTestMessage: configuration.lastTestMessage,
    lastTestedAt: configuration.lastTestedAt,
    updatedByName: configuration.updatedByName,
    updatedAt: configuration.updatedAt,
    setupPending: false,
  };
}

export async function updatePlatformGatewayConfiguration(input: FormData, actor: GatewayActor) {
  await ensurePlatformGatewayConfigurationTable();
  const parsed = gatewayConfigurationSchema.parse({
    environment: input.get("environment"),
    publicKey: input.get("publicKey"),
    accessToken: input.get("accessToken"),
    runConnectionTest: input.get("runConnectionTest") === "1",
  });

  const existing = await getPlatformPrisma().platformGatewayConfiguration.findUnique({
    where: { provider: MERCADO_PAGO_PROVIDER },
  });
  const nextAccessTokenEncrypted = parsed.accessToken
    ? encryptSecretValue(parsed.accessToken)
    : existing?.accessTokenEncrypted ?? null;
  const decryptedToken = parsed.accessToken || decryptSecretValue(nextAccessTokenEncrypted);
  const connectionTest = parsed.runConnectionTest && decryptedToken
    ? await testMercadoPagoAccessToken(decryptedToken)
    : null;
  const status = nextAccessTokenEncrypted && parsed.publicKey
    ? connectionTest?.status === "error"
      ? "attention"
      : "active"
    : "inactive";

  return getPlatformPrisma().platformGatewayConfiguration.upsert({
    where: { provider: MERCADO_PAGO_PROVIDER },
    update: {
      environment: parsed.environment,
      publicKey: parsed.publicKey,
      accessTokenEncrypted: nextAccessTokenEncrypted,
      status,
      lastTestStatus: connectionTest?.status ?? existing?.lastTestStatus ?? null,
      lastTestMessage: connectionTest?.message ?? existing?.lastTestMessage ?? null,
      lastTestedAt: connectionTest ? new Date() : existing?.lastTestedAt ?? null,
      updatedById: actor.id,
      updatedByName: actor.name,
    },
    create: {
      provider: MERCADO_PAGO_PROVIDER,
      environment: parsed.environment,
      publicKey: parsed.publicKey,
      accessTokenEncrypted: nextAccessTokenEncrypted,
      status,
      lastTestStatus: connectionTest?.status ?? null,
      lastTestMessage: connectionTest?.message ?? null,
      lastTestedAt: connectionTest ? new Date() : null,
      updatedById: actor.id,
      updatedByName: actor.name,
    },
  });
}

export async function resolveMercadoPagoGatewayCredentials() {
  await ensurePlatformGatewayConfigurationTable();
  const configuration = await getPlatformPrisma().platformGatewayConfiguration.findUnique({
    where: { provider: MERCADO_PAGO_PROVIDER },
  });

  if (!configuration?.publicKey || !configuration.accessTokenEncrypted) {
    return null;
  }

  const accessToken = decryptSecretValue(configuration.accessTokenEncrypted);

  if (!accessToken) {
    return null;
  }

  return {
    environment: normalizeGatewayEnvironment(configuration.environment),
    publicKey: configuration.publicKey,
    accessToken,
  };
}

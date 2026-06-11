import { Prisma, PrismaClient } from "@prisma/client";
import { headers } from "next/headers";

import { decryptSecretValue } from "@/lib/secret-crypto";

const DEFAULT_WORKSPACE_SLUG = process.env.DEFAULT_WORKSPACE_SLUG ?? "xp-arcade";

const globalForPrisma = globalThis as unknown as {
  platformPrisma: PrismaClient | undefined;
  tenantPrismaClients: Map<string, PrismaClient> | undefined;
};

function createPrismaClient(databaseUrl?: string) {
  return new PrismaClient({
    datasources: databaseUrl
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

export function getPlatformPrisma() {
  if (!globalForPrisma.platformPrisma) {
    globalForPrisma.platformPrisma = createPrismaClient();
  }

  return globalForPrisma.platformPrisma;
}

function getTenantClientCache() {
  if (!globalForPrisma.tenantPrismaClients) {
    globalForPrisma.tenantPrismaClients = new Map();
  }

  return globalForPrisma.tenantPrismaClients;
}

function normalizeTenantSlug(value: string | null | undefined) {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || null
  );
}

function isMissingPlatformTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table ?? "").includes("PlatformTenant")
  );
}

async function resolveTenantDatabaseUrl(slug: string) {
  const normalizedSlug = normalizeTenantSlug(slug) ?? DEFAULT_WORKSPACE_SLUG;

  try {
    const tenant = await getPlatformPrisma().platformTenant.findUnique({
      where: { slug: normalizedSlug },
      select: {
        status: true,
        isDefault: true,
        databaseUrlEncrypted: true,
      },
    });

    if (!tenant || tenant.status !== "ACTIVE") {
      return normalizedSlug === DEFAULT_WORKSPACE_SLUG ? process.env.DATABASE_URL : null;
    }

    if (tenant.isDefault || !tenant.databaseUrlEncrypted) {
      return process.env.DATABASE_URL;
    }

    return decryptSecretValue(tenant.databaseUrlEncrypted) ?? null;
  } catch (error) {
    if (isMissingPlatformTableError(error)) {
      return process.env.DATABASE_URL;
    }

    throw error;
  }
}

export async function getTenantPrismaClientBySlug(slug: string | null | undefined) {
  const normalizedSlug = normalizeTenantSlug(slug) ?? DEFAULT_WORKSPACE_SLUG;
  const databaseUrl = await resolveTenantDatabaseUrl(normalizedSlug);

  if (!databaseUrl) {
    throw new Error("Cliente inativo ou banco de dados ainda nao provisionado.");
  }

  if (databaseUrl === process.env.DATABASE_URL) {
    return getPlatformPrisma();
  }

  const cache = getTenantClientCache();
  const cached = cache.get(databaseUrl);

  if (cached) {
    return cached;
  }

  const client = createPrismaClient(databaseUrl);
  cache.set(databaseUrl, client);
  return client;
}

async function getTenantSlugFromRequest() {
  try {
    const requestHeaders = await headers();
    const headerSlug = normalizeTenantSlug(requestHeaders.get("x-tenant-slug") ?? requestHeaders.get("x-workspace-slug"));

    if (headerSlug) {
      return headerSlug;
    }

    const cookieHeader = requestHeaders.get("cookie") ?? "";
    const cookieSlug = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("xp-tenant-slug="))
      ?.split("=")[1];

    return normalizeTenantSlug(cookieSlug ? decodeURIComponent(cookieSlug) : null);
  } catch {
    return null;
  }
}

export async function getCurrentTenantSlug() {
  return (await getTenantSlugFromRequest()) ?? DEFAULT_WORKSPACE_SLUG;
}

export async function getCurrentPrismaClient() {
  const tenantSlug = await getCurrentTenantSlug();
  return getTenantPrismaClientBySlug(tenantSlug);
}

async function executePrismaPath(path: PropertyKey[], args: unknown[]) {
  const client = await getCurrentPrismaClient();
  let target: unknown = client;

  for (const segment of path.slice(0, -1)) {
    if ((typeof target !== "object" && typeof target !== "function") || target === null) {
      throw new Error("Caminho Prisma invalido.");
    }

    target = (target as Record<PropertyKey, unknown>)[segment];
  }

  const methodName = path[path.length - 1];
  if ((typeof target !== "object" && typeof target !== "function") || target === null) {
    throw new Error("Metodo Prisma invalido.");
  }

  const method = (target as Record<PropertyKey, unknown>)[methodName];

  if (typeof method !== "function") {
    return method;
  }

  return method.apply(target, args);
}

function createPrismaProxy(path: PropertyKey[] = []): unknown {
  return new Proxy(function prismaTenantProxy() {}, {
    get(_target, property) {
      if (property === "then" && path.length === 0) {
        return undefined;
      }

      if (property === Symbol.toStringTag) {
        return "PrismaTenantProxy";
      }

      return createPrismaProxy([...path, property]);
    },
    apply(_target, _thisArg, args) {
      return executePrismaPath(path, args);
    },
  });
}

export const prisma = createPrismaProxy() as PrismaClient;

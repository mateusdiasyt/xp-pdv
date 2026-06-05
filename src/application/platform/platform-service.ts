import bcrypt from "bcryptjs";
import { PlatformTenantStatus } from "@prisma/client";
import { z } from "zod";

import { provisionTenantDatabase } from "@/application/platform/tenant-provisioning-service";
import { decryptSecretValue } from "@/lib/secret-crypto";
import { getPlatformPrisma, getTenantPrismaClientBySlug } from "@/lib/prisma";

const tenantRegistrationSchema = z.object({
  companyName: z.string().trim().min(2, "Informe o nome da empresa").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "Informe o link do cliente")
    .max(48)
    .transform(normalizeTenantSlug)
    .refine((value) => value.length >= 2, "Informe um link valido"),
  ownerName: z.string().trim().min(2, "Informe seu nome").max(120),
  ownerEmail: z.string().trim().email("Informe um email valido").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Use pelo menos 8 caracteres"),
});

export function normalizeTenantSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTenantAdminPath(slug: string, adminPath = "/admin") {
  const normalizedSlug = normalizeTenantSlug(slug);
  const normalizedPath = adminPath.startsWith("/admin") ? adminPath : `/admin${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}`;

  return `/app/${normalizedSlug}${normalizedPath}`;
}

export async function listPlatformTenants() {
  return getPlatformPrisma().platformTenant.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    include: {
      users: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export async function getActiveTenantBySlug(slug: string) {
  return getPlatformPrisma().platformTenant.findFirst({
    where: {
      slug: normalizeTenantSlug(slug),
      status: PlatformTenantStatus.ACTIVE,
    },
  });
}

export async function findLoginTenantByEmail(email: string) {
  const access = await findLoginTenantAccessByEmail(email);
  return access?.tenant ?? null;
}

export async function findLoginTenantAccessByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  const access = await getPlatformPrisma().platformTenantUser.findFirst({
    where: {
      email: normalizedEmail,
      tenant: {
        status: PlatformTenantStatus.ACTIVE,
      },
    },
    include: {
      tenant: true,
    },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });

  return access ?? null;
}

export async function findLoginTenantAccessBySlug(slug: string, email: string) {
  return getPlatformPrisma().platformTenantUser.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      tenant: {
        slug: normalizeTenantSlug(slug),
        status: PlatformTenantStatus.ACTIVE,
      },
    },
    include: {
      tenant: true,
    },
  });
}

export async function resolveTenantDatabaseUrlForLogin(slug: string) {
  const tenant = await getActiveTenantBySlug(slug);

  if (!tenant) {
    return null;
  }

  if (tenant.isDefault || !tenant.databaseUrlEncrypted) {
    return process.env.DATABASE_URL ?? null;
  }

  return decryptSecretValue(tenant.databaseUrlEncrypted);
}

export async function getTenantPrismaForLogin(slug: string) {
  return getTenantPrismaClientBySlug(slug);
}

export async function registerPlatformTenant(input: FormData) {
  const parsed = tenantRegistrationSchema.parse({
    companyName: input.get("companyName"),
    slug: input.get("slug"),
    ownerName: input.get("ownerName"),
    ownerEmail: input.get("ownerEmail"),
    password: input.get("password"),
  });

  const platformPrisma = getPlatformPrisma();
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const existing = await platformPrisma.platformTenant.findUnique({
    where: { slug: parsed.slug },
    select: { id: true },
  });

  if (existing) {
    throw new Error("Esse link de cliente ja esta em uso.");
  }

  const tenant = await platformPrisma.platformTenant.create({
    data: {
      name: parsed.companyName,
      slug: parsed.slug,
      status: PlatformTenantStatus.PENDING,
      planStatus: "pending",
      ownerName: parsed.ownerName,
      ownerEmail: parsed.ownerEmail,
      ownerPasswordHash: passwordHash,
      users: {
        create: {
          email: parsed.ownerEmail,
          name: parsed.ownerName,
          role: "owner",
          isOwner: true,
          isPlatformAdmin: false,
        },
      },
    },
  });

  return tenant;
}

export async function approvePlatformTenant(tenantId: string) {
  const platformPrisma = getPlatformPrisma();
  const tenant = await platformPrisma.platformTenant.findUnique({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new Error("Cliente nao encontrado.");
  }

  if (tenant.status === PlatformTenantStatus.ACTIVE) {
    return tenant;
  }

  if (!tenant.ownerPasswordHash) {
    throw new Error("Cliente sem senha inicial cadastrada.");
  }

  try {
    const provisioned = await provisionTenantDatabase({
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      ownerName: tenant.ownerName,
      ownerEmail: tenant.ownerEmail,
      ownerPasswordHash: tenant.ownerPasswordHash,
    });

    return await platformPrisma.platformTenant.update({
      where: { id: tenant.id },
      data: {
        status: PlatformTenantStatus.ACTIVE,
        planStatus: "active",
        databaseName: provisioned.databaseName,
        databaseUrlEncrypted: provisioned.databaseUrlEncrypted,
        approvedAt: new Date(),
        suspendedAt: null,
        lastProvisioningError: null,
      },
    });
  } catch (error) {
    await platformPrisma.platformTenant.update({
      where: { id: tenant.id },
      data: {
        status: PlatformTenantStatus.FAILED,
        lastProvisioningError: error instanceof Error ? error.message : "Falha desconhecida ao criar banco.",
      },
    });

    throw error;
  }
}

export async function suspendPlatformTenant(tenantId: string) {
  return getPlatformPrisma().platformTenant.update({
    where: { id: tenantId },
    data: {
      status: PlatformTenantStatus.SUSPENDED,
      planStatus: "suspended",
      suspendedAt: new Date(),
    },
  });
}

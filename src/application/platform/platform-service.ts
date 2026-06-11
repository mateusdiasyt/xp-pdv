import bcrypt from "bcryptjs";
import { PlatformTenantStatus } from "@prisma/client";
import { z } from "zod";

import { provisionTenantDatabase } from "@/application/platform/tenant-provisioning-service";
import { buildTenantModuleEntitlements } from "@/domain/platform/plan-entitlements";
import { decryptSecretValue } from "@/lib/secret-crypto";
import { getPlatformPrisma, getTenantPrismaClientBySlug } from "@/lib/prisma";

const tenantRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Informe seu nome completo").max(120),
  document: z
    .string()
    .trim()
    .min(11, "Informe CPF ou CNPJ")
    .max(24)
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length === 11 || value.length === 14, "Informe um CPF ou CNPJ valido"),
  ownerEmail: z.string().trim().email("Informe um email valido").transform((value) => value.toLowerCase()),
  whatsapp: z
    .string()
    .trim()
    .min(10, "Informe o numero de WhatsApp")
    .max(24)
    .transform((value) => onlyDigits(value))
    .refine((value) => value.length >= 10 && value.length <= 13, "Informe um WhatsApp valido"),
  password: z.string().min(8, "Use pelo menos 8 caracteres"),
  confirmPassword: z.string().min(8, "Repita a senha"),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
  message: "As senhas precisam ser iguais",
});

const platformTenantPlanSchema = z.object({
  tenantId: z.string().trim().min(1, "Cliente invalido."),
  planName: z.enum(["Ouro", "Platina"]),
  durationMonths: z.enum(["1", "3", "6", "12", "custom"]),
  planExpiresAt: z.string().trim().optional(),
});

let platformTenantProfileColumnsPromise: Promise<void> | null = null;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeTenantSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensurePlatformTenantProfileColumns() {
  if (!platformTenantProfileColumnsPromise) {
    platformTenantProfileColumnsPromise = getPlatformPrisma()
      .$executeRawUnsafe(`
        ALTER TABLE "PlatformTenant"
          ADD COLUMN IF NOT EXISTS "ownerDocument" TEXT,
          ADD COLUMN IF NOT EXISTS "ownerWhatsapp" TEXT,
          ADD COLUMN IF NOT EXISTS "companyNameConfirmedAt" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "customSlugUpdatedAt" TIMESTAMP(3),
          ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);
      `)
      .then(() => undefined)
      .catch((error) => {
        platformTenantProfileColumnsPromise = null;
        throw error;
      });
  }

  return platformTenantProfileColumnsPromise;
}

function buildTenantSlugBase(fullName: string, ownerEmail: string, document: string) {
  const nameBase = normalizeTenantSlug(fullName);
  const emailBase = normalizeTenantSlug(ownerEmail.split("@")[0] ?? "");
  const documentSuffix = document.slice(-4);
  const base = nameBase || emailBase || "cliente";

  return `${base}${documentSuffix ? `-${documentSuffix}` : ""}`.slice(0, 48).replace(/-+$/g, "");
}

function buildPlanExpirationDate(durationMonths: string, customDate?: string | null) {
  if (durationMonths === "custom") {
    if (!customDate) {
      throw new Error("Informe a data de encerramento do plano.");
    }

    const parsed = new Date(`${customDate}T23:59:59.000-03:00`);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error("Informe uma data de encerramento valida.");
    }

    return parsed;
  }

  const months = Number(durationMonths);
  const expiration = new Date();
  expiration.setMonth(expiration.getMonth() + months);
  expiration.setHours(23, 59, 59, 999);

  return expiration;
}

async function buildUniqueTenantSlug(base: string) {
  const platformPrisma = getPlatformPrisma();
  const normalizedBase = normalizeTenantSlug(base).slice(0, 48) || "cliente";

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const candidate = `${normalizedBase.slice(0, 48 - suffix.length)}${suffix}`;
    const existing = await platformPrisma.platformTenant.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${normalizedBase.slice(0, 39)}-${Date.now().toString(36)}`;
}

export function buildTenantAdminPath(slug: string, adminPath = "/admin") {
  const normalizedSlug = normalizeTenantSlug(slug);
  const normalizedPath = adminPath.startsWith("/admin") ? adminPath : `/admin${adminPath.startsWith("/") ? adminPath : `/${adminPath}`}`;
  const publicPath = normalizedPath === "/admin" ? "" : normalizedPath.replace(/^\/admin/, "");

  return `/app/${normalizedSlug}${publicPath}`;
}

export async function listPlatformTenants() {
  await ensurePlatformTenantProfileColumns();
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
  await ensurePlatformTenantProfileColumns();
  return getPlatformPrisma().platformTenant.findFirst({
    where: {
      slug: normalizeTenantSlug(slug),
      status: PlatformTenantStatus.ACTIVE,
    },
  });
}

export async function getTenantModuleEntitlements(slug: string) {
  await ensurePlatformTenantProfileColumns();
  const tenant = await getPlatformPrisma().platformTenant.findUnique({
    where: { slug: normalizeTenantSlug(slug) },
    select: {
      planName: true,
      planStatus: true,
      planExpiresAt: true,
    },
  });

  return buildTenantModuleEntitlements({
    planName: tenant?.planName,
    planStatus: tenant?.planStatus,
    planExpiresAt: tenant?.planExpiresAt,
  });
}

export async function findLoginTenantByEmail(email: string) {
  const access = await findLoginTenantAccessByEmail(email);
  return access?.tenant ?? null;
}

export async function findLoginTenantAccessByEmail(email: string) {
  await ensurePlatformTenantProfileColumns();
  const normalizedEmail = email.trim().toLowerCase();

  const access = await getPlatformPrisma().platformTenantUser.findFirst({
    where: {
      email: normalizedEmail,
      tenant: {
        status: {
          in: [PlatformTenantStatus.ACTIVE, PlatformTenantStatus.PENDING, PlatformTenantStatus.FAILED],
        },
      },
    },
    include: {
      tenant: true,
    },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });

  return access ?? null;
}

export async function findLoginTenantAccessesByEmail(email: string) {
  await ensurePlatformTenantProfileColumns();
  const normalizedEmail = email.trim().toLowerCase();

  return getPlatformPrisma().platformTenantUser.findMany({
    where: {
      email: normalizedEmail,
      tenant: {
        status: {
          in: [PlatformTenantStatus.ACTIVE, PlatformTenantStatus.PENDING, PlatformTenantStatus.FAILED],
        },
      },
    },
    include: {
      tenant: true,
    },
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });
}

export async function findLoginTenantAccessBySlug(slug: string, email: string) {
  await ensurePlatformTenantProfileColumns();
  return getPlatformPrisma().platformTenantUser.findFirst({
    where: {
      email: email.trim().toLowerCase(),
      tenant: {
        slug: normalizeTenantSlug(slug),
        status: {
          in: [PlatformTenantStatus.ACTIVE, PlatformTenantStatus.PENDING, PlatformTenantStatus.FAILED],
        },
      },
    },
    include: {
      tenant: true,
    },
  });
}

export async function syncPlatformTenantUserAccess(data: {
  tenantSlug: string;
  email: string;
  name: string;
  role?: string;
}) {
  await ensurePlatformTenantProfileColumns();
  const platformPrisma = getPlatformPrisma();
  const tenant = await platformPrisma.platformTenant.findUnique({
    where: { slug: normalizeTenantSlug(data.tenantSlug) },
    select: { id: true },
  });

  if (!tenant) {
    return;
  }

  await platformPrisma.platformTenantUser.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: data.email.trim().toLowerCase(),
      },
    },
    update: {
      name: data.name,
      role: data.role ?? "user",
    },
    create: {
      tenantId: tenant.id,
      email: data.email.trim().toLowerCase(),
      name: data.name,
      role: data.role ?? "user",
      isOwner: false,
      isPlatformAdmin: false,
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
  await ensurePlatformTenantProfileColumns();
  const parsed = tenantRegistrationSchema.parse({
    fullName: input.get("fullName"),
    document: input.get("document"),
    ownerEmail: input.get("ownerEmail"),
    whatsapp: input.get("whatsapp"),
    password: input.get("password"),
    confirmPassword: input.get("confirmPassword"),
  });

  const platformPrisma = getPlatformPrisma();
  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const tenantSlug = await buildUniqueTenantSlug(
    buildTenantSlugBase(parsed.fullName, parsed.ownerEmail, parsed.document),
  );

  const tenant = await platformPrisma.platformTenant.create({
    data: {
      name: `Conta de ${parsed.fullName}`,
      slug: tenantSlug,
      status: PlatformTenantStatus.PENDING,
      planStatus: "pending",
      ownerName: parsed.fullName,
      ownerEmail: parsed.ownerEmail,
      ownerDocument: parsed.document,
      ownerWhatsapp: parsed.whatsapp,
      ownerPasswordHash: passwordHash,
      users: {
        create: {
          email: parsed.ownerEmail,
          name: parsed.fullName,
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
  await ensurePlatformTenantProfileColumns();
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
  await ensurePlatformTenantProfileColumns();
  return getPlatformPrisma().platformTenant.update({
    where: { id: tenantId },
    data: {
      status: PlatformTenantStatus.SUSPENDED,
      planStatus: "suspended",
      suspendedAt: new Date(),
    },
  });
}

export async function reactivatePlatformTenant(tenantId: string) {
  await ensurePlatformTenantProfileColumns();
  return getPlatformPrisma().platformTenant.update({
    where: { id: tenantId },
    data: {
      status: PlatformTenantStatus.ACTIVE,
      planStatus: "active",
      suspendedAt: null,
      lastProvisioningError: null,
    },
  });
}

export async function updatePlatformTenantPlan(input: FormData) {
  await ensurePlatformTenantProfileColumns();
  const parsed = platformTenantPlanSchema.parse({
    tenantId: input.get("tenantId"),
    planName: input.get("planName"),
    durationMonths: input.get("durationMonths"),
    planExpiresAt: input.get("planExpiresAt"),
  });
  const planExpiresAt = buildPlanExpirationDate(parsed.durationMonths, parsed.planExpiresAt);

  return getPlatformPrisma().platformTenant.update({
    where: { id: parsed.tenantId },
    data: {
      planName: parsed.planName,
      planStatus: "active",
      planExpiresAt,
    },
  });
}

export async function getTenantCompanyOnboardingState(slug: string) {
  await ensurePlatformTenantProfileColumns();
  const tenant = await getPlatformPrisma().platformTenant.findFirst({
    where: {
      slug: normalizeTenantSlug(slug),
      status: PlatformTenantStatus.ACTIVE,
    },
    select: {
      name: true,
      ownerDocument: true,
      ownerWhatsapp: true,
      companyNameConfirmedAt: true,
    },
  });

  if (!tenant) {
    return null;
  }

  return {
    companyName: tenant.name,
    shouldConfirmCompanyName:
      !tenant.companyNameConfirmedAt && Boolean(tenant.ownerDocument || tenant.ownerWhatsapp),
  };
}

export async function confirmTenantCompanyName(slug: string, companyName: string) {
  await ensurePlatformTenantProfileColumns();
  const parsed = z.string().trim().min(2, "Informe o nome da empresa").max(120).parse(companyName);
  const platformPrisma = getPlatformPrisma();
  const normalizedSlug = normalizeTenantSlug(slug);
  const tenant = await platformPrisma.platformTenant.findUnique({
    where: { slug: normalizedSlug },
    select: { id: true, slug: true },
  });

  if (!tenant) {
    throw new Error("Cliente nao encontrado.");
  }

  const updated = await platformPrisma.platformTenant.update({
    where: { id: tenant.id },
    data: {
      name: parsed,
      companyNameConfirmedAt: new Date(),
    },
    select: {
      name: true,
      slug: true,
    },
  });

  try {
    const tenantPrisma = await getTenantPrismaClientBySlug(tenant.slug);
    await tenantPrisma.platformTenant.updateMany({
      where: { id: tenant.id },
      data: { name: parsed },
    });
  } catch {
    // A confirmacao central ja foi salva; a copia local sera ajustada quando o banco do cliente estiver disponivel.
  }

  return updated;
}

export async function getTenantCustomLinkState(slug: string) {
  await ensurePlatformTenantProfileColumns();
  const tenant = await getPlatformPrisma().platformTenant.findUnique({
    where: { slug: normalizeTenantSlug(slug) },
    select: {
      slug: true,
      customSlugUpdatedAt: true,
    },
  });

  if (!tenant) {
    throw new Error("Cliente nao encontrado.");
  }

  return tenant;
}

export async function checkTenantSlugAvailability(currentSlug: string, nextSlug: string) {
  await ensurePlatformTenantProfileColumns();
  const normalizedCurrentSlug = normalizeTenantSlug(currentSlug);
  const normalizedNextSlug = normalizeTenantSlug(nextSlug);

  if (normalizedNextSlug.length < 2) {
    return {
      slug: normalizedNextSlug,
      available: false,
      message: "Digite pelo menos 2 caracteres.",
    };
  }

  const platformPrisma = getPlatformPrisma();
  const [currentTenant, existingTenant] = await Promise.all([
    platformPrisma.platformTenant.findUnique({
      where: { slug: normalizedCurrentSlug },
      select: { id: true },
    }),
    platformPrisma.platformTenant.findUnique({
      where: { slug: normalizedNextSlug },
      select: { id: true },
    }),
  ]);

  if (!currentTenant) {
    throw new Error("Cliente nao encontrado.");
  }

  if (existingTenant && existingTenant.id !== currentTenant.id) {
    return {
      slug: normalizedNextSlug,
      available: false,
      message: "Esse link ja esta em uso.",
    };
  }

  return {
    slug: normalizedNextSlug,
    available: true,
    message: "Link disponivel.",
  };
}

export async function updateTenantCustomSlug(currentSlug: string, nextSlug: string) {
  await ensurePlatformTenantProfileColumns();
  const normalizedCurrentSlug = normalizeTenantSlug(currentSlug);
  const normalizedNextSlug = normalizeTenantSlug(nextSlug);

  if (normalizedNextSlug.length < 2 || normalizedNextSlug.length > 48) {
    throw new Error("Informe um link valido.");
  }

  const platformPrisma = getPlatformPrisma();
  const currentTenant = await platformPrisma.platformTenant.findUnique({
    where: { slug: normalizedCurrentSlug },
    select: {
      id: true,
      slug: true,
      status: true,
    },
  });

  if (!currentTenant) {
    throw new Error("Cliente nao encontrado.");
  }

  if (currentTenant.status !== PlatformTenantStatus.ACTIVE) {
    throw new Error("Cliente precisa estar ativo para alterar o link.");
  }

  const availability = await checkTenantSlugAvailability(currentTenant.slug, normalizedNextSlug);
  if (!availability.available) {
    throw new Error(availability.message);
  }

  if (currentTenant.slug === normalizedNextSlug) {
    return {
      slug: normalizedNextSlug,
      changed: false,
    };
  }

  const tenantPrisma = await getTenantPrismaClientBySlug(currentTenant.slug);
  const updated = await platformPrisma.platformTenant.update({
    where: { id: currentTenant.id },
    data: {
      slug: normalizedNextSlug,
      customSlugUpdatedAt: new Date(),
    },
    select: {
      slug: true,
    },
  });

  try {
    await tenantPrisma.platformTenant.updateMany({
      where: { id: currentTenant.id },
      data: { slug: normalizedNextSlug },
    });
  } catch {
    // O login ja usa a tabela central; a copia local nao pode bloquear o link novo.
  }

  return {
    slug: updated.slug,
    changed: true,
  };
}

"use server";

import bcrypt from "bcryptjs";
import { RecordStatus } from "@prisma/client";
import { z } from "zod";

import {
  findLoginTenantAccessBySlug,
  findLoginTenantAccessesByEmail,
  getActiveTenantBySlug,
  normalizeTenantSlug,
} from "@/application/platform/platform-service";
import { getTenantPrismaClientBySlug } from "@/lib/prisma";

const DEFAULT_WORKSPACE_SLUG =
  process.env.DEFAULT_WORKSPACE_SLUG ?? process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_SLUG ?? "xp-arcade";

const loginTenantResolutionSchema = z.object({
  email: z.string().trim().email("Digite um email valido").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Digite sua senha"),
  preferredWorkspace: z.string().trim().optional(),
});

export type LoginTenantChoice = {
  slug: string;
  name: string;
};

export type LoginTenantResolutionState = {
  status: "success" | "error";
  message?: string;
  tenants?: LoginTenantChoice[];
};

function getOptionalString(input: FormData, key: string) {
  const value = input.get(key);
  return typeof value === "string" ? value : undefined;
}

async function isTenantPasswordValid(slug: string, email: string, password: string) {
  const tenantPrisma = await getTenantPrismaClientBySlug(slug);
  const user = await tenantPrisma.user.findUnique({
    where: { email },
    select: {
      passwordHash: true,
      status: true,
    },
  });

  if (!user || user.status !== RecordStatus.ACTIVE) {
    return false;
  }

  return bcrypt.compare(password, user.passwordHash);
}

async function addTenantChoiceIfPasswordMatches(
  choices: Map<string, LoginTenantChoice>,
  slug: string,
  email: string,
  password: string,
) {
  const normalizedSlug = normalizeTenantSlug(slug);

  if (!normalizedSlug || choices.has(normalizedSlug)) {
    return;
  }

  try {
    const passwordMatches = await isTenantPasswordValid(normalizedSlug, email, password);

    if (!passwordMatches) {
      return;
    }

    const tenant = await getActiveTenantBySlug(normalizedSlug);

    choices.set(normalizedSlug, {
      slug: normalizedSlug,
      name: tenant?.name ?? normalizedSlug,
    });
  } catch {
    // Um PDV indisponivel nao deve impedir o usuario de acessar outro PDV valido.
  }
}

export async function resolveLoginTenantsAction(formData: FormData): Promise<LoginTenantResolutionState> {
  const parsed = loginTenantResolutionSchema.safeParse({
    email: getOptionalString(formData, "email"),
    password: getOptionalString(formData, "password"),
    preferredWorkspace: getOptionalString(formData, "preferredWorkspace"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Dados invalidos.",
    };
  }

  const preferredWorkspace = parsed.data.preferredWorkspace
    ? normalizeTenantSlug(parsed.data.preferredWorkspace)
    : "";
  const accesses = preferredWorkspace
    ? [await findLoginTenantAccessBySlug(preferredWorkspace, parsed.data.email)].filter(Boolean)
    : await findLoginTenantAccessesByEmail(parsed.data.email);

  const validTenants = new Map<string, LoginTenantChoice>();

  for (const access of accesses) {
    if (!access?.tenant?.slug) {
      continue;
    }

    try {
      const passwordMatches = await isTenantPasswordValid(
        access.tenant.slug,
        parsed.data.email,
        parsed.data.password,
      );

      if (passwordMatches) {
        validTenants.set(access.tenant.slug, {
          slug: access.tenant.slug,
          name: access.tenant.name,
        });
      }
    } catch {
      // Um PDV indisponivel nao deve impedir o usuario de acessar outro PDV valido.
    }
  }

  await addTenantChoiceIfPasswordMatches(
    validTenants,
    preferredWorkspace || DEFAULT_WORKSPACE_SLUG,
    parsed.data.email,
    parsed.data.password,
  );

  const tenants = Array.from(validTenants.values());

  if (tenants.length === 0) {
    return {
      status: "error",
      message: "Credenciais invalidas ou usuario sem acesso.",
    };
  }

  return {
    status: "success",
    tenants,
  };
}

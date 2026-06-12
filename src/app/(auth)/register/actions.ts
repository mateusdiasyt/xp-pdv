"use server";

import { ZodError } from "zod";

import { buildTenantAdminPath, registerPlatformTenant } from "@/application/platform/platform-service";

export type RegisterTenantState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectUrl?: string;
  tenantSlug?: string;
};

export async function registerTenantAction(
  previousStateOrFormData: RegisterTenantState | FormData,
  maybeFormData?: FormData,
): Promise<RegisterTenantState> {
  const formData = maybeFormData ?? (previousStateOrFormData as FormData);

  try {
    const tenant = await registerPlatformTenant(formData);

    return {
      status: "success",
      message: "Cadastro criado. Abrindo seu painel para ativar o plano.",
      redirectUrl: buildTenantAdminPath(tenant.slug, "/admin/payment"),
      tenantSlug: tenant.slug,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof ZodError
          ? error.issues[0]?.message ?? "Dados invalidos."
          : error instanceof Error
            ? error.message
            : "Nao foi possivel criar a conta.",
    };
  }
}

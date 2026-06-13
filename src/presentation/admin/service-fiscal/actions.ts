"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { getTenantModuleEntitlements } from "@/application/platform/platform-service";
import { createServiceFiscalDeclarationRecord } from "@/application/service-fiscal/service-fiscal-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { canUsePlatformModule } from "@/domain/platform/plan-entitlements";

export async function declareServiceNfseAction(formData: FormData): Promise<void> {
  const session = await requirePermission(PERMISSIONS.SERVICE_FISCAL_MANAGE);
  const entitlements = await getTenantModuleEntitlements(session.user.tenantSlug);

  if (!canUsePlatformModule(entitlements, "fiscal-focus")) {
    throw new Error("Plugin fiscal disponivel apenas no Plano Platina ativo.");
  }

  await createServiceFiscalDeclarationRecord(formData, session.user.id);

  revalidatePath("/admin/service-fiscal");
  revalidatePath("/admin/fiscal");
  revalidatePath("/admin/reports");
}

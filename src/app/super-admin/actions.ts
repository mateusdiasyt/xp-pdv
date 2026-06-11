"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/application/platform/platform-guards";
import { updatePlatformGatewayConfiguration } from "@/application/platform/gateway-service";
import {
  approvePlatformTenant,
  reactivatePlatformTenant,
  suspendPlatformTenant,
  updatePlatformTenantPlan,
} from "@/application/platform/platform-service";

export async function approveTenantAction(formData: FormData) {
  await requirePlatformAdmin();

  const tenantId = String(formData.get("tenantId") ?? "");

  if (!tenantId) {
    throw new Error("Cliente invalido.");
  }

  await approvePlatformTenant(tenantId);
  revalidatePath("/super-admin");
}

export async function suspendTenantAction(formData: FormData) {
  await requirePlatformAdmin();

  const tenantId = String(formData.get("tenantId") ?? "");

  if (!tenantId) {
    throw new Error("Cliente invalido.");
  }

  await suspendPlatformTenant(tenantId);
  revalidatePath("/super-admin");
}

export async function reactivateTenantAction(formData: FormData) {
  await requirePlatformAdmin();

  const tenantId = String(formData.get("tenantId") ?? "");

  if (!tenantId) {
    throw new Error("Cliente invalido.");
  }

  await reactivatePlatformTenant(tenantId);
  revalidatePath("/super-admin");
}

export async function updateTenantPlanAction(formData: FormData) {
  await requirePlatformAdmin();
  await updatePlatformTenantPlan(formData);
  revalidatePath("/super-admin");
}

export async function updateGatewayConfigurationAction(formData: FormData) {
  const session = await requirePlatformAdmin();
  const actorName = session.user.name ?? session.user.email ?? "Super admin";

  await updatePlatformGatewayConfiguration(formData, {
    id: session.user.id,
    name: actorName,
  });

  revalidatePath("/super-admin");
}

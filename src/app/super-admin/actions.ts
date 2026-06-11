"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/application/platform/platform-guards";
import {
  approvePlatformTenant,
  reactivatePlatformTenant,
  suspendPlatformTenant,
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

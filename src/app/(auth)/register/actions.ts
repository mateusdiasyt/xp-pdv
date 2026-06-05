"use server";

import { redirect } from "next/navigation";

import { registerPlatformTenant } from "@/application/platform/platform-service";

export type RegisterTenantState = {
  status: "idle" | "error";
  message?: string;
};

export async function registerTenantAction(
  _previousState: RegisterTenantState,
  formData: FormData,
): Promise<RegisterTenantState> {
  try {
    const tenant = await registerPlatformTenant(formData);
    redirect(`/login?workspace=${tenant.slug}&registered=1`);
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Nao foi possivel criar a conta.",
    };
  }
}

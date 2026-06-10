"use server";

import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { registerPlatformTenant } from "@/application/platform/platform-service";

export type RegisterTenantState = {
  status: "idle" | "error";
  message?: string;
};

export async function registerTenantAction(
  _previousState: RegisterTenantState,
  formData: FormData,
): Promise<RegisterTenantState> {
  let registered = false;

  try {
    await registerPlatformTenant(formData);
    registered = true;
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

  if (registered) {
    redirect("/login?registered=1");
  }

  return {
    status: "idle",
  };
}

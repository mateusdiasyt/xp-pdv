"use server";

import { ZodError } from "zod";

import { createPlatformSubscriptionCheckout } from "@/application/platform/mercado-pago-billing-service";
import { registerPlatformTenant } from "@/application/platform/platform-service";
import {
  normalizePlatformBillingCycle,
  normalizePlatformPlanName,
} from "@/domain/platform/billing-plans";

export type RegisterTenantState = {
  status: "idle" | "success" | "error";
  message?: string;
  redirectUrl?: string;
};

export async function registerTenantAction(
  previousStateOrFormData: RegisterTenantState | FormData,
  maybeFormData?: FormData,
): Promise<RegisterTenantState> {
  const formData = maybeFormData ?? (previousStateOrFormData as FormData);

  try {
    const tenant = await registerPlatformTenant(formData);
    const checkout = await createPlatformSubscriptionCheckout({
      tenantId: tenant.id,
      planName: normalizePlatformPlanName(formData.get("planName") ?? "Ouro"),
      billingCycleMonths: normalizePlatformBillingCycle(formData.get("billingCycleMonths") ?? "1"),
    });

    return {
      status: "success",
      message: "Cadastro criado. Abrindo pagamento seguro do Mercado Pago.",
      redirectUrl: checkout.initPoint,
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

"use server";

import {
  createPlatformSubscriptionCheckout,
  getTenantPaymentPortalState,
} from "@/application/platform/mercado-pago-billing-service";
import {
  normalizePlatformBillingCycle,
  normalizePlatformPlanName,
} from "@/domain/platform/billing-plans";
import { getServerAuthSession } from "@/lib/auth";
import { toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function createCurrentTenantPaymentCheckoutAction(
  prevStateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState & { redirectUrl?: string }> {
  const formData = maybeFormData ?? (prevStateOrFormData as FormData);

  try {
    const session = await getServerAuthSession();

    if (!session?.user || session.user.accessScope === "platform") {
      throw new Error("Acesse com a conta do cliente para continuar.");
    }

    const portalState = await getTenantPaymentPortalState(session.user.tenantSlug);

    if (!portalState) {
      throw new Error("Conta nao encontrada.");
    }

    const checkout = await createPlatformSubscriptionCheckout({
      tenantId: portalState.tenantId,
      planName: normalizePlatformPlanName(formData.get("planName") ?? portalState.planName ?? "Ouro"),
      billingCycleMonths: normalizePlatformBillingCycle(formData.get("billingCycleMonths") ?? "1"),
    });

    return {
      status: "success",
      message: "Pagamento criado.",
      redirectUrl: checkout.initPoint,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

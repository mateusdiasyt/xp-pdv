"use server";

import { createPlatformSubscriptionCheckoutFromForm } from "@/application/platform/mercado-pago-billing-service";
import {
  authenticatePlatformSeller,
  clearPlatformSellerSession,
  requirePlatformSeller,
} from "@/application/platform/seller-service";
import { toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

export async function sellerLoginAction(
  prevStateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = maybeFormData ?? (prevStateOrFormData as FormData);

  try {
    await authenticatePlatformSeller(formData);

    return {
      status: "success",
      message: "Login realizado.",
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function sellerSignOutAction(): Promise<ActionState> {
  await clearPlatformSellerSession();

  return {
    status: "success",
    message: "Sessao encerrada.",
  };
}

export async function createSellerSubscriptionCheckoutAction(
  prevStateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState & { redirectUrl?: string }> {
  const formData = maybeFormData ?? (prevStateOrFormData as FormData);

  try {
    const seller = await requirePlatformSeller();
    const checkoutFormData = new FormData();

    checkoutFormData.set("tenantId", String(formData.get("tenantId") ?? ""));
    checkoutFormData.set("planName", String(formData.get("planName") ?? ""));
    checkoutFormData.set("billingCycleMonths", String(formData.get("billingCycleMonths") ?? ""));
    checkoutFormData.set("sellerId", seller.id);

    const checkout = await createPlatformSubscriptionCheckoutFromForm(checkoutFormData);

    return {
      status: "success",
      message: "Link de pagamento criado.",
      redirectUrl: checkout.initPoint,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

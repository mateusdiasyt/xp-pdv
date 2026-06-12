"use server";

import {
  activateLatestAuthorizedPlatformSubscription,
  createPlatformSubscriptionAuthorization,
  createPlatformSubscriptionCheckout,
  getTenantPaymentPortalState,
} from "@/application/platform/mercado-pago-billing-service";
import { buildTenantAdminPath } from "@/application/platform/platform-service";
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
      throw new Error("Conta não encontrada.");
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

export async function authorizeCurrentTenantPaymentAction(
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
      throw new Error("Conta não encontrada.");
    }

    const checkout = await createPlatformSubscriptionAuthorization({
      tenantId: portalState.tenantId,
      planName: normalizePlatformPlanName(formData.get("planName") ?? portalState.planName ?? "Ouro"),
      billingCycleMonths: normalizePlatformBillingCycle(formData.get("billingCycleMonths") ?? "1"),
      cardTokenId: String(formData.get("cardTokenId") ?? ""),
    });

    if (checkout.status !== "authorized" && checkout.status !== "active") {
      return {
        status: "error",
        message: `Mercado Pago retornou status ${checkout.status}. Revise os dados do cartão.`,
      };
    }

    return {
      status: "success",
      message: "Pagamento confirmado. Entre novamente para abrir o painel.",
      redirectUrl: `/login?activated=1&callbackUrl=${encodeURIComponent(buildTenantAdminPath(session.user.tenantSlug))}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function activateCurrentTenantPaidPlanAction(): Promise<ActionState & { redirectUrl?: string }> {
  try {
    const session = await getServerAuthSession();

    if (!session?.user || session.user.accessScope === "platform") {
      throw new Error("Acesse com a conta do cliente para continuar.");
    }

    const portalState = await getTenantPaymentPortalState(session.user.tenantSlug);

    if (!portalState) {
      throw new Error("Conta não encontrada.");
    }

    await activateLatestAuthorizedPlatformSubscription(portalState.tenantId);

    return {
      status: "success",
      message: "Painel liberado. Entre novamente para atualizar o acesso.",
      redirectUrl: `/login?activated=1&callbackUrl=${encodeURIComponent(buildTenantAdminPath(session.user.tenantSlug))}`,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

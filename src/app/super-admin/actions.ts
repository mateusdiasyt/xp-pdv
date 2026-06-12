"use server";

import { revalidatePath } from "next/cache";

import { requirePlatformAdmin } from "@/application/platform/platform-guards";
import {
  createPlatformSellerFromForm,
  updatePlatformSellerStatusFromForm,
} from "@/application/platform/seller-service";
import { updatePlatformGatewayConfiguration } from "@/application/platform/gateway-service";
import { createPlatformSubscriptionCheckoutFromForm } from "@/application/platform/mercado-pago-billing-service";
import {
  approvePlatformTenant,
  reactivatePlatformTenant,
  removePlatformTenantPlan,
  suspendPlatformTenant,
  updatePlatformTenantPlan,
} from "@/application/platform/platform-service";
import { toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

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

export async function removeTenantPlanAction(formData: FormData) {
  await requirePlatformAdmin();

  const tenantId = String(formData.get("tenantId") ?? "");

  if (!tenantId) {
    throw new Error("Cliente invalido.");
  }

  await removePlatformTenantPlan(tenantId);
  revalidatePath("/super-admin");
}

export async function createTenantSubscriptionCheckoutAction(
  prevStateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState & { redirectUrl?: string }> {
  const formData = maybeFormData ?? (prevStateOrFormData as FormData);

  try {
    await requirePlatformAdmin();
    const checkout = await createPlatformSubscriptionCheckoutFromForm(formData);

    revalidatePath("/super-admin");

    return {
      status: "success",
      message: "Link de assinatura criado.",
      redirectUrl: checkout.initPoint,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function createPlatformSellerAction(
  prevStateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = maybeFormData ?? (prevStateOrFormData as FormData);

  try {
    await requirePlatformAdmin();
    await createPlatformSellerFromForm(formData);

    revalidatePath("/super-admin");

    return {
      status: "success",
      message: "Vendedor criado.",
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function updatePlatformSellerStatusAction(formData: FormData) {
  await requirePlatformAdmin();
  await updatePlatformSellerStatusFromForm(formData);
  revalidatePath("/super-admin");
}

export async function updateGatewayConfigurationAction(
  prevStateOrFormData: ActionState | FormData,
  maybeFormData?: FormData,
): Promise<ActionState> {
  const formData = maybeFormData ?? (prevStateOrFormData as FormData);

  try {
    const session = await requirePlatformAdmin();
    const actorName = session.user.name ?? session.user.email ?? "Super admin";

    await updatePlatformGatewayConfiguration(formData, {
      id: session.user.id,
      name: actorName,
    });

    revalidatePath("/super-admin");

    return {
      status: "success",
      message: "Gateway salvo com sucesso.",
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

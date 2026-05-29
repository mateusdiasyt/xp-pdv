"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import {
  endManualGameplayStation,
  extendManualGameplayStation,
  releaseManualGameplayStation,
  triggerGameplayReleaseForSale,
} from "@/application/gameplay/gameplay-release-service";
import { createSaleRecord } from "@/application/pdv/pdv-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

function getOperatorName(user: { name?: string | null; email?: string | null }) {
  return user.name?.trim() || user.email?.trim() || "Administrador Sistema";
}

export async function retryGameplayReleaseAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const saleId = String(formData.get("saleId") ?? "");
    if (!saleId) {
      throw new Error("Venda obrigatoria para reenviar a liberacao.");
    }

    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await triggerGameplayReleaseForSale(saleId, session.user.id);

    revalidatePath("/admin/pdv");

    return {
      status: result.status === "LIBERADA" ? "success" : "error",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function manualServiceReleaseAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const durationPreset = String(formData.get("durationPreset") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await releaseManualGameplayStation({
      stationId,
      durationPreset,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function extendServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const durationPreset = String(formData.get("durationPreset") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await extendManualGameplayStation({
      stationId,
      durationPreset,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function paidServiceReleaseAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const isExtension = formData.get("extendActiveSession") === "true";
    if (isExtension) {
      formData.set("skipGameplayRelease", "true");
    }

    const result = await createSaleRecord(formData, session.user.id);
    const extensionResult = isExtension
      ? await extendManualGameplayStation({
          stationId: String(formData.get("stationId") ?? ""),
          durationPreset: String(formData.get("durationPreset") ?? ""),
          actorId: session.user.id,
          operator: getOperatorName(session.user),
          saleId: result.saleId,
        })
      : null;

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: extensionResult?.message || result.gameplayMessage || "Venda registrada e serviço liberado.",
      data: {
        saleId: result.saleId,
      },
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

export async function endServiceSessionAction(
  prevState: ActionState = initialActionState,
  formData: FormData,
): Promise<ActionState> {
  void prevState;

  try {
    const stationId = String(formData.get("stationId") ?? "");
    const session = await requirePermission(PERMISSIONS.PDV_MANAGE);
    const result = await endManualGameplayStation({
      stationId,
      actorId: session.user.id,
      operator: getOperatorName(session.user),
    });

    revalidatePath("/admin/services");
    revalidatePath("/admin/pdv");

    return {
      status: "success",
      message: result.message,
    };
  } catch (error) {
    return {
      status: "error",
      message: toActionErrorMessage(error),
    };
  }
}

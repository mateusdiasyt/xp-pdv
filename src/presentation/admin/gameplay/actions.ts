"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/application/auth/guards";
import { triggerGameplayReleaseForSale } from "@/application/gameplay/gameplay-release-service";
import { PERMISSIONS } from "@/domain/auth/permissions";
import { initialActionState, toActionErrorMessage, type ActionState } from "@/presentation/admin/common/action-state";

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

    revalidatePath("/admin/gameplay");
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
